import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  ACTIVE,
  FINAL,
  OPEN_REQUEST,
  addDays,
  cairoDate,
  cairoToUtc,
  daySlots,
  type BookingStatus,
  type Interval,
  type ScheduleConfig,
} from "@/lib/booking";

const { bookings: B, bookingTimeOptions: TO, bookingEvents: EV, bookingMessages: MSG, serviceCompletions: SC, centerReviews: RV, bookingDisputes: DP } = schema;
const { serviceCenters: C, centerServices: SV, centerHours: H, centerClosures: CL, centerBookingSettings: CBS, centerStaff: ST, users: U, vehicleMakes: MK, vehicleModels: MD } = schema;
const { commissionAgreements: AG, commissionLedger: LG, commissionAdjustments: ADJ, commissionSettlements: SET } = schema;

type Exec = Pick<typeof db, "select">;

export const DEFAULT_SETTINGS = {
  pilotEnabled: false,
  accepting: false,
  mode: "manual" as "manual" | "slots",
  slotIntervalMin: 30,
  capacity: 1,
  minNoticeHours: 4,
  maxAdvanceDays: 30,
  cancelCutoffHours: 12,
  policyAr: "",
  policyEn: "",
};
export type BookingSettings = typeof DEFAULT_SETTINGS & { pilotEnabledAt?: Date | null };

export async function bookingSettings(centerId: string, x: Exec = db): Promise<BookingSettings> {
  const [row] = await x.select().from(CBS).where(eq(CBS.centerId, centerId));
  return row ? { ...DEFAULT_SETTINGS, ...row } : { ...DEFAULT_SETTINGS };
}

/** Public: whether customers can book this center online right now. */
export async function centerBookable(centerId: string, x: Exec = db) {
  const [c] = await x.select({ status: C.status }).from(C).where(eq(C.id, centerId));
  if (!c || c.status !== "approved") return false;
  const s = await bookingSettings(centerId, x);
  if (!s.pilotEnabled || !s.accepting) return false;
  const [svc] = await x
    .select({ id: SV.id })
    .from(SV)
    .where(and(eq(SV.centerId, centerId), eq(SV.active, true), eq(SV.bookable, true)))
    .limit(1);
  const [hours] = await x.select({ w: H.weekday }).from(H).where(eq(H.centerId, centerId)).limit(1);
  return Boolean(svc && hours);
}

export async function scheduleConfig(centerId: string, x: Exec = db): Promise<ScheduleConfig & { settings: BookingSettings }> {
  const [settings, hours, closures] = await Promise.all([
    bookingSettings(centerId, x),
    x.select({ weekday: H.weekday, opens: H.opens, closes: H.closes }).from(H).where(eq(H.centerId, centerId)),
    x
      .select({ start: CL.startsAt, end: CL.endsAt })
      .from(CL)
      .where(and(eq(CL.centerId, centerId), gte(CL.endsAt, new Date()))),
  ]);
  return {
    settings,
    hours,
    closures,
    slotIntervalMin: settings.slotIntervalMin,
    capacity: settings.capacity,
    minNoticeHours: settings.minNoticeHours,
    maxAdvanceDays: settings.maxAdvanceDays,
  };
}

/**
 * Intervals that occupy capacity at a center (see holdsCapacity): confirmed/checked-in bookings,
 * requested times of pending slot-mode requests, and proposed times awaiting the customer.
 */
export async function busyIntervals(centerId: string, from: Date, to: Date, excludeBookingId?: string, x: Exec = db): Promise<Interval[]> {
  const notSelf = excludeBookingId ? sql`${B.id} <> ${excludeBookingId}` : sql`true`;
  const confirmed = await x
    .select({ start: B.startsAt, end: B.endsAt })
    .from(B)
    .where(and(eq(B.centerId, centerId), inArray(B.status, ["confirmed", "checked_in"]), lt(B.startsAt, to), gte(B.endsAt, from), notSelf));
  const held = await x
    .select({ start: TO.startsAt, end: TO.endsAt })
    .from(TO)
    .innerJoin(B, eq(B.id, TO.bookingId))
    .where(
      and(
        eq(B.centerId, centerId),
        eq(TO.state, "open"),
        lt(TO.startsAt, to),
        gte(TO.endsAt, from),
        notSelf,
        or(
          and(eq(B.status, "pending_provider"), eq(B.mode, "slots"), eq(TO.kind, "requested")),
          and(eq(B.status, "alternative_proposed"), eq(TO.kind, "proposed")),
        ),
      ),
    );
  return [...confirmed, ...held].filter((i): i is Interval => Boolean(i.start && i.end));
}

/** Bookable start times for a service on a Cairo date. */
export async function availableSlots(centerId: string, durationMin: number, date: string, now = new Date()) {
  const cfg = await scheduleConfig(centerId);
  const dayStart = cairoToUtc(date, "00:00");
  const dayEnd = cairoToUtc(addDays(date, 1), "00:00");
  const busy = await busyIntervals(centerId, dayStart, dayEnd);
  return daySlots(cfg, date, durationMin, busy, now).map((s) => ({ start: s.start.toISOString(), label: s.label }));
}

/** Dates (Cairo) the center is open within its advance window — the date picker's options. */
export async function openDates(centerId: string, now = new Date()) {
  const cfg = await scheduleConfig(centerId);
  const days = new Set(cfg.hours.map((h) => h.weekday));
  const today = cairoDate(now).date;
  const out: string[] = [];
  for (let i = 0; i <= cfg.maxAdvanceDays && out.length < 60; i++) {
    const d = addDays(today, i);
    if (days.has(new Date(`${d}T12:00:00Z`).getUTCDay())) out.push(d);
  }
  return out;
}

/* ------------------------------- Booking reads ------------------------------- */

const bookingCols = {
  id: B.id,
  reference: B.reference,
  status: B.status,
  mode: B.mode,
  centerId: B.centerId,
  customerId: B.customerId,
  serviceId: B.serviceId,
  serviceNameAr: B.serviceNameAr,
  serviceNameEn: B.serviceNameEn,
  serviceCategory: B.serviceCategory,
  priceMode: B.priceMode,
  priceEgp: B.priceEgp,
  priceMaxEgp: B.priceMaxEgp,
  durationMin: B.durationMin,
  vehicleYear: B.vehicleYear,
  vehicleMileageKm: B.vehicleMileageKm,
  vehicleModelText: B.vehicleModelText,
  makeAr: MK.nameAr,
  makeEn: MK.nameEn,
  modelAr: MD.nameAr,
  modelEn: MD.nameEn,
  startsAt: B.startsAt,
  endsAt: B.endsAt,
  cancelCutoffHours: B.cancelCutoffHours,
  contactName: B.contactName,
  contactPhone: B.contactPhone,
  customerNote: B.customerNote,
  statusReason: B.statusReason,
  lateCancel: B.lateCancel,
  confirmedAt: B.confirmedAt,
  completedAt: B.completedAt,
  createdAt: B.createdAt,
  updatedAt: B.updatedAt,
  centerSlug: C.slug,
  centerNameAr: C.nameAr,
  centerNameEn: C.nameEn,
  centerCategory: C.category,
  centerStatus: C.status,
  centerPhone: C.phone,
  centerAddress: C.address,
  centerArea: C.area,
  centerLastVerifiedAt: C.lastVerifiedAt,
};

function baseQuery(x: Exec = db) {
  return x
    .select(bookingCols)
    .from(B)
    .innerJoin(C, eq(C.id, B.centerId))
    .innerJoin(MK, eq(MK.id, B.vehicleMakeId))
    .leftJoin(MD, eq(MD.id, B.vehicleModelId));
}
export type BookingRow = Awaited<ReturnType<typeof baseQuery>>[number];

async function details(b: BookingRow) {
  const [options, events, messages, completion, review, disputes] = await Promise.all([
    db.select().from(TO).where(eq(TO.bookingId, b.id)).orderBy(asc(TO.round), asc(TO.startsAt)),
    db.select({ id: EV.id, action: EV.action, fromStatus: EV.fromStatus, toStatus: EV.toStatus, actorRole: EV.actorRole, note: EV.note, createdAt: EV.createdAt }).from(EV).where(eq(EV.bookingId, b.id)).orderBy(asc(EV.createdAt)),
    db.select({ id: MSG.id, authorRole: MSG.authorRole, body: MSG.body, createdAt: MSG.createdAt }).from(MSG).where(eq(MSG.bookingId, b.id)).orderBy(asc(MSG.createdAt)),
    db.select().from(SC).where(eq(SC.bookingId, b.id)).then((r) => r[0] ?? null),
    db.select().from(RV).where(eq(RV.bookingId, b.id)).then((r) => r[0] ?? null),
    db.select().from(DP).where(eq(DP.bookingId, b.id)).orderBy(desc(DP.createdAt)),
  ]);
  const statusSince = [...events].reverse().find((e) => e.toStatus === b.status)?.createdAt ?? b.updatedAt;
  return { ...b, options, events, messages, completion, review, disputes, statusSince };
}
export type BookingDetail = Awaited<ReturnType<typeof details>>;

/** Customer view: only the caller's own booking. Expires a stale request before showing it. */
export async function customerBooking(userId: string, reference: string): Promise<BookingDetail | null> {
  await expireStaleByReference(reference);
  const [b] = await baseQuery().where(and(eq(B.reference, reference), eq(B.customerId, userId)));
  return b ? details(b) : null;
}

export async function customerBookings(userId: string) {
  await expireStale({ customerId: userId });
  return baseQuery().where(eq(B.customerId, userId)).orderBy(desc(B.createdAt)).limit(200);
}

/** Provider view: only bookings of a center the caller is active staff of (checked by the caller). */
export async function centerBooking(centerId: string, reference: string): Promise<BookingDetail | null> {
  await expireStaleByReference(reference);
  const [b] = await baseQuery().where(and(eq(B.reference, reference), eq(B.centerId, centerId)));
  return b ? details(b) : null;
}

export const CENTER_TABS = ["action", "upcoming", "history"] as const;
export type CenterTab = (typeof CENTER_TABS)[number];

export async function centerBookings(centerId: string, tab: CenterTab) {
  await expireStale({ centerId });
  const where: Record<CenterTab, SQL | undefined> = {
    action: inArray(B.status, ["pending_provider", "awaiting_customer", "alternative_proposed", "disputed"]),
    upcoming: inArray(B.status, ["confirmed", "checked_in"]),
    history: inArray(B.status, FINAL),
  };
  const order = tab === "upcoming" ? asc(B.startsAt) : desc(B.updatedAt);
  const rows = await baseQuery().where(and(eq(B.centerId, centerId), where[tab])).orderBy(order).limit(200);
  if (!rows.length) return [];
  const opts = await db
    .select({ bookingId: TO.bookingId, kind: TO.kind, startsAt: TO.startsAt, state: TO.state })
    .from(TO)
    .where(and(inArray(TO.bookingId, rows.map((r) => r.id)), eq(TO.state, "open")))
    .orderBy(asc(TO.startsAt));
  return rows.map((r) => ({ ...r, openTimes: opts.filter((o) => o.bookingId === r.id) }));
}

export async function centerBookingCounts(centerId: string) {
  const rows = await db.select({ status: B.status, n: sql<number>`count(*)::int` }).from(B).where(eq(B.centerId, centerId)).groupBy(B.status);
  const get = (s: BookingStatus[]) => rows.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.n, 0);
  return { action: get(["pending_provider", "awaiting_customer", "alternative_proposed", "disputed"]), needsResponse: get(["pending_provider"]), upcoming: get(["confirmed", "checked_in"]) };
}

/* ------------------------------- Expiry ------------------------------- */

/**
 * Expires open requests whose every open time has started without a confirmation.
 * Run lazily on reads and by the daily job, so a stale request never looks active.
 */
export async function expireStale(scope: { centerId?: string; customerId?: string; bookingId?: string } = {}, now = new Date()) {
  const conds: SQL[] = [inArray(B.status, OPEN_REQUEST)];
  if (scope.centerId) conds.push(eq(B.centerId, scope.centerId));
  if (scope.customerId) conds.push(eq(B.customerId, scope.customerId));
  if (scope.bookingId) conds.push(eq(B.id, scope.bookingId));
  const candidates = await db
    .select({ id: B.id })
    .from(B)
    .where(and(...conds, sql`NOT EXISTS (SELECT 1 FROM ${TO} WHERE ${TO.bookingId} = ${B.id} AND ${TO.state} = 'open' AND ${TO.startsAt} > ${now})`));
  if (!candidates.length) return 0;
  const { expireBooking } = await import("@/server/booking-engine");
  let n = 0;
  for (const c of candidates) if (await expireBooking(c.id, now)) n++;
  return n;
}

async function expireStaleByReference(reference: string) {
  const [b] = await db.select({ id: B.id, status: B.status }).from(B).where(eq(B.reference, reference));
  if (b && OPEN_REQUEST.includes(b.status)) await expireStale({ bookingId: b.id });
}

/* ------------------------------- Vehicles ------------------------------- */

export async function customerVehicles(userId: string) {
  return db
    .select({
      id: schema.customerVehicles.id,
      makeId: schema.customerVehicles.makeId,
      modelId: schema.customerVehicles.modelId,
      year: schema.customerVehicles.year,
      mileageKm: schema.customerVehicles.mileageKm,
      nickname: schema.customerVehicles.nickname,
      makeAr: MK.nameAr,
      makeEn: MK.nameEn,
      modelAr: MD.nameAr,
      modelEn: MD.nameEn,
    })
    .from(schema.customerVehicles)
    .innerJoin(MK, eq(MK.id, schema.customerVehicles.makeId))
    .leftJoin(MD, eq(MD.id, schema.customerVehicles.modelId))
    .where(eq(schema.customerVehicles.userId, userId))
    .orderBy(desc(schema.customerVehicles.createdAt));
}

/** The customer's service history per vehicle, from recorded completions. */
export async function maintenanceRecords(userId: string) {
  return db
    .select({
      reference: B.reference,
      vehicleId: B.vehicleId,
      serviceNameAr: B.serviceNameAr,
      serviceNameEn: B.serviceNameEn,
      centerNameAr: C.nameAr,
      centerNameEn: C.nameEn,
      completedAt: B.completedAt,
      finalAmountEgp: SC.finalAmountEgp,
      workSummary: SC.workSummary,
      mileageKm: SC.mileageKm,
    })
    .from(B)
    .innerJoin(SC, eq(SC.bookingId, B.id))
    .innerJoin(C, eq(C.id, B.centerId))
    .where(and(eq(B.customerId, userId), eq(B.status, "completed"), eq(SC.serviceCompleted, true)))
    .orderBy(desc(B.completedAt));
}

/* ------------------------------- Reviews ------------------------------- */

export async function centerRatingSummary(centerId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int`, avg: sql<number | null>`round(avg(${RV.rating})::numeric, 1)::float` })
    .from(RV)
    .where(and(eq(RV.centerId, centerId), eq(RV.hidden, false)));
  return { count: r.n, average: r.avg };
}

export async function centerReviews(centerId: string, includeHidden = false, limit = 20) {
  return db
    .select({ id: RV.id, rating: RV.rating, comment: RV.comment, hidden: RV.hidden, hiddenReason: RV.hiddenReason, createdAt: RV.createdAt, reference: B.reference })
    .from(RV)
    .innerJoin(B, eq(B.id, RV.bookingId))
    .where(and(eq(RV.centerId, centerId), includeHidden ? undefined : eq(RV.hidden, false)))
    .orderBy(desc(RV.createdAt))
    .limit(limit);
}

/* ------------------------------- Staff ------------------------------- */

/** Active staff of a center, for notifications. */
export async function centerStaffIds(centerId: string, roles: ("owner" | "manager" | "technician")[] = ["owner", "manager", "technician"], x: Exec = db) {
  const rows = await x
    .select({ userId: ST.userId, role: ST.role })
    .from(ST)
    .where(and(eq(ST.centerId, centerId), eq(ST.active, true), inArray(ST.role, roles)));
  return rows.map((r) => r.userId);
}

export async function closures(centerId: string) {
  return db
    .select({ id: CL.id, startsAt: CL.startsAt, endsAt: CL.endsAt, reason: CL.reason })
    .from(CL)
    .where(and(eq(CL.centerId, centerId), gte(CL.endsAt, new Date())))
    .orderBy(asc(CL.startsAt));
}

/* ------------------------------- Admin ------------------------------- */

export async function adminBookings(status?: BookingStatus) {
  await expireStale();
  return baseQuery()
    .where(status ? eq(B.status, status) : undefined)
    .orderBy(desc(B.updatedAt))
    .limit(200);
}

export async function adminBooking(reference: string) {
  await expireStaleByReference(reference);
  const [b] = await baseQuery().where(eq(B.reference, reference));
  return b ? details(b) : null;
}

export async function openDisputes() {
  return db
    .select({ id: DP.id, kind: DP.kind, status: DP.status, description: DP.description, openedByRole: DP.openedByRole, createdAt: DP.createdAt, reference: B.reference, centerNameAr: C.nameAr, centerNameEn: C.nameEn, bookingStatus: B.status })
    .from(DP)
    .innerJoin(B, eq(B.id, DP.bookingId))
    .innerJoin(C, eq(C.id, B.centerId))
    .where(inArray(DP.status, ["open", "reviewing"]))
    .orderBy(asc(DP.createdAt));
}

export async function openDisputeCount() {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(DP).where(inArray(DP.status, ["open", "reviewing"]));
  return r.n;
}

/* ------------------------------- Commission ------------------------------- */

export async function agreements(centerId: string) {
  return db.select().from(AG).where(eq(AG.centerId, centerId)).orderBy(desc(AG.effectiveFrom), desc(AG.createdAt));
}

/** Ledger rows with their adjustments summed. Effective commission = base + adjustments. */
export async function ledger(filter: { centerId?: string; from?: Date; to?: Date; status?: schema.LedgerStatus } = {}) {
  const conds: SQL[] = [];
  if (filter.centerId) conds.push(eq(LG.centerId, filter.centerId));
  if (filter.from) conds.push(gte(LG.completedAt, filter.from));
  if (filter.to) conds.push(lt(LG.completedAt, filter.to));
  if (filter.status) conds.push(eq(LG.status, filter.status));
  return db
    .select({
      id: LG.id,
      bookingReference: LG.bookingReference,
      centerId: LG.centerId,
      centerNameAr: C.nameAr,
      centerNameEn: C.nameEn,
      agreedPriceEgp: LG.agreedPriceEgp,
      completedAmountEgp: LG.completedAmountEgp,
      basis: LG.basis,
      percentBps: LG.percentBps,
      fixedEgp: LG.fixedEgp,
      commissionEgp: LG.commissionEgp,
      adjustmentsEgp: sql<number>`coalesce((SELECT sum(ca.delta_egp) FROM commission_adjustments ca WHERE ca.ledger_id = "commission_ledger"."id"), 0)::int`,
      providerConfirmedAt: LG.providerConfirmedAt,
      customerConfirmedAt: LG.customerConfirmedAt,
      status: LG.status,
      settlementId: LG.settlementId,
      completedAt: LG.completedAt,
    })
    .from(LG)
    .innerJoin(C, eq(C.id, LG.centerId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(LG.completedAt))
    .limit(500);
}

export async function ledgerAdjustments(ledgerId: string) {
  return db.select().from(ADJ).where(eq(ADJ.ledgerId, ledgerId)).orderBy(asc(ADJ.createdAt));
}

export async function settlements(centerId?: string) {
  return db
    .select({ id: SET.id, reference: SET.reference, centerId: SET.centerId, centerNameAr: C.nameAr, centerNameEn: C.nameEn, periodStart: SET.periodStart, periodEnd: SET.periodEnd, totalEgp: SET.totalEgp, status: SET.status, settledAt: SET.settledAt, paymentNote: SET.paymentNote, createdAt: SET.createdAt })
    .from(SET)
    .innerJoin(C, eq(C.id, SET.centerId))
    .where(centerId ? eq(SET.centerId, centerId) : undefined)
    .orderBy(desc(SET.periodStart));
}

/** Monthly report for a center: bookings by outcome and commission by status, for a Cairo month "YYYY-MM". */
export async function centerMonthlyReport(centerId: string, month: string) {
  const from = cairoToUtc(`${month}-01`, "00:00");
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const to = cairoToUtc(`${next}-01`, "00:00");
  const byStatus = await db
    .select({ status: B.status, n: sql<number>`count(*)::int` })
    .from(B)
    .where(and(eq(B.centerId, centerId), gte(B.createdAt, from), lt(B.createdAt, to)))
    .groupBy(B.status);
  const rows = await ledger({ centerId, from, to });
  const effective = (r: (typeof rows)[number]) => r.commissionEgp + r.adjustmentsEgp;
  const sum = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).reduce((a, r) => a + effective(r), 0);
  const [rating] = await db
    .select({ n: sql<number>`count(*)::int`, avg: sql<number | null>`round(avg(${RV.rating})::numeric, 1)::float` })
    .from(RV)
    .where(and(eq(RV.centerId, centerId), gte(RV.createdAt, from), lt(RV.createdAt, to)));
  return {
    from,
    to,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Partial<Record<BookingStatus, number>>,
    total: byStatus.reduce((a, r) => a + r.n, 0),
    ledger: rows,
    completedRevenueEgp: rows.filter((r) => r.status !== "waived").reduce((a, r) => a + r.completedAmountEgp, 0),
    commission: {
      pending: sum((r) => r.status === "pending_verification" || r.status === "disputed"),
      confirmed: sum((r) => r.status === "confirmed" || r.status === "payable"),
      settled: sum((r) => r.status === "settled"),
      waived: sum((r) => r.status === "waived"),
    },
    reviews: { count: rating.n, average: rating.avg },
  };
}

export { ACTIVE };
