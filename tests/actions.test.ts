/**
 * Integration tests: server actions against a real Postgres test database.
 * The session is mocked so we can act as different users; everything else
 * (validation, ownership, state machine, constraints, rate limits) is real.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

type U = { id: string; name: string; email: string; role: "user" | "dealer" | "admin"; suspended: boolean };
let current: U | null = null;

vi.mock("@/server/session", () => ({
  getCurrentUser: async () => current,
  requireUser: async () => current,
  requireAdmin: async () => current,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { db, schema } = await import("@/db");
const listings = await import("@/server/actions/listings");
const engagement = await import("@/server/actions/engagement");
const admin = await import("@/server/actions/admin");
const { rateLimit } = await import("@/server/rate-limit");

const users: Record<"seller" | "buyer" | "other" | "admin", U> = {} as never;

async function makeUser(key: keyof typeof users, role: U["role"] = "user") {
  const id = crypto.randomUUID();
  await db.insert(schema.users).values({ id, name: key, email: `${key}-${id.slice(0, 6)}@test.local`, role });
  users[key] = { id, name: key, email: `${key}@test.local`, role, suspended: false };
}

let corolla: { makeId: number; modelId: number };
let kiaModelId: number;

const input = () => ({
  makeId: String(corolla.makeId),
  modelId: String(corolla.modelId),
  year: "2020",
  mileageKm: "50000",
  priceEgp: "900000",
  negotiable: true,
  condition: "used",
  transmission: "automatic",
  fuelType: "petrol",
  cityId: "1",
  title: "Toyota Corolla 2020",
  description: "Well maintained, agency service history, no accidents. Selling because I'm travelling.",
});

async function addImages(listingId: string, n: number) {
  await db.insert(schema.listingImages).values(
    Array.from({ length: n }, (_, i) => ({
      listingId,
      storageKey: `listings/${listingId}/${i}.webp`,
      thumbKey: `listings/${listingId}/${i}_t.webp`,
      width: 1200,
      height: 800,
      bytes: 1000,
      position: i,
    })),
  );
}

async function publishedListing() {
  current = users.seller;
  const r = await listings.saveListing(null, input(), "draft");
  if (!r.ok) throw new Error(r.error);
  await addImages(r.data.id, 3);
  await listings.changeListingStatus(r.data.id, "submit");
  current = users.admin;
  await admin.moderateListing(r.data.id, "approve");
  return r.data.id;
}

beforeAll(async () => {
  await makeUser("seller");
  await makeUser("buyer");
  await makeUser("other");
  await makeUser("admin", "admin");
  const [m] = await db
    .select({ makeId: schema.vehicleModels.makeId, modelId: schema.vehicleModels.id })
    .from(schema.vehicleModels)
    .innerJoin(schema.vehicleMakes, eq(schema.vehicleMakes.id, schema.vehicleModels.makeId))
    .where(sql`${schema.vehicleMakes.slug} = 'toyota' AND ${schema.vehicleModels.slug} = 'corolla'`);
  corolla = m;
  const [k] = await db
    .select({ id: schema.vehicleModels.id })
    .from(schema.vehicleModels)
    .innerJoin(schema.vehicleMakes, eq(schema.vehicleMakes.id, schema.vehicleModels.makeId))
    .where(sql`${schema.vehicleMakes.slug} = 'kia' AND ${schema.vehicleModels.slug} = 'cerato'`);
  kiaModelId = k.id;
});

beforeEach(async () => {
  current = null;
  await db.delete(schema.rateLimitBuckets);
});

afterAll(async () => {
  // Pool is shared; let the process exit.
});

describe("listing lifecycle", () => {
  it("requires sign-in", async () => {
    const r = await listings.saveListing(null, input(), "draft");
    expect(r).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects a model that doesn't belong to the make", async () => {
    current = users.seller;
    const r = await listings.saveListing(null, { ...input(), modelId: String(kiaModelId) }, "draft");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields?.modelId).toBe("modelMismatch");
  });

  it("creates a draft and refuses submission without 3 photos", async () => {
    current = users.seller;
    const r = await listings.saveListing(null, input(), "submit");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.status).toBe("draft");
    expect(r.data.missing).toContain("photos");
    const s = await listings.changeListingStatus(r.data.id, "submit");
    expect(s).toEqual({ ok: false, error: "validation" });
  });

  it("only the owner can edit, change status, or delete", async () => {
    current = users.seller;
    const r = await listings.saveListing(null, input(), "draft");
    if (!r.ok) throw new Error();
    current = users.other;
    expect(await listings.saveListing(r.data.id, input(), "draft")).toEqual({ ok: false, error: "forbidden" });
    expect(await listings.changeListingStatus(r.data.id, "archive")).toEqual({ ok: false, error: "forbidden" });
    expect(await listings.deleteListing(r.data.id)).toEqual({ ok: false, error: "forbidden" });
    expect(await listings.reorderImages(r.data.id, [])).toEqual({ ok: false, error: "forbidden" });
  });

  it("submit → approve publishes; price-only edit stays live; detail edit returns to review", async () => {
    const id = await publishedListing();
    let [row] = await db.select().from(schema.listings).where(eq(schema.listings.id, id));
    expect(row.status).toBe("published");
    expect(row.publishedAt).not.toBeNull();

    current = users.seller;
    const priceOnly = await listings.saveListing(id, { ...input(), priceEgp: "850000" }, "draft");
    expect(priceOnly.ok && priceOnly.data.status).toBe("published");
    const history = await db.select().from(schema.listingPriceHistory).where(eq(schema.listingPriceHistory.listingId, id));
    expect(history.map((h) => h.newPriceEgp)).toContain(850000);

    const detail = await listings.saveListing(id, { ...input(), priceEgp: "850000", mileageKm: "60000" }, "draft");
    expect(detail.ok && detail.data.status).toBe("pending_review");
    [row] = await db.select().from(schema.listings).where(eq(schema.listings.id, id));
    expect(row.status).toBe("pending_review");
  });

  it("sold listings can't be edited or re-sold", async () => {
    const id = await publishedListing();
    current = users.seller;
    expect((await listings.changeListingStatus(id, "markSold")).ok).toBe(true);
    expect(await listings.changeListingStatus(id, "markSold")).toEqual({ ok: false, error: "invalidTransition" });
    expect(await listings.saveListing(id, input(), "draft")).toEqual({ ok: false, error: "invalidTransition" });
  });

  it("DB constraints reject impossible values even if validation is bypassed", async () => {
    await expect(
      db.insert(schema.listings).values({
        slug: `bad-${crypto.randomUUID()}`,
        sellerId: users.seller.id,
        makeId: corolla.makeId,
        modelId: corolla.modelId,
        year: 2020,
        mileageKm: -1,
        priceEgp: 100000,
        transmission: "manual",
        fuelType: "petrol",
        title: "bad",
        cityId: 1,
      }),
    ).rejects.toThrow();
  });
});

describe("moderation is admin-only", () => {
  it("non-admins can't approve, reject, or suspend", async () => {
    current = users.seller;
    const r = await listings.saveListing(null, input(), "draft");
    if (!r.ok) throw new Error();
    await addImages(r.data.id, 3);
    await listings.changeListingStatus(r.data.id, "submit");
    expect(await admin.moderateListing(r.data.id, "approve")).toEqual({ ok: false, error: "forbidden" });
    current = users.buyer;
    expect(await admin.setUserSuspension(users.seller.id, true, "spam spam")).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejection needs a reason and is audited", async () => {
    current = users.seller;
    const r = await listings.saveListing(null, input(), "draft");
    if (!r.ok) throw new Error();
    await addImages(r.data.id, 3);
    await listings.changeListingStatus(r.data.id, "submit");
    current = users.admin;
    expect((await admin.moderateListing(r.data.id, "reject")).ok).toBe(false);
    expect((await admin.moderateListing(r.data.id, "reject", "Photos are from the internet")).ok).toBe(true);
    const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, r.data.id));
    expect(logs.some((l) => l.action === "listing.reject")).toBe(true);
  });

  it("suspension hides listings and blocks the account", async () => {
    await makeUser("other"); // fresh user to suspend
    current = users.other;
    const r = await listings.saveListing(null, input(), "draft");
    if (!r.ok) throw new Error();
    await addImages(r.data.id, 3);
    await listings.changeListingStatus(r.data.id, "submit");
    current = users.admin;
    await admin.moderateListing(r.data.id, "approve");
    expect((await admin.setUserSuspension(users.other.id, true, "Deposit scam reports")).ok).toBe(true);
    const [l] = await db.select().from(schema.listings).where(eq(schema.listings.id, r.data.id));
    expect(l.status).toBe("archived");
    expect(await admin.setUserSuspension(users.admin.id, true, "self suspend")).toEqual({ ok: false, error: "forbidden" });
  });
});

describe("messaging, favorites, reports", () => {
  it("buyer can contact seller; seller can't message own listing; outsiders can't read/write", async () => {
    const id = await publishedListing();
    current = users.seller;
    expect(await engagement.contactSeller(id, "hi")).toEqual({ ok: false, error: "ownListing" });
    current = users.buyer;
    const c = await engagement.contactSeller(id, "Is it available?");
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const again = await engagement.contactSeller(id, "Following up");
    expect(again.ok && again.data.conversationId).toBe(c.data.conversationId);
    current = users.seller;
    expect((await engagement.sendMessage(c.data.conversationId, "Yes, available")).ok).toBe(true);
    current = users.other;
    expect(await engagement.sendMessage(c.data.conversationId, "intrude")).toEqual({ ok: false, error: "forbidden" });
    expect(await engagement.sendMessage(c.data.conversationId, "")).toMatchObject({ ok: false, error: "validation" });
  });

  it("can't contact or favorite unpublished listings", async () => {
    current = users.seller;
    const r = await listings.saveListing(null, input(), "draft");
    if (!r.ok) throw new Error();
    current = users.buyer;
    expect(await engagement.contactSeller(r.data.id, "hi")).toEqual({ ok: false, error: "listingUnavailable" });
    expect(await engagement.toggleFavorite(r.data.id)).toEqual({ ok: false, error: "listingUnavailable" });
  });

  it("favorite toggles", async () => {
    const id = await publishedListing();
    current = users.buyer;
    expect(await engagement.toggleFavorite(id)).toEqual({ ok: true, data: { saved: true } });
    expect(await engagement.toggleFavorite(id)).toEqual({ ok: true, data: { saved: false } });
  });

  it("phone reveal respects the seller's opt-in", async () => {
    const id = await publishedListing();
    current = users.buyer;
    expect(await engagement.revealPhone(id)).toEqual({ ok: false, error: "forbidden" });
    await db.update(schema.users).set({ phone: "01001234567", showPhone: true }).where(eq(schema.users.id, users.seller.id));
    expect(await engagement.revealPhone(id)).toEqual({ ok: true, data: { phone: "01001234567" } });
    current = null;
    expect(await engagement.revealPhone(id)).toEqual({ ok: false, error: "unauthorized" });
  });

  it("repeat reports from the same user update one open report", async () => {
    const id = await publishedListing();
    current = users.buyer;
    await engagement.reportListing(id, { reason: "scam", details: "asked for deposit" });
    await engagement.reportListing(id, { reason: "scam", details: "asked again" });
    const rows = await db.select().from(schema.reports).where(eq(schema.reports.listingId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].details).toBe("asked again");
    expect((await engagement.reportListing(id, { reason: "nonsense" })).ok).toBe(false);
  });
});

describe("unlisted models", () => {
  it("seller can enter a model that isn't in the catalog; it stays hidden until approval", async () => {
    current = users.seller;
    const r = await listings.saveListing(null, { ...input(), modelId: "other", modelOther: "Corolla GR Sport" }, "draft");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [l] = await db.select().from(schema.listings).where(eq(schema.listings.id, r.data.id));
    const [model] = await db.select().from(schema.vehicleModels).where(eq(schema.vehicleModels.id, l.modelId));
    expect(model.nameEn).toBe("Corolla GR Sport");
    expect(model.isVerified).toBe(false);
    expect(model.makeId).toBe(corolla.makeId);
    const { getModels } = await import("@/server/listings");
    expect((await getModels(corolla.makeId)).some((m) => m.id === model.id)).toBe(false);

    await addImages(r.data.id, 3);
    await listings.changeListingStatus(r.data.id, "submit");
    current = users.admin;
    await admin.moderateListing(r.data.id, "approve");
    const [after] = await db.select().from(schema.vehicleModels).where(eq(schema.vehicleModels.id, model.id));
    expect(after.isVerified).toBe(true);
  });

  it("matches an existing model by name instead of creating a duplicate", async () => {
    current = users.buyer;
    const r = await listings.saveListing(null, { ...input(), modelId: "other", modelOther: "corolla" }, "draft");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [l] = await db.select().from(schema.listings).where(eq(schema.listings.id, r.data.id));
    expect(l.modelId).toBe(corolla.modelId);
  });

  it("requires a name when 'other' is chosen, and caps pending models per seller", async () => {
    current = users.buyer;
    const empty = await listings.saveListing(null, { ...input(), modelId: "other", modelOther: "  " }, "draft");
    expect(empty.ok).toBe(false);
    for (let i = 0; i < 5; i++) {
      await listings.saveListing(null, { ...input(), modelId: "other", modelOther: `Test Model ${i}` }, "draft");
      await db.delete(schema.rateLimitBuckets);
    }
    const sixth = await listings.saveListing(null, { ...input(), modelId: "other", modelOther: "Test Model 6" }, "draft");
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.fields?.modelOther).toBe("modelOther");
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within a window", async () => {
    const subject = crypto.randomUUID();
    const results = [];
    for (let i = 0; i < 12; i++) results.push(await rateLimit("report", subject));
    expect(results.filter(Boolean)).toHaveLength(10);
    expect(results.at(-1)).toBe(false);
  });
});
