import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const N = schema.notifications;

export const BOOKING_NOTIFICATION_KINDS = [
  "booking_new",
  "booking_confirmed",
  "booking_declined",
  "booking_alternative",
  "booking_alternative_accepted",
  "booking_alternative_declined",
  "booking_question",
  "booking_reply",
  "booking_rescheduled",
  "booking_cancelled",
  "booking_cancelled_provider",
  "booking_completed",
  "booking_no_show",
  "booking_reminder",
  "booking_confirm_reminder",
  "booking_expired",
  "booking_dispute",
  "booking_dispute_resolved",
  "booking_review",
] as const;
export const NOTIFICATION_KINDS = ["listing_approved", "listing_rejected", "listing_taken_down", "message", "center_status", "licence_accepted", "licence_rejected", ...BOOKING_NOTIFICATION_KINDS] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

type Tx = Pick<typeof db, "insert">;

/**
 * Creates an in-app notification. With a dedupeKey, an existing unread notification with the
 * same key is refreshed instead of adding another (one item per busy conversation).
 */
export async function createNotification(
  userId: string,
  kind: NotificationKind,
  data: Record<string, string | null>,
  href: string,
  dedupeKey?: string,
  tx: Tx = db,
) {
  if (!href.startsWith("/") || href.startsWith("//")) throw new Error("Notification links must be local paths");
  const values = { userId, kind, data, href, dedupeKey: dedupeKey ?? null };
  if (!dedupeKey) {
    await tx.insert(N).values(values);
    return;
  }
  await tx
    .insert(N)
    .values(values)
    .onConflictDoUpdate({
      target: [N.userId, N.dedupeKey],
      targetWhere: sql`${N.readAt} IS NULL AND ${N.dedupeKey} IS NOT NULL`,
      set: { data, href, kind, createdAt: new Date() },
    });
}

export async function unreadNotificationCount(userId: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(N).where(and(eq(N.userId, userId), isNull(N.readAt)));
  return n;
}

export async function listNotifications(userId: string, limit = 50) {
  return db
    .select({ id: N.id, kind: N.kind, data: N.data, href: N.href, readAt: N.readAt, createdAt: N.createdAt })
    .from(N)
    .where(eq(N.userId, userId))
    .orderBy(desc(N.createdAt))
    .limit(limit);
}

/** Marks a conversation's message notification read when its thread is opened. */
export async function markConversationNotificationsRead(userId: string, conversationId: string) {
  await db
    .update(N)
    .set({ readAt: new Date() })
    .where(and(eq(N.userId, userId), eq(N.dedupeKey, `conv:${conversationId}`), isNull(N.readAt)));
}
