/**
 * MOTORNA Care, Stage 1: center applications, admin-only approval, privacy of documents.
 * Session is mocked; DB, validation, state machine and storage are real.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";

type U = { id: string; name: string; email: string; role: "user" | "dealer" | "admin"; suspended: boolean };
let current: U | null = null;
vi.mock("@/server/session", () => ({
  getCurrentUser: async () => current,
  requireUser: async () => current,
  requireAdmin: async () => current,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { db, schema } = await import("@/db");
const care = await import("@/server/actions/care");
const careAdmin = await import("@/server/actions/care-admin");
const queries = await import("@/server/care");
const { nextCenterStatus, approvalBlockers } = await import("@/lib/care");
const uploadRoute = await import("@/app/api/care/centers/[id]/credentials/route");
const fileRoute = await import("@/app/api/care/credentials/[id]/route");

const people: Record<"owner" | "tech" | "stranger" | "admin" | "admin2" | "owner2", U> = {} as never;
async function makeUser(key: keyof typeof people, role: U["role"] = "user") {
  const id = crypto.randomUUID();
  const email = `${key}-${id.slice(0, 6)}@care.test`;
  await db.insert(schema.users).values({ id, name: key, email, role });
  people[key] = { id, name: key, email, role, suspended: false };
}

const application = (over: Record<string, unknown> = {}) => ({
  nameAr: "مركز الاختبار",
  nameEn: `Test Center ${crypto.randomUUID().slice(0, 4)}`,
  cityId: "2",
  area: "Smouha",
  address: "12 Test Street, Smouha",
  phone: "03 4251234",
  email: "",
  website: "",
  description: "Diagnostics and inspection.",
  vehicleTypes: ["passenger"],
  quotationPolicy: "",
  acceptTerms: true,
  ...over,
});

async function apply(as: U, over: Record<string, unknown> = {}) {
  current = as;
  const r = await care.applyCenter(application(over));
  if (!r.ok) throw new Error(`apply failed: ${r.error} ${JSON.stringify(r.fields)}`);
  return r.data;
}

/** Fill in what submission requires (service, technician, documents) and submit. */
async function makeReadyAndSubmit(as: U, centerId: string, opts: { inspection?: boolean } = {}) {
  current = as;
  const svc = opts.inspection
    ? { category: "pre_purchase_inspection", nameAr: "فحص شامل", nameEn: "Full inspection", priceMode: "fixed", priceEgp: "1500", durationMin: "90" }
    : { category: "diagnostics", nameAr: "كشف", nameEn: "Diagnostics", priceMode: "quote", durationMin: "60" };
  expect((await care.saveCenterService(centerId, null, svc)).ok).toBe(true);
  if (opts.inspection) for (const kind of ["obd_scanner", "paint_thickness_gauge", "lift"]) expect((await care.addCenterEquipment(centerId, { kind })).ok).toBe(true);
  expect((await care.addCenterTechnician(centerId, { fullName: "Mahmoud Adel", specialty: "Diagnostics", yearsExperience: "8" })).ok).toBe(true);
  for (const kind of ["commercial_register", "tax_card"] as const) {
    await db.insert(schema.centerCredentials).values({ centerId, kind, fileKey: `centers/${centerId}/credentials/${kind}-p.pdf`, contentType: "application/pdf", uploadedById: as.id });
  }
  const r = await care.submitCenter(centerId);
  if (!r.ok) throw new Error(`submit failed: ${r.error}`);
}

async function acceptCoreDocs(centerId: string, uploader: string) {
  for (const kind of ["commercial_register", "tax_card"] as const) {
    await db.insert(schema.centerCredentials).values({
      centerId, kind, fileKey: `centers/${centerId}/credentials/${kind}.pdf`, contentType: "application/pdf",
      uploadedById: uploader, reviewState: "accepted", reviewedById: people.admin.id, reviewedAt: new Date(),
    });
  }
}

async function passChecks(centerId: string, criteria: string[]) {
  current = people.admin;
  for (const c of criteria) expect((await careAdmin.setCenterCheck(centerId, c, true)).ok).toBe(true);
}

beforeAll(async () => {
  await makeUser("owner");
  await makeUser("owner2");
  await makeUser("tech");
  await makeUser("stranger");
  await makeUser("admin", "admin");
  await makeUser("admin2", "admin");
});

describe("pure rules", () => {
  it("status machine only allows admin transitions from valid states", () => {
    expect(nextCenterStatus("applied", "approve")).toBeNull();
    expect(nextCenterStatus("under_review", "approve")).toBe("approved");
    expect(nextCenterStatus("revoked", "reinstate")).toBeNull();
    expect(nextCenterStatus("approved", "suspend")).toBe("suspended");
  });
  it("approval needs every applicable check and unexpired core documents", () => {
    const docs = [
      { kind: "commercial_register", reviewState: "accepted", expiresAt: null },
      { kind: "tax_card", reviewState: "accepted", expiresAt: new Date(Date.now() - 1000) },
    ];
    const checks = { documents_valid: true, address_confirmed: true, technician_named: true, terms_accepted: true };
    expect(approvalBlockers({ checks, offersInspection: false, credentials: docs })).toEqual(["document:tax_card"]);
    expect(approvalBlockers({ checks, offersInspection: true, credentials: [] })).toContain("check:inspection_equipment");
  });
});

describe("applications", () => {
  it("requires sign-in, valid data and accepted terms", async () => {
    current = null;
    expect((await care.applyCenter(application())).ok).toBe(false);
    current = people.stranger;
    const bad = await care.applyCenter(application({ phone: "123", acceptTerms: false }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.fields).toMatchObject({ phone: "phone", acceptTerms: "acceptTerms" });
  });

  it("creates an invisible draft owned by the applicant, with an audit entry", async () => {
    const { id, slug } = await apply(people.owner);
    const [c] = await db.select().from(schema.serviceCenters).where(eq(schema.serviceCenters.id, id));
    expect(c.status).toBe("draft");
    expect((await queries.adminCenterList(["applied", "under_review"])).some((x) => x.id === id)).toBe(false);
    expect(await queries.staffRole(people.owner.id, id)).toBe("owner");
    expect(await queries.publicCenterBySlug(slug)).toBeNull();
    expect((await queries.approvedCenters()).items.some((x) => x.id === id)).toBe(false);
    const logs = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.entityId, id), eq(schema.auditLogs.action, "center.draft")));
    expect(logs).toHaveLength(1);
    current = people.owner;
    const again = await care.applyCenter(application());
    expect(again.ok === false && again.error).toBe("centerPending");
  });
});

describe("draft → submitted", () => {
  it("admins can't act on drafts; incomplete applications can't be submitted", async () => {
    const [owned] = await queries.centersForUser(people.owner.id);
    current = people.admin;
    expect((await careAdmin.changeCenterStatus(owned.id, "startReview")).ok).toBe(false);
    current = people.owner;
    const r = await care.submitCenter(owned.id);
    expect(r.ok === false && r.error).toBe("applicationIncomplete");
  });

  it("an inspection center must declare the core equipment before submitting", async () => {
    const c = await apply(people.tech);
    current = people.tech;
    await care.saveCenterService(c.id, null, { category: "pre_purchase_inspection", nameAr: "فحص", nameEn: "Inspection", priceMode: "quote", durationMin: "60" });
    await care.addCenterTechnician(c.id, { fullName: "Ali Hassan" });
    for (const kind of ["commercial_register", "tax_card"] as const) {
      await db.insert(schema.centerCredentials).values({ centerId: c.id, kind, fileKey: `centers/${c.id}/credentials/${kind}.pdf`, contentType: "application/pdf", uploadedById: people.tech.id });
    }
    expect((await care.submitCenter(c.id)).ok).toBe(false);
    for (const kind of ["obd_scanner", "paint_thickness_gauge", "lift"]) await care.addCenterEquipment(c.id, { kind });
    expect((await care.submitCenter(c.id)).ok).toBe(true);
    const [row] = await db.select().from(schema.serviceCenters).where(eq(schema.serviceCenters.id, c.id));
    expect(row.status).toBe("applied");
    expect(row.submittedAt).not.toBeNull();
  });

  it("validates technicians and equipment input", async () => {
    const [owned] = await queries.centersForUser(people.owner.id);
    current = people.owner;
    const t = await care.addCenterTechnician(owned.id, { fullName: "A", yearsExperience: "99" });
    expect(t.ok === false && t.fields).toMatchObject({ fullName: "technicianName", yearsExperience: "technicianYears" });
    expect((await care.addCenterEquipment(owned.id, { kind: "laser_cannon" })).ok).toBe(false);
  });
});

describe("approval is admin-only and evidence-based", () => {
  let center: { id: string; slug: string };
  beforeAll(async () => {
    center = await apply(people.owner2);
    await makeReadyAndSubmit(people.owner2, center.id);
  });

  it("owners and other users can't change status or tick checks", async () => {
    for (const u of [people.owner2, people.stranger]) {
      current = u;
      expect((await careAdmin.changeCenterStatus(center.id, "startReview")).ok).toBe(false);
      expect((await careAdmin.setCenterCheck(center.id, "address_confirmed", true)).ok).toBe(false);
    }
  });

  it("only admins can add internal notes, which never reach center queries", async () => {
    current = people.owner2;
    expect((await careAdmin.addReviewNote(center.id, "looks fine")).ok).toBe(false);
    current = people.admin;
    expect((await careAdmin.addReviewNote(center.id, "Called the center; address matches the CR.")).ok).toBe(true);
    expect((await queries.reviewNotes(center.id))[0].body).toContain("address matches");
    const ws = await queries.centerWorkspace(center.id);
    expect(JSON.stringify(ws)).not.toContain("address matches");
  });

  it("an admin who is staff at the center can't review it", async () => {
    current = people.owner2;
    expect((await care.addCenterStaff(center.id, people.admin2.email, "technician")).ok).toBe(true);
    current = people.admin2;
    const r = await careAdmin.changeCenterStatus(center.id, "startReview");
    expect(r.ok === false && r.error).toBe("conflictOfInterest");
    current = people.owner2;
    await care.removeCenterStaff(center.id, people.admin2.id);
    current = people.admin2;
    // Former staff still can't: membership history is enough to block.
    expect((await careAdmin.changeCenterStatus(center.id, "startReview")).ok).toBe(false);
  });

  it("approval is blocked until checks pass and core documents are accepted", async () => {
    current = people.admin;
    expect((await careAdmin.changeCenterStatus(center.id, "startReview")).ok).toBe(true);
    const blocked = await careAdmin.changeCenterStatus(center.id, "approve");
    expect(blocked.ok === false && blocked.error).toBe("approvalBlocked");
    await passChecks(center.id, ["documents_valid", "address_confirmed", "technician_named", "terms_accepted"]);
    expect((await careAdmin.changeCenterStatus(center.id, "approve")).ok).toBe(false); // documents still missing
    await acceptCoreDocs(center.id, people.owner2.id);
    // Adding an inspection service makes the equipment criterion mandatory.
    current = people.owner2;
    expect((await care.saveCenterService(center.id, null, { category: "pre_purchase_inspection", nameAr: "فحص شامل", nameEn: "Full inspection", priceMode: "fixed", priceEgp: "1500", durationMin: "90" })).ok).toBe(true);
    await care.addCenterEquipment(center.id, { kind: "obd_scanner", details: "Launch X431" });
    current = people.admin;
    expect((await careAdmin.changeCenterStatus(center.id, "approve")).ok).toBe(false);
    await passChecks(center.id, ["inspection_equipment"]);
    const ok = await careAdmin.changeCenterStatus(center.id, "approve");
    expect(ok.ok).toBe(true);
    const [c] = await db.select().from(schema.serviceCenters).where(eq(schema.serviceCenters.id, center.id));
    expect(c.status).toBe("approved");
    expect(c.approvedById).toBe(people.admin.id);
    expect(c.lastVerifiedAt).not.toBeNull();
    expect((await queries.approvedCenters({ category: "pre_purchase_inspection" })).items.some((x) => x.id === center.id)).toBe(true);
    const pub = await queries.publicCenterBySlug(center.slug);
    expect(pub?.services).toHaveLength(2);
    expect(pub?.equipment.map((e) => e.kind)).toContain("obd_scanner");
    // Technician names stay private; only passed criteria are shown.
    expect(JSON.stringify(pub?.technicians)).not.toContain("Mahmoud");
    expect(pub?.technicians[0]).toMatchObject({ specialty: "Diagnostics", yearsExperience: 8 });
    expect(pub?.checks.map((k) => k.criterion).sort()).toEqual(["address_confirmed", "documents_valid", "inspection_equipment", "technician_named", "terms_accepted"]);
  });

  it("identity fields lock after approval; other edits still work", async () => {
    current = people.owner2;
    const [c] = await db.select().from(schema.serviceCenters).where(eq(schema.serviceCenters.id, center.id));
    const base = { ...c, cityId: String(c.cityId), area: c.area ?? "", email: c.email ?? "", website: c.website ?? "" };
    const renamed = await care.updateCenterProfile(center.id, { ...base, nameEn: "Different Name" });
    expect(renamed.ok === false && renamed.error).toBe("identityLocked");
    expect((await care.updateCenterProfile(center.id, { ...base, description: "Now with a lift." })).ok).toBe(true);
  });

  it("technicians and outsiders can't edit the profile or services", async () => {
    current = people.owner2;
    await care.addCenterStaff(center.id, people.tech.email, "technician");
    for (const u of [people.tech, people.stranger]) {
      current = u;
      const r = await care.saveCenterService(center.id, null, { category: "brakes", nameAr: "فرامل", nameEn: "Brakes", priceMode: "quote", durationMin: "60" });
      expect(r.ok === false && r.error).toBe("forbidden");
    }
  });

  it("suspension needs a reason and hides the center", async () => {
    current = people.admin;
    expect((await careAdmin.changeCenterStatus(center.id, "suspend", "")).ok).toBe(false);
    expect((await careAdmin.changeCenterStatus(center.id, "suspend", "Customer complaints under review")).ok).toBe(true);
    expect(await queries.publicCenterBySlug(center.slug)).toBeNull();
    expect((await careAdmin.changeCenterStatus(center.id, "reinstate")).ok).toBe(true);
  });
});

describe("changes requested, rejection and resubmission", () => {
  it("request-changes needs a message; only the owner resubmits", async () => {
    const extra = { ...people.stranger };
    const c = await apply(extra);
    await makeReadyAndSubmit(extra, c.id);
    current = people.admin;
    expect((await careAdmin.changeCenterStatus(c.id, "requestChanges", "")).ok).toBe(false);
    expect((await careAdmin.changeCenterStatus(c.id, "requestChanges", "Please upload a clearer tax card")).ok).toBe(true);
    let [row] = await db.select().from(schema.serviceCenters).where(eq(schema.serviceCenters.id, c.id));
    expect(row.status).toBe("changes_requested");
    expect(row.statusReason).toContain("clearer tax card");
    current = people.tech;
    expect((await care.submitCenter(c.id)).ok).toBe(false);
    current = extra;
    expect((await care.submitCenter(c.id)).ok).toBe(true);
    current = people.admin;
    expect((await careAdmin.changeCenterStatus(c.id, "reject", "Address could not be confirmed")).ok).toBe(true);
    current = extra;
    expect((await care.submitCenter(c.id)).ok).toBe(true);
    [row] = await db.select().from(schema.serviceCenters).where(eq(schema.serviceCenters.id, c.id));
    expect(row.status).toBe("applied");
    expect(row.statusReason).toBeNull();
  });
});

describe("directory filtering, sorting and pagination", () => {
  const tag = `dir${Date.now().toString(36)}`;
  beforeAll(async () => {
    // Approved fixtures inserted directly: this block tests the public query, not the approval flow.
    for (let i = 0; i < 14; i++) {
      const [c] = await db
        .insert(schema.serviceCenters)
        .values({
          slug: `${tag}-${i}`, nameAr: `مركز ${i}`, nameEn: `${tag} ${String(i).padStart(2, "0")}`, cityId: i < 10 ? 1 : 2,
          area: i % 2 ? "Smouha" : "Sporting", address: "Street 1", phone: "034251234", status: i === 13 ? "suspended" : "approved",
          approvedAt: new Date(Date.now() - i * 86_400_000), lastVerifiedAt: new Date(Date.now() - i * 86_400_000), createdById: people.admin.id,
        })
        .returning({ id: schema.serviceCenters.id });
      await db.insert(schema.centerServices).values({ centerId: c.id, category: i < 3 ? "tires" : "brakes", nameAr: "خدمة", nameEn: "Service", priceMode: "quote", priceEgp: null });
      if (i === 0) await db.insert(schema.centerHours).values({ centerId: c.id, weekday: 0, opens: "09:00", closes: "17:00" });
    }
  });
  const mine = <T extends { nameEn: string }>(xs: T[]) => xs.filter((x) => x.nameEn.startsWith(tag));

  it("counts and pages reflect the filtered set; suspended centers never appear", async () => {
    const all = await queries.approvedCenters({});
    const p1 = mine(all.items).length;
    expect(all.total).toBeGreaterThanOrEqual(13);
    expect(all.items.length).toBeLessThanOrEqual(12);
    expect(all.pages).toBe(Math.ceil(all.total / 12));
    const p2 = await queries.approvedCenters({ page: 2 });
    expect(p1 + mine(p2.items).length).toBe(13);
    const city = await queries.approvedCenters({ city: "cairo" });
    expect(mine(city.items)).toHaveLength(3);
    const area = await queries.approvedCenters({ city: "alexandria", area: " smouha " });
    expect(mine(area.items)).toHaveLength(5);
    const tires = await queries.approvedCenters({ category: "tires" });
    expect(mine(tires.items)).toHaveLength(3);
    expect(tires.total).toBe(tires.items.length);
    expect(await queries.directoryAreas("alexandria")).toEqual(expect.arrayContaining(["Smouha", "Sporting"]));
  });

  it("sorts by name or by most recent review, and reports today's hours", async () => {
    const byName = mine((await queries.approvedCenters({ city: "alexandria" })).items).map((x) => x.nameEn);
    expect(byName).toEqual([...byName].sort());
    const recent = mine((await queries.approvedCenters({ city: "alexandria", sort: "recent" })).items).map((x) => x.nameEn);
    expect(recent[0]).toBe(`${tag} 00`);
    const first = (await queries.approvedCenters({ city: "alexandria", sort: "recent" })).items.find((x) => x.nameEn === `${tag} 00`)!;
    expect(first.today).not.toBeNull();
    const other = (await queries.approvedCenters({ city: "alexandria", sort: "recent" })).items.find((x) => x.nameEn === `${tag} 01`)!;
    expect(other.today).toBeNull();
  });
});

describe("validation", () => {
  it("fixed price needs a price; quotes store none; hours must make sense", async () => {
    const [owned] = await queries.centersForUser(people.owner.id);
    current = people.owner;
    const noPrice = await care.saveCenterService(owned.id, null, { category: "oil_change", nameAr: "زيت", nameEn: "Oil", priceMode: "fixed", durationMin: "30" });
    expect(noPrice.ok === false && noPrice.fields?.priceEgp).toBe("servicePrice");
    const quote = await care.saveCenterService(owned.id, null, { category: "electrical", nameAr: "كهرباء", nameEn: "Electrical", priceMode: "quote", priceEgp: "500", durationMin: "60" });
    expect(quote.ok).toBe(true);
    if (quote.ok) {
      const [s] = await db.select().from(schema.centerServices).where(eq(schema.centerServices.id, quote.data.id));
      expect(s.priceEgp).toBeNull();
    }
    expect((await care.setCenterHours(owned.id, [{ weekday: 1, opens: "18:00", closes: "09:00" }])).ok).toBe(false);
    expect((await care.setCenterHours(owned.id, [{ weekday: 6, opens: "09:00", closes: "18:00" }])).ok).toBe(true);
  });
});

describe("audit log is append-only", () => {
  it("rejects updates and deletes at the database level", async () => {
    await expect(db.update(schema.auditLogs).set({ action: "tampered" })).rejects.toThrow();
    await expect(db.delete(schema.auditLogs)).rejects.toThrow();
  });
});

describe("credential documents stay private", () => {
  const pdf = () => new Blob([Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF")], { type: "application/pdf" });
  async function upload(centerId: string, file: Blob, name = "cr.pdf") {
    const fd = new FormData();
    fd.append("file", file, name);
    fd.append("kind", "commercial_register");
    fd.append("expiresAt", "2030-01-01");
    const req = new Request(`http://localhost/api/care/centers/${centerId}/credentials`, { method: "POST", body: fd });
    return uploadRoute.POST(req, { params: Promise.resolve({ id: centerId }) } as never);
  }
  const view = (id: string) => fileRoute.GET(new Request(`http://localhost/api/care/credentials/${id}`), { params: Promise.resolve({ id }) } as never);

  it("only the center's managers can upload; only they and admins can read", async () => {
    const [owned] = await queries.centersForUser(people.owner.id);
    current = people.stranger;
    expect((await upload(owned.id, pdf())).status).toBe(403);
    current = null;
    expect((await upload(owned.id, pdf())).status).toBe(401);
    current = people.owner;
    expect((await upload(owned.id, new Blob([Buffer.from("not a document")]), "x.exe")).status).toBe(400);
    const res = await upload(owned.id, pdf());
    expect(res.status).toBe(200);
    const { id } = await res.json();
    const [doc] = await db.select().from(schema.centerCredentials).where(eq(schema.centerCredentials.id, id));
    expect(doc.reviewState).toBe("pending");
    expect(doc.fileKey.startsWith(`centers/${owned.id}/credentials/`)).toBe(true);

    current = null;
    expect((await view(id)).status).toBe(401);
    current = people.stranger;
    expect((await view(id)).status).toBe(403);
    current = people.admin;
    const ok = await view(id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toContain("no-store");
    current = people.owner;
    expect((await view(id)).status).toBe(200);
  });
});
