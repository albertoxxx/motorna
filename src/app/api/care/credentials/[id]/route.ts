import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { staffRole } from "@/server/care";
import { canManageCenter } from "@/lib/care";
import { privateStorage } from "@/lib/storage";

const UUID = /^[0-9a-f-]{36}$/i;

/** Streams a private credential document to an admin or to the center's owner/manager. */
export async function GET(_req: Request, ctx: RouteContext<"/api/care/credentials/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const [doc] = await db.select().from(schema.centerCredentials).where(eq(schema.centerCredentials.id, id));
  if (!doc) return new Response("Not found", { status: 404 });
  const allowed = user.role === "admin" || canManageCenter(await staffRole(user.id, doc.centerId));
  if (!allowed) return new Response("Forbidden", { status: 403 });
  const data = await privateStorage().get(doc.fileKey);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename="${doc.kind}.${doc.contentType === "application/pdf" ? "pdf" : "webp"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

export const dynamic = "force-dynamic";
