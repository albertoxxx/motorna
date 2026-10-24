import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCities, getMakes, getModelsForSeller } from "@/server/listings";

export async function listingFormOptions(userId: string) {
  const [makes, models, cities, [me]] = await Promise.all([
    getMakes(),
    getModelsForSeller(userId),
    getCities(),
    db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, userId)),
  ]);
  return {
    /** The seller's own saved number, used only to prefill the optional phone-consent field. */
    profilePhone: me?.phone ?? "",
    makes: makes.map(({ id, slug, nameEn, nameAr }) => ({ id, slug, nameEn, nameAr })),
    models: models.map(({ id, makeId, slug, nameEn, nameAr, bodyType }) => ({ id, makeId, slug, nameEn, nameAr, bodyType })),
    cities: cities.map(({ id, slug, nameEn, nameAr }) => ({ id, slug, nameEn, nameAr })),
  };
}
