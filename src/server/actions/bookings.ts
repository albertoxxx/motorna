"use server";

import { and, eq, inArray, or, sql, lt, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser, type CurrentUser } from "@/server/session";
import { rateLimit } from "@/server/rate-limit";
import { fail, ok, type ActionResult, type ErrorKey } from "@/server/result";
import { fieldErrors } from "@/lib/validation";
import {
  ACTIVE,
  MAX_PROPOSALS,
  bookingRequestSchema,
  bookingSettingsSchema,
  cairoToUtc,
  completionSchema,
  newReference,
  timeOptionSchema,
  withinSchedule,
  type BookingStatus,
  type StaffRole,
} from "@/lib/booking";
import { staffRole } from "@/server/care";
import { bookingSettings, centerBookable, scheduleConfig } from "@/server/bookings";
import {
  BookingError,
  applyTransition,
  capacityFree,
  lockBooking,
  lockCenter,
  notifyBooking,
  recordLedger,
  setLedgerForBooking,
  slotAvailable,
  type LockedBooking,
  type Tx,
} from "@/server/booking-engine";

const { bookings: B, bookingTimeOptions: TO, bookingMessages: MSG, serviceCompletions: SC, centerReviews: RV, bookingDisputes: DP, auditLogs: AL } = schema;
const { serviceCenters: C, centerServices: SV, customerVehicles: VEH, vehicleModels: MD, centerBookingSettings: CBS, centerClosures: CL } = schema;

const ERR: Record<BookingError["code"], ErrorKey> = {
  invalidTransition: "bookingTransition",
  forbidden: "forbidden",
  tooLate: "bookingTooLate",
  tooEarly: "bookingTooEarly",
  reasonRequired: "bookingReasonRequired",
  windowClosed: "bookingWindowClosed",
  invalidOutcome: "validation",
  notFound: "notFound",
  slotTaken: "slotTaken",
  stale: "bookingStale",
  bookingUnavailable: "bookingUnavailable",
  validation: "validation",
  proposalLimit: "validation",
};

/** Runs a booking mutation in one transaction and maps rule violations to user-facing errors. */
async function run<T>(fn: (tx: Tx) => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await db.transaction(fn));
  } catch (e) {
    if (e instanceof BookingError) return fail(ERR[e.code]);
    throw e;
  }
}

const revalidate = (b?: { reference: string; centerSlug: string }) => {
  revalidatePath("/[lang]/account", "layout");
  revalidatePath("/[lang]/center", "layout");
  revalidatePath("/[lang]/admin", "layout");
  if (b) revalidatePath(`/[lang]/care/centers/${b.centerSlug}`, "page");
};

const UUID = z.uuid();
const reasonSchema = z.string().trim().min(3).max(500);
const messageSchema = z.string().trim().min(1).max(1000);

type Times = z.infer<typeof timeOptionSchema>[];
const toInstant = (t: { date: string; time: string }) => cairoToUtc(t.date, t.time);

/**
 * Validates requested/proposed times. Slot mode: exactly one time, which must have free capacity.
 * Manual mode: up to `max` distinct times inside opening hours.
 */
async function checkTimes(tx: Tx, centerId: string, mode: "slots" | "manual", times: Times, durationMin: number, excludeBookingId: string | undefined, max: number) {
  const instants = [...new Map(times.map((t) => [toInstant(t).getTime(), toInstant(t)])).values()];
  if (!instants.length || instants.length > max) throw new BookingError("validation");
  if (mode === "slots" && instants.length !== 1) throw new BookingError("validation");
  await lockCenter(tx, centerId);
  const cfg = await scheduleConfig(centerId, tx);
  for (const at of instants) {
    if (!withinSchedule(cfg, at, durationMin)) throw new BookingError("slotTaken");
    if (mode === "slots" && !(await slotAvailable(tx, centerId, at, durationMin, excludeBookingId))) throw new BookingError("slotTaken");
  }
  return instants.sort((a, b) => a.getTime() - b.getTime());
}

async function insertOptions(tx: Tx, bookingId: string, kind: "requested" | "proposed", instants: Date[], durationMin: number, by: string) {
  const [{ r }] = await tx.select({ r: sql<number>`coalesce(max(${TO.round}), 0)::int` }).from(TO).where(eq(TO.bookingId, bookingId));
  await tx.insert(TO).values(instants.map((s) => ({ bookingId, kind, round: r + 1, startsAt: s, endsAt: new Date(s.getTime() + durationMin * 60_000), createdById: by })));
}

const closeOpenOptions = (tx: Tx, bookingId: string, state: "declined" | "withdrawn") =>
  tx.update(TO).set({ state }).where(and(eq(TO.bookingId, bookingId), eq(TO.state, "open")));

/* ================================ Customer ================================ */

export async function createBooking(raw: unknown): Promise<ActionResult<{ reference: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const parsed = bookingRequestSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const input = parsed.data;

  // Double submission: the same form key returns the booking already created.
  const [existing] = await db.select({ reference: B.reference }).from(B).where(and(eq(B.customerId, user.id), eq(B.requestKey, input.requestKey)));
  if (existing) return ok({ reference: existing.reference });
  if (!(await rateLimit("bookingCreate", user.id))) return fail("rateLimited");

  if (!(await centerBookable(input.centerId))) return fail("bookingUnavailable");
  if (await staffRole(user.id, input.centerId)) return fail("forbidden");
  const [svc] = await db.select().from(SV).where(and(eq(SV.id, input.serviceId), eq(SV.centerId, input.centerId), eq(SV.active, true), eq(SV.bookable, true)));
  if (!svc) return fail("bookingUnavailable");

  // Vehicle: one of the customer's saved vehicles, or details typed in the form.
  let vehicle: { id: string | null; makeId: number; modelId: number | null; modelText: string | null; year: number; mileageKm: number | null };
  if (input.vehicleId) {
    const [v] = await db.select().from(VEH).where(and(eq(VEH.id, input.vehicleId), eq(VEH.userId, user.id)));
    if (!v) return fail("validation", { vehicleId: "required" });
    vehicle = { id: v.id, makeId: v.makeId, modelId: v.modelId, modelText: null, year: v.year, mileageKm: v.mileageKm };
  } else if (input.vehicle) {
    const v = input.vehicle;
    if (v.modelId) {
      const [m] = await db.select({ makeId: MD.makeId }).from(MD).where(eq(MD.id, v.modelId));
      if (!m || m.makeId !== v.makeId) return fail("validation", { modelId: "modelMismatch" });
    }
    vehicle = { id: null, makeId: v.makeId, modelId: v.modelId ?? null, modelText: v.modelId ? null : v.modelText || null, year: v.year, mileageKm: v.mileageKm ?? null };
  } else return fail("validation", { vehicle: "required" });

  const settings = await bookingSettings(input.centerId);
  const res = await run(async (tx) => {
    const instants = await checkTimes(tx, input.centerId, settings.mode, input.times, svc.durationMin, undefined, settings.mode === "slots" ? 1 : 3);
    // One open booking per customer per center for overlapping times.
    const first = instants[0];
    const last = new Date(instants[instants.length - 1].getTime() + svc.durationMin * 60_000);
    const [clash] = await tx
      .select({ id: B.id })
      .from(B)
      .leftJoin(TO, and(eq(TO.bookingId, B.id), eq(TO.state, "open")))
      .where(
        and(
          eq(B.customerId, user.id),
          eq(B.centerId, input.centerId),
          inArray(B.status, ACTIVE),
          or(and(lt(B.startsAt, last), gt(B.endsAt, first)), and(lt(TO.startsAt, last), gt(TO.endsAt, first))),
        ),
      )
      .limit(1);
    if (clash) throw new BookingError("slotTaken");

    if (!vehicle.id && input.vehicle?.save) {
      const [v] = await tx
        .insert(VEH)
        .values({ userId: user.id, makeId: vehicle.makeId, modelId: vehicle.modelId, year: vehicle.year, mileageKm: vehicle.mileageKm })
        .returning({ id: VEH.id });
      vehicle.id = v.id;
    }
    let reference = newReference();
    for (let i = 0; i < 3; i++) {
      const [taken] = await tx.select({ id: B.id }).from(B).where(eq(B.reference, reference));
      if (!taken) break;
      reference = newReference();
    }
    const [b] = await tx
      .insert(B)
      .values({
        reference,
        centerId: input.centerId,
        serviceId: svc.id,
        customerId: user.id,
        vehicleId: vehicle.id,
        status: "pending_provider",
        mode: settings.mode,
        serviceNameAr: svc.nameAr,
        serviceNameEn: svc.nameEn,
        serviceCategory: svc.category,
        priceMode: svc.priceMode,
        priceEgp: svc.priceEgp,
        priceMaxEgp: svc.priceMaxEgp,
        durationMin: svc.durationMin,
        vehicleMakeId: vehicle.makeId,
        vehicleModelId: vehicle.modelId,
        vehicleModelText: vehicle.modelText,
        vehicleYear: vehicle.year,
        vehicleMileageKm: vehicle.mileageKm,
        cancelCutoffHours: settings.cancelCutoffHours,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        customerNote: input.note || null,
        requestKey: input.requestKey,
      })
      .onConflictDoNothing()
      .returning();
    if (!b) throw new BookingError("stale");
    await insertOptions(tx, b.id, "requested", instants, svc.durationMin, user.id);
    await tx.insert(schema.bookingEvents).values({ bookingId: b.id, action: "submit", fromStatus: null, toStatus: "pending_provider", actorId: user.id, actorRole: "customer" });
    await tx.insert(AL).values({ actorId: user.id, action: "booking.submit", entityType: "booking", entityId: b.id, metadata: { reference, centerId: input.centerId, serviceId: svc.id, mode: settings.mode } });
    const locked = await lockBooking(tx, b.id);
    await notifyBooking(tx, locked!, "booking_new", "staff");
    return { reference, centerSlug: locked!.centerSlug };
  });
  if (!res.ok) {
    // A concurrent duplicate submission with the same key: return the first booking.
    const [dupe] = await db.select({ reference: B.reference }).from(B).where(and(eq(B.customerId, user.id), eq(B.requestKey, input.requestKey)));
    if (dupe) return ok({ reference: dupe.reference });
    return res;
  }
  revalidate(res.data);
  return ok({ reference: res.data.reference });
}

/** Loads a booking for its customer inside the transaction (404 for anyone else). */
async function customerLock(tx: Tx, user: CurrentUser, bookingId: string) {
  const b = await lockBooking(tx, bookingId);
  if (!b || b.customerId !== user.id) throw new BookingError("notFound");
  return b;
}

const customerActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), message: messageSchema }),
  z.object({ action: z.literal("acceptAlternative"), optionId: UUID }),
  z.object({ action: z.literal("declineAlternative"), times: z.array(timeOptionSchema).min(1).max(3), message: messageSchema.optional() }),
  z.object({ action: z.literal("reschedule"), times: z.array(timeOptionSchema).min(1).max(3) }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().max(500).optional() }),
]);

export async function customerBookingAction(bookingId: string, raw: unknown): Promise<ActionResult<{ status: BookingStatus }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!UUID.safeParse(bookingId).success) return fail("notFound");
  const parsed = customerActionSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  if (!(await rateLimit("bookingAction", user.id))) return fail("rateLimited");
  const a = parsed.data;
  let ref: LockedBooking | null = null;
  const res = await run(async (tx) => {
    const b = await customerLock(tx, user, bookingId);
    ref = b;
    const base = { actor: "customer" as const, actorId: user.id };
    switch (a.action) {
      case "reply": {
        const to = await applyTransition(tx, b, { ...base, action: "reply" });
        await tx.insert(MSG).values({ bookingId: b.id, authorId: user.id, authorRole: "customer", body: a.message });
        await notifyBooking(tx, b, "booking_reply", "managers");
        return { status: to };
      }
      case "acceptAlternative": {
        const [opt] = await tx.select().from(TO).where(and(eq(TO.id, a.optionId), eq(TO.bookingId, b.id), eq(TO.kind, "proposed"), eq(TO.state, "open")));
        if (!opt || opt.startsAt <= new Date()) throw new BookingError("slotTaken");
        await lockCenter(tx, b.centerId);
        if (!(await capacityFree(tx, b.centerId, opt.startsAt, opt.endsAt, b.id))) throw new BookingError("slotTaken");
        const to = await applyTransition(tx, b, { ...base, action: "acceptAlternative", set: { startsAt: opt.startsAt, endsAt: opt.endsAt } });
        await tx.update(TO).set({ state: "accepted" }).where(eq(TO.id, opt.id));
        await closeOpenOptions(tx, b.id, "declined");
        await notifyBooking(tx, b, "booking_alternative_accepted", "staff");
        return { status: to };
      }
      case "declineAlternative": {
        const instants = await checkTimes(tx, b.centerId, b.mode, a.times, b.durationMin, b.id, b.mode === "slots" ? 1 : 3);
        const to = await applyTransition(tx, b, { ...base, action: "declineAlternative" });
        await closeOpenOptions(tx, b.id, "declined");
        await insertOptions(tx, b.id, "requested", instants, b.durationMin, user.id);
        if (a.message) await tx.insert(MSG).values({ bookingId: b.id, authorId: user.id, authorRole: "customer", body: a.message });
        await notifyBooking(tx, b, "booking_alternative_declined", "managers");
        return { status: to };
      }
      case "reschedule": {
        const instants = await checkTimes(tx, b.centerId, b.mode, a.times, b.durationMin, b.id, b.mode === "slots" ? 1 : 3);
        const to = await applyTransition(tx, b, { ...base, action: "reschedule", set: { startsAt: null, endsAt: null, confirmedAt: null, reminderSentAt: null } });
        await closeOpenOptions(tx, b.id, "withdrawn");
        await insertOptions(tx, b.id, "requested", instants, b.durationMin, user.id);
        await notifyBooking(tx, b, "booking_rescheduled", "staff");
        return { status: to };
      }
      case "cancel": {
        const to = await applyTransition(tx, b, { ...base, action: "cancel", reason: a.reason || null });
        await closeOpenOptions(tx, b.id, "withdrawn");
        await notifyBooking(tx, b, "booking_cancelled", "staff", { late: b.lateCancel ? "1" : null });
        return { status: to };
      }
    }
  });
  if (res.ok) revalidate(ref ?? undefined);
  return res;
}

/** The customer confirms the service was done; this also verifies the commission record. */
export async function confirmCompletion(bookingId: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!UUID.safeParse(bookingId).success) return fail("notFound");
  const res = await run(async (tx) => {
    const b = await customerLock(tx, user, bookingId);
    if (b.status !== "completed") throw new BookingError("invalidTransition");
    const now = new Date();
    const upd = await tx.update(SC).set({ customerConfirmedAt: now }).where(and(eq(SC.bookingId, b.id), sql`${SC.customerConfirmedAt} IS NULL`)).returning({ id: SC.bookingId });
    if (!upd.length) return null;
    await tx.update(schema.commissionLedger).set({ customerConfirmedAt: now }).where(eq(schema.commissionLedger.bookingId, b.id));
    await setLedgerForBooking(tx, b.id, "confirmed", user.id, "customer_confirmed", ["pending_verification"]);
    await tx.insert(AL).values({ actorId: user.id, action: "booking.customerConfirmed", entityType: "booking", entityId: b.id, metadata: { reference: b.reference } });
    return null;
  });
  if (res.ok) revalidate();
  return res;
}

const reviewSchema = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() });

/** One review per completed booking, by its customer only. */
export async function submitReview(bookingId: string, raw: unknown): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!UUID.safeParse(bookingId).success) return fail("notFound");
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const res = await run(async (tx) => {
    const b = await customerLock(tx, user, bookingId);
    if (b.status !== "completed") throw new BookingError("invalidTransition");
    const [completion] = await tx.select({ done: SC.serviceCompleted }).from(SC).where(eq(SC.bookingId, b.id));
    if (!completion?.done) throw new BookingError("invalidTransition");
    const [row] = await tx
      .insert(RV)
      .values({ bookingId: b.id, centerId: b.centerId, customerId: user.id, rating: parsed.data.rating, comment: parsed.data.comment || null })
      .onConflictDoNothing({ target: RV.bookingId })
      .returning({ id: RV.id });
    if (!row) throw new BookingError("stale");
    await notifyBooking(tx, b, "booking_review", "managers", { rating: String(parsed.data.rating) });
    return null;
  });
  if (res.ok) revalidate();
  return res;
}

const disputeSchema = z.object({
  kind: z.enum(["no_show_dispute", "late_cancellation", "service_unavailable", "completion_disagreement", "price_disagreement", "conduct", "support", "other"]),
  description: z.string().trim().min(5).max(2000),
});

/**
 * Report a problem. "support" requests never change the booking status; other kinds move a
 * finished booking to `disputed` within its window and freeze its commission record.
 */
export async function openBookingDispute(bookingId: string, raw: unknown): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!UUID.safeParse(bookingId).success) return fail("notFound");
  const parsed = disputeSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  if (!(await rateLimit("report", user.id))) return fail("rateLimited");
  const d = parsed.data;
  const res = await run(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (!b) throw new BookingError("notFound");
    const role: "customer" | StaffRole | null = b.customerId === user.id ? "customer" : await staffRole(user.id, b.centerId);
    if (!role || role === "technician") throw new BookingError("notFound");
    const [already] = await tx.select({ id: DP.id }).from(DP).where(and(eq(DP.bookingId, b.id), inArray(DP.status, ["open", "reviewing"]), d.kind === "support" ? eq(DP.kind, "support") : sql`${DP.kind} <> 'support'`));
    if (already) throw new BookingError("stale");
    const prior = b.status;
    if (d.kind !== "support") {
      const [ev] = await tx
        .select({ at: schema.bookingEvents.createdAt })
        .from(schema.bookingEvents)
        .where(and(eq(schema.bookingEvents.bookingId, b.id), eq(schema.bookingEvents.toStatus, b.status)))
        .orderBy(sql`${schema.bookingEvents.createdAt} desc`)
        .limit(1);
      await applyTransition(tx, b, { action: "openDispute", actor: role, actorId: user.id, reason: d.description, statusSince: ev?.at ?? b.updatedAt, set: { preDisputeStatus: prior } });
      await setLedgerForBooking(tx, b.id, "disputed", user.id, "dispute_opened", ["pending_verification", "confirmed"]);
    }
    await tx.insert(DP).values({ bookingId: b.id, openedById: user.id, openedByRole: role === "customer" ? "customer" : "provider", kind: d.kind, description: d.description, priorStatus: prior });
    await tx.insert(AL).values({ actorId: user.id, action: "booking.dispute", entityType: "booking", entityId: b.id, metadata: { reference: b.reference, kind: d.kind } });
    await notifyBooking(tx, b, "booking_dispute", role === "customer" ? "managers" : "customer");
    return null;
  });
  if (res.ok) revalidate();
  return res;
}

const vehicleSchema = z.object({
  makeId: z.coerce.number().int().min(1).max(32767),
  modelId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().positive().optional()),
  year: z.coerce.number().int().min(1950).max(2100),
  mileageKm: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).max(3_000_000).optional()),
  nickname: z.string().trim().max(40).optional(),
});

export async function saveVehicle(vehicleId: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const parsed = vehicleSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const v = parsed.data;
  if (v.modelId) {
    const [m] = await db.select({ makeId: MD.makeId }).from(MD).where(eq(MD.id, v.modelId));
    if (!m || m.makeId !== v.makeId) return fail("validation", { modelId: "modelMismatch" });
  }
  const values = { makeId: v.makeId, modelId: v.modelId ?? null, year: v.year, mileageKm: v.mileageKm ?? null, nickname: v.nickname || null };
  if (vehicleId) {
    if (!UUID.safeParse(vehicleId).success) return fail("notFound");
    const [row] = await db.update(VEH).set(values).where(and(eq(VEH.id, vehicleId), eq(VEH.userId, user.id))).returning({ id: VEH.id });
    if (!row) return fail("notFound");
    revalidate();
    return ok({ id: row.id });
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(VEH).where(eq(VEH.userId, user.id));
  if (n >= 10) return fail("rateLimited");
  const [row] = await db.insert(VEH).values({ ...values, userId: user.id }).returning({ id: VEH.id });
  revalidate();
  return ok({ id: row.id });
}

export async function deleteVehicle(vehicleId: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!UUID.safeParse(vehicleId).success) return fail("notFound");
  const rows = await db.delete(VEH).where(and(eq(VEH.id, vehicleId), eq(VEH.userId, user.id))).returning({ id: VEH.id });
  if (!rows.length) return fail("notFound");
  revalidate();
  return ok(null);
}

/* ================================ Provider ================================ */

/** Loads a booking for an active staff member of its center (404 for everyone else). */
async function providerLock(tx: Tx, user: CurrentUser, bookingId: string) {
  const b = await lockBooking(tx, bookingId);
  if (!b) throw new BookingError("notFound");
  const role = await staffRole(user.id, b.centerId);
  if (!role) throw new BookingError("notFound");
  return { b, role };
}

const providerActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), optionId: UUID }),
  z.object({ action: z.literal("propose"), times: z.array(timeOptionSchema).min(1).max(MAX_PROPOSALS), message: messageSchema.optional() }),
  z.object({ action: z.literal("ask"), message: messageSchema }),
  z.object({ action: z.literal("decline"), reason: reasonSchema }),
  z.object({ action: z.literal("providerCancel"), reason: reasonSchema }),
  z.object({ action: z.literal("checkIn") }),
  z.object({ action: z.literal("complete"), completion: z.unknown() }),
  z.object({ action: z.literal("noShow") }),
]);

export async function providerBookingAction(bookingId: string, raw: unknown): Promise<ActionResult<{ status: BookingStatus }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!UUID.safeParse(bookingId).success) return fail("notFound");
  const parsed = providerActionSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  if (!(await rateLimit("bookingAction", user.id))) return fail("rateLimited");
  const a = parsed.data;
  let completion: z.infer<typeof completionSchema> | null = null;
  if (a.action === "complete") {
    const c = completionSchema.safeParse(a.completion);
    if (!c.success) return fail("validation", fieldErrors(c.error));
    completion = c.data;
  }
  let ref: LockedBooking | null = null;
  const res = await run(async (tx) => {
    const { b, role } = await providerLock(tx, user, bookingId);
    ref = b;
    const base = { actor: role, actorId: user.id };
    // A suspended or revoked center keeps its history but can't take on new commitments.
    const newCommitment = a.action === "accept" || a.action === "propose";
    if (newCommitment && b.centerStatus !== "approved") throw new BookingError("bookingUnavailable");
    switch (a.action) {
      case "accept": {
        const [opt] = await tx.select().from(TO).where(and(eq(TO.id, a.optionId), eq(TO.bookingId, b.id), eq(TO.kind, "requested"), eq(TO.state, "open")));
        if (!opt || opt.startsAt <= new Date()) throw new BookingError("slotTaken");
        await lockCenter(tx, b.centerId);
        // The provider may accept at short notice, but never over capacity.
        if (!(await capacityFree(tx, b.centerId, opt.startsAt, opt.endsAt, b.id))) throw new BookingError("slotTaken");
        const to = await applyTransition(tx, b, { ...base, action: "accept", set: { startsAt: opt.startsAt, endsAt: opt.endsAt } });
        await tx.update(TO).set({ state: "accepted" }).where(eq(TO.id, opt.id));
        await closeOpenOptions(tx, b.id, "declined");
        await notifyBooking(tx, b, "booking_confirmed", "customer", { at: opt.startsAt.toISOString() });
        return { status: to };
      }
      case "propose": {
        const instants = await checkTimes(tx, b.centerId, "manual", a.times, b.durationMin, b.id, MAX_PROPOSALS);
        for (const st of instants) {
          if (!(await capacityFree(tx, b.centerId, st, new Date(st.getTime() + b.durationMin * 60_000), b.id))) throw new BookingError("slotTaken");
        }
        const to = await applyTransition(tx, b, { ...base, action: "propose" });
        await closeOpenOptions(tx, b.id, "declined");
        await insertOptions(tx, b.id, "proposed", instants, b.durationMin, user.id);
        if (a.message) await tx.insert(MSG).values({ bookingId: b.id, authorId: user.id, authorRole: "provider", body: a.message });
        await notifyBooking(tx, b, "booking_alternative", "customer");
        return { status: to };
      }
      case "ask": {
        const to = await applyTransition(tx, b, { ...base, action: "ask" });
        await tx.insert(MSG).values({ bookingId: b.id, authorId: user.id, authorRole: "provider", body: a.message });
        await notifyBooking(tx, b, "booking_question", "customer");
        return { status: to };
      }
      case "decline": {
        const to = await applyTransition(tx, b, { ...base, action: "decline", reason: a.reason });
        await closeOpenOptions(tx, b.id, "declined");
        await notifyBooking(tx, b, "booking_declined", "customer", { reason: a.reason });
        return { status: to };
      }
      case "providerCancel": {
        const to = await applyTransition(tx, b, { ...base, action: "providerCancel", reason: a.reason });
        await notifyBooking(tx, b, "booking_cancelled_provider", "customer", { reason: a.reason });
        return { status: to };
      }
      case "checkIn": {
        const to = await applyTransition(tx, b, { ...base, action: "checkIn" });
        return { status: to };
      }
      case "noShow": {
        const to = await applyTransition(tx, b, { ...base, action: "noShow" });
        await tx.insert(SC).values({ bookingId: b.id, attended: false, serviceCompleted: false, recordedById: user.id }).onConflictDoNothing();
        await notifyBooking(tx, b, "booking_no_show", "customer");
        return { status: to };
      }
      case "complete": {
        const c = completion!;
        if (!c.serviceCompleted) {
          // Customer came, but the service couldn't be done: a provider cancellation with the reason.
          if (role === "technician") throw new BookingError("forbidden");
          const reason = c.workSummary && c.workSummary.length >= 3 ? c.workSummary : null;
          const to = await applyTransition(tx, b, { ...base, action: "providerCancel", reason });
          await tx.insert(SC).values({ bookingId: b.id, attended: true, serviceCompleted: false, workSummary: c.workSummary || null, recordedById: user.id }).onConflictDoNothing();
          await notifyBooking(tx, b, "booking_cancelled_provider", "customer", { reason });
          return { status: to };
        }
        const now = new Date();
        const to = await applyTransition(tx, b, { ...base, action: "complete", set: { completedAt: now } });
        await tx.insert(SC).values({ bookingId: b.id, attended: true, serviceCompleted: true, finalAmountEgp: c.finalAmountEgp ?? null, workSummary: c.workSummary || null, mileageKm: c.mileageKm ?? null, recordedById: user.id, recordedAt: now });
        await recordLedger(tx, b, user.id);
        await notifyBooking(tx, b, "booking_completed", "customer");
        return { status: to };
      }
    }
  });
  if (res.ok) revalidate(ref ?? undefined);
  return res;
}

/* ============================ Provider settings ============================ */

async function requireManager(centerId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" as const };
  if (!UUID.safeParse(centerId).success) return { error: "notFound" as const };
  const role = await staffRole(user.id, centerId);
  if (role !== "owner" && role !== "manager") return { error: "forbidden" as const };
  const [center] = await db.select({ id: C.id, slug: C.slug, status: C.status }).from(C).where(eq(C.id, centerId));
  if (!center) return { error: "notFound" as const };
  return { user, center };
}

export async function saveBookingSettings(centerId: string, raw: unknown): Promise<ActionResult<null>> {
  const s = await requireManager(centerId);
  if ("error" in s) return fail(s.error!);
  const parsed = bookingSettingsSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const current = await bookingSettings(centerId);
  // The provider can only start accepting once MOTORNA has enabled the pilot for an approved center.
  if (parsed.data.accepting && (!current.pilotEnabled || s.center.status !== "approved")) return fail("bookingUnavailable");
  await db.transaction(async (tx) => {
    await tx.insert(CBS).values({ centerId, ...parsed.data }).onConflictDoUpdate({ target: CBS.centerId, set: parsed.data });
    await tx.insert(AL).values({ actorId: s.user.id, action: "center.bookingSettings", entityType: "service_center", entityId: centerId, metadata: parsed.data });
  });
  revalidate({ reference: "", centerSlug: s.center.slug });
  return ok(null);
}

const closureSchema = z
  .object({ startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), reason: z.string().trim().max(120).optional() })
  .transform((v) => ({ startsAt: cairoToUtc(v.startDate, v.startTime), endsAt: cairoToUtc(v.endDate, v.endTime), reason: v.reason || null }))
  .refine((v) => v.endsAt > v.startsAt, { path: ["endDate"], message: "closureRange" });

export async function addClosure(centerId: string, raw: unknown): Promise<ActionResult<null>> {
  const s = await requireManager(centerId);
  if ("error" in s) return fail(s.error!);
  const parsed = closureSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  await db.transaction(async (tx) => {
    await tx.insert(CL).values({ centerId, ...parsed.data, createdById: s.user.id });
    await tx.insert(AL).values({ actorId: s.user.id, action: "center.closure.add", entityType: "service_center", entityId: centerId, metadata: { startsAt: parsed.data.startsAt.toISOString(), endsAt: parsed.data.endsAt.toISOString() } });
  });
  revalidate({ reference: "", centerSlug: s.center.slug });
  return ok(null);
}

export async function removeClosure(centerId: string, closureId: string): Promise<ActionResult<null>> {
  const s = await requireManager(centerId);
  if ("error" in s) return fail(s.error!);
  if (!UUID.safeParse(closureId).success) return fail("notFound");
  const rows = await db.delete(CL).where(and(eq(CL.id, closureId), eq(CL.centerId, centerId))).returning({ id: CL.id });
  if (!rows.length) return fail("notFound");
  await db.insert(AL).values({ actorId: s.user.id, action: "center.closure.remove", entityType: "service_center", entityId: centerId, metadata: { closureId } });
  revalidate({ reference: "", centerSlug: s.center.slug });
  return ok(null);
}

/* ============================ Reads for the wizard ============================ */

/**
 * Bookable start times for a service on a Cairo date. Slot mode: only times with free capacity.
 * Manual mode: every start inside opening hours (capacity is checked when the provider accepts).
 */
export async function bookingTimes(centerId: string, serviceId: string, date: string): Promise<ActionResult<{ start: string; label: string }[]>> {
  if (!UUID.safeParse(centerId).success || !UUID.safeParse(serviceId).success || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("validation");
  if (!(await centerBookable(centerId))) return fail("bookingUnavailable");
  const [svc] = await db.select({ d: SV.durationMin }).from(SV).where(and(eq(SV.id, serviceId), eq(SV.centerId, centerId), eq(SV.active, true), eq(SV.bookable, true)));
  if (!svc) return fail("bookingUnavailable");
  const settings = await bookingSettings(centerId);
  if (settings.mode === "slots") {
    const { availableSlots } = await import("@/server/bookings");
    return ok(await availableSlots(centerId, svc.d, date));
  }
  const cfg = await scheduleConfig(centerId);
  const { daySlots } = await import("@/lib/booking");
  return ok(daySlots({ ...cfg, capacity: Number.MAX_SAFE_INTEGER }, date, svc.d, []).map((s) => ({ start: s.start.toISOString(), label: s.label })));
}
