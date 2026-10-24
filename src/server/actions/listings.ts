"use server";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";
import { fail, ok, type ActionResult } from "@/server/result";
import { fieldErrors, listingInputSchema, type ValidationKey, MIN_DESCRIPTION_FOR_SUBMIT, type ListingInput } from "@/lib/validation";
import { nextStatus, requiresReReview, type ListingAction } from "@/lib/listing-state";
import { IMAGE_MIN_COUNT } from "@/lib/images";
import { storage } from "@/lib/storage";
import { makeListingSlug, shortId } from "@/lib/slug";

const { listings: L, listingImages: IMG, vehicleModels: MD, vehicleMakes: MK, cities: C } = schema;

type SaveResult = { id: string; slug: string; status: schema.ListingStatus; missing: ("photos" | "description")[] };

const MAX_PENDING_MODELS_PER_USER = 5;

function slugifyModel(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Resolves the listing's make/model/city. A catalog model must belong to the
 * chosen make. An unlisted model ("other") is matched case-insensitively to an
 * existing one, or created as unverified until an admin approves the listing.
 */
async function verifyRefs(input: ListingInput, userId: string) {
  const bad = (fields: Record<string, ValidationKey>) => ({ error: fields, model: null });
  const [city] = await db.select({ id: C.id }).from(C).where(eq(C.id, input.cityId));
  if (!city) return bad({ cityId: "required" });

  if (input.modelId) {
    const [model] = await db
      .select({ id: MD.id, makeId: MD.makeId, makeSlug: MK.slug, modelSlug: MD.slug })
      .from(MD)
      .innerJoin(MK, eq(MK.id, MD.makeId))
      .where(eq(MD.id, input.modelId));
    if (!model || model.makeId !== input.makeId) return bad({ modelId: "modelMismatch" });
    return { error: null, model };
  }

  const name = input.modelOther!;
  const [make] = await db.select({ id: MK.id, slug: MK.slug }).from(MK).where(eq(MK.id, input.makeId));
  if (!make) return bad({ makeId: "required" });
  const [existing] = await db
    .select({ id: MD.id, slug: MD.slug })
    .from(MD)
    .where(and(eq(MD.makeId, make.id), sql`(lower(${MD.nameEn}) = lower(${name}) OR lower(${MD.nameAr}) = lower(${name}))`));
  if (existing) return { error: null, model: { id: existing.id, makeId: make.id, makeSlug: make.slug, modelSlug: existing.slug } };

  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(MD)
    .where(and(eq(MD.createdById, userId), eq(MD.isVerified, false)));
  if (pending >= MAX_PENDING_MODELS_PER_USER) return bad({ modelOther: "modelOther" });

  const base = slugifyModel(name) || "model";
  const [taken] = await db.select({ id: MD.id }).from(MD).where(and(eq(MD.makeId, make.id), eq(MD.slug, base)));
  const slug = taken ? `${base}-${shortId(4)}` : base;
  const [created] = await db
    .insert(MD)
    .values({ makeId: make.id, slug, nameEn: name, nameAr: name, bodyType: input.bodyType ?? null, isVerified: false, createdById: userId })
    .returning({ id: MD.id, slug: MD.slug });
  return { error: null, model: { id: created.id, makeId: make.id, makeSlug: make.slug, modelSlug: created.slug } };
}

async function submissionGaps(listingId: string, description: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(IMG)
    .where(eq(IMG.listingId, listingId));
  const missing: SaveResult["missing"] = [];
  if (n < IMAGE_MIN_COUNT) missing.push("photos");
  if (description.trim().length < MIN_DESCRIPTION_FOR_SUBMIT) missing.push("description");
  return missing;
}

/**
 * Create or update a listing. `intent: "submit"` also sends it to review when
 * nothing is missing. Ownership, suspension, refs and state are checked here.
 */
export async function saveListing(
  listingId: string | null,
  raw: Record<string, unknown>,
  intent: "draft" | "submit",
): Promise<ActionResult<SaveResult>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const parsed = listingInputSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const input = parsed.data;

  const refs = await verifyRefs(input, user.id);
  if (refs.error || !refs.model) return fail("validation", refs.error ?? undefined);

  const values = {
    makeId: input.makeId,
    modelId: refs.model.id,
    trim: input.trim ?? null,
    year: input.year,
    mileageKm: input.mileageKm,
    priceEgp: input.priceEgp,
    negotiable: input.negotiable,
    condition: input.condition,
    transmission: input.transmission,
    fuelType: input.fuelType,
    bodyType: input.bodyType ?? null,
    color: input.color ?? null,
    engineCc: input.engineCc ?? null,
    cityId: input.cityId,
    area: input.area ?? null,
    title: input.title,
    description: input.description,
    knownDefects: input.knownDefects ?? null,
  };

  let id: string;
  let slug: string;
  let status: schema.ListingStatus;

  if (!listingId) {
    if (!(await rateLimit("listingCreate", user.id))) return fail("rateLimited");
    slug = makeListingSlug(input.year, refs.model.makeSlug, refs.model.modelSlug);
    const [created] = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(L)
        .values({ ...values, sellerId: user.id, slug, status: "draft" })
        .returning({ id: L.id, slug: L.slug, status: L.status });
      await tx.insert(schema.listingPriceHistory).values({ listingId: rows[0].id, newPriceEgp: input.priceEgp });
      return rows;
    });
    ({ id, slug, status } = created);
  } else {
    const [existing] = await db
      .select()
      .from(L)
      .where(and(eq(L.id, listingId), isNull(L.deletedAt)));
    if (!existing) return fail("notFound");
    if (existing.sellerId !== user.id) return fail("forbidden");
    if (existing.status === "sold") return fail("invalidTransition");

    let newStatus = existing.status;
    if (existing.status === "published" && requiresReReview(existing, values)) newStatus = "pending_review";
    if (existing.status === "pending_review") newStatus = "pending_review";

    await db.transaction(async (tx) => {
      await tx
        .update(L)
        .set({
          ...values,
          status: newStatus,
          submittedAt: newStatus === "pending_review" && existing.status === "published" ? new Date() : existing.submittedAt,
          rejectionReason: newStatus === existing.status ? existing.rejectionReason : null,
        })
        .where(eq(L.id, existing.id));
      if (existing.priceEgp !== values.priceEgp) {
        await tx.insert(schema.listingPriceHistory).values({
          listingId: existing.id,
          oldPriceEgp: existing.priceEgp,
          newPriceEgp: values.priceEgp,
        });
      }
    });
    id = existing.id;
    slug = existing.slug;
    status = newStatus;
  }

  const missing = await submissionGaps(id, input.description);
  if (intent === "submit" && missing.length === 0) {
    const to = nextStatus(status, "submit");
    if (to) {
      await db.update(L).set({ status: to, submittedAt: new Date(), rejectionReason: null }).where(eq(L.id, id));
      status = to;
    }
  }

  revalidatePath("/[lang]/account/listings", "page");
  return ok({ id, slug, status, missing });
}

/** Owner-initiated status changes. */
export async function changeListingStatus(
  listingId: string,
  action: Extract<ListingAction, "submit" | "markSold" | "archive">,
): Promise<ActionResult<{ status: schema.ListingStatus }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const [l] = await db.select().from(L).where(and(eq(L.id, listingId), isNull(L.deletedAt)));
  if (!l) return fail("notFound");
  if (l.sellerId !== user.id) return fail("forbidden");
  const to = nextStatus(l.status, action);
  if (!to) return fail("invalidTransition");
  if (action === "submit") {
    const missing = await submissionGaps(l.id, l.description);
    if (missing.length) return fail("validation");
  }
  await db
    .update(L)
    .set({
      status: to,
      soldAt: to === "sold" ? new Date() : l.soldAt,
      submittedAt: to === "pending_review" ? new Date() : l.submittedAt,
      rejectionReason: to === "pending_review" ? null : l.rejectionReason,
    })
    .where(eq(L.id, l.id));
  revalidatePath("/[lang]/account/listings", "page");
  revalidatePath(`/[lang]/cars/${l.slug}`, "page");
  return ok({ status: to });
}

export async function deleteListing(listingId: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const [l] = await db.select().from(L).where(and(eq(L.id, listingId), isNull(L.deletedAt)));
  if (!l) return fail("notFound");
  if (l.sellerId !== user.id) return fail("forbidden");
  await db.update(L).set({ deletedAt: new Date(), status: "archived" }).where(eq(L.id, l.id));
  await audit(user.id, "listing.delete", "listing", l.id, { by: "owner" });
  revalidatePath("/[lang]/account/listings", "page");
  return ok(null);
}

/* Images */

async function ownedListing(listingId: string, userId: string) {
  const [l] = await db.select().from(L).where(and(eq(L.id, listingId), isNull(L.deletedAt)));
  if (!l) return { error: "notFound" as const };
  if (l.sellerId !== userId) return { error: "forbidden" as const };
  if (l.status === "sold") return { error: "invalidTransition" as const };
  return { listing: l };
}

export async function getListingImages(listingId: string) {
  const user = await getCurrentUser();
  if (!user) return [];
  const owned = await ownedListing(listingId, user.id);
  if (owned.error) return [];
  const rows = await db.select().from(IMG).where(eq(IMG.listingId, listingId)).orderBy(asc(IMG.position), asc(IMG.createdAt));
  return rows.map((r) => ({ id: r.id, thumbUrl: storage().publicUrl(r.thumbKey) }));
}

export async function reorderImages(listingId: string, orderedIds: string[]): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const owned = await ownedListing(listingId, user.id);
  if (owned.error) return fail(owned.error);
  const rows = await db
    .select({ id: IMG.id })
    .from(IMG)
    .where(eq(IMG.listingId, listingId))
    .orderBy(asc(IMG.position), asc(IMG.createdAt));
  const known = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== known.size || !orderedIds.every((id) => known.has(id))) return fail("validation");
  const coverChanged = rows[0]?.id !== orderedIds[0];
  await db.transaction(async (tx) => {
    for (const [i, imgId] of orderedIds.entries()) {
      await tx.update(IMG).set({ position: i }).where(and(eq(IMG.id, imgId), eq(IMG.listingId, listingId)));
    }
    // A new cover photo on a live listing needs another look.
    if (coverChanged && owned.listing.status === "published") {
      await tx.update(L).set({ status: "pending_review", submittedAt: new Date() }).where(eq(L.id, listingId));
    }
  });
  return ok(null);
}

export async function deleteImage(listingId: string, imageId: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const owned = await ownedListing(listingId, user.id);
  if (owned.error) return fail(owned.error);
  const [img] = await db
    .delete(IMG)
    .where(and(eq(IMG.id, imageId), eq(IMG.listingId, listingId)))
    .returning();
  if (!img) return fail("notFound");
  await Promise.allSettled([storage().delete(img.storageKey), storage().delete(img.thumbKey)]);
  return ok(null);
}
