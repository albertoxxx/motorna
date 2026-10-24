import { describe, expect, it } from "vitest";
import { commissionFor, nextBookingStatus, type CommissionRule } from "@/lib/booking";

const at = new Date("2026-11-01T10:00:00Z");
const before = (h: number) => new Date(at.getTime() - h * 3_600_000);

describe("booking state machine (design, not yet wired)", () => {
  it("follows the inspection lifecycle", () => {
    const base = { kind: "inspection" as const, scheduledAt: at, now: before(48) };
    expect(nextBookingStatus({ ...base, status: "requested", action: "confirm", actor: "center" })).toEqual({ ok: true, to: "confirmed" });
    expect(nextBookingStatus({ ...base, status: "confirmed", action: "start", actor: "center" })).toEqual({ ok: true, to: "in_progress" });
    expect(nextBookingStatus({ ...base, status: "in_progress", action: "complete", actor: "center" })).toMatchObject({ ok: false });
    expect(nextBookingStatus({ ...base, status: "in_progress", action: "submitReport", actor: "center" })).toEqual({ ok: true, to: "report_ready" });
    expect(nextBookingStatus({ ...base, status: "report_ready", action: "complete", actor: "system" })).toEqual({ ok: true, to: "completed" });
  });
  it("maintenance completes without a report; only centers confirm", () => {
    const base = { kind: "maintenance" as const, scheduledAt: at, now: before(48) };
    expect(nextBookingStatus({ ...base, status: "in_progress", action: "complete", actor: "center" })).toEqual({ ok: true, to: "completed" });
    expect(nextBookingStatus({ ...base, status: "in_progress", action: "submitReport", actor: "center" })).toMatchObject({ ok: false });
    expect(nextBookingStatus({ ...base, status: "requested", action: "confirm", actor: "customer" })).toEqual({ ok: false, error: "forbidden" });
  });
  it("customers can cancel or reschedule only before the cutoff; no-show only after the slot", () => {
    const b = { kind: "maintenance" as const, status: "confirmed" as const, scheduledAt: at };
    expect(nextBookingStatus({ ...b, action: "cancel", actor: "customer", now: before(24) })).toEqual({ ok: true, to: "cancelled" });
    expect(nextBookingStatus({ ...b, action: "cancel", actor: "customer", now: before(2) })).toEqual({ ok: false, error: "tooLate" });
    expect(nextBookingStatus({ ...b, action: "reschedule", actor: "customer", now: before(24) })).toEqual({ ok: true, to: "requested" });
    expect(nextBookingStatus({ ...b, action: "markNoShow", actor: "center", now: before(1) })).toEqual({ ok: false, error: "tooEarly" });
    expect(nextBookingStatus({ ...b, action: "cancel", actor: "customer", status: "completed" as never, now: before(24) })).toEqual({ ok: false, error: "invalidTransition" });
  });
});

describe("commission (design, not yet wired)", () => {
  const rules: CommissionRule[] = [
    { id: "base", kind: "inspection", category: null, percentBps: 1000, fixedEgp: 0, activeFrom: new Date("2026-01-01"), activeTo: null },
    { id: "ppi", kind: "inspection", category: "pre_purchase_inspection", percentBps: 1500, fixedEgp: 10, activeFrom: new Date("2026-01-01"), activeTo: null },
  ];
  const booking = { status: "completed" as const, kind: "inspection" as const, category: "pre_purchase_inspection", finalPriceEgp: 1000, completedAt: at };
  it("accrues only for completed bookings with a final price, using the most specific rule", () => {
    expect(commissionFor(booking, rules)).toEqual({ ruleId: "ppi", amountEgp: 160 });
    expect(commissionFor({ ...booking, category: "diagnostics" }, rules)).toEqual({ ruleId: "base", amountEgp: 100 });
    expect(commissionFor({ ...booking, status: "cancelled" as never }, rules)).toBeNull();
    expect(commissionFor({ ...booking, finalPriceEgp: null }, rules)).toBeNull();
    expect(commissionFor({ ...booking, kind: "maintenance" }, rules)).toBeNull();
  });
});
