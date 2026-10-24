import { storage, assertSafeKey } from "@/lib/storage";

// Serves files from the local storage driver (development). In production,
// images are served directly from the S3/Supabase public bucket URL.
export async function GET(_req: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key } = await ctx.params;
  const joined = key.join("/");
  try {
    assertSafeKey(joined);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!joined.startsWith("listings/")) return new Response("Not found", { status: 404 });
  const data = await storage().get(joined);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
