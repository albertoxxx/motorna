import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CenterCriterion, StaffRole } from "@/lib/care";

const { serviceCenters: C, centerStaff: ST, centerServices: SV, centerHours: H, centerCredentials: CR, centerApprovalChecks: CK, cities, users: U, auditLogs: A } = schema;

const publicCols = {
  id: C.id,
  slug: C.slug,
  nameAr: C.nameAr,
  nameEn: C.nameEn,
  area: C.area,
  address: C.address,
  phone: C.phone,
  email: C.email,
  website: C.website,
  description: C.description,
  vehicleTypes: C.vehicleTypes,
  quotationPolicy: C.quotationPolicy,
  approvedAt: C.approvedAt,
  cityNameAr: cities.nameAr,
  cityNameEn: cities.nameEn,
  citySlug: cities.slug,
};

/** Public directory: approved centers only, optional city / category filter. */
export async function approvedCenters(filter: { city?: string; category?: string } = {}) {
  const conds = [eq(C.status, "approved")];
  if (filter.city) conds.push(eq(cities.slug, filter.city));
  if (filter.category) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM ${SV} WHERE ${SV.centerId} = ${C.id} AND ${SV.active} AND ${SV.category} = ${filter.category})`,
    );
  }
  const rows = await db
    .select(publicCols)
    .from(C)
    .innerJoin(cities, eq(cities.id, C.cityId))
    .where(and(...conds))
    .orderBy(asc(C.nameEn));
  const services = rows.length
    ? await db
        .select({ centerId: SV.centerId, category: SV.category })
        .from(SV)
        .where(and(inArray(SV.centerId, rows.map((r) => r.id)), eq(SV.active, true)))
    : [];
  return rows.map((r) => ({ ...r, categories: [...new Set(services.filter((s) => s.centerId === r.id).map((s) => s.category))] }));
}

export async function approvedCenterCount() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(C).where(eq(C.status, "approved"));
  return n;
}

/** Public center page. Returns null unless the center is approved. */
export async function publicCenterBySlug(slug: string) {
  const [c] = await db
    .select({ ...publicCols, status: C.status })
    .from(C)
    .innerJoin(cities, eq(cities.id, C.cityId))
    .where(and(eq(C.slug, slug), eq(C.status, "approved")));
  if (!c) return null;
  const [services, hours] = await Promise.all([
    db.select().from(SV).where(and(eq(SV.centerId, c.id), eq(SV.active, true))).orderBy(asc(SV.category), asc(SV.nameEn)),
    db.select().from(H).where(eq(H.centerId, c.id)).orderBy(asc(H.weekday)),
  ]);
  return { ...c, services, hours };
}

/** The caller's role at a center (null when not active staff). */
export async function staffRole(userId: string, centerId: string): Promise<StaffRole | null> {
  const [row] = await db
    .select({ role: ST.role })
    .from(ST)
    .where(and(eq(ST.userId, userId), eq(ST.centerId, centerId), eq(ST.active, true)));
  return row?.role ?? null;
}

export async function centersForUser(userId: string) {
  return db
    .select({ id: C.id, slug: C.slug, nameAr: C.nameAr, nameEn: C.nameEn, status: C.status, role: ST.role })
    .from(ST)
    .innerJoin(C, eq(C.id, ST.centerId))
    .where(and(eq(ST.userId, userId), eq(ST.active, true)))
    .orderBy(desc(C.createdAt));
}

/** Everything a center's staff (or an admin) may see about one center. */
export async function centerWorkspace(centerId: string) {
  const [center] = await db.select().from(C).where(eq(C.id, centerId));
  if (!center) return null;
  const [services, hours, credentials, staff, checks] = await Promise.all([
    db.select().from(SV).where(eq(SV.centerId, centerId)).orderBy(asc(SV.category), asc(SV.nameEn)),
    db.select().from(H).where(eq(H.centerId, centerId)).orderBy(asc(H.weekday)),
    db
      .select({
        id: CR.id,
        kind: CR.kind,
        number: CR.number,
        contentType: CR.contentType,
        expiresAt: CR.expiresAt,
        reviewState: CR.reviewState,
        reviewNote: CR.reviewNote,
        createdAt: CR.createdAt,
      })
      .from(CR)
      .where(eq(CR.centerId, centerId))
      .orderBy(desc(CR.createdAt)),
    db
      .select({ userId: ST.userId, role: ST.role, active: ST.active, name: U.name, email: U.email })
      .from(ST)
      .innerJoin(U, eq(U.id, ST.userId))
      .where(eq(ST.centerId, centerId))
      .orderBy(asc(ST.createdAt)),
    db.select().from(CK).where(eq(CK.centerId, centerId)),
  ]);
  const checkMap = Object.fromEntries(checks.map((c) => [c.criterion, c])) as Partial<Record<CenterCriterion, (typeof checks)[number]>>;
  return { center, services, hours, credentials, staff, checks: checkMap };
}

export async function centerIdBySlug(slug: string) {
  const [row] = await db.select({ id: C.id }).from(C).where(eq(C.slug, slug));
  return row?.id ?? null;
}

/** Admin list, newest first, optional status filter. */
export async function adminCenterList(statuses?: schema.CenterStatus[]) {
  return db
    .select({
      id: C.id,
      slug: C.slug,
      nameAr: C.nameAr,
      nameEn: C.nameEn,
      status: C.status,
      createdAt: C.createdAt,
      cityNameAr: cities.nameAr,
      cityNameEn: cities.nameEn,
      ownerName: U.name,
    })
    .from(C)
    .innerJoin(cities, eq(cities.id, C.cityId))
    .innerJoin(U, eq(U.id, C.createdById))
    .where(statuses?.length ? inArray(C.status, statuses) : undefined)
    .orderBy(desc(C.createdAt));
}

export async function centerAudit(centerId: string) {
  return db
    .select({ id: A.id, action: A.action, metadata: A.metadata, createdAt: A.createdAt, actorName: U.name })
    .from(A)
    .leftJoin(U, eq(U.id, A.actorId))
    .where(and(eq(A.entityType, "service_center"), eq(A.entityId, centerId)))
    .orderBy(desc(A.createdAt))
    .limit(100);
}

export async function pendingCenterCount() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(C).where(inArray(C.status, ["applied", "under_review"]));
  return n;
}
