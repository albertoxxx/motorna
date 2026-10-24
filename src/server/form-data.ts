import "server-only";
import { getCities, getMakes, getModels } from "@/server/listings";

export async function listingFormOptions() {
  const [makes, models, cities] = await Promise.all([getMakes(), getModels(), getCities()]);
  return {
    makes: makes.map(({ id, slug, nameEn, nameAr }) => ({ id, slug, nameEn, nameAr })),
    models: models.map(({ id, makeId, slug, nameEn, nameAr, bodyType }) => ({ id, makeId, slug, nameEn, nameAr, bodyType })),
    cities: cities.map(({ id, slug, nameEn, nameAr }) => ({ id, slug, nameEn, nameAr })),
  };
}
