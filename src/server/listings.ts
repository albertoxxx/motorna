import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { storage } from "@/lib/storage";
import { PAGE_SIZE, type SearchFilters } from "@/lib/search-params";

const { listings: L, vehicleMakes: MK, vehicleModels: MD, cities: C, listingImages: IMG, users: U } = schema;

export type ListingCardData = {
  id: string;
  slug: string;
  title: string;
  year: number;
  mileageKm: number;
  priceEgp: number;
  negotiable: boolean;
  condition: "new" | "used";
  transmission: "automatic" | "manual";
  fuelType: "petrol" | "diesel" | "hybrid" | "electric" | "natural_gas";
  status: schema.ListingStatus;
  makeNameEn: string;
  makeNameAr: string;
  modelNameEn: string;
  modelNameAr: string;
  trim: string | null;
  cityNameEn: string;
  cityNameAr: string;
  coverUrl: string | null;
  imageCount: number;
  publishedAt: Date | null;
};

const coverKey = sql<string | null>`(
  SELECT ${IMG.thumbKey} FROM ${IMG} WHERE ${IMG.listingId} = ${L.id}
  ORDER BY ${IMG.position} ASC, ${IMG.createdAt} ASC LIMIT 1
)`;
const imageCount = sql<number>`(SELECT count(*)::int FROM ${IMG} WHERE ${IMG.listingId} = ${L.id})`;

const cardColumns = {
  id: L.id,
  slug: L.slug,
  title: L.title,
  year: L.year,
  mileageKm: L.mileageKm,
  priceEgp: L.priceEgp,
  negotiable: L.negotiable,
  condition: L.condition,
  transmission: L.transmission,
  fuelType: L.fuelType,
  status: L.status,
  trim: L.trim,
  makeNameEn: MK.nameEn,
  makeNameAr: MK.nameAr,
  modelNameEn: MD.nameEn,
  modelNameAr: MD.nameAr,
  cityNameEn: C.nameEn,
  cityNameAr: C.nameAr,
  coverKey,
  imageCount,
  publishedAt: L.publishedAt,
};

type CardRow = { coverKey: string | null } & Omit<ListingCardData, "coverUrl">;

function toCard(r: CardRow): ListingCardData {
  const { coverKey: key, ...rest } = r;
  return { ...rest, coverUrl: key ? storage().publicUrl(key) : null };
}

function cardQuery() {
  return db
    .select(cardColumns)
    .from(L)
    .innerJoin(MK, eq(MK.id, L.makeId))
    .innerJoin(MD, eq(MD.id, L.modelId))
    .innerJoin(C, eq(C.id, L.cityId));
}

const publicListing = and(eq(L.status, "published"), isNull(L.deletedAt))!;

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function filterConditions(f: SearchFilters): SQL[] {
  const conds: SQL[] = [publicListing];
  if (f.make) conds.push(eq(MK.slug, f.make));
  if (f.model) conds.push(eq(MD.slug, f.model));
  if (f.priceMin !== undefined) conds.push(gte(L.priceEgp, f.priceMin));
  if (f.priceMax !== undefined) conds.push(lte(L.priceEgp, f.priceMax));
  if (f.yearMin !== undefined) conds.push(gte(L.year, f.yearMin));
  if (f.yearMax !== undefined) conds.push(lte(L.year, f.yearMax));
  if (f.mileageMax !== undefined) conds.push(lte(L.mileageKm, f.mileageMax));
  if (f.condition) conds.push(eq(L.condition, f.condition));
  if (f.transmission) conds.push(eq(L.transmission, f.transmission));
  if (f.fuel) conds.push(eq(L.fuelType, f.fuel));
  if (f.body) conds.push(eq(L.bodyType, f.body));
  if (f.city) conds.push(eq(C.slug, f.city));
  if (f.q) {
    const words = f.q.split(/\s+/).filter(Boolean).slice(0, 5);
    for (const w of words) {
      const p = `%${escapeLike(w)}%`;
      conds.push(
        or(
          ilike(L.title, p),
          ilike(L.trim, p),
          ilike(L.description, p),
          ilike(MK.nameEn, p),
          ilike(MK.nameAr, p),
          ilike(MD.nameEn, p),
          ilike(MD.nameAr, p),
        )!,
      );
    }
  }
  return conds;
}

function orderFor(sort: SearchFilters["sort"]) {
  switch (sort) {
    case "price_asc":
      return [asc(L.priceEgp), desc(L.publishedAt)];
    case "price_desc":
      return [desc(L.priceEgp), desc(L.publishedAt)];
    case "mileage_asc":
      return [asc(L.mileageKm), desc(L.publishedAt)];
    case "year_desc":
      return [desc(L.year), desc(L.publishedAt)];
    default:
      return [desc(L.publishedAt), desc(L.createdAt)];
  }
}

export async function searchListings(f: SearchFilters) {
  const where = and(...filterConditions(f));
  const [rows, [{ total }]] = await Promise.all([
    cardQuery()
      .where(where)
      .orderBy(...orderFor(f.sort))
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(L)
      .innerJoin(MK, eq(MK.id, L.makeId))
      .innerJoin(MD, eq(MD.id, L.modelId))
      .innerJoin(C, eq(C.id, L.cityId))
      .where(where),
  ]);
  return {
    items: rows.map(toCard),
    total,
    page: f.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function latestListings(limit = 8) {
  const rows = await cardQuery()
    .where(publicListing)
    .orderBy(desc(L.publishedAt))
    .limit(limit);
  return rows.map(toCard);
}

export async function countPublished() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(L).where(publicListing);
  return n;
}

export async function popularMakesWithCounts() {
  return db
    .select({
      slug: MK.slug,
      nameEn: MK.nameEn,
      nameAr: MK.nameAr,
      count: sql<number>`count(${L.id}) FILTER (WHERE ${L.status} = 'published' AND ${L.deletedAt} IS NULL)::int`,
    })
    .from(MK)
    .leftJoin(L, eq(L.makeId, MK.id))
    .where(eq(MK.isPopular, true))
    .groupBy(MK.id)
    .orderBy(desc(sql`4`), asc(MK.nameEn));
}

export async function budgetBandCounts(bands: [number, number | null][]) {
  const cols = Object.fromEntries(
    bands.map(([min, max], i) => [
      `b${i}`,
      max === null
        ? sql<number>`count(*) FILTER (WHERE ${L.priceEgp} >= ${min})::int`
        : sql<number>`count(*) FILTER (WHERE ${L.priceEgp} >= ${min} AND ${L.priceEgp} < ${max})::int`,
    ]),
  );
  const [row] = await db.select(cols).from(L).where(publicListing);
  return bands.map((_, i) => Number((row as Record<string, number>)[`b${i}`] ?? 0));
}

/** Full listing for the details page. Visibility is decided by the caller. */
export async function getListingBySlug(slug: string) {
  const [row] = await db
    .select({
      listing: L,
      make: MK,
      model: MD,
      city: C,
      seller: {
        id: U.id,
        name: U.name,
        role: U.role,
        phone: U.phone,
        showPhone: U.showPhone,
        createdAt: U.createdAt,
        suspendedAt: U.suspendedAt,
      },
    })
    .from(L)
    .innerJoin(MK, eq(MK.id, L.makeId))
    .innerJoin(MD, eq(MD.id, L.modelId))
    .innerJoin(C, eq(C.id, L.cityId))
    .innerJoin(U, eq(U.id, L.sellerId))
    .where(and(eq(L.slug, slug), isNull(L.deletedAt)));
  if (!row) return null;
  const images = await db
    .select()
    .from(IMG)
    .where(eq(IMG.listingId, row.listing.id))
    .orderBy(asc(IMG.position), asc(IMG.createdAt));
  const s = storage();
  return {
    ...row,
    images: images.map((i) => ({
      id: i.id,
      url: s.publicUrl(i.storageKey),
      thumbUrl: s.publicUrl(i.thumbKey),
      width: i.width,
      height: i.height,
    })),
  };
}

export async function similarListings(listing: { id: string; makeId: number; modelId: number; priceEgp: number }, limit = 4) {
  const rows = await cardQuery()
    .where(
      and(
        publicListing,
        ne(L.id, listing.id),
        or(
          eq(L.modelId, listing.modelId),
          and(
            eq(L.makeId, listing.makeId),
            gte(L.priceEgp, Math.round(listing.priceEgp * 0.7)),
            lte(L.priceEgp, Math.round(listing.priceEgp * 1.3)),
          ),
        ),
      ),
    )
    .orderBy(sql`CASE WHEN ${L.modelId} = ${listing.modelId} THEN 0 ELSE 1 END`, desc(L.publishedAt))
    .limit(limit);
  return rows.map(toCard);
}

export async function sellerPublicListings(sellerId: string) {
  const rows = await cardQuery()
    .where(and(publicListing, eq(L.sellerId, sellerId)))
    .orderBy(desc(L.publishedAt))
    .limit(48);
  return rows.map(toCard);
}

export async function countSellerActive(sellerId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(L)
    .where(and(publicListing, eq(L.sellerId, sellerId)));
  return n;
}

export async function myListings(userId: string) {
  const rows = await cardQuery()
    .where(and(eq(L.sellerId, userId), isNull(L.deletedAt)))
    .orderBy(desc(L.updatedAt));
  return rows.map(toCard);
}

export async function listingsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await cardQuery().where(and(inArray(L.id, ids), isNull(L.deletedAt)));
  return rows.map(toCard);
}

/* Taxonomy */

export async function getMakes() {
  return db.select().from(MK).orderBy(desc(MK.isPopular), asc(MK.nameEn));
}

export async function getModels(makeId?: number) {
  const q = db.select().from(MD);
  return makeId ? q.where(eq(MD.makeId, makeId)).orderBy(asc(MD.nameEn)) : q.orderBy(asc(MD.nameEn));
}

export async function getCities() {
  return db.select().from(C).orderBy(asc(C.sortOrder), asc(C.nameEn));
}
