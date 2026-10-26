import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { privateStorage } from "@/lib/storage";

const UUID = /^[0-9a-f-]{36}$/i;

/** Streams a vehicle licence image to the listing's seller or an admin only. Never cached. */
export async function GET(_req: Request, ctx: RouteContext<"/api/licence/[id]/[side]">) {
  const { id, side } = await ctx.params;
  if (!UUID.test(id) || (side !== "front" && side !== "back")) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const [row] = await db
    .select({ frontKey: schema.listingLicenceChecks.frontKey, backKey: schema.listingLicenceChecks.backKey, frontType: schema.listingLicenceChecks.frontType, backType: schema.listingLicenceChecks.backType, sellerId: schema.listings.sellerId })
    .from(schema.listingLicenceChecks)
    .innerJoin(schema.listings, eq(schema.listings.id, schema.listingLicenceChecks.listingId))
    .where(eq(schema.listingLicenceChecks.id, id));
  if (!row) return new Response("Not found", { status: 404 });
  if (user.role !== "admin" && user.id !== row.sellerId) return new Response("Forbidden", { status: 403 });
  const key = side === "front" ? row.frontKey : row.backKey;
  const type = side === "front" ? row.frontType : row.backType;
  if (!key || !type) return new Response("Not found", { status: 404 });
  const data = await privateStorage().get(key);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="licence-${side}.${type === "application/pdf" ? "pdf" : "webp"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

export const dynamic = "force-dynamic";
