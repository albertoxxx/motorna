import "server-only";
import { and, desc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { privateStorage } from "@/lib/storage";
import { LICENCE_FILE_RETENTION_DAYS, licenceState, phoneVerified, type LicenceState } from "@/lib/verification";

const { listingLicenceChecks: LC, listings: L, users: U } = schema;

export async function licenceChecksFor(listingId: string) {
  return db.select().from(LC).where(eq(LC.listingId, listingId)).orderBy(desc(LC.createdAt));
}

/** Public trust signals for a listing page: seller phone and vehicle licence. */
export async function listingTrust(listing: { id: string; sellerId: string; makeId: number; modelId: number | null; year: number }): Promise<{ phone: boolean; licence: LicenceState }> {
  const [[seller], checks] = await Promise.all([
    db.select({ phone: U.phone, phoneVerifiedAt: U.phoneVerifiedAt, phoneVerifiedNumber: U.phoneVerifiedNumber }).from(U).where(eq(U.id, listing.sellerId)),
    licenceChecksFor(listing.id),
  ]);
  return { phone: seller ? phoneVerified(seller) : false, licence: licenceState(listing, checks) };
}

/** SQL boolean for list queries: the listing has a current, matching, accepted licence check. */
export const licenceVerifiedSql = sql<boolean>`EXISTS (
  SELECT 1 FROM listing_licence_checks lc
  WHERE lc.listing_id = "listings"."id" AND lc.status = 'accepted'
    AND (lc.licence_expires_at IS NULL OR lc.licence_expires_at > now())
    AND lc.snapshot_make_id = "listings"."make_id"
    AND lc.snapshot_model_id IS NOT DISTINCT FROM "listings"."model_id"
    AND lc.snapshot_year = "listings"."year"
)`;

export async function adminLicenceQueue() {
  return db
    .select({
      id: LC.id,
      listingId: L.id,
      slug: L.slug,
      title: L.title,
      year: L.year,
      makeId: L.makeId,
      modelId: L.modelId,
      snapshotMakeId: LC.snapshotMakeId,
      snapshotModelId: LC.snapshotModelId,
      snapshotYear: LC.snapshotYear,
      hasBack: sql<boolean>`${LC.backKey} IS NOT NULL`,
      frontType: LC.frontType,
      backType: LC.backType,
      makeAr: schema.vehicleMakes.nameAr,
      makeEn: schema.vehicleMakes.nameEn,
      modelAr: schema.vehicleModels.nameAr,
      modelEn: schema.vehicleModels.nameEn,
      createdAt: LC.createdAt,
      sellerId: L.sellerId,
      sellerName: U.name,
    })
    .from(LC)
    .innerJoin(L, eq(L.id, LC.listingId))
    .innerJoin(U, eq(U.id, L.sellerId))
    .innerJoin(schema.vehicleMakes, eq(schema.vehicleMakes.id, L.makeId))
    .leftJoin(schema.vehicleModels, eq(schema.vehicleModels.id, L.modelId))
    .where(and(eq(LC.status, "pending"), isNull(L.deletedAt)))
    .orderBy(LC.createdAt);
}

export async function pendingLicenceCount() {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(LC).where(eq(LC.status, "pending"));
  return r.n;
}

/** Deletes licence files 30 days after the decision (privacy). The decision record is kept. */
export async function purgeLicenceFiles(now = new Date()) {
  const cutoff = new Date(now.getTime() - LICENCE_FILE_RETENTION_DAYS * 86_400_000);
  const due = await db
    .select({ id: LC.id, frontKey: LC.frontKey, backKey: LC.backKey })
    .from(LC)
    .where(and(isNotNull(LC.reviewedAt), lt(LC.reviewedAt, cutoff), isNull(LC.filesPurgedAt)));
  for (const d of due) {
    for (const k of [d.frontKey, d.backKey]) if (k) await privateStorage().delete(k).catch(() => {});
    await db.update(LC).set({ frontKey: null, backKey: null, frontType: null, backType: null, filesPurgedAt: now }).where(eq(LC.id, d.id));
  }
  return due.length;
}
