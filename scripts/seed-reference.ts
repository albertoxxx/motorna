/** Idempotent: safe to run in any environment. */
import { sql } from "drizzle-orm";
import { db, pool, schema } from "./db";
import { CITIES, MAKES } from "../src/db/reference-data";

async function main() {
  for (const c of CITIES) {
    await db
      .insert(schema.cities)
      .values({ ...c, isLaunch: c.isLaunch ?? false })
      .onConflictDoUpdate({
        target: schema.cities.id,
        set: { slug: c.slug, nameEn: c.nameEn, nameAr: c.nameAr, isLaunch: c.isLaunch ?? false, sortOrder: c.sortOrder },
      });
  }
  let models = 0;
  for (const m of MAKES) {
    const [make] = await db
      .insert(schema.vehicleMakes)
      .values({ slug: m.slug, nameEn: m.nameEn, nameAr: m.nameAr, isPopular: m.popular ?? false })
      .onConflictDoUpdate({
        target: schema.vehicleMakes.slug,
        set: { nameEn: m.nameEn, nameAr: m.nameAr, isPopular: m.popular ?? false },
      })
      .returning({ id: schema.vehicleMakes.id });
    for (const [slug, nameEn, nameAr, bodyType] of m.models) {
      await db
        .insert(schema.vehicleModels)
        .values({ makeId: make.id, slug, nameEn, nameAr, bodyType, isVerified: true })
        .onConflictDoUpdate({
          target: [schema.vehicleModels.makeId, schema.vehicleModels.slug],
          set: { nameEn, nameAr, bodyType, isVerified: true },
        });
      models++;
    }
  }
  const [{ n }] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM vehicle_makes`)).rows;
  console.log(`Reference data: ${CITIES.length} governorates, ${n} makes, ${models} models.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
