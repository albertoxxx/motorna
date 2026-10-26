/**
 * Seller verification: phone by SMS code (provider mocked) and vehicle licence review.
 * Session and SMS are mocked; DB, private storage (local driver), routes and rules are real.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";

type U = { id: string; name: string; email: string; role: "user" | "dealer" | "admin"; suspended: boolean };
let current: U | null = null;
vi.mock("@/server/session", () => ({ getCurrentUser: async () => current, requireUser: async () => current, requireAdmin: async () => current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
let smsOn = true;
const sms: { to: string; text: string }[] = [];
vi.mock("@/lib/sms", () => ({
  smsDeliveryAvailable: () => smsOn,
  sendSms: async (to: string, text: string) => { sms.push({ to, text }); return { sent: true }; },
}));

const { db, schema } = await import("@/db");
const v = await import("@/server/actions/verification");
const profile = await import("@/server/actions/profile");
const queries = await import("@/server/verification");
const { listingsByIds } = await import("@/server/listings");
const { phoneVerified, licenceState } = await import("@/lib/verification");
const upload = await import("@/app/api/listings/[id]/licence/route");
const view = await import("@/app/api/licence/[id]/[side]/route");

const as = (u: U | null) => { current = u; };
async function user(name: string, role: U["role"] = "user", phone: string | null = null): Promise<U> {
  const id = crypto.randomUUID();
  const email = `${name}-${id.slice(0, 6)}@verify.test`;
  await db.insert(schema.users).values({ id, name, email, role, phone });
  return { id, name, email, role, suspended: false };
}
let admin: U, stranger: U, model: { id: number; makeId: number }, otherModel: { id: number; makeId: number };
async function listing(seller: U, status: "published" | "draft" = "published") {
  const [l] = await db
    .insert(schema.listings)
    .values({ slug: `vf-${crypto.randomUUID().slice(0, 8)}`, sellerId: seller.id, makeId: model.makeId, modelId: model.id, year: 2020, mileageKm: 50000, priceEgp: 900000, transmission: "automatic", fuelType: "petrol", title: "Verify test car", cityId: 2, status, publishedAt: status === "published" ? new Date() : null })
    .returning();
  return l;
}
const png = () => sharp({ create: { width: 800, height: 500, channels: 3, background: "#cdd" } }).png().toBuffer();
async function post(listingId: string, files: { front?: Buffer; back?: Buffer }) {
  const fd = new FormData();
  if (files.front) fd.set("front", new File([new Uint8Array(files.front)], "front.png", { type: "image/png" }));
  if (files.back) fd.set("back", new File([new Uint8Array(files.back)], "back.png", { type: "image/png" }));
  const res = await upload.POST(new Request("http://x/api", { method: "POST", body: fd }), { params: Promise.resolve({ id: listingId }) } as never);
  return { status: res.status, body: (await res.json()) as { ok: boolean; id?: string; error?: string } };
}
const get = (id: string, side: string) => view.GET(new Request("http://x"), { params: Promise.resolve({ id, side }) } as never);

beforeAll(async () => {
  admin = await user("admin", "admin");
  stranger = await user("stranger");
  const ms = await db.select({ id: schema.vehicleModels.id, makeId: schema.vehicleModels.makeId }).from(schema.vehicleModels).limit(50);
  model = ms[0];
  otherModel = ms.find((m) => m.makeId === model.makeId && m.id !== model.id) ?? ms[1];
});

describe("pure rules", () => {
  it("phone counts only while the verified number is the profile number", () => {
    const at = new Date();
    expect(phoneVerified({ phone: "01012345678", phoneVerifiedAt: at, phoneVerifiedNumber: "01012345678" })).toBe(true);
    expect(phoneVerified({ phone: "01099999999", phoneVerifiedAt: at, phoneVerifiedNumber: "01012345678" })).toBe(false);
    expect(phoneVerified({ phone: "01012345678", phoneVerifiedAt: null, phoneVerifiedNumber: null })).toBe(false);
  });
  it("licence badge needs an accepted, unexpired check matching make/model/year", () => {
    const l = { makeId: 1, modelId: 5, year: 2020 };
    const c = { status: "accepted" as const, snapshotMakeId: 1, snapshotModelId: 5, snapshotYear: 2020, licenceExpiresAt: null, reviewedAt: new Date() };
    expect(licenceState(l, [c]).state).toBe("verified");
    expect(licenceState({ ...l, year: 2021 }, [c]).state).toBe("none");
    expect(licenceState(l, [{ ...c, licenceExpiresAt: new Date(Date.now() - 1000) }]).state).toBe("none");
    expect(licenceState(l, [{ ...c, status: "pending" }]).state).toBe("pending");
    expect(licenceState(l, [{ ...c, status: "rejected" }]).state).toBe("none");
  });
});

describe("phone verification", () => {
  it("is refused when no SMS provider is configured", async () => {
    smsOn = false;
    as(await user("nosms", "user", "01011112222"));
    expect(await v.requestPhoneCode()).toMatchObject({ ok: false, error: "smsUnavailable" });
    smsOn = true;
  });

  it("sends a code, rejects wrong codes, locks after 5, accepts the right one", async () => {
    const u = await user("phone", "user", "01011113333");
    as(u);
    expect((await v.requestPhoneCode()).ok).toBe(true);
    const code = sms.at(-1)!.text.match(/\d{6}/)![0];
    expect(sms.at(-1)!.to).toBe("01011113333");
    const [row] = await db.select().from(schema.phoneVerifications).where(eq(schema.phoneVerifications.userId, u.id));
    expect(row.codeHash).not.toContain(code); // only a hash is stored
    expect(await v.requestPhoneCode()).toMatchObject({ ok: false, error: "rateLimited" }); // resend cooldown
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await v.confirmPhoneCode(wrong)).toMatchObject({ ok: false, error: "codeInvalid" });
    expect((await v.confirmPhoneCode(code)).ok).toBe(true);
    const [me] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(phoneVerified(me)).toBe(true);
    // A used code can't be reused.
    expect(await v.confirmPhoneCode(code)).toMatchObject({ ok: false, error: "codeInvalid" });
  });

  it("five wrong attempts lock the code", async () => {
    const u = await user("lock", "user", "01011114444");
    as(u);
    await v.requestPhoneCode();
    const code = sms.at(-1)!.text.match(/\d{6}/)![0];
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await v.confirmPhoneCode(wrong);
    expect(await v.confirmPhoneCode(code)).toMatchObject({ ok: false, error: "codeInvalid" });
  });

  it("changing the profile number voids the verification", async () => {
    const u = await user("change", "user", "01011115555");
    as(u);
    await v.requestPhoneCode();
    await v.confirmPhoneCode(sms.at(-1)!.text.match(/\d{6}/)![0]);
    expect((await profile.updateProfile({ name: "change", phone: "01011115555", showPhone: false, cityId: "", locale: "ar" })).ok).toBe(true);
    let [me] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(phoneVerified(me)).toBe(true);
    expect((await profile.updateProfile({ name: "change", phone: "01011116666", showPhone: false, cityId: "", locale: "ar" })).ok).toBe(true);
    [me] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(phoneVerified(me)).toBe(false);
    expect(me.phoneVerifiedAt).toBeNull();
  });
});

describe("vehicle licence", () => {
  it("owner uploads privately; one pending at a time; strangers can't upload or view", async () => {
    const seller = await user("seller");
    const l = await listing(seller);
    as(stranger);
    expect((await post(l.id, { front: await png() })).status).toBe(404);
    as(null);
    expect((await post(l.id, { front: await png() })).status).toBe(401);
    as(seller);
    expect((await post(l.id, {})).status).toBe(400);
    const r = await post(l.id, { front: await png(), back: await png() });
    expect(r).toMatchObject({ status: 200, body: { ok: true } });
    expect((await post(l.id, { front: await png() })).body.error).toBe("licencePending");
    expect((await get(r.body.id!, "front")).status).toBe(200);
    expect((await get(r.body.id!, "back")).headers.get("cache-control")).toContain("no-store");
    as(stranger);
    expect((await get(r.body.id!, "front")).status).toBe(403);
    as(null);
    expect((await get(r.body.id!, "front")).status).toBe(401);
    as(admin);
    expect((await get(r.body.id!, "front")).status).toBe(200);
    expect((await queries.listingTrust({ ...l })).licence.state).toBe("pending");
  });

  it("admin review: accept gives the badge; sellers can't review; reject needs a note", async () => {
    const seller = await user("seller2");
    const l = await listing(seller);
    as(seller);
    const { body } = await post(l.id, { front: await png() });
    expect(await v.reviewLicence(body.id!, { decision: "accept" })).toMatchObject({ ok: false, error: "forbidden" });
    as(admin);
    expect(await v.reviewLicence(body.id!, { decision: "reject", note: "no" })).toMatchObject({ ok: false, error: "validation" });
    expect(await v.reviewLicence(body.id!, { decision: "accept", expiresAt: "2000-01-01" })).toMatchObject({ ok: false, error: "licenceExpired" });
    expect((await v.reviewLicence(body.id!, { decision: "accept", expiresAt: "2099-01-01" })).ok).toBe(true);
    expect(await v.reviewLicence(body.id!, { decision: "reject", note: "Changed my mind" })).toMatchObject({ ok: false, error: "notFound" });
    expect((await queries.listingTrust({ ...l })).licence.state).toBe("verified");
    const [card] = await listingsByIds([l.id]);
    expect(card.licenceVerified).toBe(true);
    const notes = await db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, seller.id), eq(schema.notifications.kind, "licence_accepted")));
    expect(notes).toHaveLength(1);
    // Changing the car's model removes the badge until reviewed again.
    await db.update(schema.listings).set({ modelId: otherModel.id, makeId: otherModel.makeId }).where(eq(schema.listings.id, l.id));
    const [moved] = await db.select().from(schema.listings).where(eq(schema.listings.id, l.id));
    expect((await queries.listingTrust(moved)).licence.state).toBe("none");
    expect((await listingsByIds([l.id]))[0].licenceVerified).toBe(false);
  });

  it("an admin can't review their own listing's licence; rejection reaches the seller", async () => {
    const l = await listing(admin);
    as(admin);
    const { body } = await post(l.id, { front: await png() });
    expect(await v.reviewLicence(body.id!, { decision: "accept" })).toMatchObject({ ok: false, error: "conflictOfInterest" });
    const seller = await user("seller3");
    const l2 = await listing(seller);
    as(seller);
    const r2 = await post(l2.id, { front: await png() });
    as(admin);
    expect((await v.reviewLicence(r2.body.id!, { decision: "reject", note: "Photo is blurry" })).ok).toBe(true);
    const [n] = await db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, seller.id), eq(schema.notifications.kind, "licence_rejected")));
    expect(n.data).toMatchObject({ reason: "Photo is blurry" });
  });

  it("withdraw deletes a pending licence; files are purged 30 days after review", async () => {
    const seller = await user("seller4");
    const l = await listing(seller);
    as(seller);
    const a = await post(l.id, { front: await png() });
    as(stranger);
    expect(await v.withdrawLicence(a.body.id!)).toMatchObject({ ok: false, error: "notFound" });
    as(seller);
    expect((await v.withdrawLicence(a.body.id!)).ok).toBe(true);
    expect(await queries.licenceChecksFor(l.id)).toHaveLength(0);
    const b = await post(l.id, { front: await png() });
    as(admin);
    await v.reviewLicence(b.body.id!, { decision: "accept" });
    expect(await queries.purgeLicenceFiles()).toBe(0);
    expect(await queries.purgeLicenceFiles(new Date(Date.now() + 31 * 86_400_000))).toBeGreaterThanOrEqual(1);
    const [row] = await queries.licenceChecksFor(l.id);
    expect(row).toMatchObject({ frontKey: null, status: "accepted" });
    expect(row.filesPurgedAt).not.toBeNull();
    expect((await get(b.body.id!, "front")).status).toBe(404);
    // The decision record (and the badge) remain after the files are gone.
    expect((await queries.listingTrust({ ...l })).licence.state).toBe("verified");
  });
});
