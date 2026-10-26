import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { markConversationNotificationsRead } from "@/server/notifications";
import { storage } from "@/lib/storage";

const { listings: L, conversations: CV, messages: M, users: U, favorites: F, reports: R, auditLogs: A, listingImages: IMG, vehicleMakes: MK, vehicleModels: MD, cities: C } = schema;

export async function favoriteIds(userId: string | undefined, listingIds: string[]) {
  if (!userId || listingIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ id: F.listingId })
    .from(F)
    .where(and(eq(F.userId, userId), inArray(F.listingId, listingIds)));
  return new Set(rows.map((r) => r.id));
}

export async function userFavoriteListingIds(userId: string) {
  const rows = await db.select({ id: F.listingId }).from(F).where(eq(F.userId, userId)).orderBy(desc(F.createdAt));
  return rows.map((r) => r.id);
}

const other = alias(U, "other_party");

export async function conversationList(userId: string) {
  const lastMsg = sql<string | null>`(SELECT ${M.body} FROM ${M} WHERE ${M.conversationId} = "conversations"."id" ORDER BY ${M.createdAt} DESC LIMIT 1)`;
  const unread = sql<number>`(SELECT count(*)::int FROM ${M} WHERE ${M.conversationId} = "conversations"."id" AND ${M.senderId} <> ${userId} AND ${M.readAt} IS NULL)`;
  const cover = sql<string | null>`(SELECT ${IMG.thumbKey} FROM ${IMG} WHERE ${IMG.listingId} = "listings"."id" ORDER BY ${IMG.position} LIMIT 1)`;
  const rows = await db
    .select({
      id: CV.id,
      lastMessageAt: CV.lastMessageAt,
      isBuyer: sql<boolean>`${CV.buyerId} = ${userId}`,
      otherName: other.name,
      listingTitle: L.title,
      listingSlug: L.slug,
      listingStatus: L.status,
      lastMsg,
      unread,
      cover,
    })
    .from(CV)
    .innerJoin(L, eq(L.id, CV.listingId))
    .innerJoin(other, sql`${other.id} = CASE WHEN ${CV.buyerId} = ${userId} THEN ${CV.sellerId} ELSE ${CV.buyerId} END`)
    .where(or(eq(CV.buyerId, userId), eq(CV.sellerId, userId)))
    .orderBy(desc(CV.lastMessageAt))
    .limit(100);
  return rows.map((r) => ({ ...r, coverUrl: r.cover ? storage().publicUrl(r.cover) : null }));
}

export async function unreadCount(userId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(M)
    .innerJoin(CV, eq(CV.id, M.conversationId))
    .where(and(or(eq(CV.buyerId, userId), eq(CV.sellerId, userId)), ne(M.senderId, userId), isNull(M.readAt)));
  return n;
}

/** Loads a conversation the user participates in and marks incoming messages read. */
export async function conversationThread(userId: string, conversationId: string) {
  const [c] = await db
    .select({
      id: CV.id,
      buyerId: CV.buyerId,
      sellerId: CV.sellerId,
      listingId: L.id,
      listingTitle: L.title,
      listingSlug: L.slug,
      listingStatus: L.status,
      listingDeletedAt: L.deletedAt,
      priceEgp: L.priceEgp,
    })
    .from(CV)
    .innerJoin(L, eq(L.id, CV.listingId))
    .where(eq(CV.id, conversationId));
  if (!c || (c.buyerId !== userId && c.sellerId !== userId)) return null;
  const otherId = c.buyerId === userId ? c.sellerId : c.buyerId;
  const [o] = await db.select({ id: U.id, name: U.name }).from(U).where(eq(U.id, otherId));
  await db
    .update(M)
    .set({ readAt: new Date() })
    .where(and(eq(M.conversationId, c.id), ne(M.senderId, userId), isNull(M.readAt)));
  await markConversationNotificationsRead(userId, c.id);
  const msgs = await db
    .select({ id: M.id, body: M.body, senderId: M.senderId, createdAt: M.createdAt })
    .from(M)
    .where(eq(M.conversationId, c.id))
    .orderBy(asc(M.createdAt))
    .limit(500);
  return { conversation: c, other: o, messages: msgs, isBuyer: c.buyerId === userId };
}

/* Admin */

export async function adminStats() {
  const [row] = await db.execute<{ pending: number; published: number; reports: number; users: number; centersQueue: number; disputes: number; bookingsWaiting: number; licences: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM listings WHERE status = 'pending_review' AND deleted_at IS NULL) AS pending,
      (SELECT count(*)::int FROM listings WHERE status = 'published' AND deleted_at IS NULL) AS published,
      (SELECT count(*)::int FROM reports WHERE status IN ('open','reviewing')) AS reports,
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM service_centers WHERE status IN ('applied','under_review')) AS "centersQueue",
      (SELECT count(*)::int FROM booking_disputes WHERE status IN ('open','reviewing')) AS disputes,
      (SELECT count(*)::int FROM bookings WHERE status = 'pending_provider') AS "bookingsWaiting",
      (SELECT count(*)::int FROM listing_licence_checks WHERE status = 'pending') AS licences
  `).then((r) => r.rows);
  return row;
}

export async function moderationQueue() {
  const rows = await db
    .select({
      id: L.id,
      slug: L.slug,
      title: L.title,
      year: L.year,
      mileageKm: L.mileageKm,
      priceEgp: L.priceEgp,
      description: L.description,
      knownDefects: L.knownDefects,
      submittedAt: L.submittedAt,
      makeNameEn: MK.nameEn,
      modelNameEn: MD.nameEn,
      modelVerified: MD.isVerified,
      makeNameEnQ: MK.nameEn,
      cityNameEn: C.nameEn,
      cityNameAr: C.nameAr,
      sellerId: U.id,
      sellerName: U.name,
      sellerEmail: U.email,
      sellerCreatedAt: U.createdAt,
    })
    .from(L)
    .innerJoin(MK, eq(MK.id, L.makeId))
    .innerJoin(MD, eq(MD.id, L.modelId))
    .innerJoin(C, eq(C.id, L.cityId))
    .innerJoin(U, eq(U.id, L.sellerId))
    .where(and(eq(L.status, "pending_review"), isNull(L.deletedAt)))
    .orderBy(asc(L.submittedAt))
    .limit(50);
  const ids = rows.map((r) => r.id);
  const imgs = ids.length
    ? await db.select().from(IMG).where(inArray(IMG.listingId, ids)).orderBy(asc(IMG.position))
    : [];
  const s = storage();
  return rows.map((r) => ({
    ...r,
    images: imgs.filter((i) => i.listingId === r.id).map((i) => ({ id: i.id, thumbUrl: s.publicUrl(i.thumbKey) })),
  }));
}

const reporter = alias(U, "reporter");
const reported = alias(U, "reported");

export async function reportList(status?: "open" | "reviewing" | "resolved" | "dismissed") {
  return db
    .select({
      id: R.id,
      reason: R.reason,
      details: R.details,
      status: R.status,
      createdAt: R.createdAt,
      resolutionNote: R.resolutionNote,
      listingId: L.id,
      listingTitle: L.title,
      listingSlug: L.slug,
      listingStatus: L.status,
      reporterName: reporter.name,
      reportedUserId: reported.id,
      reportedUserName: reported.name,
      reportedSuspendedAt: reported.suspendedAt,
    })
    .from(R)
    .leftJoin(L, eq(L.id, R.listingId))
    .innerJoin(reporter, eq(reporter.id, R.reporterId))
    .leftJoin(reported, eq(reported.id, R.reportedUserId))
    .where(status ? eq(R.status, status) : sql`${R.status} IN ('open','reviewing')`)
    .orderBy(desc(R.createdAt))
    .limit(100);
}

export async function auditList(limit = 100) {
  return db
    .select({
      id: A.id,
      action: A.action,
      entityType: A.entityType,
      entityId: A.entityId,
      metadata: A.metadata,
      createdAt: A.createdAt,
      actorName: U.name,
    })
    .from(A)
    .leftJoin(U, eq(U.id, A.actorId))
    .orderBy(desc(A.createdAt))
    .limit(limit);
}

export async function getProfile(userId: string) {
  const [u] = await db
    .select({ id: U.id, name: U.name, email: U.email, phone: U.phone, showPhone: U.showPhone, cityId: U.cityId, locale: U.locale, phoneVerifiedAt: U.phoneVerifiedAt, phoneVerifiedNumber: U.phoneVerifiedNumber })
    .from(U)
    .where(eq(U.id, userId));
  return u ?? null;
}

export async function getPublicSeller(userId: string) {
  const [u] = await db
    .select({
      id: U.id,
      name: U.name,
      role: U.role,
      createdAt: U.createdAt,
      suspendedAt: U.suspendedAt,
      cityId: U.cityId,
      // Only the boolean leaves the server, never the number.
      phoneVerified: sql<boolean>`(${U.phone} IS NOT NULL AND ${U.phoneVerifiedAt} IS NOT NULL AND ${U.phoneVerifiedNumber} = ${U.phone})`,
    })
    .from(U)
    .where(eq(U.id, userId));
  return u && !u.suspendedAt ? u : null;
}

export async function listingForEdit(userId: string, listingId: string) {
  const [l] = await db.select().from(L).where(and(eq(L.id, listingId), isNull(L.deletedAt)));
  if (!l || l.sellerId !== userId) return null;
  const imgs = await db.select().from(IMG).where(eq(IMG.listingId, l.id)).orderBy(asc(IMG.position), asc(IMG.createdAt));
  return { listing: l, images: imgs.map((i) => ({ id: i.id, thumbUrl: storage().publicUrl(i.thumbKey) })) };
}

/** Admin user directory: newest first, optional search by name or email, optional suspended-only filter. */
export async function adminUsers(q?: string, suspendedOnly = false) {
  const term = q?.trim().slice(0, 80);
  const like = term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      suspendedAt: schema.users.suspendedAt,
      suspensionReason: schema.users.suspensionReason,
      createdAt: schema.users.createdAt,
      listings: sql<number>`(SELECT count(*)::int FROM listings l WHERE l.seller_id = "users"."id" AND l.deleted_at IS NULL)`,
      centers: sql<number>`(SELECT count(*)::int FROM center_staff cs WHERE cs.user_id = "users"."id" AND cs.active)`,
    })
    .from(schema.users)
    .where(
      and(
        like ? sql`(${schema.users.name} ILIKE ${like} OR ${schema.users.email} ILIKE ${like})` : undefined,
        suspendedOnly ? sql`${schema.users.suspendedAt} IS NOT NULL` : undefined,
      ),
    )
    .orderBy(desc(schema.users.createdAt))
    .limit(100);
}
