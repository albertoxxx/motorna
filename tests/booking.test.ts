import { describe, expect, it } from "vitest";
import {
  agreementFor,
  availableActions,
  cairoDate,
  cairoToUtc,
  canMoveLedger,
  commissionAmount,
  daySlots,
  hasCapacity,
  holdsCapacity,
  ledgerEntryFor,
  newReference,
  transition,
  withinSchedule,
  type Agreement,
  type ScheduleConfig,
} from "@/lib/booking";

const start = new Date("2026-11-03T08:00:00Z"); // 10:00 Cairo (UTC+2 in November)
const h = (n: number) => new Date(start.getTime() - n * 3_600_000);
const base = { startsAt: start, cancelCutoffHours: 12 };

describe("booking state machine", () => {
  it("only owners/managers accept; never the customer", () => {
    expect(transition({ ...base, status: "pending_provider", action: "accept", actor: "manager" })).toEqual({ ok: true, to: "confirmed" });
    expect(transition({ ...base, status: "pending_provider", action: "accept", actor: "technician" })).toEqual({ ok: false, error: "forbidden" });
    expect(transition({ ...base, status: "pending_provider", action: "accept", actor: "customer" })).toEqual({ ok: false, error: "forbidden" });
    expect(transition({ ...base, status: "alternative_proposed", action: "accept", actor: "owner" })).toEqual({ ok: false, error: "invalidTransition" });
  });

  it("alternative-time negotiation", () => {
    expect(transition({ ...base, status: "pending_provider", action: "propose", actor: "owner" })).toEqual({ ok: true, to: "alternative_proposed" });
    expect(transition({ ...base, status: "alternative_proposed", action: "acceptAlternative", actor: "customer" })).toEqual({ ok: true, to: "confirmed" });
    expect(transition({ ...base, status: "alternative_proposed", action: "declineAlternative", actor: "customer" })).toEqual({ ok: true, to: "pending_provider" });
    expect(transition({ ...base, status: "alternative_proposed", action: "acceptAlternative", actor: "owner" })).toEqual({ ok: false, error: "forbidden" });
  });

  it("question and reply", () => {
    expect(transition({ ...base, status: "pending_provider", action: "ask", actor: "manager" })).toEqual({ ok: true, to: "awaiting_customer" });
    expect(transition({ ...base, status: "awaiting_customer", action: "reply", actor: "customer" })).toEqual({ ok: true, to: "pending_provider" });
  });

  it("decline and provider cancel need a reason", () => {
    expect(transition({ ...base, status: "pending_provider", action: "decline", actor: "owner" })).toEqual({ ok: false, error: "reasonRequired" });
    expect(transition({ ...base, status: "pending_provider", action: "decline", actor: "owner", reason: "Fully booked" })).toEqual({ ok: true, to: "declined" });
    expect(transition({ ...base, status: "confirmed", action: "providerCancel", actor: "owner", reason: "  " })).toEqual({ ok: false, error: "reasonRequired" });
  });

  it("cancellation rules: free before the cutoff, recorded as late after it", () => {
    expect(transition({ ...base, status: "confirmed", action: "cancel", actor: "customer", now: h(24) })).toEqual({ ok: true, to: "cancelled_customer", lateCancel: false });
    expect(transition({ ...base, status: "confirmed", action: "cancel", actor: "customer", now: h(3) })).toEqual({ ok: true, to: "cancelled_customer", lateCancel: true });
    // An unconfirmed request is never "late".
    expect(transition({ ...base, startsAt: null, status: "pending_provider", action: "cancel", actor: "customer" })).toEqual({ ok: true, to: "cancelled_customer", lateCancel: false });
    expect(transition({ ...base, status: "completed", action: "cancel", actor: "customer" })).toEqual({ ok: false, error: "invalidTransition" });
    expect(transition({ ...base, status: "confirmed", action: "reschedule", actor: "customer", now: h(24) })).toEqual({ ok: true, to: "pending_provider" });
    expect(transition({ ...base, status: "confirmed", action: "reschedule", actor: "customer", now: h(5) })).toEqual({ ok: false, error: "tooLate" });
  });

  it("check-in window, completion and no-show timing", () => {
    expect(transition({ ...base, status: "confirmed", action: "checkIn", actor: "technician", now: h(5) })).toEqual({ ok: false, error: "tooEarly" });
    expect(transition({ ...base, status: "confirmed", action: "checkIn", actor: "technician", now: h(1) })).toEqual({ ok: true, to: "checked_in" });
    expect(transition({ ...base, status: "confirmed", action: "complete", actor: "owner" })).toEqual({ ok: false, error: "invalidTransition" });
    expect(transition({ ...base, status: "checked_in", action: "complete", actor: "technician" })).toEqual({ ok: true, to: "completed" });
    expect(transition({ ...base, status: "confirmed", action: "noShow", actor: "owner", now: h(-0.25) })).toEqual({ ok: false, error: "tooEarly" });
    expect(transition({ ...base, status: "confirmed", action: "noShow", actor: "owner", now: h(-1) })).toEqual({ ok: true, to: "no_show" });
  });

  it("disputes: windows, who may open, admin resolution", () => {
    const done = new Date("2026-11-03T12:00:00Z");
    const later = (d: number) => new Date(done.getTime() + d * 86_400_000);
    const d = { ...base, statusSince: done };
    expect(transition({ ...d, status: "completed", action: "openDispute", actor: "customer", reason: "Work not done", now: later(3) })).toEqual({ ok: true, to: "disputed" });
    expect(transition({ ...d, status: "completed", action: "openDispute", actor: "customer", reason: "Work not done", now: later(8) })).toEqual({ ok: false, error: "windowClosed" });
    expect(transition({ ...d, status: "completed", action: "openDispute", actor: "owner", reason: "xxx", now: later(1) })).toEqual({ ok: false, error: "forbidden" });
    expect(transition({ ...d, status: "cancelled_customer", action: "openDispute", actor: "customer", reason: "xxx", now: later(1) })).toEqual({ ok: false, error: "forbidden" });
    expect(transition({ ...d, status: "cancelled_customer", lateCancel: true, action: "openDispute", actor: "owner", reason: "Late cancel", now: later(1) })).toEqual({ ok: true, to: "disputed" });
    expect(transition({ ...d, status: "disputed", action: "resolve", actor: "admin", reason: "Checked", outcome: "no_show" })).toEqual({ ok: true, to: "no_show" });
    expect(transition({ ...d, status: "disputed", action: "resolve", actor: "admin", reason: "Checked", outcome: "confirmed" })).toEqual({ ok: false, error: "invalidOutcome" });
    expect(transition({ ...d, status: "disputed", action: "resolve", actor: "owner", reason: "x", outcome: "completed" })).toEqual({ ok: false, error: "forbidden" });
  });

  it("only the system expires unanswered requests", () => {
    expect(transition({ ...base, status: "pending_provider", action: "expire", actor: "system" })).toEqual({ ok: true, to: "expired" });
    expect(transition({ ...base, status: "confirmed", action: "expire", actor: "system" })).toEqual({ ok: false, error: "invalidTransition" });
    expect(transition({ ...base, status: "pending_provider", action: "expire", actor: "admin" })).toEqual({ ok: false, error: "forbidden" });
  });

  it("availableActions mirrors the rules", () => {
    expect(availableActions({ ...base, status: "pending_provider", actor: "customer" })).toEqual(["cancel"]);
    expect(availableActions({ ...base, status: "pending_provider", actor: "technician" })).toEqual([]);
    expect(availableActions({ ...base, status: "pending_provider", actor: "owner" }).sort()).toEqual(["accept", "ask", "decline", "propose"]);
  });

  it("capacity holding by status and mode", () => {
    expect(holdsCapacity("pending_provider", "slots")).toBe(true);
    expect(holdsCapacity("pending_provider", "manual")).toBe(false);
    expect(holdsCapacity("confirmed", "manual")).toBe(true);
    expect(holdsCapacity("cancelled_customer", "slots")).toBe(false);
  });
});

describe("Cairo time and slots", () => {
  it("converts wall-clock time across DST", () => {
    expect(cairoToUtc("2026-11-03", "10:00").toISOString()).toBe("2026-11-03T08:00:00.000Z");
    expect(cairoToUtc("2026-07-15", "10:00").toISOString()).toBe("2026-07-15T07:00:00.000Z");
    expect(cairoDate(new Date("2026-11-03T22:30:00Z"))).toEqual({ date: "2026-11-04", weekday: 3, minutes: 30 });
  });

  const cfg: ScheduleConfig = {
    hours: [{ weekday: 2, opens: "09:00", closes: "13:00" }], // Tuesday
    closures: [],
    slotIntervalMin: 60,
    capacity: 1,
    minNoticeHours: 2,
    maxAdvanceDays: 30,
  };
  const now = new Date("2026-11-01T08:00:00Z");

  it("lists slots that fit the hours", () => {
    expect(daySlots(cfg, "2026-11-03", 60, [], now).map((s) => s.label)).toEqual(["09:00", "10:00", "11:00", "12:00"]);
    expect(daySlots(cfg, "2026-11-03", 120, [], now).map((s) => s.label)).toEqual(["09:00", "10:00", "11:00"]);
    expect(daySlots(cfg, "2026-11-04", 60, [], now)).toEqual([]); // closed Wednesday
  });

  it("removes full slots and blackout periods", () => {
    const busy = [{ start: cairoToUtc("2026-11-03", "10:00"), end: cairoToUtc("2026-11-03", "11:00") }];
    expect(daySlots(cfg, "2026-11-03", 60, busy, now).map((s) => s.label)).toEqual(["09:00", "11:00", "12:00"]);
    expect(daySlots({ ...cfg, capacity: 2 }, "2026-11-03", 60, busy, now).map((s) => s.label)).toHaveLength(4);
    const closed = { ...cfg, closures: [{ start: cairoToUtc("2026-11-03", "11:30"), end: cairoToUtc("2026-11-03", "18:00") }] };
    expect(daySlots(closed, "2026-11-03", 60, [], now).map((s) => s.label)).toEqual(["09:00", "10:00"]);
  });

  it("enforces notice and advance window", () => {
    expect(withinSchedule(cfg, cairoToUtc("2026-11-03", "09:00"), 60, new Date("2026-11-03T06:30:00Z"))).toBe(false);
    expect(withinSchedule(cfg, cairoToUtc("2026-12-29", "09:00"), 60, now)).toBe(false);
  });

  it("counts overlapping load for capacity", () => {
    const t = (a: string, b: string) => ({ start: cairoToUtc("2026-11-03", a), end: cairoToUtc("2026-11-03", b) });
    const busy = [t("09:00", "10:00"), t("09:30", "10:30")];
    expect(hasCapacity({ capacity: 2 }, busy, t("09:45", "10:15"))).toBe(false);
    expect(hasCapacity({ capacity: 2 }, busy, t("10:00", "11:00"))).toBe(true);
    expect(hasCapacity({ capacity: 3 }, busy, t("09:00", "11:00"))).toBe(true);
  });
});

describe("commission", () => {
  const ag = (o: Partial<Agreement>): Agreement => ({
    id: "a",
    status: "active",
    basis: "percent",
    percentBps: 1000,
    fixedEgp: null,
    categories: null,
    effectiveFrom: new Date("2026-10-01"),
    effectiveTo: null,
    ...o,
  });
  const done = new Date("2026-11-05");

  it("percent and fixed, capped at the amount", () => {
    expect(commissionAmount(ag({}), 1500)).toBe(150);
    expect(commissionAmount(ag({ basis: "fixed", percentBps: null, fixedEgp: 200 }), 150)).toBe(150);
    expect(commissionAmount(ag({ percentBps: 1250 }), 999)).toBe(125);
  });

  it("chooses the agreement active at completion, most specific first", () => {
    const all = ag({ id: "all" });
    const oil = ag({ id: "oil", categories: ["oil_change"], percentBps: 500 });
    const old = ag({ id: "old", status: "ended", effectiveFrom: new Date("2026-01-01"), effectiveTo: new Date("2026-10-01") });
    const draft = ag({ id: "draft", status: "draft", effectiveFrom: new Date("2026-11-01") });
    expect(agreementFor([all, oil, old, draft], "oil_change", done)?.id).toBe("oil");
    expect(agreementFor([all, oil, old, draft], "brakes", done)?.id).toBe("all");
    expect(agreementFor([old], "brakes", new Date("2026-05-01"))?.id).toBe("old");
    expect(agreementFor([draft], "brakes", done)).toBeNull();
  });

  it("never records commission for bookings that weren't completed", () => {
    const b = { category: "brakes", completedAt: done, serviceCompleted: true, finalAmountEgp: 1000 };
    expect(ledgerEntryFor({ ...b, status: "completed" }, [ag({})])?.commissionEgp).toBe(100);
    for (const status of ["cancelled_customer", "cancelled_provider", "no_show", "declined", "expired", "confirmed"] as const) {
      expect(ledgerEntryFor({ ...b, status }, [ag({})])).toBeNull();
    }
    expect(ledgerEntryFor({ ...b, status: "completed", finalAmountEgp: null }, [ag({})])).toBeNull();
    expect(ledgerEntryFor({ ...b, status: "completed", serviceCompleted: false }, [ag({})])).toBeNull();
    expect(ledgerEntryFor({ ...b, status: "completed" }, [])).toBeNull();
  });

  it("ledger status moves", () => {
    expect(canMoveLedger("pending_verification", "confirmed")).toBe(true);
    expect(canMoveLedger("pending_verification", "settled")).toBe(false);
    expect(canMoveLedger("payable", "settled")).toBe(true);
    expect(canMoveLedger("settled", "waived")).toBe(false);
  });

  it("references are well-formed", () => {
    expect(newReference()).toMatch(/^MC-[A-Z0-9]{7}$/);
  });
});
