"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { audit } from "@/server/audit";
import { rateLimit } from "@/server/rate-limit";
import { fail, ok, type ActionResult } from "@/server/result";
import { fieldErrors } from "@/lib/validation";
import {
  centerApplicationSchema,
  centerHoursSchema,
  centerProfileSchema,
  centerServiceSchema,
  equipmentSchema,
  identityLocked,
  OPEN_APPLICATION,
  SUBMITTABLE,
  submissionGaps,
  technicianSchema,
  profileEditable,
  type StaffRole,
} from "@/lib/care";
import { staffRole } from "@/server/care";

const { serviceCenters: C, centerStaff: ST, centerServices: SV, centerHours: H, users: U, centerEquipment: EQ, centerTechnicians: TECH, centerCredentials: CRED } = schema;

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Loads the center and checks the caller is active staff with one of the given roles. */
async function requireStaff(centerId: string, roles: StaffRole[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" as const };
  const [center] = await db.select().from(C).where(eq(C.id, centerId));
  if (!center) return { error: "notFound" as const };
  const role = await staffRole(user.id, centerId);
  if (!role || !roles.includes(role)) return { error: "forbidden" as const };
  return { user, center, role };
}

const revalidateCenter = (slug: string) => {
  revalidatePath("/[lang]/care", "layout");
  revalidatePath(`/[lang]/center/${slug}`, "layout");
  revalidatePath("/[lang]/admin", "layout");
};

/**
 * Any signed-in user can apply. The applicant becomes the center's owner, and the
 * center starts in "applied" — it is invisible to the public until an admin approves it.
 */
export async function applyCenter(raw: Record<string, unknown>): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const parsed = centerApplicationSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  // One open application per person keeps the queue clean.
  const [open] = await db
    .select({ id: C.id })
    .from(ST)
    .innerJoin(C, eq(C.id, ST.centerId))
    .where(and(eq(ST.userId, user.id), eq(ST.role, "owner"), inArray(C.status, OPEN_APPLICATION)));
  if (open) return fail("centerPending");
  if (!(await rateLimit("centerApply", user.id))) return fail("rateLimited");
  const { acceptTerms: _accepted, ...profile } = parsed.data;
  void _accepted;
  const slug = `${slugify(profile.nameEn) || "center"}-${crypto.randomUUID().slice(0, 6)}`;
  const id = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(C)
      .values({ ...profile, area: profile.area ?? null, email: profile.email ?? null, website: profile.website ?? null, slug, status: "draft", createdById: user.id })
      .returning({ id: C.id });
    await tx.insert(ST).values({ centerId: c.id, userId: user.id, role: "owner", addedById: user.id });
    await audit(user.id, "center.draft", "service_center", c.id, { name: profile.nameEn, termsAcceptedAt: new Date().toISOString() }, tx);
    return c.id;
  });
  revalidatePath("/[lang]/admin", "layout");
  return ok({ id, slug });
}

/** Owners/managers edit the profile. Name, city and address are locked after approval. */
export async function updateCenterProfile(centerId: string, raw: Record<string, unknown>): Promise<ActionResult<null>> {
  const s = await requireStaff(centerId, ["owner", "manager"]);
  if (s.error) return fail(s.error);
  if (!profileEditable(s.center.status)) return fail("invalidTransition");
  const parsed = centerProfileSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  if (!(await rateLimit("centerEdit", s.user.id))) return fail("rateLimited");
  const p = parsed.data;
  const locked = identityLocked(s.center.status);
  if (locked && (p.nameAr !== s.center.nameAr || p.nameEn !== s.center.nameEn || p.cityId !== s.center.cityId || p.address !== s.center.address)) {
    return fail("identityLocked");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(C)
      .set({ ...p, area: p.area ?? null, email: p.email ?? null, website: p.website ?? null })
      .where(eq(C.id, centerId));
    await audit(s.user.id, "center.update", "service_center", centerId, {}, tx);
  });
  revalidateCenter(s.center.slug);
  return ok(null);
}

/**
 * The owner sends the application to the review queue (from draft, changes requested or rejected).
 * The server re-checks completeness; nothing is reviewed until it is submitted.
 */
export async function submitCenter(centerId: string): Promise<ActionResult<null>> {
  const s = await requireStaff(centerId, ["owner"]);
  if (s.error) return fail(s.error);
  if (!SUBMITTABLE.includes(s.center.status)) return fail("invalidTransition");
  const [services, equipment, technicians, credentials] = await Promise.all([
    db.select({ category: SV.category, active: SV.active }).from(SV).where(eq(SV.centerId, centerId)),
    db.select({ kind: EQ.kind }).from(EQ).where(eq(EQ.centerId, centerId)),
    db.select({ active: TECH.active }).from(TECH).where(eq(TECH.centerId, centerId)),
    db.select({ kind: CRED.kind, reviewState: CRED.reviewState }).from(CRED).where(eq(CRED.centerId, centerId)),
  ]);
  if (submissionGaps({ services, equipment, technicians, credentials }).length) return fail("applicationIncomplete");
  await db.transaction(async (tx) => {
    await tx
      .update(C)
      .set({ status: "applied", statusReason: null, submittedAt: new Date() })
      .where(and(eq(C.id, centerId), eq(C.status, s.center.status)));
    await audit(s.user.id, "center.submit", "service_center", centerId, { from: s.center.status, to: "applied" }, tx);
  });
  revalidateCenter(s.center.slug);
  return ok(null);
}

export async function addCenterEquipment(centerId: string, raw: Record<string, unknown>): Promise<ActionResult<null>> {
  const s = await requireStaff(centerId, ["owner", "manager"]);
  if (s.error) return fail(s.error);
  if (!profileEditable(s.center.status)) return fail("invalidTransition");
  const parsed = equipmentSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  if (!(await rateLimit("centerEdit", s.user.id))) return fail("rateLimited");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(EQ).where(eq(EQ.centerId, centerId));
  if (n >= 40) return fail("validation");
  await db.transaction(async (tx) => {
    const [row] = await tx.insert(EQ).values({ centerId, kind: parsed.data.kind, details: parsed.data.details ?? null }).returning({ id: EQ.id });
    await audit(s.user.id, "center.equipment.add", "service_center", centerId, { equipmentId: row.id, ...parsed.data }, tx);
  });
  revalidateCenter(s.center.slug);
  return ok(null);
}

export async function removeCenterEquipment(centerId: string, equipmentId: string): Promise<ActionResult<null>> {
  const s = await requireStaff(centerId, ["owner", "manager"]);
  if (s.error) return fail(s.error);
  if (!profileEditable(s.center.status)) return fail("invalidTransition");
  const res = await db.delete(EQ).where(and(eq(EQ.id, equipmentId), eq(EQ.centerId, centerId))).returning({ kind: EQ.kind });
  if (!res.length) return fail("notFound");
  await audit(s.user.id, "center.equipment.remove", "service_center", centerId, { equipmentId, kind: res[0].kind });
  revalidateCenter(s.center.slug);
  return ok(null);
}

export async function addCenterTechnician(centerId: string, raw: Record<string, unknown>): Promise<ActionResult<null>> {
  const s = await requireStaff(centerId, ["owner", "manager"]);
  if (s.error) return fail(s.error);
  if (!profileEditable(s.center.status)) return fail("invalidTransition");
  const parsed = technicianSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  if (!(await rateLimit("centerEdit", s.user.id))) return fail("rateLimited");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(TECH).where(eq(TECH.centerId, centerId));
  if (n >= 50) return fail("validation");
  const d = parsed.data;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(TECH)
      .values({ centerId, fullName: d.fullName, specialty: d.specialty ?? null, yearsExperience: d.yearsExperience ?? null, certifications: d.certifications ?? null })
      .returning({ id: TECH.id });
    await audit(s.user.id, "center.technician.add", "service_center", centerId, { technicianId: row.id, name: d.fullName }, tx);
  });
  revalidateCenter(s.center.slug);
  return ok(null);
}

/** Technicians are deactivated, not deleted, so the review history stays meaningful. */
export async function removeCenterTechnician(centerId: string, technicianId: string): Promise<ActionResult<null>> {
  const s = await requireStaff(centerId, ["owner", "manager"]);
  if (s.error) return fail(s.error);
  const res = await db
    .update(TECH)
    .set({ active: false })
    .where(and(eq(TECH.id, technicianId), eq(TECH.centerId, centerId)))
    .returning({ name: TECH.fullName });
  if (!res.length) return fail("notFound");
  await audit(s.user.id, "center.technician.remove", "service_center", centerId, { technicianId, name: res[0].name });
  revalidateCenter(s.center.slug);
  return ok(null);
}

export async function saveCenterService(centerId: string, serviceId: string | null, raw: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  const s = await requireStaff(centerId, ["owner", "manager"]);
  if (s.error) return fail(s.error);
  if (!profileEditable(s.center.status)) return fail("invalidTransition");
  const parsed = centerServiceSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  if (!(await rateLimit("centerEdit", s.user.id))) return fail("rateLimited");
  const id = await db.transaction(async (tx) => {
    if (serviceId) {
      const [row] = await tx
        .update(SV)
        .set(parsed.data)
        .where(and(eq(SV.id, serviceId), eq(SV.centerId, centerId)))
        .returning({ id: SV.id });
      if (!row) return null;
      await audit(s.user.id, "center.service.update", "service_center", centerId, { serviceId, ...parsed.data }, tx);
      return row.id;
    }
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(SV).where(eq(SV.centerId, centerId));
    if (n >= 60) return null;
    const [row] = await tx.insert(SV).values({ ...parsed.data, centerId }).returning({ id: SV.id });
    await audit(s.user.id, "center.service.add", "service_center", centerId, { serviceId: row.id, ...parsed.data }, tx);
    return row.id;
  });
  if (!id) return fail("notFound");
  revalidateCenter(s.center.slug);
  return ok({ id });
}

export async function setCenterServiceActive(centerId: string, serviceId: string, active: boolean): Promise<ActionResult<null>> {
  const s = await requireStaff(centerId, ["owner", "manager"]);
  if (s.error) return fail(s.error);
  const res = await db
    .update(SV)
    .set({ active })
    .where(and(eq(SV.id, serviceId), eq(SV.centerId, centerId)))
    .returning({ id: SV.id });
  if (!res.length) return fail("notFound");
  await audit(s.user.id, active ? "center.service.enable" : "center.service.disable", "service_center", centerId, { serviceId });
  revalidateCenter(s.center.slug);
  return ok(null);
}

export async function setCenterHours(centerId: string, rows: { weekday: number; opens: string; closes: string }[]): Promise<ActionResult<null>> {
  const s = await requireStaff(centerId, ["owner", "manager"]);
  if (s.error) return fail(s.error);
  if (!profileEditable(s.center.status)) return fail("invalidTransition");
  const parsed = centerHoursSchema.safeParse(rows);
  if (!parsed.success) return fail("validation", { hours: "hours" });
  await db.transaction(async (tx) => {
    await tx.delete(H).where(eq(H.centerId, centerId));
    if (parsed.data.length) await tx.insert(H).values(parsed.data.map((r) => ({ ...r, centerId })));
    await audit(s.user.id, "center.hours", "service_center", centerId, { hours: parsed.data }, tx);
  });
  revalidateCenter(s.center.slug);
  return ok(null);
}

/** Owners add staff by the email of an existing MOTORNA account. Owners can't be added this way. */
export async function addCenterStaff(centerId: string, email: string, role: "manager" | "technician"): Promise<ActionResult<null>> {
  const s = await requireStaff(centerId, ["owner"]);
  if (s.error) return fail(s.error);
  if (role !== "manager" && role !== "technician") return fail("validation");
  const [target] = await db.select({ id: U.id }).from(U).where(eq(U.email, email.trim().toLowerCase()));
  if (!target) return fail("userNotFound");
  if (target.id === s.user.id) return fail("forbidden");
  await db.transaction(async (tx) => {
    await tx
      .insert(ST)
      .values({ centerId, userId: target.id, role, addedById: s.user.id })
      .onConflictDoUpdate({ target: [ST.centerId, ST.userId], set: { role, active: true, addedById: s.user.id } });
    await audit(s.user.id, "center.staff.add", "service_center", centerId, { userId: target.id, role }, tx);
  });
  revalidateCenter(s.center.slug);
  return ok(null);
}

export async function removeCenterStaff(centerId: string, userId: string): Promise<ActionResult<null>> {
  const s = await requireStaff(centerId, ["owner"]);
  if (s.error) return fail(s.error);
  if (userId === s.user.id) return fail("forbidden");
  const res = await db
    .update(ST)
    .set({ active: false })
    .where(and(eq(ST.centerId, centerId), eq(ST.userId, userId), sql`${ST.role} <> 'owner'`))
    .returning({ userId: ST.userId });
  if (!res.length) return fail("notFound");
  await audit(s.user.id, "center.staff.remove", "service_center", centerId, { userId });
  revalidateCenter(s.center.slug);
  return ok(null);
}

