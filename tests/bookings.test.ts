/**
 * MOTORNA Care bookings and commission (docs/CARE-BOOKING.md).
 * Session is mocked; DB, constraints, triggers, transactions and the state machine are real.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";

type U = { id: string; name: string; email: string; role: "user" | "dealer" | "admin"; suspended: boolean };
let current: U | null = null;
vi.mock("@/server/session", () => ({
  getCurrentUser: async () => current,
  requireUser: async () => current,
  requireAdmin: async () => current,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/email", () => ({ sendEmail: async () => ({ sent: false }), emailDeliveryAvailable: () => false }));

const { db, schema } = await import("@/db");
const actions = await import("@/server/actions/bookings");
const adminActions = await import("@/server/actions/booking-admin");
const queries = await import("@/server/bookings");
const engine = await import("@/server/booking-engine");
const { listNotifications } = await import("@/server/notifications");
const { addDays, cairoDate } = await import("@/lib/booking");

const as = (u: U | null) => {
  current = u;
};
async function user(name: string, role: U["role"] = "user"): Promise<U> {
  const id = crypto.randomUUID();
  const email = `${name}-${id.slice(0, 6)}@book.test`;
  await db.insert(schema.users).values({ id, name, email, role });
  return { id, name, email, role, suspended: false };
}

let admin: U, admin2: U, stranger: U;
let makeId: number;

type Center = { id: string; slug: string; owner: U; manager: U; tech: U; serviceId: string; fixedServiceId: string };

/** An approved center with hours every day 00:00–23:59, staff, and two bookable services. */
async function center(opts: { mode?: "slots" | "manual"; capacity?: number; pilot?: boolean; status?: "approved" | "under_review" | "suspended"; minNoticeHours?: number } = {}): Promise<Center> {
  const owner = await user("owner");
  const manager = await user("manager");
  const tech = await user("tech");
  const slug = `bk-${crypto.randomUUID().slice(0, 8)}`;
  const [c] = await db
    .insert(schema.serviceCenters)
    .values({ slug, nameAr: "ي مركز حجز تجريبي", nameEn: "zz Booking Center", cityId: 2, address: "1 Test St, Smouha", phone: "034251234", status: opts.status ?? "approved", createdById: owner.id, category: "independent_workshop" })
    .returning({ id: schema.serviceCenters.id });
  await db.insert(schema.centerStaff).values([
    { centerId: c.id, userId: owner.id, role: "owner" },
    { centerId: c.id, userId: manager.id, role: "manager" },
    { centerId: c.id, userId: tech.id, role: "technician" },
  ]);
  const [svc] = await db
    .insert(schema.centerServices)
    .values({ centerId: c.id, category: "brakes", nameAr: "فرامل", nameEn: "Brakes", priceMode: "estimate", priceEgp: 800, priceMaxEgp: 1200, durationMin: 60 })
    .returning({ id: schema.centerServices.id });
  const [fixed] = await db
    .insert(schema.centerServices)
    .values({ centerId: c.id, category: "oil_change", nameAr: "تغيير زيت", nameEn: "Oil change", priceMode: "fixed", priceEgp: 600, durationMin: 30 })
    .returning({ id: schema.centerServices.id });
  await db.insert(schema.centerHours).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ centerId: c.id, weekday, opens: "00:00", closes: "23:59" })));
  if (opts.pilot !== false) {
    await db.insert(schema.centerBookingSettings).values({
      centerId: c.id,
      pilotEnabled: true,
      accepting: true,
      mode: opts.mode ?? "manual",
      capacity: opts.capacity ?? 1,
      minNoticeHours: opts.minNoticeHours ?? 1,
      slotIntervalMin: 30,
      cancelCutoffHours: 12,
    });
  }
  return { id: c.id, slug, owner, manager, tech, serviceId: svc.id, fixedServiceId: fixed.id };
}

/** Cairo "tomorrow" (or +n days) at a time — safely inside the booking window. */
const day = (n = 1) => addDays(cairoDate(new Date()).date, n);

function request(c: Center, times: { date: string; time: string }[], over: Record<string, unknown> = {}) {
  return {
    centerId: c.id,
    serviceId: c.serviceId,
    requestKey: crypto.randomUUID(),
    vehicle: { makeId, year: 2019, mileageKm: 85000 },
    times,
    contactName: "Customer Test",
    contactPhone: "01012345678",
    note: "Squeaking front brakes",
    acceptPolicy: true,
    ...over,
  };
}

async function book(c: Center, customer: U, times: { date: string; time: string }[], over: Record<string, unknown> = {}) {
  as(customer);
  const r = await actions.createBooking(request(c, times, over));
  if (!r.ok) throw new Error(`createBooking failed: ${r.error} ${JSON.stringify(r.fields ?? {})}`);
  return bookingByRef(r.data.reference);
}
async function bookingByRef(reference: string) {
  const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.reference, reference));
  return b;
}
async function options(bookingId: string) {
  return db.select().from(schema.bookingTimeOptions).where(eq(schema.bookingTimeOptions.bookingId, bookingId));
}
async function openOption(bookingId: string, kind: "requested" | "proposed") {
  return (await options(bookingId)).filter((o) => o.kind === kind && o.state === "open").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
/** Test-only: move a confirmed booking's time (bookings are mutable; events are not). */
async function shiftTo(bookingId: string, startsAt: Date) {
  const b = (await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId)))[0];
  await db.update(schema.bookings).set({ startsAt, endsAt: new Date(startsAt.getTime() + b.durationMin * 60_000) }).where(eq(schema.bookings.id, bookingId));
}
async function ledgerFor(bookingId: string) {
  return (await db.select().from(schema.commissionLedger).where(eq(schema.commissionLedger.bookingId, bookingId)))[0];
}
async function agreement(c: Center, over: Record<string, unknown> = {}) {
  as(admin);
  const r = await adminActions.createAgreement(c.id, { basis: "percent", percent: 10, effectiveFrom: day(-30), settlementSchedule: "monthly", contractReference: "PILOT-001", ...over });
  if (!r.ok) throw new Error(`agreement failed: ${r.error}`);
  const a = await adminActions.activateAgreement(r.data.id);
  if (!a.ok) throw new Error(`activate failed: ${a.error}`);
  return r.data.id;
}
/** Confirm → shift to now → check in → complete with an amount. */
async function completed(c: Center, customer: U, amount = 1000) {
  const b = await book(c, customer, [{ date: day(2), time: "10:00" }]);
  as(c.manager);
  const [opt] = await openOption(b.id, "requested");
  expect((await actions.providerBookingAction(b.id, { action: "accept", optionId: opt.id })).ok).toBe(true);
  await shiftTo(b.id, new Date(Date.now() + 30 * 60_000));
  as(c.tech);
  expect((await actions.providerBookingAction(b.id, { action: "checkIn" })).ok).toBe(true);
  const r = await actions.providerBookingAction(b.id, { action: "complete", completion: { serviceCompleted: true, finalAmountEgp: amount, workSummary: "Replaced front pads" } });
  if (!r.ok) throw new Error(`complete failed: ${r.error}`);
  return bookingByRef(b.reference);
}

beforeAll(async () => {
  admin = await user("admin", "admin");
  admin2 = await user("admin2", "admin");
  stranger = await user("stranger");
  const [m] = await db.select({ id: schema.vehicleMakes.id }).from(schema.vehicleMakes).limit(1);
  makeId = m.id;
});

describe("pilot switch", () => {
  it("booking is off by default and the provider can't turn it on alone", async () => {
    const c = await center({ pilot: false });
    expect(await queries.centerBookable(c.id)).toBe(false);
    const cust = await user("cust");
    as(cust);
    expect(await actions.createBooking(request(c, [{ date: day(), time: "10:00" }]))).toMatchObject({ ok: false, error: "bookingUnavailable" });
    as(c.owner);
    const settings = { accepting: true, mode: "manual", slotIntervalMin: 30, capacity: 1, minNoticeHours: 1, maxAdvanceDays: 30, cancelCutoffHours: 12, policyAr: "", policyEn: "" };
    expect(await actions.saveBookingSettings(c.id, settings)).toMatchObject({ ok: false, error: "bookingUnavailable" });
    // Preparing settings (not accepting) is fine.
    expect((await actions.saveBookingSettings(c.id, { ...settings, accepting: false })).ok).toBe(true);
    // Only an admin can enable the pilot, and not on a center they staff.
    expect(await adminActions.setBookingPilot(c.id, true)).toMatchObject({ ok: false, error: "forbidden" });
    await db.insert(schema.centerStaff).values({ centerId: c.id, userId: admin2.id, role: "manager" });
    as(admin2);
    expect(await adminActions.setBookingPilot(c.id, true)).toMatchObject({ ok: false, error: "conflictOfInterest" });
    as(admin);
    expect((await adminActions.setBookingPilot(c.id, true)).ok).toBe(true);
    as(c.owner);
    expect((await actions.saveBookingSettings(c.id, settings)).ok).toBe(true);
    expect(await queries.centerBookable(c.id)).toBe(true);
    // Disabling stops acceptance immediately.
    as(admin);
    expect((await adminActions.setBookingPilot(c.id, false)).ok).toBe(true);
    expect(await queries.centerBookable(c.id)).toBe(false);
    const [s] = await db.select().from(schema.centerBookingSettings).where(eq(schema.centerBookingSettings.centerId, c.id));
    expect(s.accepting).toBe(false);
    const log = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.entityId, c.id), sql`${schema.auditLogs.action} like 'booking.pilot.%'`));
    expect(log.map((l) => l.action).sort()).toEqual(["booking.pilot.disable", "booking.pilot.enable"]);
  });

  it("the pilot can't be enabled for a center that isn't approved", async () => {
    const c = await center({ pilot: false, status: "under_review" });
    as(admin);
    expect(await adminActions.setBookingPilot(c.id, true)).toMatchObject({ ok: false, error: "bookingUnavailable" });
    const s = await center({ pilot: true, status: "suspended" });
    expect(await queries.centerBookable(s.id)).toBe(false);
  });
});

describe("booking creation and conflicts", () => {
  it("a new request is pending, not confirmed, and notifies the provider", async () => {
    const c = await center();
    const cust = await user("cust");
    const b = await book(c, cust, [{ date: day(), time: "10:00" }, { date: day(), time: "14:00" }]);
    expect(b.status).toBe("pending_provider");
    expect(b.startsAt).toBeNull();
    expect(b.reference).toMatch(/^MC-[A-Z0-9]{7}$/);
    expect(b.priceMode).toBe("estimate");
    expect(b.priceEgp).toBe(800);
    expect(b.priceMaxEgp).toBe(1200);
    expect((await options(b.id)).every((o) => o.kind === "requested" && o.state === "open")).toBe(true);
    const n = await listNotifications(c.manager.id);
    expect(n.some((x) => x.kind === "booking_new" && x.href === `/center/${c.slug}/bookings/${b.reference}`)).toBe(true);
    // Notifications are private to their recipient.
    expect((await listNotifications(stranger.id)).length).toBe(0);
  });

  it("the same form submitted twice creates one booking", async () => {
    const c = await center();
    const cust = await user("cust");
    as(cust);
    const req = request(c, [{ date: day(), time: "11:00" }]);
    const [a, b] = await Promise.all([actions.createBooking(req), actions.createBooking(req)]);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.data.reference).toBe(b.data.reference);
    const rows = await db.select().from(schema.bookings).where(eq(schema.bookings.customerId, cust.id));
    expect(rows).toHaveLength(1);
  });

  it("slot mode: concurrent requests for the last seat — exactly one wins", async () => {
    const c = await center({ mode: "slots", capacity: 1 });
    const custs = await Promise.all([user("c1"), user("c2"), user("c3")]);
    const results = await Promise.all(
      custs.map(async (u) => {
        const { createBooking } = actions;
        // Each call reads `current` synchronously at its start.
        current = u;
        return createBooking(request(c, [{ date: day(), time: "09:00" }]));
      }),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error === "slotTaken")).toBe(true);
  });

  it("slot mode respects capacity > 1 and hides full slots", async () => {
    const c = await center({ mode: "slots", capacity: 2 });
    await book(c, await user("a"), [{ date: day(), time: "09:00" }]);
    await book(c, await user("b"), [{ date: day(), time: "09:30" }]); // overlaps 09:30–10:00
    const third = await user("c");
    as(third);
    expect(await actions.createBooking(request(c, [{ date: day(), time: "09:30" }]))).toMatchObject({ ok: false, error: "slotTaken" });
    const slots = await queries.availableSlots(c.id, 60, day());
    expect(slots.map((s) => s.label)).not.toContain("09:30");
    expect(slots.map((s) => s.label)).not.toContain("09:00");
    expect(slots.map((s) => s.label)).toContain("10:30");
  });

  it("manual mode: provider can't confirm a second booking over capacity", async () => {
    const c = await center({ capacity: 1 });
    const b1 = await book(c, await user("a"), [{ date: day(), time: "12:00" }]);
    const b2 = await book(c, await user("b"), [{ date: day(), time: "12:30" }]);
    as(c.manager);
    const [o1] = await openOption(b1.id, "requested");
    const [o2] = await openOption(b2.id, "requested");
    const [r1, r2] = await Promise.all([actions.providerBookingAction(b1.id, { action: "accept", optionId: o1.id }), actions.providerBookingAction(b2.id, { action: "accept", optionId: o2.id })]);
    expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1);
    const loser = r1.ok ? r2 : r1;
    expect(loser).toMatchObject({ ok: false, error: "slotTaken" });
  });

  it("rejects times outside the schedule, closures and the customer's own overlapping booking", async () => {
    const c = await center();
    const cust = await user("cust");
    as(cust);
    expect(await actions.createBooking(request(c, [{ date: day(60), time: "10:00" }]))).toMatchObject({ ok: false, error: "slotTaken" });
    as(c.owner);
    expect((await actions.addClosure(c.id, { startDate: day(3), startTime: "00:00", endDate: day(4), endTime: "00:00", reason: "Holiday" })).ok).toBe(true);
    as(cust);
    expect(await actions.createBooking(request(c, [{ date: day(3), time: "10:00" }]))).toMatchObject({ ok: false, error: "slotTaken" });
    await book(c, cust, [{ date: day(5), time: "10:00" }]);
    expect(await actions.createBooking(request(c, [{ date: day(5), time: "10:30" }]))).toMatchObject({ ok: false, error: "slotTaken" });
  });

  it("staff can't book their own center; services must belong to the center", async () => {
    const c = await center();
    const other = await center();
    as(c.tech);
    expect(await actions.createBooking(request(c, [{ date: day(), time: "10:00" }]))).toMatchObject({ ok: false, error: "forbidden" });
    as(await user("cust"));
    expect(await actions.createBooking(request(c, [{ date: day(), time: "10:00" }], { serviceId: other.serviceId }))).toMatchObject({ ok: false, error: "bookingUnavailable" });
  });
});

describe("permissions and isolation", () => {
  it("customers can't confirm; technicians can't accept; other providers and customers get 404", async () => {
    const c = await center();
    const other = await center();
    const cust = await user("cust");
    const b = await book(c, cust, [{ date: day(), time: "15:00" }]);
    const [opt] = await openOption(b.id, "requested");
    as(cust);
    expect(await actions.providerBookingAction(b.id, { action: "accept", optionId: opt.id })).toMatchObject({ ok: false, error: "notFound" });
    as(c.tech);
    expect(await actions.providerBookingAction(b.id, { action: "accept", optionId: opt.id })).toMatchObject({ ok: false, error: "forbidden" });
    as(other.owner);
    expect(await actions.providerBookingAction(b.id, { action: "accept", optionId: opt.id })).toMatchObject({ ok: false, error: "notFound" });
    as(stranger);
    expect(await actions.customerBookingAction(b.id, { action: "cancel" })).toMatchObject({ ok: false, error: "notFound" });
    expect(await queries.customerBooking(stranger.id, b.reference)).toBeNull();
    expect(await queries.centerBooking(other.id, b.reference)).toBeNull();
    expect((await queries.centerBookings(other.id, "action")).some((x) => x.id === b.id)).toBe(false);
    expect((await queries.customerBookings(stranger.id)).length).toBe(0);
    expect((await bookingByRef(b.reference)).status).toBe("pending_provider");
  });
});

describe("alternative times and questions", () => {
  it("provider proposes, customer accepts → confirmed at the proposed time", async () => {
    const c = await center();
    const cust = await user("cust");
    const b = await book(c, cust, [{ date: day(), time: "16:00" }]);
    as(c.owner);
    const pr = await actions.providerBookingAction(b.id, { action: "propose", times: [{ date: day(), time: "17:00" }, { date: day(2), time: "09:00" }], message: "16:00 is full" });
    expect(pr).toEqual({ ok: true, data: { status: "alternative_proposed" } });
    let row = await bookingByRef(b.reference);
    expect(row.status).toBe("alternative_proposed");
    expect(row.startsAt).toBeNull();
    const proposed = await openOption(b.id, "proposed");
    expect(proposed).toHaveLength(2);
    expect(await openOption(b.id, "requested")).toHaveLength(0);
    expect((await listNotifications(cust.id)).some((n) => n.kind === "booking_alternative")).toBe(true);
    // The provider can't accept on the customer's behalf.
    expect(await actions.customerBookingAction(b.id, { action: "acceptAlternative", optionId: proposed[0].id })).toMatchObject({ ok: false, error: "notFound" });
    as(cust);
    expect((await actions.customerBookingAction(b.id, { action: "acceptAlternative", optionId: proposed[1].id })).ok).toBe(true);
    row = await bookingByRef(b.reference);
    expect(row.status).toBe("confirmed");
    expect(row.startsAt?.getTime()).toBe(proposed[1].startsAt.getTime());
    const states = (await options(b.id)).filter((o) => o.kind === "proposed").map((o) => o.state).sort();
    expect(states).toEqual(["accepted", "declined"]);
  });

  it("customer declines the alternatives with new times; question and reply", async () => {
    const c = await center();
    const cust = await user("cust");
    const b = await book(c, cust, [{ date: day(), time: "18:00" }]);
    as(c.manager);
    expect((await actions.providerBookingAction(b.id, { action: "ask", message: "Petrol or diesel?" })).ok).toBe(true);
    as(cust);
    expect((await actions.customerBookingAction(b.id, { action: "reply", message: "Petrol" })).ok).toBe(true);
    as(c.manager);
    expect((await actions.providerBookingAction(b.id, { action: "propose", times: [{ date: day(), time: "19:00" }] })).ok).toBe(true);
    as(cust);
    expect((await actions.customerBookingAction(b.id, { action: "declineAlternative", times: [{ date: day(2), time: "18:00" }] })).ok).toBe(true);
    const row = await bookingByRef(b.reference);
    expect(row.status).toBe("pending_provider");
    expect((await openOption(b.id, "requested")).map((o) => o.round)).toEqual([4 - 1]);
    const msgs = await db.select().from(schema.bookingMessages).where(eq(schema.bookingMessages.bookingId, b.id));
    expect(msgs.map((m) => m.authorRole)).toEqual(["provider", "customer"]);
    const events = await db.select().from(schema.bookingEvents).where(eq(schema.bookingEvents.bookingId, b.id));
    expect(events.map((e) => e.action)).toEqual(["submit", "ask", "reply", "propose", "declineAlternative"]);
  });

  it("status history is append-only", async () => {
    const c = await center();
    const b = await book(c, await user("cust"), [{ date: day(), time: "20:00" }]);
    await expect(db.update(schema.bookingEvents).set({ note: "x" }).where(eq(schema.bookingEvents.bookingId, b.id))).rejects.toThrow();
    await expect(db.delete(schema.bookingEvents).where(eq(schema.bookingEvents.bookingId, b.id))).rejects.toThrow();
  });
});

describe("cancellation", () => {
  it("free before the cutoff; recorded as late (no fee) after it; reschedule blocked after the cutoff", async () => {
    const c = await center();
    const cust = await user("cust");
    const early = await book(c, cust, [{ date: day(3), time: "10:00" }]);
    as(c.owner);
    expect((await actions.providerBookingAction(early.id, { action: "accept", optionId: (await openOption(early.id, "requested"))[0].id })).ok).toBe(true);
    as(cust);
    expect((await actions.customerBookingAction(early.id, { action: "cancel" })).ok).toBe(true);
    expect(await bookingByRef(early.reference)).toMatchObject({ status: "cancelled_customer", lateCancel: false });

    const late = await book(c, cust, [{ date: day(4), time: "10:00" }]);
    as(c.owner);
    expect((await actions.providerBookingAction(late.id, { action: "accept", optionId: (await openOption(late.id, "requested"))[0].id })).ok).toBe(true);
    await shiftTo(late.id, new Date(Date.now() + 3 * 3_600_000));
    as(cust);
    expect(await actions.customerBookingAction(late.id, { action: "reschedule", times: [{ date: day(6), time: "10:00" }] })).toMatchObject({ ok: false, error: "bookingTooLate" });
    expect((await actions.customerBookingAction(late.id, { action: "cancel", reason: "Car broke down" })).ok).toBe(true);
    const row = await bookingByRef(late.reference);
    expect(row).toMatchObject({ status: "cancelled_customer", lateCancel: true });
    // No ledger, no fee: a cancelled booking never produces commission.
    expect(await ledgerFor(late.id)).toBeUndefined();
    expect((await listNotifications(c.manager.id)).some((n) => n.kind === "booking_cancelled")).toBe(true);
  });

  it("reschedule before the cutoff releases the confirmed time", async () => {
    const c = await center();
    const cust = await user("cust");
    const b = await book(c, cust, [{ date: day(3), time: "13:00" }]);
    as(c.owner);
    await actions.providerBookingAction(b.id, { action: "accept", optionId: (await openOption(b.id, "requested"))[0].id });
    as(cust);
    expect((await actions.customerBookingAction(b.id, { action: "reschedule", times: [{ date: day(4), time: "13:00" }] })).ok).toBe(true);
    expect(await bookingByRef(b.reference)).toMatchObject({ status: "pending_provider", startsAt: null });
  });
});

describe("completion, commission and confirmation", () => {
  it("records the agreement and rate; never marks it paid", async () => {
    const c = await center();
    const agId = await agreement(c);
    const cust = await user("cust");
    const b = await completed(c, cust, 1000);
    expect(b.status).toBe("completed");
    const l = await ledgerFor(b.id);
    expect(l).toMatchObject({ agreementId: agId, basis: "percent", percentBps: 1000, completedAmountEgp: 1000, commissionEgp: 100, status: "pending_verification", settlementId: null, bookingReference: b.reference });
    expect(l.agreedPriceEgp).toBeNull(); // estimate, not a fixed agreed price
    const audit = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.entityId, l.id), eq(schema.auditLogs.action, "commission.accrued")));
    expect(audit).toHaveLength(1);
    // Only ledger statuses move; amounts are frozen at the DB level.
    await expect(db.update(schema.commissionLedger).set({ commissionEgp: 1 }).where(eq(schema.commissionLedger.id, l.id))).rejects.toThrow();
    await expect(db.update(schema.commissionLedger).set({ status: "settled" }).where(eq(schema.commissionLedger.id, l.id))).rejects.toThrow();
    await expect(db.delete(schema.commissionLedger).where(eq(schema.commissionLedger.id, l.id))).rejects.toThrow();
    // Customer confirms → ledger confirmed.
    as(cust);
    expect((await actions.confirmCompletion(b.id)).ok).toBe(true);
    expect((await ledgerFor(b.id)).status).toBe("confirmed");
  });

  it("no agreement → no commission; no-show → no commission; can't insert ledger for unfinished bookings", async () => {
    const c = await center();
    const b = await completed(c, await user("cust"));
    expect(await ledgerFor(b.id)).toBeUndefined();
    const c2 = await center();
    const agId = await agreement(c2);
    const ns = await book(c2, await user("cust"), [{ date: day(2), time: "11:00" }]);
    as(c2.owner);
    await actions.providerBookingAction(ns.id, { action: "accept", optionId: (await openOption(ns.id, "requested"))[0].id });
    expect(await actions.providerBookingAction(ns.id, { action: "noShow" })).toMatchObject({ ok: false, error: "bookingTooEarly" });
    await shiftTo(ns.id, new Date(Date.now() - 2 * 3_600_000));
    expect((await actions.providerBookingAction(ns.id, { action: "noShow" })).ok).toBe(true);
    expect(await ledgerFor(ns.id)).toBeUndefined();
    await expect(
      db.insert(schema.commissionLedger).values({ bookingId: ns.id, centerId: c2.id, agreementId: agId, bookingReference: ns.reference, completedAmountEgp: 500, basis: "percent", percentBps: 1000, commissionEgp: 50, providerConfirmedAt: new Date(), completedAt: new Date() }),
    ).rejects.toThrow();
  });

  it("a fixed-fee agreement for one category, and a provider can't complete before check-in", async () => {
    const c = await center();
    await agreement(c, { basis: "fixed", fixedEgp: 150, percent: undefined, categories: ["brakes"] });
    const b = await book(c, await user("cust"), [{ date: day(2), time: "12:00" }]);
    as(c.owner);
    await actions.providerBookingAction(b.id, { action: "accept", optionId: (await openOption(b.id, "requested"))[0].id });
    expect(await actions.providerBookingAction(b.id, { action: "complete", completion: { serviceCompleted: true, finalAmountEgp: 900 } })).toMatchObject({ ok: false, error: "bookingTransition" });
    expect(await actions.providerBookingAction(b.id, { action: "checkIn" })).toMatchObject({ ok: false, error: "bookingTooEarly" });
    const done = await completed(c, await user("cust"), 900);
    expect(await ledgerFor(done.id)).toMatchObject({ basis: "fixed", fixedEgp: 150, commissionEgp: 150 });
  });

  it("completion needs an amount; 'not completed' becomes a provider cancellation", async () => {
    const c = await center();
    await agreement(c);
    const b = await book(c, await user("cust"), [{ date: day(2), time: "14:00" }]);
    as(c.manager);
    await actions.providerBookingAction(b.id, { action: "accept", optionId: (await openOption(b.id, "requested"))[0].id });
    await shiftTo(b.id, new Date(Date.now() + 10 * 60_000));
    await actions.providerBookingAction(b.id, { action: "checkIn" });
    expect(await actions.providerBookingAction(b.id, { action: "complete", completion: { serviceCompleted: true } })).toMatchObject({ ok: false, error: "validation" });
    as(c.tech);
    expect(await actions.providerBookingAction(b.id, { action: "complete", completion: { serviceCompleted: false, workSummary: "Part not in stock" } })).toMatchObject({ ok: false, error: "forbidden" });
    as(c.manager);
    expect((await actions.providerBookingAction(b.id, { action: "complete", completion: { serviceCompleted: false, workSummary: "Part not in stock" } })).ok).toBe(true);
    expect(await bookingByRef(b.reference)).toMatchObject({ status: "cancelled_provider", statusReason: "Part not in stock" });
    expect(await ledgerFor(b.id)).toBeUndefined();
  });

  it("one review per completed booking, by its customer only", async () => {
    const c = await center();
    const cust = await user("cust");
    const b = await completed(c, cust);
    as(stranger);
    expect(await actions.submitReview(b.id, { rating: 1 })).toMatchObject({ ok: false, error: "notFound" });
    as(cust);
    expect((await actions.submitReview(b.id, { rating: 5, comment: "Quick and honest" })).ok).toBe(true);
    expect(await actions.submitReview(b.id, { rating: 4 })).toMatchObject({ ok: false });
    expect(await queries.centerRatingSummary(c.id)).toEqual({ count: 1, average: 5 });
  });
});

describe("disputes", () => {
  it("customer dispute freezes commission; admin resolves; conflicted admin can't", async () => {
    const c = await center();
    await agreement(c);
    const cust = await user("cust");
    const b = await completed(c, cust, 2000);
    as(cust);
    expect((await actions.openBookingDispute(b.id, { kind: "completion_disagreement", description: "Brakes still squeak" })).ok).toBe(true);
    expect((await bookingByRef(b.reference)).status).toBe("disputed");
    expect((await ledgerFor(b.id)).status).toBe("disputed");
    expect(await actions.openBookingDispute(b.id, { kind: "other", description: "Second report" })).toMatchObject({ ok: false });
    const [d] = await db.select().from(schema.bookingDisputes).where(eq(schema.bookingDisputes.bookingId, b.id));
    // Provider and customer can't resolve.
    as(c.owner);
    expect(await adminActions.resolveDispute(d.id, { decision: "completed", note: "Checked" })).toMatchObject({ ok: false, error: "forbidden" });
    await db.insert(schema.centerStaff).values({ centerId: c.id, userId: admin2.id, role: "technician" });
    as(admin2);
    expect(await adminActions.resolveDispute(d.id, { decision: "completed", note: "Checked" })).toMatchObject({ ok: false, error: "conflictOfInterest" });
    as(admin);
    expect((await adminActions.resolveDispute(d.id, { decision: "completed", note: "Center redid the pads; customer agreed" })).ok).toBe(true);
    expect((await bookingByRef(b.reference)).status).toBe("completed");
    expect((await ledgerFor(b.id)).status).toBe("confirmed");
    expect((await listNotifications(cust.id)).some((n) => n.kind === "booking_dispute_resolved")).toBe(true);
  });

  it("a dispute resolved as not completed waives the commission", async () => {
    const c = await center();
    await agreement(c);
    const cust = await user("cust");
    const b = await completed(c, cust);
    as(cust);
    await actions.openBookingDispute(b.id, { kind: "completion_disagreement", description: "Work was never done" });
    const [d] = await db.select().from(schema.bookingDisputes).where(eq(schema.bookingDisputes.bookingId, b.id));
    as(admin);
    expect((await adminActions.resolveDispute(d.id, { decision: "cancelled_provider", note: "Center couldn't show the work" })).ok).toBe(true);
    expect((await ledgerFor(b.id)).status).toBe("waived");
  });

  it("support requests don't change the booking; providers may dispute only a late cancellation", async () => {
    const c = await center();
    const cust = await user("cust");
    const b = await book(c, cust, [{ date: day(), time: "08:00" }]);
    as(cust);
    expect((await actions.openBookingDispute(b.id, { kind: "support", description: "Can I bring two cars?" })).ok).toBe(true);
    expect((await bookingByRef(b.reference)).status).toBe("pending_provider");
    as(c.owner);
    await actions.providerBookingAction(b.id, { action: "accept", optionId: (await openOption(b.id, "requested"))[0].id });
    await shiftTo(b.id, new Date(Date.now() + 2 * 3_600_000));
    as(cust);
    await actions.customerBookingAction(b.id, { action: "cancel" });
    as(cust);
    expect(await actions.openBookingDispute(b.id, { kind: "other", description: "I cancelled myself" })).toMatchObject({ ok: false, error: "forbidden" });
    as(c.owner);
    expect((await actions.openBookingDispute(b.id, { kind: "late_cancellation", description: "Cancelled 2h before, bay was reserved" })).ok).toBe(true);
    expect((await bookingByRef(b.reference)).status).toBe("disputed");
  });
});

describe("agreements, adjustments and settlements", () => {
  it("agreements: no overlapping active scope; active terms are immutable", async () => {
    const c = await center();
    const id = await agreement(c);
    as(admin);
    const second = await adminActions.createAgreement(c.id, { basis: "percent", percent: 8, effectiveFrom: day(), settlementSchedule: "monthly" });
    expect(second.ok).toBe(true);
    if (second.ok) expect(await adminActions.activateAgreement(second.data.id)).toMatchObject({ ok: false, error: "agreementOverlap" });
    await expect(db.update(schema.commissionAgreements).set({ percentBps: 1 }).where(eq(schema.commissionAgreements.id, id))).rejects.toThrow();
    as(c.owner);
    expect(await adminActions.createAgreement(c.id, { basis: "percent", percent: 1, effectiveFrom: day(), settlementSchedule: "monthly" })).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("adjustments are append-only and audited; settlement only by admin", async () => {
    const c = await center();
    await agreement(c);
    const cust = await user("cust");
    const b = await completed(c, cust, 1500);
    const l = await ledgerFor(b.id);
    as(c.owner);
    expect(await adminActions.adjustLedger(l.id, { deltaEgp: -50, reason: "Goodwill" })).toMatchObject({ ok: false, error: "forbidden" });
    as(admin);
    expect((await adminActions.adjustLedger(l.id, { deltaEgp: -50, reason: "Agreed launch discount" })).ok).toBe(true);
    expect(await adminActions.adjustLedger(l.id, { deltaEgp: -500, reason: "Too much" })).toMatchObject({ ok: false, error: "validation" });
    const adj = await db.select().from(schema.commissionAdjustments).where(eq(schema.commissionAdjustments.ledgerId, l.id));
    expect(adj).toHaveLength(1);
    await expect(db.update(schema.commissionAdjustments).set({ deltaEgp: 1 }).where(eq(schema.commissionAdjustments.ledgerId, l.id))).rejects.toThrow();
    await expect(db.delete(schema.commissionAdjustments).where(eq(schema.commissionAdjustments.ledgerId, l.id))).rejects.toThrow();
    const [row] = await queries.ledger({ centerId: c.id });
    expect(row.commissionEgp + row.adjustmentsEgp).toBe(100);

    // Pending rows aren't settled.
    expect(await adminActions.createSettlement(c.id, { from: day(-1), to: day(1) })).toMatchObject({ ok: false, error: "nothingToSettle" });
    as(cust);
    await actions.confirmCompletion(b.id);
    as(c.owner);
    expect(await adminActions.createSettlement(c.id, { from: day(-1), to: day(1) })).toMatchObject({ ok: false, error: "forbidden" });
    as(admin);
    const st = await adminActions.createSettlement(c.id, { from: day(-1), to: day(1) });
    expect(st).toMatchObject({ ok: true });
    if (st.ok) expect(st.data.totalEgp).toBe(100);
    if (!st.ok) return;
    expect((await ledgerFor(b.id)).status).toBe("payable");
    // Provider can't record payment; only the admin can, with a note.
    as(c.owner);
    expect(await adminActions.markSettlementPaid(st.data.id, "Transfer 123")).toMatchObject({ ok: false, error: "forbidden" });
    as(admin);
    expect(await adminActions.adjustLedger(l.id, { deltaEgp: 10, reason: "Late change" })).toMatchObject({ ok: false });
    expect((await adminActions.markSettlementPaid(st.data.id, "Bank transfer ref 4471")).ok).toBe(true);
    expect((await ledgerFor(b.id)).status).toBe("settled");
    expect(await adminActions.setLedgerStatus(l.id, "waived", "Oops")).toMatchObject({ ok: false });
    const log = await db.select({ a: schema.auditLogs.action }).from(schema.auditLogs).where(eq(schema.auditLogs.entityId, st.data.id));
    expect(log.map((x) => x.a).sort()).toEqual(["commission.settlement.issue", "commission.settlement.paid"]);
  });

  it("voiding a statement returns its rows to confirmed", async () => {
    const c = await center();
    await agreement(c);
    const cust = await user("cust");
    const b = await completed(c, cust, 1000);
    as(cust);
    await actions.confirmCompletion(b.id);
    as(admin);
    const st = await adminActions.createSettlement(c.id, { from: day(-1), to: day(1) });
    if (!st.ok) throw new Error(st.error);
    expect((await adminActions.voidSettlement(st.data.id, "Wrong period")).ok).toBe(true);
    expect(await ledgerFor(b.id)).toMatchObject({ status: "confirmed", settlementId: null });
  });
});

describe("daily job: reminders, expiry, auto-confirm", () => {
  it("reminds once, only for upcoming confirmed appointments", async () => {
    const c = await center();
    const cust = await user("cust");
    const confirmed = await book(c, cust, [{ date: day(), time: "21:00" }]);
    const pending = await book(c, await user("cust2"), [{ date: day(), time: "22:00" }]);
    as(c.owner);
    await actions.providerBookingAction(confirmed.id, { action: "accept", optionId: (await openOption(confirmed.id, "requested"))[0].id });
    await shiftTo(confirmed.id, new Date(Date.now() + 20 * 3_600_000));
    await engine.runCareMaintenance();
    await engine.runCareMaintenance();
    const reminders = (await listNotifications(cust.id)).filter((n) => n.kind === "booking_reminder");
    expect(reminders).toHaveLength(1);
    expect((await bookingByRef(confirmed.reference)).reminderSentAt).not.toBeNull();
    expect((await bookingByRef(pending.reference)).reminderSentAt).toBeNull();
  });

  it("expires requests whose times all passed", async () => {
    const c = await center();
    const cust = await user("cust");
    const b = await book(c, cust, [{ date: day(), time: "20:30" }]);
    const later = new Date(Date.now() + 3 * 86_400_000);
    expect((await engine.runCareMaintenance(later)).expired).toBeGreaterThanOrEqual(1);
    expect((await bookingByRef(b.reference)).status).toBe("expired");
    expect((await listNotifications(cust.id)).some((n) => n.kind === "booking_expired")).toBe(true);
  });

  it("sends the confirm-or-report reminder once, then auto-confirms after 7 days", async () => {
    const c = await center();
    await agreement(c);
    const cust = await user("cust");
    const b = await completed(c, cust, 1000);
    const day6 = new Date(Date.now() + 5.5 * 86_400_000);
    await engine.runCareMaintenance(day6);
    await engine.runCareMaintenance(day6);
    expect((await listNotifications(cust.id)).filter((n) => n.kind === "booking_confirm_reminder")).toHaveLength(1);
    expect((await ledgerFor(b.id)).status).toBe("pending_verification");
    await engine.runCareMaintenance(new Date(Date.now() + 8 * 86_400_000));
    expect((await ledgerFor(b.id)).status).toBe("confirmed");
  });
});
