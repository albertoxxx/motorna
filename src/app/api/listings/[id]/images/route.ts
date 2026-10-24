import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { rateLimit } from "@/server/rate-limit";
import { processListingImage, IMAGE_MAX_BYTES, IMAGE_MAX_COUNT } from "@/lib/images";
import { storage } from "@/lib/storage";

const { listings: L, listingImages: IMG } = schema;
const UUID = /^[0-9a-f-]{36}$/i;

function err(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}

/** Upload one image (multipart field "file") to a listing the caller owns. */
export async function POST(req: Request, ctx: RouteContext<"/api/listings/[id]/images">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return err("notFound", 404);
  const user = await getCurrentUser();
  if (!user) return err("unauthorized", 401);

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > IMAGE_MAX_BYTES + 64 * 1024) return err("imageSize", 413);

  const [listing] = await db.select().from(L).where(and(eq(L.id, id), isNull(L.deletedAt)));
  if (!listing) return err("notFound", 404);
  if (listing.sellerId !== user.id) return err("forbidden", 403);
  if (listing.status === "sold") return err("invalidTransition", 409);
  if (!(await rateLimit("imageUpload", user.id))) return err("rateLimited", 429);

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(IMG).where(eq(IMG.listingId, id));
  if (n >= IMAGE_MAX_COUNT) return err("imageCount", 409);

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return err("imageType", 400);
  }
  if (!file) return err("imageType", 400);
  if (file.size > IMAGE_MAX_BYTES) return err("imageSize", 413);

  const processed = await processListingImage(Buffer.from(await file.arrayBuffer()));
  if ("error" in processed) return err(processed.error, 400);

  const imgId = crypto.randomUUID();
  const storageKey = `listings/${id}/${imgId}.webp`;
  const thumbKey = `listings/${id}/${imgId}_t.webp`;
  const s = storage();
  await s.put(storageKey, processed.full, "image/webp");
  await s.put(thumbKey, processed.thumb, "image/webp");

  await db.transaction(async (tx) => {
    await tx.insert(IMG).values({
      id: imgId,
      listingId: id,
      storageKey,
      thumbKey,
      width: processed.width,
      height: processed.height,
      bytes: processed.full.byteLength,
      position: n,
    });
    // New photos on a live listing go back through review.
    if (listing.status === "published") {
      await tx.update(L).set({ status: "pending_review", submittedAt: new Date() }).where(eq(L.id, id));
    }
  });

  return Response.json({ ok: true, image: { id: imgId, thumbUrl: s.publicUrl(thumbKey) } });
}
