import "server-only";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  CONFIRM_REMINDER_DAYS_BEFORE,
  LEDGER_AUTO_CONFIRM_DAYS,
  actorKind,
  hasCapacity,
  ledgerEntryFor,
  transition,
  withinSchedule,
  type ActorRole,
  type BookingAction,
  type BookingStatus,
  type StaffRole,
  type TransitionError,
} from "@/lib/booking";
import { createNotification, type NotificationKind } from "@/server/notifications";
import { busyIntervals, centerStaffIds, scheduleConfig } from "@/server/bookings";

const { bookings: B, bookingTimeOptions: TO, bookingEvents: EV, serviceCenters: C, auditLogs: AL, commissionLedger: LG, commissionAgreements: AG, serviceCompletions: SC } = schema;

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type LockedBooking = typeof B.$inferSelect & { centerSlug: string; centerNameAr: string; centerNameEn: string; centerStatus: schema.CenterStatus };

/** Locks the booking row for the rest of the transaction. */
export async function lockBooking(tx: Tx, bookingId: string): Promise<LockedBooking | null> {
  const [b] = await tx.select().from(B).where(eq(B.id, bookingId)).for("update");
  if (!b) return null;
  const [c] = await tx.select({ slug: C.slug, nameAr: C.nameAr, nameEn: C.nameEn, status: C.status }).from(C).where(eq(C.id, b.centerId));
  return { ...b, centerSlug: c.slug, centerNameAr: c.nameAr, centerNameEn: c.nameEn, centerStatus: c.status };
}

/** Serialises capacity checks per center (two customers can't take the last seat). */
export async function lockCenter(tx: Tx, centerId: string) {
  await tx.select({ id: C.id }).from(C).where(eq(C.id, centerId)).for("update");
}

/** Checks a time fits the schedule and has free capacity (call after lockCenter). */
export async function slotAvailable(tx: Tx, centerId: string, start: Date, durationMin: number, excludeBookingId?: string, now = new Date()) {
  const cfg = await scheduleConfig(centerId, tx);
  if (!withinSchedule(cfg, start, durationMin, now)) return false;
  const end = new Date(start.getTime() + durationMin * 60_000);
  const busy = await busyIntervals(centerId, start, end, excludeBookingId, tx);
  return hasCapacity(cfg, busy, { start, end });
}

/** Capacity only (no notice/advance window): used when confirming a time that was already offered. */
export async function capacityFree(tx: Tx, centerId: string, start: Date, end: Date, excludeBookingId?: string) {
  const cfg = await scheduleConfig(centerId, tx);
  const busy = await busyIntervals(centerId, start, end, excludeBookingId, tx);
  return hasCapacity(cfg, busy, { start, end });
}

export class BookingError extends Error {
  constructor(public code: TransitionError | "notFound" | "slotTaken" | "stale" | "bookingUnavailable" | "validation" | "proposalLimit") {
    super(code);
  }
}

type Apply = {
  action: BookingAction;
  actor: ActorRole | StaffRole;
  actorId: string | null;
  reason?: string | null;
  outcome?: BookingStatus;
  statusSince?: Date;
  /** Extra column updates (e.g. startsAt when confirming). */
  set?: Partial<typeof B.$inferInsert>;
  now?: Date;
};

/** Runs the state machine on a locked booking and persists status + event + audit. */
export async function applyTransition(tx: Tx, b: LockedBooking, a: Apply): Promise<BookingStatus> {
  const res = transition({
    status: b.status,
    action: a.action,
    actor: a.actor,
    startsAt: b.startsAt,
    cancelCutoffHours: b.cancelCutoffHours,
    statusSince: a.statusSince,
    reason: a.reason,
    lateCancel: b.lateCancel,
    outcome: a.outcome,
    now: a.now,
  });
  if (!res.ok) throw new BookingError(res.error);
  const set: Partial<typeof B.$inferInsert> = { status: res.to, ...a.set };
  if (res.lateCancel !== undefined) set.lateCancel = res.lateCancel;
  if (a.reason !== undefined && a.reason !== null) set.statusReason = a.reason;
  if (res.to === "confirmed" && !set.confirmedAt) set.confirmedAt = a.now ?? new Date();
  // Optimistic guard on top of the row lock: the status must still be what we read.
  const updated = await tx
    .update(B)
    .set(set)
    .where(and(eq(B.id, b.id), eq(B.status, b.status)))
    .returning({ id: B.id });
  if (!updated.length) throw new BookingError("stale");
  const role = actorKind(a.actor);
  await tx.insert(EV).values({ bookingId: b.id, action: a.action, fromStatus: b.status, toStatus: res.to, actorId: a.actorId, actorRole: role, note: a.reason ?? null });
  await tx.insert(AL).values({ actorId: a.actorId, action: `booking.${a.action}`, entityType: "booking", entityId: b.id, metadata: { reference: b.reference, from: b.status, to: res.to, actorRole: role } });
  Object.assign(b, set);
  return res.to;
}

/* ------------------------------- Notifications ------------------------------- */

type Audience = "customer" | "staff" | "managers";

/** In-app notification(s) for a booking event. One unread item per booking per person (dedupe). */
export async function notifyBooking(tx: Tx, b: LockedBooking, kind: NotificationKind, audience: Audience, extra: Record<string, string | null> = {}) {
  const data = { ref: b.reference, centerAr: b.centerNameAr, centerEn: b.centerNameEn, serviceAr: b.serviceNameAr, serviceEn: b.serviceNameEn, ...extra };
  if (audience === "customer") {
    await createNotification(b.customerId, kind, data, `/account/bookings/${b.reference}`, `bk:${b.id}`, tx);
    return;
  }
  const ids = await centerStaffIds(b.centerId, audience === "managers" ? ["owner", "manager"] : ["owner", "manager", "technician"], tx);
  for (const id of ids) {
    if (id === b.customerId) continue;
    await createNotification(id, kind, data, `/center/${b.centerSlug}/bookings/${b.reference}`, `bk:${b.id}`, tx);
  }
}

/* ------------------------------- Ledger ------------------------------- */

/**
 * Creates the commission ledger row for a completed booking, if an agreement covers it.
 * Unique per booking (DB) and only for completed bookings (DB trigger + ledgerEntryFor).
 */
export async function recordLedger(tx: Tx, b: LockedBooking, actorId: string | null) {
  const [completion] = await tx.select().from(SC).where(eq(SC.bookingId, b.id));
  if (!completion || !b.completedAt) return null;
  const ags = await tx.select().from(AG).where(eq(AG.centerId, b.centerId));
  const entry = ledgerEntryFor(
    { status: b.status, category: b.serviceCategory, completedAt: b.completedAt, serviceCompleted: completion.serviceCompleted, finalAmountEgp: completion.finalAmountEgp },
    ags.map((a) => ({ ...a, categories: a.categories as string[] | null })),
  );
  if (!entry) return null;
  const a = entry.agreement;
  const [row] = await tx
    .insert(LG)
    .values({
      bookingId: b.id,
      centerId: b.centerId,
      agreementId: a.id,
      bookingReference: b.reference,
      agreedPriceEgp: b.priceMode === "fixed" ? b.priceEgp : null,
      completedAmountEgp: completion.finalAmountEgp!,
      basis: a.basis,
      percentBps: a.basis === "percent" ? a.percentBps : null,
      fixedEgp: a.basis === "fixed" ? a.fixedEgp : null,
      commissionEgp: entry.commissionEgp,
      providerConfirmedAt: completion.recordedAt,
      completedAt: b.completedAt,
    })
    .onConflictDoNothing({ target: LG.bookingId })
    .returning({ id: LG.id });
  if (row) await tx.insert(AL).values({ actorId, action: "commission.accrued", entityType: "commission_ledger", entityId: row.id, metadata: { reference: b.reference, commissionEgp: entry.commissionEgp, agreementId: a.id } });
  return row?.id ?? null;
}

/** Moves the booking's ledger row (if any) to a new status, logging it. */
export async function setLedgerForBooking(tx: Tx, bookingId: string, to: schema.LedgerStatus, actorId: string | null, why: string, onlyFrom?: schema.LedgerStatus[]) {
  const [row] = await tx.select({ id: LG.id, status: LG.status }).from(LG).where(eq(LG.bookingId, bookingId)).for("update");
  if (!row || row.status === to || row.status === "settled") return;
  if (onlyFrom && !onlyFrom.includes(row.status)) return;
  await tx.update(LG).set({ status: to }).where(eq(LG.id, row.id));
  await tx.insert(AL).values({ actorId, action: `commission.${to}`, entityType: "commission_ledger", entityId: row.id, metadata: { from: row.status, why } });
}

/* ------------------------------- System jobs ------------------------------- */

/** Expires one stale open request (re-checked under lock). */
export async function expireBooking(bookingId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (!b) return false;
    const [open] = await tx
      .select({ id: TO.id })
      .from(TO)
      .where(and(eq(TO.bookingId, b.id), eq(TO.state, "open"), sql`${TO.startsAt} > ${now}`))
      .limit(1);
    if (open) return false;
    try {
      await applyTransition(tx, b, { action: "expire", actor: "system", actorId: null, now });
    } catch (e) {
      if (e instanceof BookingError) return false;
      throw e;
    }
    await tx.update(TO).set({ state: "withdrawn" }).where(and(eq(TO.bookingId, b.id), eq(TO.state, "open")));
    await notifyBooking(tx, b, "booking_expired", "customer");
    await notifyBooking(tx, b, "booking_expired", "managers");
    return true;
  });
}

/**
 * The daily job: expire stale requests, send tomorrow's reminders, auto-confirm ledger rows
 * 7 days after completion when nobody disputed. Idempotent.
 */
export async function runCareMaintenance(now = new Date()) {
  const { expireStale } = await import("@/server/bookings");
  const expired = await expireStale({}, now);

  // Reminders for confirmed appointments in the next ~36 hours, once per booking.
  const soon = await db
    .select({ id: B.id })
    .from(B)
    .where(and(eq(B.status, "confirmed"), isNull(B.reminderSentAt), sql`${B.startsAt} > ${now}`, lt(B.startsAt, new Date(now.getTime() + 36 * 3_600_000))));
  let reminded = 0;
  for (const { id } of soon) {
    await db.transaction(async (tx) => {
      const b = await lockBooking(tx, id);
      if (!b || b.status !== "confirmed" || b.reminderSentAt) return;
      await tx.update(B).set({ reminderSentAt: now }).where(eq(B.id, id));
      await notifyBooking(tx, b, "booking_reminder", "customer", { at: b.startsAt!.toISOString() });
      await notifyBooking(tx, b, "booking_reminder", "staff", { at: b.startsAt!.toISOString() });
      reminded++;
    });
  }

  // "Confirm or report a problem" reminder, once, a couple of days before the window closes.
  const remindBefore = new Date(now.getTime() - (LEDGER_AUTO_CONFIRM_DAYS - CONFIRM_REMINDER_DAYS_BEFORE) * 86_400_000);
  const windowStart = new Date(now.getTime() - LEDGER_AUTO_CONFIRM_DAYS * 86_400_000);
  const toConfirm = await db
    .select({ id: B.id })
    .from(B)
    .innerJoin(SC, eq(SC.bookingId, B.id))
    .where(and(eq(B.status, "completed"), eq(SC.serviceCompleted, true), isNull(SC.customerConfirmedAt), isNull(SC.confirmReminderSentAt), lt(B.completedAt, remindBefore), sql`${B.completedAt} > ${windowStart}`));
  let confirmReminders = 0;
  for (const { id } of toConfirm) {
    await db.transaction(async (tx) => {
      const b = await lockBooking(tx, id);
      if (!b || b.status !== "completed" || !b.completedAt) return;
      const upd = await tx.update(SC).set({ confirmReminderSentAt: now }).where(and(eq(SC.bookingId, id), isNull(SC.confirmReminderSentAt), isNull(SC.customerConfirmedAt))).returning({ id: SC.bookingId });
      if (!upd.length) return;
      const deadline = new Date(b.completedAt.getTime() + LEDGER_AUTO_CONFIRM_DAYS * 86_400_000);
      await notifyBooking(tx, b, "booking_confirm_reminder", "customer", { deadline: deadline.toISOString() });
      confirmReminders++;
    });
  }

  const cutoff = new Date(now.getTime() - LEDGER_AUTO_CONFIRM_DAYS * 86_400_000);
  const due = await db
    .select({ bookingId: LG.bookingId })
    .from(LG)
    .innerJoin(B, eq(B.id, LG.bookingId))
    .where(and(eq(LG.status, "pending_verification"), lt(LG.completedAt, cutoff), eq(B.status, "completed")));
  for (const { bookingId } of due) {
    await db.transaction((tx) => setLedgerForBooking(tx, bookingId, "confirmed", null, "auto_confirm_no_dispute", ["pending_verification"]));
  }
  return { expired, reminded, confirmReminders, autoConfirmed: due.length };
}

