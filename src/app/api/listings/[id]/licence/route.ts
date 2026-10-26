import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";
import { DOCUMENT_MAX_BYTES, processDocument } from "@/lib/images";
import { privateStorage } from "@/lib/storage";

const UUID = /^[0-9a-f-]{36}$/i;
const err = (error: string, status: number) => Response.json({ ok: false, error }, { status });
const LC = schema.listingLicenceChecks;

/**
 * The seller uploads the vehicle licence for one of their listings (front required, back optional).
 * Files go to private storage; only the seller and admins can open them, and they're deleted
 * 30 days after review. One pending check per listing.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/listings/[id]/licence">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return err("notFound", 404);
  const user = await getCurrentUser();
  if (!user) return err("unauthorized", 401);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 2 * DOCUMENT_MAX_BYTES + 64 * 1024) return err("documentSize", 413);
  const [listing] = await db.select().from(schema.listings).where(and(eq(schema.listings.id, id), isNull(schema.listings.deletedAt)));
  if (!listing || listing.sellerId !== user.id) return err("notFound", 404);
  if (!["draft", "pending_review", "published", "rejected"].includes(listing.status)) return err("invalidTransition", 409);
  const [pending] = await db.select({ id: LC.id }).from(LC).where(and(eq(LC.listingId, id), eq(LC.status, "pending")));
  if (pending) return err("licencePending", 409);
  if (!(await rateLimit("licenceUpload", user.id))) return err("rateLimited", 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("documentType", 400);
  }
  const front = form.get("front");
  const back = form.get("back");
  if (!(front instanceof File) || front.size === 0) return err("documentType", 400);
  const files: ["front" | "back", File][] = [["front", front]];
  if (back instanceof File && back.size > 0) files.push(["back", back]);
  const checkId = crypto.randomUUID();
  const stored: Record<string, { key: string; type: string }> = {};
  for (const [side, f] of files) {
    if (f.size > DOCUMENT_MAX_BYTES) return err("documentSize", 413);
    const p = await processDocument(Buffer.from(await f.arrayBuffer()));
    if ("error" in p) return err(p.error === "imageSize" ? "documentSize" : "documentType", 400);
    const key = `listings/${id}/licence/${checkId}-${side}.${p.ext}`;
    try {
      await privateStorage().put(key, p.data, p.contentType);
    } catch {
      return err("documentsUnavailable", 503);
    }
    stored[side] = { key, type: p.contentType };
  }
  try {
    await db.transaction(async (tx) => {
      await tx.insert(LC).values({
        id: checkId,
        listingId: id,
        frontKey: stored.front.key,
        frontType: stored.front.type,
        backKey: stored.back?.key ?? null,
        backType: stored.back?.type ?? null,
        snapshotMakeId: listing.makeId,
        snapshotModelId: listing.modelId,
        snapshotYear: listing.year,
        submittedById: user.id,
      });
      await audit(user.id, "listing.licence.submit", "listing", id, { checkId, back: !!stored.back }, tx);
    });
  } catch {
    for (const s of Object.values(stored)) await privateStorage().delete(s.key).catch(() => {});
    return err("licencePending", 409);
  }
  return Response.json({ ok: true, id: checkId });
}
