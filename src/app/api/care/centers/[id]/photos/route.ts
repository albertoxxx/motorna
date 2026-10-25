import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";
import { staffRole } from "@/server/care";
import { canManageCenter, profileEditable } from "@/lib/care";
import { IMAGE_MAX_BYTES, processListingImage } from "@/lib/images";
import { storage } from "@/lib/storage";

const UUID = /^[0-9a-f-]{36}$/i;
const CENTER_PHOTO_MAX = 12;
const err = (error: string, status: number) => Response.json({ ok: false, error }, { status });

/** Upload one real photo of the center (owners/managers). Decoded, EXIF-stripped and re-encoded like listing photos. */
export async function POST(req: Request, ctx: RouteContext<"/api/care/centers/[id]/photos">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return err("notFound", 404);
  const user = await getCurrentUser();
  if (!user) return err("unauthorized", 401);
  if (Number(req.headers.get("content-length") ?? 0) > IMAGE_MAX_BYTES + 64 * 1024) return err("imageSize", 413);
  const [center] = await db.select().from(schema.serviceCenters).where(eq(schema.serviceCenters.id, id));
  if (!center) return err("notFound", 404);
  if (!canManageCenter(await staffRole(user.id, id))) return err("forbidden", 403);
  if (!profileEditable(center.status)) return err("invalidTransition", 409);
  if (!(await rateLimit("imageUpload", user.id))) return err("rateLimited", 429);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.centerPhotos).where(eq(schema.centerPhotos.centerId, id));
  if (n >= CENTER_PHOTO_MAX) return err("imageCount", 409);

  let file: File | null = null;
  try {
    const f = (await req.formData()).get("file");
    file = f instanceof File ? f : null;
  } catch {
    return err("imageType", 400);
  }
  if (!file) return err("imageType", 400);
  if (file.size > IMAGE_MAX_BYTES) return err("imageSize", 413);
  const processed = await processListingImage(Buffer.from(await file.arrayBuffer()));
  if ("error" in processed) return err(processed.error, 400);

  const photoId = crypto.randomUUID();
  const storageKey = `centers/${id}/photos/${photoId}.webp`;
  const thumbKey = `centers/${id}/photos/${photoId}_t.webp`;
  const s = storage();
  await s.put(storageKey, processed.full, "image/webp");
  await s.put(thumbKey, processed.thumb, "image/webp");
  await db.transaction(async (tx) => {
    await tx.insert(schema.centerPhotos).values({ id: photoId, centerId: id, storageKey, thumbKey, width: processed.width, height: processed.height, position: n, uploadedById: user.id });
    await audit(user.id, "center.photo.add", "service_center", id, { photoId }, tx);
  });
  return Response.json({ ok: true, photo: { id: photoId, thumbUrl: s.publicUrl(thumbKey) } });
}

export const dynamic = "force-dynamic";
