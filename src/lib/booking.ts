/**
 * MOTORNA Care bookings — pure rules (docs/CARE-BOOKING.md).
 *
 * Everything here is deterministic and side-effect free so it can be unit tested. Server actions
 * call `transition()` inside a transaction that has locked the booking row, then persist the
 * result together with a booking_events row and an audit entry.
 */
import { z } from "zod";

export const BOOKING_STATUSES = [
  "pending_provider",
  "alternative_proposed",
  "awaiting_customer",
  "confirmed",
  "checked_in",
  "completed",
  "declined",
  "cancelled_customer",
  "cancelled_provider",
  "no_show",
  "expired",
  "disputed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type BookingMode = "slots" | "manual";
export type ActorRole = "customer" | "provider" | "admin" | "system";
export type StaffRole = "owner" | "manager" | "technician";

export const BOOKING_ACTIONS = [
  "accept",
  "propose",
  "ask",
  "decline",
  "reply",
  "acceptAlternative",
  "declineAlternative",
  "reschedule",
  "cancel",
  "providerCancel",
  "checkIn",
  "complete",
  "noShow",
  "expire",
  "openDispute",
  "resolve",
] as const;
export type BookingAction = (typeof BOOKING_ACTIONS)[number];

/** Statuses where the request is still being negotiated (no confirmed time yet). */
export const OPEN_REQUEST: BookingStatus[] = ["pending_provider", "alternative_proposed", "awaiting_customer"];
/** Statuses that have a confirmed time. */
export const HAS_CONFIRMED_TIME: BookingStatus[] = ["confirmed", "checked_in", "completed", "no_show"];
/** Final statuses: nothing more can happen except a dispute where allowed. */
export const FINAL: BookingStatus[] = ["completed", "declined", "cancelled_customer", "cancelled_provider", "no_show", "expired"];
/** "Upcoming" for dashboards. */
export const ACTIVE: BookingStatus[] = [...OPEN_REQUEST, "confirmed", "checked_in", "disputed"];

/** Whether a booking in this status occupies capacity at its time. */
export function holdsCapacity(status: BookingStatus, mode: BookingMode): boolean {
  if (status === "confirmed" || status === "checked_in") return true;
  if (status === "alternative_proposed") return true;
  if (status === "pending_provider") return mode === "slots";
  return false;
}

export const CHECK_IN_WINDOW_HOURS = 2;
export const NO_SHOW_GRACE_MIN = 30;
/** The customer's confirmation / dispute window for a completed service equals the auto-confirm delay. */
export const LEDGER_AUTO_CONFIRM_DAYS = 7;
/** Remind the customer this many days before the window closes. */
export const CONFIRM_REMINDER_DAYS_BEFORE = 2;
export const DISPUTE_WINDOW_DAYS: Partial<Record<BookingStatus, number>> = { completed: LEDGER_AUTO_CONFIRM_DAYS, no_show: 7, cancelled_provider: 7, cancelled_customer: 7 };
export const MAX_PROPOSALS = 3;
export const MAX_REQUESTED = 3;

type Rule = { from: BookingStatus[]; to: BookingStatus | null; who: (ActorRole | StaffRole)[]; reason?: boolean };
/**
 * `who`: customer / admin / system, or a staff role for provider actions.
 * `to: null` means the target is computed (resolve).
 */
const RULES: Record<BookingAction, Rule> = {
  accept: { from: ["pending_provider"], to: "confirmed", who: ["owner", "manager"] },
  propose: { from: ["pending_provider", "awaiting_customer"], to: "alternative_proposed", who: ["owner", "manager"] },
  ask: { from: ["pending_provider"], to: "awaiting_customer", who: ["owner", "manager"] },
  decline: { from: ["pending_provider", "awaiting_customer"], to: "declined", who: ["owner", "manager"], reason: true },
  reply: { from: ["awaiting_customer"], to: "pending_provider", who: ["customer"] },
  acceptAlternative: { from: ["alternative_proposed"], to: "confirmed", who: ["customer"] },
  declineAlternative: { from: ["alternative_proposed"], to: "pending_provider", who: ["customer"] },
  reschedule: { from: ["confirmed"], to: "pending_provider", who: ["customer"] },
  cancel: { from: ["pending_provider", "alternative_proposed", "awaiting_customer", "confirmed"], to: "cancelled_customer", who: ["customer"] },
  providerCancel: { from: ["confirmed", "checked_in"], to: "cancelled_provider", who: ["owner", "manager"], reason: true },
  checkIn: { from: ["confirmed"], to: "checked_in", who: ["owner", "manager", "technician"] },
  complete: { from: ["checked_in"], to: "completed", who: ["owner", "manager", "technician"] },
  noShow: { from: ["confirmed"], to: "no_show", who: ["owner", "manager", "technician"] },
  expire: { from: ["pending_provider", "alternative_proposed", "awaiting_customer"], to: "expired", who: ["system"] },
  openDispute: { from: ["completed", "no_show", "cancelled_provider", "cancelled_customer"], to: "disputed", who: ["customer", "owner", "manager"], reason: true },
  resolve: { from: ["disputed"], to: null, who: ["admin"], reason: true },
};

export const RESOLVE_OUTCOMES: BookingStatus[] = ["completed", "no_show", "cancelled_provider", "cancelled_customer"];

export type TransitionError =
  | "invalidTransition"
  | "forbidden"
  | "tooLate"
  | "tooEarly"
  | "reasonRequired"
  | "windowClosed"
  | "invalidOutcome";

export type TransitionInput = {
  status: BookingStatus;
  action: BookingAction;
  /** customer/admin/system, or the staff role of the provider user acting. */
  actor: ActorRole | StaffRole;
  startsAt: Date | null;
  cancelCutoffHours: number;
  /** When the booking reached its current final status (for dispute windows). */
  statusSince?: Date;
  reason?: string | null;
  /** Late cancellation by the provider is disputable by the provider only when the customer cancelled late. */
  lateCancel?: boolean;
  outcome?: BookingStatus;
  now?: Date;
};

export type TransitionResult = { ok: true; to: BookingStatus; lateCancel?: boolean } | { ok: false; error: TransitionError };

export const actorKind = (a: ActorRole | StaffRole): ActorRole => (a === "owner" || a === "manager" || a === "technician" ? "provider" : a);

/** The one place booking status rules live. Pure: the caller persists the result. */
export function transition(i: TransitionInput): TransitionResult {
  const r = RULES[i.action];
  if (!r.from.includes(i.status)) return { ok: false, error: "invalidTransition" };
  if (!r.who.includes(i.actor)) return { ok: false, error: "forbidden" };
  if (r.reason && !(i.reason && i.reason.trim().length >= 3)) return { ok: false, error: "reasonRequired" };
  const now = i.now ?? new Date();
  const hoursLeft = i.startsAt ? (i.startsAt.getTime() - now.getTime()) / 3_600_000 : Infinity;

  switch (i.action) {
    case "reschedule":
      if (hoursLeft < i.cancelCutoffHours) return { ok: false, error: "tooLate" };
      break;
    case "cancel":
      // Always allowed (so nobody is forced into a no-show); after the cutoff it is recorded as late.
      return { ok: true, to: "cancelled_customer", lateCancel: i.status === "confirmed" && hoursLeft < i.cancelCutoffHours };
    case "checkIn":
      if (hoursLeft > CHECK_IN_WINDOW_HOURS) return { ok: false, error: "tooEarly" };
      break;
    case "noShow":
      if (!i.startsAt || now.getTime() < i.startsAt.getTime() + NO_SHOW_GRACE_MIN * 60_000) return { ok: false, error: "tooEarly" };
      break;
    case "openDispute": {
      const kind = actorKind(i.actor);
      // Providers may only dispute a late customer cancellation; customers can't dispute their own cancellation.
      if (i.status === "cancelled_customer" && !(kind === "provider" && i.lateCancel)) return { ok: false, error: "forbidden" };
      if (i.status !== "cancelled_customer" && kind !== "customer") return { ok: false, error: "forbidden" };
      const days = DISPUTE_WINDOW_DAYS[i.status];
      const since = i.statusSince ?? now;
      if (days == null || now.getTime() - since.getTime() > days * 86_400_000) return { ok: false, error: "windowClosed" };
      break;
    }
    case "resolve":
      if (!i.outcome || !RESOLVE_OUTCOMES.includes(i.outcome)) return { ok: false, error: "invalidOutcome" };
      return { ok: true, to: i.outcome };
  }
  return { ok: true, to: r.to as BookingStatus };
}

/** Actions a given actor could take now (for rendering buttons; the server re-checks). */
export function availableActions(i: Omit<TransitionInput, "action" | "reason" | "outcome">): BookingAction[] {
  return BOOKING_ACTIONS.filter((action) => {
    if (action === "expire" || action === "resolve") return false;
    const res = transition({ ...i, action, reason: "xxx", outcome: "completed" });
    return res.ok;
  });
}

/* ------------------------------- Time (Cairo) ------------------------------- */

export const TZ = "Africa/Cairo";

/** Offset of Cairo from UTC (minutes) at a given instant. Handles DST via Intl. */
function cairoOffsetMin(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Converts a Cairo wall-clock date ("2026-11-02") and time ("09:30") to a UTC instant. */
export function cairoToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = cairoOffsetMin(new Date(guess));
  let t = guess - off1 * 60_000;
  const off2 = cairoOffsetMin(new Date(t));
  if (off2 !== off1) t = guess - off2 * 60_000;
  return new Date(t);
}

/** Cairo calendar date (YYYY-MM-DD) and weekday (0 = Sunday) of an instant. */
export function cairoDate(at: Date): { date: string; weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const v = (t: string) => parts.find((p) => p.type === t)!.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v("weekday"));
  return { date: `${v("year")}-${v("month")}-${v("day")}`, weekday, minutes: Number(v("hour")) * 60 + Number(v("minute")) };
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export type Interval = { start: Date; end: Date };
export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export type ScheduleConfig = {
  hours: { weekday: number; opens: string; closes: string }[];
  closures: Interval[];
  slotIntervalMin: number;
  capacity: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
};

/** Is [start, start+duration) inside opening hours, outside closures, and within the booking window? */
export function withinSchedule(cfg: ScheduleConfig, start: Date, durationMin: number, now = new Date()): boolean {
  const end = new Date(start.getTime() + durationMin * 60_000);
  if (start.getTime() < now.getTime() + cfg.minNoticeHours * 3_600_000) return false;
  if (start.getTime() > now.getTime() + cfg.maxAdvanceDays * 86_400_000) return false;
  const s = cairoDate(start);
  const e = cairoDate(new Date(end.getTime() - 1));
  if (s.date !== e.date) return false;
  const h = cfg.hours.find((x) => x.weekday === s.weekday);
  if (!h) return false;
  if (s.minutes < toMin(h.opens) || s.minutes + durationMin > toMin(h.closes)) return false;
  return !cfg.closures.some((c) => overlaps(c, { start, end }));
}

/** How many capacity-holding bookings overlap the interval at its busiest point. */
export function peakLoad(busy: Interval[], target: Interval): number {
  const hits = busy.filter((b) => overlaps(b, target));
  if (!hits.length) return 0;
  // Sweep over start points inside the target.
  const points = [target.start, ...hits.map((b) => b.start).filter((p) => p > target.start && p < target.end)];
  return Math.max(...points.map((p) => hits.filter((b) => b.start <= p && b.end > p).length));
}

export function hasCapacity(cfg: Pick<ScheduleConfig, "capacity">, busy: Interval[], target: Interval): boolean {
  return peakLoad(busy, target) < cfg.capacity;
}

/** Bookable start times on a Cairo date, as UTC instants with their local label. */
export function daySlots(cfg: ScheduleConfig, date: string, durationMin: number, busy: Interval[], now = new Date()): { start: Date; label: string }[] {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const h = cfg.hours.find((x) => x.weekday === weekday);
  if (!h) return [];
  const out: { start: Date; label: string }[] = [];
  for (let m = toMin(h.opens); m + durationMin <= toMin(h.closes); m += cfg.slotIntervalMin) {
    const label = toHHMM(m);
    const start = cairoToUtc(date, label);
    const target = { start, end: new Date(start.getTime() + durationMin * 60_000) };
    if (withinSchedule(cfg, start, durationMin, now) && hasCapacity(cfg, busy, target)) out.push({ start, label });
  }
  return out;
}

/* ------------------------------- Commission ------------------------------- */

export type Agreement = {
  id: string;
  status: "draft" | "active" | "ended";
  basis: "percent" | "fixed";
  percentBps: number | null;
  fixedEgp: number | null;
  categories: string[] | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

/** The agreement that governs a completion: active at that time and covering the category. Most specific wins. */
export function agreementFor(agreements: Agreement[], category: string, at: Date): Agreement | null {
  const live = agreements.filter(
    (a) => a.status !== "draft" && a.effectiveFrom <= at && (!a.effectiveTo || a.effectiveTo > at) && (a.categories === null || a.categories.includes(category)),
  );
  if (!live.length) return null;
  return live.sort((a, b) => Number(b.categories !== null) - Number(a.categories !== null) || b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
}

/** Commission in whole EGP, never more than the completed amount. */
export function commissionAmount(a: Pick<Agreement, "basis" | "percentBps" | "fixedEgp">, completedAmountEgp: number): number {
  const raw = a.basis === "percent" ? Math.round((completedAmountEgp * (a.percentBps ?? 0)) / 10_000) : (a.fixedEgp ?? 0);
  return Math.max(0, Math.min(raw, completedAmountEgp));
}

/**
 * Whether a completion produces a ledger row: only a completed service with a recorded amount,
 * under an agreement. Cancelled / declined / expired / no-show bookings never do.
 */
export function ledgerEntryFor(
  b: { status: BookingStatus; category: string; completedAt: Date | null; serviceCompleted: boolean; finalAmountEgp: number | null },
  agreements: Agreement[],
): { agreement: Agreement; commissionEgp: number } | null {
  if (b.status !== "completed" || !b.completedAt || !b.serviceCompleted || b.finalAmountEgp == null) return null;
  const agreement = agreementFor(agreements, b.category, b.completedAt);
  if (!agreement) return null;
  return { agreement, commissionEgp: commissionAmount(agreement, b.finalAmountEgp) };
}

export const LEDGER_STATUSES = ["pending_verification", "confirmed", "disputed", "payable", "settled", "waived"] as const;
export type LedgerStatus = (typeof LEDGER_STATUSES)[number];
const LEDGER_MOVES: Record<LedgerStatus, LedgerStatus[]> = {
  pending_verification: ["confirmed", "disputed", "waived"],
  confirmed: ["payable", "disputed", "waived"],
  disputed: ["confirmed", "waived"],
  payable: ["settled", "confirmed", "waived"],
  settled: [],
  waived: [],
};
export const canMoveLedger = (from: LedgerStatus, to: LedgerStatus) => LEDGER_MOVES[from].includes(to);

/* ------------------------------- Misc ------------------------------- */

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newReference(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(7);
  return "MC-" + Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
}

export const egPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^\+?20/, "0"))
  .pipe(z.string().regex(/^01[0125]\d{8}$/));

export const timeOptionSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });

export const bookingRequestSchema = z.object({
  centerId: z.uuid(),
  serviceId: z.uuid(),
  requestKey: z.string().min(8).max(64),
  vehicleId: z.uuid().optional(),
  vehicle: z
    .object({
      makeId: z.coerce.number().int().min(1).max(32767),
      modelId: z.coerce.number().int().positive().optional(),
      modelText: z.string().trim().max(60).optional(),
      year: z.coerce.number().int().min(1950).max(2100),
      mileageKm: z.coerce.number().int().min(0).max(3_000_000).optional(),
      save: z.boolean().optional(),
    })
    .optional(),
  times: z.array(timeOptionSchema).min(1).max(MAX_REQUESTED),
  contactName: z.string().trim().min(2).max(80),
  contactPhone: egPhone,
  note: z.string().trim().max(1000).optional(),
  acceptPolicy: z.literal(true),
});
export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const bookingSettingsSchema = z.object({
  accepting: z.boolean(),
  mode: z.enum(["slots", "manual"]),
  slotIntervalMin: z.coerce.number().pipe(z.union([z.literal(15), z.literal(30), z.literal(60)])),
  capacity: z.coerce.number().int().min(1).max(50),
  minNoticeHours: z.coerce.number().int().min(0).max(168),
  maxAdvanceDays: z.coerce.number().int().min(1).max(90),
  cancelCutoffHours: z.coerce.number().int().min(0).max(72),
  policyAr: z.string().trim().max(1000),
  policyEn: z.string().trim().max(1000),
});

export const completionSchema = z
  .object({
    serviceCompleted: z.boolean(),
    finalAmountEgp: z.coerce.number().int().min(0).max(5_000_000).optional(),
    workSummary: z.string().trim().max(2000).optional(),
    mileageKm: z.coerce.number().int().min(0).max(3_000_000).optional(),
  })
  .refine((v) => !v.serviceCompleted || v.finalAmountEgp != null, { path: ["finalAmountEgp"], message: "required" });

export const agreementSchema = z
  .object({
    basis: z.enum(["percent", "fixed"]),
    percent: z.coerce.number().min(0.01).max(50).optional(),
    fixedEgp: z.coerce.number().int().min(1).max(100_000).optional(),
    categories: z.array(z.string()).optional(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    settlementSchedule: z.enum(["monthly", "biweekly"]),
    exceptions: z.string().trim().max(1000).optional(),
    contractReference: z.string().trim().max(120).optional(),
  })
  .refine((v) => (v.basis === "percent" ? v.percent != null : v.fixedEgp != null), { path: ["basis"], message: "required" });
