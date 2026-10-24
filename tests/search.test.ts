/**
 * Every search filter and sort must actually change the database results.
 * Builds a small fixed inventory, then checks each filter in isolation.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

const { db, schema } = await import("@/db");
const { searchListings } = await import("@/server/listings");
const { parseSearchParams } = await import("@/lib/search-params");

const tag = `srch${Date.now().toString(36)}`;
type Row = { make: string; model: string; year: number; km: number; price: number; trans: "automatic" | "manual"; fuel: "petrol" | "diesel" | "electric"; body: "sedan" | "suv" | "hatchback"; cond: "new" | "used"; city: number; status?: "published" | "pending_review" | "rejected" | "sold" };

const ROWS: Row[] = [
  { make: "toyota", model: "corolla", year: 2015, km: 150000, price: 400000, trans: "manual", fuel: "petrol", body: "sedan", cond: "used", city: 1 },
  { make: "toyota", model: "fortuner", year: 2021, km: 60000, price: 2200000, trans: "automatic", fuel: "diesel", body: "suv", cond: "used", city: 2 },
  { make: "kia", model: "picanto", year: 2023, km: 0, price: 750000, trans: "automatic", fuel: "petrol", body: "hatchback", cond: "new", city: 1 },
  { make: "byd", model: "atto-3", year: 2025, km: 500, price: 1800000, trans: "automatic", fuel: "electric", body: "suv", cond: "new", city: 2 },
  // Never visible in search:
  { make: "kia", model: "picanto", year: 2022, km: 10000, price: 600000, trans: "automatic", fuel: "petrol", body: "hatchback", cond: "used", city: 1, status: "pending_review" },
  { make: "kia", model: "picanto", year: 2022, km: 10000, price: 600000, trans: "automatic", fuel: "petrol", body: "hatchback", cond: "used", city: 1, status: "rejected" },
];

async function search(params: Record<string, string>) {
  const res = await searchListings(parseSearchParams({ q: tag, ...params }));
  return res.items;
}

beforeAll(async () => {
  const sellerId = crypto.randomUUID();
  await db.insert(schema.users).values({ id: sellerId, name: "Search Seller", email: `${tag}@test.local` });
  for (const [i, r] of ROWS.entries()) {
    const [m] = await db
      .select({ makeId: schema.vehicleModels.makeId, modelId: schema.vehicleModels.id })
      .from(schema.vehicleModels)
      .innerJoin(schema.vehicleMakes, eq(schema.vehicleMakes.id, schema.vehicleModels.makeId))
      .where(sql`${schema.vehicleMakes.slug} = ${r.make} AND ${schema.vehicleModels.slug} = ${r.model}`);
    await db.insert(schema.listings).values({
      slug: `${tag}-${i}`,
      sellerId,
      makeId: m.makeId,
      modelId: m.modelId,
      year: r.year,
      mileageKm: r.km,
      priceEgp: r.price,
      transmission: r.trans,
      fuelType: r.fuel,
      bodyType: r.body,
      condition: r.cond,
      cityId: r.city,
      title: `Listing ${tag} ${i}`,
      status: r.status ?? "published",
      publishedAt: new Date(Date.now() - i * 60_000),
    });
  }
});

describe("search filters hit the database", () => {
  it("only published listings are returned", async () => {
    expect(await search({})).toHaveLength(4);
  });

  it.each([
    [{ make: "toyota" }, 2],
    [{ make: "toyota", model: "fortuner" }, 1],
    [{ priceMin: "1000000" }, 2],
    [{ priceMax: "800000" }, 2],
    [{ priceMin: "500000", priceMax: "1900000" }, 2],
    [{ yearMin: "2021" }, 3],
    [{ yearMax: "2016" }, 1],
    [{ mileageMax: "1000" }, 2],
    [{ condition: "new" }, 2],
    [{ transmission: "manual" }, 1],
    [{ fuel: "electric" }, 1],
    [{ body: "suv" }, 2],
    [{ city: "cairo" }, 2],
    [{ make: "kia", condition: "used" }, 0],
  ])("%o → %i result(s)", async (params, n) => {
    expect(await search(params as Record<string, string>)).toHaveLength(n);
  });

  it("sorting orders results", async () => {
    const asc = (await search({ sort: "price_asc" })).map((r) => r.priceEgp);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = (await search({ sort: "price_desc" })).map((r) => r.priceEgp);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    const km = (await search({ sort: "mileage_asc" })).map((r) => r.mileageKm);
    expect(km).toEqual([...km].sort((a, b) => a - b));
    const yr = (await search({ sort: "year_desc" })).map((r) => r.year);
    expect(yr).toEqual([...yr].sort((a, b) => b - a));
  });

  it("keyword search matches make/model names in Arabic and English", async () => {
    const en = await searchListings(parseSearchParams({ q: `${tag} Fortuner` }));
    expect(en.items.map((i) => i.modelNameEn)).toEqual(["Fortuner"]);
    const ar = await searchListings(parseSearchParams({ q: `${tag} فورتشنر` }));
    expect(ar.items).toHaveLength(1);
  });
});
