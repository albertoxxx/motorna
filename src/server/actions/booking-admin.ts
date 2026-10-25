"use server";

/**
 * Admin-only booking and commission operations: the booking pilot switch, dispute resolution,
 * review moderation, commission agreements, ledger adjustments and settlements.
 * Admins can never act on a center they are (or were) staff of.
 */
import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { fail, ok, type ActionResult } from "@/server/result";
import { fieldErrors } from "@/lib/validation";
import { RESOLVE_OUTCOMES, agreementSchema, cairoToUtc, canMoveLedger, newReference, type BookingStatus } from "@/lib/booking";
import { BookingError, applyTransition, lockBooking, notifyBooking, setLedgerForBooking } from "@/server/booking-engine";

const { bookingDisputes: DP, centerReviews: RV, centerBookingSettings: CBS, serviceCenters: C, auditLogs: AL } = schema;
const { commissionAgreements: AG, commissionLedger: LG, commissionAdjustments: ADJ, commissionSettlements: SET } = schema;
const UUID = z.uuid();

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" as const };
  if (user.role !== "admin") return { error: "forbidden" as const };
  return { admin: user };
}

async function isStaff(userId: string, centerId: string) {
  const [row] = await db
    .select({ u: schema.centerStaff.userId })
    .from(schema.centerStaff)
    .where(and(eq(schema.centerStaff.userId, userId), eq(schema.centerStaff.centerId, centerId)));
  return !!row;
}

const refresh = () => {
  revalidatePath("/[lang]/admin", "layout");
  revalidatePath("/[lang]/center", "layout");
  revalidatePath("/[lang]/account", "layout");
  revalidatePath("/[lang]/care", "layout");
};

/* ------------------------------- Pilot ------------------------------- */

/**
 * Turns online booking on or off for one center. Only for approved centers; turning it off also
 * stops the provider accepting. Existing bookings are unaffected either way.
 */
export async function setBookingPilot(centerId: string, enabled: boolean): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(centerId).success) return fail("notFound");
  const [c] = await db.select({ status: C.status }).from(C).where(eq(C.id, centerId));
  if (!c) return fail("notFound");
  if (await isStaff(a.admin.id, centerId)) return fail("conflictOfInterest");
  if (enabled && c.status !== "approved") return fail("bookingUnavailable");
  await db.transaction(async (tx) => {
    const set = enabled ? { pilotEnabled: true, pilotEnabledById: a.admin.id, pilotEnabledAt: new Date() } : { pilotEnabled: false, accepting: false };
    await tx.insert(CBS).values({ centerId, ...set }).onConflictDoUpdate({ target: CBS.centerId, set });
    await tx.insert(AL).values({ actorId: a.admin.id, action: enabled ? "booking.pilot.enable" : "booking.pilot.disable", entityType: "service_center", entityId: centerId, metadata: {} });
  });
  refresh();
  return ok(null);
}

/* ------------------------------- Disputes ------------------------------- */

const resolveSchema = z.object({
  decision: z.enum(["dismiss", ...RESOLVE_OUTCOMES] as [string, ...string[]]),
  note: z.string().trim().min(3).max(1000),
});

/**
 * Resolves a dispute. For a status dispute the admin picks the final outcome (or dismisses it,
 * restoring the prior status). The commission record follows: confirmed if the outcome is
 * completed, waived otherwise.
 */
export async function resolveDispute(disputeId: string, raw: unknown): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(disputeId).success) return fail("notFound");
  const parsed = resolveSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  try {
    await db.transaction(async (tx) => {
      const [d] = await tx.select().from(DP).where(eq(DP.id, disputeId)).for("update");
      if (!d || (d.status !== "open" && d.status !== "reviewing")) throw new BookingError("notFound");
      const b = await lockBooking(tx, d.bookingId);
      if (!b) throw new BookingError("notFound");
      if (await isStaff(a.admin.id, b.centerId)) throw new BookingError("forbidden");
      let outcome: BookingStatus | null = null;
      if (d.kind !== "support" && b.status === "disputed") {
        outcome = parsed.data.decision === "dismiss" ? (d.priorStatus as BookingStatus) : (parsed.data.decision as BookingStatus);
        await applyTransition(tx, b, { action: "resolve", actor: "admin", actorId: a.admin.id, reason: parsed.data.note, outcome, set: { preDisputeStatus: null } });
        if (outcome === "completed") await setLedgerForBooking(tx, b.id, "confirmed", a.admin.id, "dispute_resolved_completed", ["disputed"]);
        else await setLedgerForBooking(tx, b.id, "waived", a.admin.id, "dispute_resolved_not_completed");
      }
      await tx
        .update(DP)
        .set({ status: parsed.data.decision === "dismiss" ? "dismissed" : "resolved", outcomeStatus: outcome, resolution: parsed.data.note, resolvedById: a.admin.id, resolvedAt: new Date() })
        .where(eq(DP.id, d.id));
      await tx.insert(AL).values({ actorId: a.admin.id, action: "booking.dispute.resolve", entityType: "booking", entityId: b.id, metadata: { disputeId: d.id, decision: parsed.data.decision, outcome } });
      await notifyBooking(tx, b, "booking_dispute_resolved", "customer");
      await notifyBooking(tx, b, "booking_dispute_resolved", "managers");
    });
  } catch (e) {
    if (e instanceof BookingError) return fail(e.code === "forbidden" ? "conflictOfInterest" : e.code === "notFound" ? "notFound" : "bookingTransition");
    throw e;
  }
  refresh();
  return ok(null);
}

export async function setDisputeReviewing(disputeId: string): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(disputeId).success) return fail("notFound");
  const rows = await db.update(DP).set({ status: "reviewing" }).where(and(eq(DP.id, disputeId), eq(DP.status, "open"))).returning({ b: DP.bookingId });
  if (!rows.length) return fail("notFound");
  await db.insert(AL).values({ actorId: a.admin.id, action: "booking.dispute.reviewing", entityType: "booking", entityId: rows[0].b, metadata: { disputeId } });
  refresh();
  return ok(null);
}

/* ------------------------------- Reviews ------------------------------- */

export async function setReviewHidden(reviewId: string, hidden: boolean, reason?: string): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(reviewId).success) return fail("notFound");
  const r = hidden ? z.string().trim().min(3).max(300).safeParse(reason) : { success: true as const, data: null };
  if (!r.success) return fail("validation", { reason: "required" });
  const rows = await db.update(RV).set({ hidden, hiddenReason: hidden ? r.data : null }).where(eq(RV.id, reviewId)).returning({ centerId: RV.centerId });
  if (!rows.length) return fail("notFound");
  await db.insert(AL).values({ actorId: a.admin.id, action: hidden ? "review.hide" : "review.unhide", entityType: "center_review", entityId: reviewId, metadata: { reason: r.data } });
  refresh();
  return ok(null);
}

/* ------------------------------- Agreements ------------------------------- */

export async function createAgreement(centerId: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(centerId).success) return fail("notFound");
  if (await isStaff(a.admin.id, centerId)) return fail("conflictOfInterest");
  const parsed = agreementSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const v = parsed.data;
  const [c] = await db.select({ id: C.id }).from(C).where(eq(C.id, centerId));
  if (!c) return fail("notFound");
  const values = {
    centerId,
    status: "draft" as const,
    basis: v.basis,
    percentBps: v.basis === "percent" ? Math.round(v.percent! * 100) : null,
    fixedEgp: v.basis === "fixed" ? v.fixedEgp! : null,
    categories: v.categories?.length ? (v.categories as schema.CareCategory[]) : null,
    effectiveFrom: cairoToUtc(v.effectiveFrom, "00:00"),
    settlementSchedule: v.settlementSchedule,
    exceptions: v.exceptions || null,
    contractReference: v.contractReference || null,
    createdById: a.admin.id,
  };
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(AG).values(values).returning({ id: AG.id });
    await tx.insert(AL).values({ actorId: a.admin.id, action: "commission.agreement.create", entityType: "commission_agreement", entityId: row.id, metadata: { ...values, effectiveFrom: values.effectiveFrom.toISOString() } });
    return row.id;
  });
  refresh();
  return ok({ id });
}

const sameScope = (x: string[] | null, y: string[] | null) => x === null || y === null || x.some((c) => y.includes(c));

/** Activates a draft. Refuses if another active agreement already covers the same services. */
export async function activateAgreement(agreementId: string): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(agreementId).success) return fail("notFound");
  const [ag] = await db.select().from(AG).where(eq(AG.id, agreementId));
  if (!ag || ag.status !== "draft") return fail("notFound");
  if (await isStaff(a.admin.id, ag.centerId)) return fail("conflictOfInterest");
  const active = await db.select().from(AG).where(and(eq(AG.centerId, ag.centerId), eq(AG.status, "active")));
  const clash = active.find((o) => sameScope(o.categories as string[] | null, ag.categories as string[] | null) && (!o.effectiveTo || o.effectiveTo > ag.effectiveFrom));
  if (clash) return fail("agreementOverlap");
  await db.transaction(async (tx) => {
    await tx.update(AG).set({ status: "active" }).where(eq(AG.id, ag.id));
    await tx.insert(AL).values({ actorId: a.admin.id, action: "commission.agreement.activate", entityType: "commission_agreement", entityId: ag.id, metadata: {} });
  });
  refresh();
  return ok(null);
}

/** Ends an active agreement at a date (Cairo). Completions after that date get no commission under it. */
export async function endAgreement(agreementId: string, endDate: string): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(agreementId).success || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return fail("validation");
  const [ag] = await db.select().from(AG).where(eq(AG.id, agreementId));
  if (!ag || ag.status !== "active") return fail("notFound");
  if (await isStaff(a.admin.id, ag.centerId)) return fail("conflictOfInterest");
  const end = cairoToUtc(endDate, "00:00");
  if (end <= ag.effectiveFrom) return fail("validation", { endDate: "required" });
  await db.transaction(async (tx) => {
    await tx.update(AG).set({ status: "ended", effectiveTo: end }).where(eq(AG.id, ag.id));
    await tx.insert(AL).values({ actorId: a.admin.id, action: "commission.agreement.end", entityType: "commission_agreement", entityId: ag.id, metadata: { effectiveTo: end.toISOString() } });
  });
  refresh();
  return ok(null);
}

export async function deleteDraftAgreement(agreementId: string): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(agreementId).success) return fail("notFound");
  const rows = await db.delete(AG).where(and(eq(AG.id, agreementId), eq(AG.status, "draft"))).returning({ id: AG.id });
  if (!rows.length) return fail("notFound");
  await db.insert(AL).values({ actorId: a.admin.id, action: "commission.agreement.deleteDraft", entityType: "commission_agreement", entityId: agreementId, metadata: {} });
  refresh();
  return ok(null);
}

/* ------------------------------- Ledger ------------------------------- */

const adjustSchema = z.object({ deltaEgp: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0), reason: z.string().trim().min(3).max(500) });

/** Append-only correction. Settled or waived rows can't be adjusted; the effective amount never goes below 0. */
export async function adjustLedger(ledgerId: string, raw: unknown): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(ledgerId).success) return fail("notFound");
  const parsed = adjustSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const res = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(LG).where(eq(LG.id, ledgerId)).for("update");
    if (!row) return "notFound" as const;
    if (await isStaff(a.admin.id, row.centerId)) return "conflictOfInterest" as const;
    if (row.status === "settled" || row.status === "waived" || row.status === "payable") return "bookingTransition" as const;
    const [{ sum }] = await tx.select({ sum: sql<number>`coalesce(sum(${ADJ.deltaEgp}), 0)::int` }).from(ADJ).where(eq(ADJ.ledgerId, row.id));
    const next = row.commissionEgp + sum + parsed.data.deltaEgp;
    if (next < 0 || next > row.completedAmountEgp) return "validation" as const;
    await tx.insert(ADJ).values({ ledgerId: row.id, deltaEgp: parsed.data.deltaEgp, reason: parsed.data.reason, createdById: a.admin.id });
    await tx.insert(AL).values({ actorId: a.admin.id, action: "commission.adjust", entityType: "commission_ledger", entityId: row.id, metadata: { deltaEgp: parsed.data.deltaEgp, reason: parsed.data.reason, effectiveEgp: next } });
    return null;
  });
  if (res) return fail(res);
  refresh();
  return ok(null);
}

/** Manual verification moves: confirm or waive. Payable/settled happen only through settlements. */
export async function setLedgerStatus(ledgerId: string, to: "confirmed" | "waived", reason: string): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(ledgerId).success || (to !== "confirmed" && to !== "waived")) return fail("notFound");
  if (!z.string().trim().min(3).max(500).safeParse(reason).success) return fail("validation", { reason: "required" });
  const res = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(LG).where(eq(LG.id, ledgerId)).for("update");
    if (!row) return "notFound" as const;
    if (await isStaff(a.admin.id, row.centerId)) return "conflictOfInterest" as const;
    if (row.settlementId || !canMoveLedger(row.status, to)) return "bookingTransition" as const;
    // A disputed record follows the dispute, not a manual move.
    if (row.status === "disputed") return "bookingTransition" as const;
    await tx.update(LG).set({ status: to }).where(eq(LG.id, row.id));
    await tx.insert(AL).values({ actorId: a.admin.id, action: `commission.${to}`, entityType: "commission_ledger", entityId: row.id, metadata: { from: row.status, reason } });
    return null;
  });
  if (res) return fail(res);
  refresh();
  return ok(null);
}

/* ------------------------------- Settlements ------------------------------- */

const periodSchema = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * Issues a settlement statement for a center and period: every confirmed, unsettled ledger row
 * completed in the period becomes payable. Nothing is marked paid here.
 */
export async function createSettlement(centerId: string, raw: unknown): Promise<ActionResult<{ id: string; reference: string; totalEgp: number }>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(centerId).success) return fail("notFound");
  if (await isStaff(a.admin.id, centerId)) return fail("conflictOfInterest");
  const p = periodSchema.safeParse(raw);
  if (!p.success) return fail("validation", fieldErrors(p.error));
  const from = cairoToUtc(p.data.from, "00:00");
  const to = cairoToUtc(p.data.to, "00:00");
  if (to <= from) return fail("validation", { to: "required" });
  const out = await db.transaction(async (tx) => {
    await tx.select({ id: C.id }).from(C).where(eq(C.id, centerId)).for("update");
    const rows = await tx
      .select({ id: LG.id, commissionEgp: LG.commissionEgp, adj: sql<number>`coalesce((SELECT sum(ca.delta_egp) FROM commission_adjustments ca WHERE ca.ledger_id = "commission_ledger"."id"), 0)::int` })
      .from(LG)
      .where(and(eq(LG.centerId, centerId), eq(LG.status, "confirmed"), isNull(LG.settlementId), gte(LG.completedAt, from), lt(LG.completedAt, to)))
      .for("update");
    if (!rows.length) return null;
    const totalEgp = rows.reduce((s, r) => s + r.commissionEgp + r.adj, 0);
    const reference = newReference().replace("MC-", "ST-");
    const [st] = await tx.insert(SET).values({ centerId, reference, periodStart: from, periodEnd: to, totalEgp, status: "issued", createdById: a.admin.id }).returning({ id: SET.id });
    await tx.update(LG).set({ status: "payable", settlementId: st.id }).where(inArray(LG.id, rows.map((r) => r.id)));
    await tx.insert(AL).values({ actorId: a.admin.id, action: "commission.settlement.issue", entityType: "commission_settlement", entityId: st.id, metadata: { reference, totalEgp, rows: rows.length, from: from.toISOString(), to: to.toISOString() } });
    return { id: st.id, reference, totalEgp };
  });
  if (!out) return fail("nothingToSettle");
  refresh();
  return ok(out);
}

/** Records that the provider actually paid the statement. Only an admin can do this. */
export async function markSettlementPaid(settlementId: string, paymentNote: string): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(settlementId).success) return fail("notFound");
  const note = z.string().trim().min(3).max(300).safeParse(paymentNote);
  if (!note.success) return fail("validation", { paymentNote: "required" });
  const res = await db.transaction(async (tx) => {
    const [st] = await tx.select().from(SET).where(eq(SET.id, settlementId)).for("update");
    if (!st || st.status !== "issued") return "notFound" as const;
    if (await isStaff(a.admin.id, st.centerId)) return "conflictOfInterest" as const;
    const now = new Date();
    await tx.update(SET).set({ status: "settled", settledAt: now, paymentNote: note.data }).where(eq(SET.id, st.id));
    await tx.update(LG).set({ status: "settled" }).where(and(eq(LG.settlementId, st.id), eq(LG.status, "payable")));
    await tx.insert(AL).values({ actorId: a.admin.id, action: "commission.settlement.paid", entityType: "commission_settlement", entityId: st.id, metadata: { paymentNote: note.data, totalEgp: st.totalEgp } });
    return null;
  });
  if (res) return fail(res);
  refresh();
  return ok(null);
}

/** Voids an unpaid statement; its rows return to confirmed and can be settled again. */
export async function voidSettlement(settlementId: string, reason: string): Promise<ActionResult<null>> {
  const a = await requireAdmin();
  if ("error" in a) return fail(a.error!);
  if (!UUID.safeParse(settlementId).success) return fail("notFound");
  if (!z.string().trim().min(3).max(300).safeParse(reason).success) return fail("validation", { reason: "required" });
  const res = await db.transaction(async (tx) => {
    const [st] = await tx.select().from(SET).where(eq(SET.id, settlementId)).for("update");
    if (!st || st.status !== "issued") return "notFound" as const;
    if (await isStaff(a.admin.id, st.centerId)) return "conflictOfInterest" as const;
    await tx.update(LG).set({ status: "confirmed", settlementId: null }).where(and(eq(LG.settlementId, st.id), eq(LG.status, "payable")));
    await tx.update(SET).set({ status: "void" }).where(eq(SET.id, st.id));
    await tx.insert(AL).values({ actorId: a.admin.id, action: "commission.settlement.void", entityType: "commission_settlement", entityId: st.id, metadata: { reason } });
    return null;
  });
  if (res) return fail(res);
  refresh();
  return ok(null);
}
