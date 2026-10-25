"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { createNotification } from "@/server/notifications";
import { getCurrentUser } from "@/server/session";
import { rateLimit } from "@/server/rate-limit";
import { fail, ok, type ActionResult } from "@/server/result";
import { fieldErrors, messageSchema, reportSchema } from "@/lib/validation";

const { listings: L, favorites: F, conversations: CV, messages: M, reports: R, users: U } = schema;

async function publishedListing(listingId: string) {
  const [l] = await db
    .select({ id: L.id, sellerId: L.sellerId, status: L.status, slug: L.slug, title: L.title, showPhone: L.showPhone })
    .from(L)
    .where(and(eq(L.id, listingId), isNull(L.deletedAt)));
  return l && l.status === "published" ? l : null;
}

export async function toggleFavorite(listingId: string): Promise<ActionResult<{ saved: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!(await rateLimit("favorite", user.id))) return fail("rateLimited");
  const removed = await db
    .delete(F)
    .where(and(eq(F.userId, user.id), eq(F.listingId, listingId)))
    .returning({ id: F.listingId });
  if (removed.length) {
    revalidatePath("/[lang]/account/favorites", "page");
    return ok({ saved: false });
  }
  const l = await publishedListing(listingId);
  if (!l) return fail("listingUnavailable");
  await db.insert(F).values({ userId: user.id, listingId }).onConflictDoNothing();
  revalidatePath("/[lang]/account/favorites", "page");
  return ok({ saved: true });
}

/** Starts (or continues) a conversation with the seller about a listing. */
export async function contactSeller(
  listingId: string,
  body: string,
): Promise<ActionResult<{ conversationId: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return fail("validation", { body: "messageLength" });
  const l = await publishedListing(listingId);
  if (!l) return fail("listingUnavailable");
  if (l.sellerId === user.id) return fail("ownListing");

  const [existing] = await db
    .select({ id: CV.id })
    .from(CV)
    .where(and(eq(CV.listingId, listingId), eq(CV.buyerId, user.id)));
  if (!existing && !(await rateLimit("newConversation", user.id))) return fail("rateLimited");
  if (!(await rateLimit("message", user.id))) return fail("rateLimited");

  const conversationId = await db.transaction(async (tx) => {
    let id = existing?.id;
    if (!id) {
      const [c] = await tx
        .insert(CV)
        .values({ listingId, buyerId: user.id, sellerId: l.sellerId })
        .onConflictDoUpdate({ target: [CV.listingId, CV.buyerId], set: { lastMessageAt: new Date() } })
        .returning({ id: CV.id });
      id = c.id;
    }
    await tx.insert(M).values({ conversationId: id, senderId: user.id, body: parsed.data });
    await tx.update(CV).set({ lastMessageAt: new Date() }).where(eq(CV.id, id));
    // In-app notice for the seller (no message text in the notification itself).
    await createNotification(l.sellerId, "message", { from: user.name, listing: l.title }, `/account/messages/${id}`, `conv:${id}`, tx);
    return id;
  });
  revalidatePath("/[lang]/account/messages", "layout");
  return ok({ conversationId });
}

export async function sendMessage(conversationId: string, body: string): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return fail("validation", { body: "messageLength" });
  const [c] = await db.select().from(CV).where(eq(CV.id, conversationId));
  if (!c) return fail("notFound");
  if (c.buyerId !== user.id && c.sellerId !== user.id) return fail("forbidden");
  const [l] = await db.select({ status: L.status, deletedAt: L.deletedAt }).from(L).where(eq(L.id, c.listingId));
  // Buyers can't keep messaging once a listing is gone; sellers can still reply.
  if (c.buyerId === user.id && (!l || l.deletedAt || !["published", "sold"].includes(l.status))) {
    return fail("listingUnavailable");
  }
  if (!(await rateLimit("message", user.id))) return fail("rateLimited");
  const [m] = await db.transaction(async (tx) => {
    const rows = await tx.insert(M).values({ conversationId, senderId: user.id, body: parsed.data }).returning({ id: M.id });
    await tx.update(CV).set({ lastMessageAt: new Date() }).where(eq(CV.id, conversationId));
    const [t] = await tx.select({ title: L.title }).from(L).where(eq(L.id, c.listingId));
    const recipient = c.buyerId === user.id ? c.sellerId : c.buyerId;
    await createNotification(recipient, "message", { from: user.name, listing: t?.title ?? "" }, `/account/messages/${conversationId}`, `conv:${conversationId}`, tx);
    return rows;
  });
  revalidatePath("/[lang]/account/messages", "layout");
  return ok({ id: m.id });
}

export async function reportListing(
  listingId: string,
  raw: { reason: string; details?: string },
): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const [l] = await db.select({ id: L.id, sellerId: L.sellerId }).from(L).where(eq(L.id, listingId));
  if (!l) return fail("notFound");
  if (!(await rateLimit("report", user.id))) return fail("rateLimited");
  // One open report per user per listing; repeated taps update the details.
  const [open] = await db
    .select({ id: R.id })
    .from(R)
    .where(and(eq(R.listingId, listingId), eq(R.reporterId, user.id), sql`${R.status} IN ('open','reviewing')`));
  if (open) {
    await db.update(R).set({ reason: parsed.data.reason, details: parsed.data.details ?? null }).where(eq(R.id, open.id));
  } else {
    await db.insert(R).values({
      reporterId: user.id,
      listingId,
      reportedUserId: l.sellerId,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
    });
  }
  return ok(null);
}

/** Reveals the seller's phone to a signed-in user, only if the seller opted in on this listing. */
export async function revealPhone(listingId: string): Promise<ActionResult<{ phone: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!(await rateLimit("phoneReveal", user.id))) return fail("rateLimited");
  const l = await publishedListing(listingId);
  if (!l) return fail("listingUnavailable");
  // Per-listing consent is the only switch; the profile number is used only when it's on.
  if (!l.showPhone) return fail("forbidden");
  const [s] = await db.select({ phone: U.phone }).from(U).where(eq(U.id, l.sellerId));
  if (!s?.phone) return fail("forbidden");
  return ok({ phone: s.phone });
}
