import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";
import { staffRole } from "@/server/care";
import { canManageCenter, CREDENTIAL_KINDS, profileEditable } from "@/lib/care";
import { DOCUMENT_MAX_BYTES, processDocument } from "@/lib/images";
import { privateStorage } from "@/lib/storage";

const UUID = /^[0-9a-f-]{36}$/i;
const err = (error: string, status: number) => Response.json({ ok: false, error }, { status });

/** Upload one credential document to private storage. Owners and managers of the center only. */
export async function POST(req: Request, ctx: RouteContext<"/api/care/centers/[id]/credentials">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return err("notFound", 404);
  const user = await getCurrentUser();
  if (!user) return err("unauthorized", 401);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > DOCUMENT_MAX_BYTES + 64 * 1024) return err("documentSize", 413);

  const [center] = await db.select().from(schema.serviceCenters).where(eq(schema.serviceCenters.id, id));
  if (!center) return err("notFound", 404);
  if (!canManageCenter(await staffRole(user.id, id))) return err("forbidden", 403);
  if (!profileEditable(center.status)) return err("invalidTransition", 409);
  if (!(await rateLimit("credentialUpload", user.id))) return err("rateLimited", 429);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.centerCredentials)
    .where(eq(schema.centerCredentials.centerId, id));
  if (n >= 30) return err("imageCount", 409);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("documentType", 400);
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  const number = String(form.get("number") ?? "").trim().slice(0, 60) || null;
  const expiresRaw = String(form.get("expiresAt") ?? "").trim();
  if (!(file instanceof File)) return err("documentType", 400);
  if (!CREDENTIAL_KINDS.includes(kind as (typeof CREDENTIAL_KINDS)[number])) return err("validation", 400);
  if (file.size > DOCUMENT_MAX_BYTES) return err("documentSize", 413);
  let expiresAt: Date | null = null;
  if (expiresRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresRaw)) return err("validation", 400);
    expiresAt = new Date(`${expiresRaw}T23:59:59Z`);
    if (Number.isNaN(expiresAt.getTime())) return err("validation", 400);
  }

  const processed = await processDocument(Buffer.from(await file.arrayBuffer()));
  if ("error" in processed) return err(processed.error === "imageSize" ? "documentSize" : "documentType", 400);

  const docId = crypto.randomUUID();
  const fileKey = `centers/${id}/credentials/${docId}.${processed.ext}`;
  try {
    await privateStorage().put(fileKey, processed.data, processed.contentType);
  } catch (e) {
    console.error("[care] private storage unavailable", e);
    return err("documentsUnavailable", 503);
  }
  await db.transaction(async (tx) => {
    await tx.insert(schema.centerCredentials).values({
      id: docId,
      centerId: id,
      kind: kind as (typeof CREDENTIAL_KINDS)[number],
      number,
      fileKey,
      contentType: processed.contentType,
      expiresAt,
      uploadedById: user.id,
    });
    await audit(user.id, "center.credential.upload", "service_center", id, { credentialId: docId, kind }, tx);
  });
  return Response.json({ ok: true, id: docId });
}

export const dynamic = "force-dynamic";
