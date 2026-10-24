/**
 * MOTORNA Care bookings & monetization — architecture only (docs/CARE.md §5, §13).
 *
 * Nothing in the app calls these yet and there are no booking/payment tables. They exist so
 * the rules are designed and tested before any UI promises booking or payment.
 * `features.careBooking` stays false until the full workflow and integrations are live.
 */

export const BOOKING_STATUSES = ["requested", "confirmed", "in_progress", "report_ready", "completed", "cancelled", "no_show"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type BookingKind = "inspection" | "maintenance";
export type BookingActor = "customer" | "center" | "admin" | "system";
export type BookingAction = "confirm" | "start" | "submitReport" | "complete" | "cancel" | "reschedule" | "markNoShow";

/** Payment is tracked separately from the booking: a completed booking can still be unpaid. */
export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "refunded", "waived"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Customers may cancel or reschedule free of charge up to this many hours before the slot. */
export const CUSTOMER_CHANGE_CUTOFF_HOURS = 12;

type Rule = { from: BookingStatus[]; to: BookingStatus | "same"; actors: BookingActor[]; kinds?: BookingKind[] };
const RULES: Record<BookingAction, Rule> = {
  confirm: { from: ["requested"], to: "confirmed", actors: ["center"] },
  start: { from: ["confirmed"], to: "in_progress", actors: ["center"] },
  submitReport: { from: ["in_progress"], to: "report_ready", actors: ["center"], kinds: ["inspection"] },
  complete: { from: ["in_progress", "report_ready"], to: "completed", actors: ["center", "system"] },
  cancel: { from: ["requested", "confirmed"], to: "cancelled", actors: ["customer", "center", "admin"] },
  reschedule: { from: ["requested", "confirmed"], to: "requested", actors: ["customer", "center"] },
  markNoShow: { from: ["confirmed"], to: "no_show", actors: ["center"] },
};

export type TransitionInput = {
  status: BookingStatus;
  kind: BookingKind;
  action: BookingAction;
  actor: BookingActor;
  scheduledAt: Date;
  now?: Date;
};

/** Returns the next status, or an error code. Pure — the caller persists it with an event row. */
export function nextBookingStatus(i: TransitionInput): { ok: true; to: BookingStatus } | { ok: false; error: "invalidTransition" | "forbidden" | "tooLate" | "tooEarly" } {
  const r = RULES[i.action];
  if (!r.from.includes(i.status)) return { ok: false, error: "invalidTransition" };
  if (r.kinds && !r.kinds.includes(i.kind)) return { ok: false, error: "invalidTransition" };
  if (!r.actors.includes(i.actor)) return { ok: false, error: "forbidden" };
  // Maintenance has no report step: complete directly from in_progress. Inspections must have a report first.
  if (i.action === "complete" && i.kind === "inspection" && i.status !== "report_ready") return { ok: false, error: "invalidTransition" };
  const now = i.now ?? new Date();
  const hoursLeft = (i.scheduledAt.getTime() - now.getTime()) / 3_600_000;
  if ((i.action === "cancel" || i.action === "reschedule") && i.actor === "customer" && hoursLeft < CUSTOMER_CHANGE_CUTOFF_HOURS) {
    return { ok: false, error: "tooLate" };
  }
  if (i.action === "markNoShow" && now < i.scheduledAt) return { ok: false, error: "tooEarly" };
  return { ok: true, to: r.to === "same" ? i.status : r.to };
}

/* ------------------------------ Monetization ------------------------------ */

/** Admin-configured commission rule. percentBps: 1000 = 10%. Most specific active rule wins. */
export type CommissionRule = {
  id: string;
  kind: BookingKind;
  category: string | null;
  percentBps: number;
  fixedEgp: number;
  activeFrom: Date;
  activeTo: Date | null;
};

/**
 * Commission accrues only for a completed booking with a known final price. Returns null otherwise —
 * we never record revenue for work that didn't happen.
 */
export function commissionFor(
  booking: { status: BookingStatus; kind: BookingKind; category: string; finalPriceEgp: number | null; completedAt: Date | null },
  rules: CommissionRule[],
): { ruleId: string; amountEgp: number } | null {
  if (booking.status !== "completed" || booking.finalPriceEgp == null || !booking.completedAt) return null;
  const at = booking.completedAt;
  const active = rules.filter((r) => r.kind === booking.kind && r.activeFrom <= at && (!r.activeTo || r.activeTo > at) && (r.category === null || r.category === booking.category));
  if (!active.length) return null;
  const rule = active.sort((a, b) => Number(b.category !== null) - Number(a.category !== null) || b.activeFrom.getTime() - a.activeFrom.getTime())[0];
  const amount = Math.round((booking.finalPriceEgp * rule.percentBps) / 10_000) + rule.fixedEgp;
  return { ruleId: rule.id, amountEgp: Math.min(amount, booking.finalPriceEgp) };
}

/** Subscriptions are billing only. This is deliberately not an input to any approval or ranking rule. */
export type SubscriptionPlan = { code: string; monthlyEgp: number; features: string[] };
