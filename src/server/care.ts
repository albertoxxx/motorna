import "server-only";
import { storage } from "@/lib/storage";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cairoWeekday, DIRECTORY_PAGE_SIZE, type CenterCriterion, type DirectorySort, type StaffRole } from "@/lib/care";

const { serviceCenters: C, centerStaff: ST, centerServices: SV, centerHours: H, centerCredentials: CR, centerApprovalChecks: CK, centerEquipment: EQ, centerTechnicians: TECH, centerReviewNotes: NOTE, centerMakes: CM, centerPhotos: PH, vehicleMakes: MK, cities, users: U, auditLogs: A } = schema;

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
  category: C.category,
  latitude: C.latitude,
  longitude: C.longitude,
  approvedAt: C.approvedAt,
  cityNameAr: cities.nameAr,
  cityNameEn: cities.nameEn,
  citySlug: cities.slug,
};

export type DirectoryFilter = {
  q?: string;
  city?: string;
  area?: string;
  /** Provider category: authorized_service | independent_workshop | inspection_center */
  provider?: string;
  /** Service type (care_category) */
  category?: string;
  /** Vehicle make slug */
  make?: string;
  sort?: DirectorySort;
  page?: number;
};

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * Public directory: approved centers only. Filters run in SQL, so the count and the
 * pages always describe the same filtered set.
 */
export async function approvedCenters(filter: DirectoryFilter = {}) {
  const conds = [eq(C.status, "approved")];
  if (filter.city) conds.push(eq(cities.slug, filter.city));
  if (filter.area) conds.push(sql`lower(trim(${C.area})) = lower(trim(${filter.area}))`);
  if (filter.provider) conds.push(sql`${C.category} = ${filter.provider}`);
  if (filter.make) {
    conds.push(sql`EXISTS (SELECT 1 FROM ${CM} JOIN ${MK} ON ${MK.id} = ${CM.makeId} WHERE ${CM.centerId} = ${C.id} AND ${MK.slug} = ${filter.make})`);
  }
  if (filter.q) {
    // Name or location: Arabic/English name, area, address, governorate.
    const p = `%${likeEscape(filter.q.trim())}%`;
    conds.push(sql`(${C.nameAr} ILIKE ${p} OR ${C.nameEn} ILIKE ${p} OR ${C.area} ILIKE ${p} OR ${C.address} ILIKE ${p} OR ${cities.nameAr} ILIKE ${p} OR ${cities.nameEn} ILIKE ${p})`);
  }
  if (filter.category) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM ${SV} WHERE ${SV.centerId} = ${C.id} AND ${SV.active} AND ${SV.category} = ${filter.category})`,
    );
  }
  const where = and(...conds);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(C)
    .innerJoin(cities, eq(cities.id, C.cityId))
    .where(where);
  const pages = Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE));
  const page = Math.min(Math.max(1, filter.page ?? 1), pages);
  const rows = await db
    .select({ ...publicCols, lastVerifiedAt: C.lastVerifiedAt })
    .from(C)
    .innerJoin(cities, eq(cities.id, C.cityId))
    .where(where)
    .orderBy(...(filter.sort === "recent" ? [desc(sql`coalesce(${C.lastVerifiedAt}, ${C.approvedAt})`), asc(C.nameEn)] : [asc(C.nameEn)]))
    .limit(DIRECTORY_PAGE_SIZE)
    .offset((page - 1) * DIRECTORY_PAGE_SIZE);
  const ids = rows.map((r) => r.id);
  const today = cairoWeekday();
  const [services, hours, makes, photos] = ids.length
    ? await Promise.all([
        db.select({ centerId: SV.centerId, category: SV.category }).from(SV).where(and(inArray(SV.centerId, ids), eq(SV.active, true))),
        db.select().from(H).where(inArray(H.centerId, ids)),
        db.select({ centerId: CM.centerId, nameAr: MK.nameAr, nameEn: MK.nameEn }).from(CM).innerJoin(MK, eq(MK.id, CM.makeId)).where(inArray(CM.centerId, ids)).orderBy(asc(MK.nameEn)),
        db.select({ centerId: PH.centerId, thumbKey: PH.thumbKey, position: PH.position }).from(PH).where(inArray(PH.centerId, ids)).orderBy(asc(PH.position), asc(PH.createdAt)),
      ])
    : [[], [], [], []];
  const st = storage();
  const items = rows.map((r) => {
    const mine = hours.filter((x) => x.centerId === r.id);
    const t = mine.find((x) => x.weekday === today);
    return {
      ...r,
      categories: [...new Set(services.filter((x) => x.centerId === r.id).map((x) => x.category))],
      makes: makes.filter((x) => x.centerId === r.id).map(({ nameAr, nameEn }) => ({ nameAr, nameEn })),
      coverUrl: (() => {
        const ph = photos.find((x) => x.centerId === r.id);
        return ph ? st.publicUrl(ph.thumbKey) : null;
      })(),
      // null = no published hours; { closed: true } = published hours but closed today.
      today: mine.length === 0 ? null : t ? { closed: false as const, opens: t.opens, closes: t.closes } : { closed: true as const },
    };
  });
  return { items, total, page, pages };
}

/** Distinct areas among approved centers (optionally in one governorate), for the area filter. */
/** Approved centers per provider category, for the directory tabs. */
export async function providerCounts() {
  const rows = await db.select({ category: C.category, n: sql<number>`count(*)::int` }).from(C).where(eq(C.status, "approved")).groupBy(C.category);
  return Object.fromEntries(rows.map((r) => [r.category, r.n])) as Partial<Record<schema.ProviderCategory, number>>;
}

/** Makes that at least one approved center supports, for the make filter. */
export async function directoryMakes() {
  return db
    .selectDistinct({ slug: MK.slug, nameAr: MK.nameAr, nameEn: MK.nameEn })
    .from(CM)
    .innerJoin(MK, eq(MK.id, CM.makeId))
    .innerJoin(C, eq(C.id, CM.centerId))
    .where(eq(C.status, "approved"))
    .orderBy(asc(MK.nameEn));
}

export async function directoryAreas(city?: string) {
  const rows = await db
    .selectDistinct({ area: sql<string>`trim(${C.area})` })
    .from(C)
    .innerJoin(cities, eq(cities.id, C.cityId))
    .where(and(eq(C.status, "approved"), sql`coalesce(trim(${C.area}), '') <> ''`, city ? eq(cities.slug, city) : undefined));
  return rows.map((r) => r.area).sort((a, b) => a.localeCompare(b));
}

export async function approvedCenterCount() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(C).where(eq(C.status, "approved"));
  return n;
}

/** Public center page. Returns null unless the center is approved. Only shows what MOTORNA actually recorded. */
export async function publicCenterBySlug(slug: string) {
  const [c] = await db
    .select({ ...publicCols, status: C.status, lastVerifiedAt: C.lastVerifiedAt })
    .from(C)
    .innerJoin(cities, eq(cities.id, C.cityId))
    .where(and(eq(C.slug, slug), eq(C.status, "approved")));
  if (!c) return null;
  const st = storage();
  const [services, hours, equipment, technicians, checks, makes, photos] = await Promise.all([
    db.select().from(SV).where(and(eq(SV.centerId, c.id), eq(SV.active, true))).orderBy(asc(SV.category), asc(SV.nameEn)),
    db.select().from(H).where(eq(H.centerId, c.id)).orderBy(asc(H.weekday)),
    db.select({ kind: EQ.kind, details: EQ.details }).from(EQ).where(eq(EQ.centerId, c.id)).orderBy(asc(EQ.kind)),
    // Public view shows specialties and experience, not technicians' names.
    db
      .select({ specialty: TECH.specialty, yearsExperience: TECH.yearsExperience })
      .from(TECH)
      .where(and(eq(TECH.centerId, c.id), eq(TECH.active, true))),
    db
      .select({ criterion: CK.criterion, checkedAt: CK.checkedAt })
      .from(CK)
      .where(and(eq(CK.centerId, c.id), eq(CK.passed, true))),
    db.select({ id: MK.id, slug: MK.slug, nameAr: MK.nameAr, nameEn: MK.nameEn }).from(CM).innerJoin(MK, eq(MK.id, CM.makeId)).where(eq(CM.centerId, c.id)).orderBy(asc(MK.nameEn)),
    db.select().from(PH).where(eq(PH.centerId, c.id)).orderBy(asc(PH.position), asc(PH.createdAt)),
  ]);
  return {
    ...c,
    services,
    hours,
    equipment,
    technicians,
    checks,
    makes,
    photos: photos.map((p) => ({ id: p.id, url: st.publicUrl(p.storageKey), thumbUrl: st.publicUrl(p.thumbKey), width: p.width, height: p.height })),
  };
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
  const [services, hours, credentials, staff, checks, equipment, technicians, makes, photos] = await Promise.all([
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
    db.select().from(EQ).where(eq(EQ.centerId, centerId)).orderBy(asc(EQ.createdAt)),
    db.select().from(TECH).where(eq(TECH.centerId, centerId)).orderBy(asc(TECH.createdAt)),
    db.select({ id: MK.id, nameAr: MK.nameAr, nameEn: MK.nameEn }).from(CM).innerJoin(MK, eq(MK.id, CM.makeId)).where(eq(CM.centerId, centerId)).orderBy(asc(MK.nameEn)),
    db.select().from(PH).where(eq(PH.centerId, centerId)).orderBy(asc(PH.position), asc(PH.createdAt)),
  ]);
  const st = storage();
  const checkMap = Object.fromEntries(checks.map((c) => [c.criterion, c])) as Partial<Record<CenterCriterion, (typeof checks)[number]>>;
  return {
    center,
    services,
    hours,
    credentials,
    staff,
    checks: checkMap,
    equipment,
    technicians,
    makes,
    photos: photos.map((p) => ({ id: p.id, thumbUrl: st.publicUrl(p.thumbKey) })),
  };
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
      submittedAt: C.submittedAt,
      cityNameAr: cities.nameAr,
      cityNameEn: cities.nameEn,
      ownerName: U.name,
    })
    .from(C)
    .innerJoin(cities, eq(cities.id, C.cityId))
    .innerJoin(U, eq(U.id, C.createdById))
    .where(statuses?.length ? inArray(C.status, statuses) : undefined)
    // Oldest submissions first, so the queue is worked in order.
    .orderBy(asc(sql`coalesce(${C.submittedAt}, ${C.createdAt})`));
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

/** Internal notes — callers must be admins (checked by the admin layout and page). */
export async function reviewNotes(centerId: string) {
  return db
    .select({ id: NOTE.id, body: NOTE.body, createdAt: NOTE.createdAt, authorName: U.name })
    .from(NOTE)
    .leftJoin(U, eq(U.id, NOTE.authorId))
    .where(eq(NOTE.centerId, centerId))
    .orderBy(desc(NOTE.createdAt));
}

/** Count of centers per status, for the admin queue tabs. */
export async function centerStatusCounts() {
  const rows = await db.select({ status: C.status, n: sql<number>`count(*)::int` }).from(C).groupBy(C.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<schema.CenterStatus, number>>;
}

export async function pendingCenterCount() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(C).where(inArray(C.status, ["applied", "under_review"]));
  return n;
}
