"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  activateAgreement,
  adjustLedger,
  createAgreement,
  createSettlement,
  deleteDraftAgreement,
  endAgreement,
  markSettlementPaid,
  resolveDispute,
  setBookingPilot,
  setDisputeReviewing,
  setLedgerStatus,
  setReviewHidden,
  voidSettlement,
} from "@/server/actions/booking-admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { CARE_CATEGORIES } from "@/lib/care";
import { RESOLVE_OUTCOMES } from "@/lib/booking";
import type { Dictionary } from "@/i18n/dictionaries/ar";

type D = Pick<Dictionary, "booking" | "errors" | "common" | "care">;

function useRun(dict: D) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return {
    pending,
    run: (fn: () => Promise<{ ok: boolean; error?: keyof Dictionary["errors"] }>, msg: string, after?: () => void) =>
      start(async () => {
        const r = await fn();
        if (!r.ok) return toast(dict.errors[r.error ?? "generic"], "error");
        toast(msg);
        after?.();
        router.refresh();
      }),
  };
}

export function PilotSwitch({ dict, centerId, enabled, approved }: { dict: D; centerId: string; enabled: boolean; approved: boolean }) {
  const A = dict.booking.admin;
  const { pending, run } = useRun(dict);
  return enabled ? (
    <Button variant="danger" size="sm" loading={pending} onClick={() => run(() => setBookingPilot(centerId, false), A.pilotOffState)}>{A.pilotDisable}</Button>
  ) : (
    <Button size="sm" disabled={!approved} loading={pending} onClick={() => run(() => setBookingPilot(centerId, true), A.pilotEnable)}>{A.pilotEnable}</Button>
  );
}

export function DisputeResolver({ dict, disputeId, status, kind }: { dict: D; disputeId: string; status: "open" | "reviewing"; kind: string }) {
  const A = dict.booking.admin;
  const [decision, setDecision] = useState<string>(kind === "support" ? "dismiss" : "completed");
  const [note, setNote] = useState("");
  const { pending, run } = useRun(dict);
  return (
    <div className="flex flex-col gap-3">
      {status === "open" && <Button size="sm" variant="secondary" className="self-start" loading={pending} onClick={() => run(() => setDisputeReviewing(disputeId), A.markReviewing)}>{A.markReviewing}</Button>}
      {kind !== "support" && (
        <Field label={A.decision} htmlFor={`dc-${disputeId}`}>
          <Select id={`dc-${disputeId}`} value={decision} onChange={(e) => setDecision(e.target.value)}>
            {RESOLVE_OUTCOMES.map((o) => <option key={o} value={o}>{A.outcome.replace("{status}", dict.booking.status[o])}</option>)}
            <option value="dismiss">{A.dismiss}</option>
          </Select>
        </Field>
      )}
      <Field label={A.note} htmlFor={`dn-${disputeId}`}><Textarea id={`dn-${disputeId}`} rows={2} maxLength={1000} dir="auto" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Button size="sm" className="self-start" disabled={note.trim().length < 3} loading={pending} onClick={() => run(() => resolveDispute(disputeId, { decision: kind === "support" ? "dismiss" : decision, note }), A.resolved)}>{A.resolve}</Button>
    </div>
  );
}

export function ReviewToggle({ dict, reviewId, hidden }: { dict: D; reviewId: string; hidden: boolean }) {
  const A = dict.booking.admin;
  const [reason, setReason] = useState("");
  const { pending, run } = useRun(dict);
  if (hidden) return <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => setReviewHidden(reviewId, false), A.unhide)}>{A.unhide}</Button>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={A.hideReason} htmlFor={`hr-${reviewId}`}><Input id={`hr-${reviewId}`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
      <Button size="sm" variant="danger" disabled={reason.trim().length < 3} loading={pending} onClick={() => run(() => setReviewHidden(reviewId, true, reason), A.hidden)}>{A.hide}</Button>
    </div>
  );
}

export function AgreementForm({ dict, centerId }: { dict: D; centerId: string }) {
  const C = dict.booking.commission;
  const [f, setF] = useState({ basis: "percent" as "percent" | "fixed", percent: "10", fixedEgp: "", categories: [] as string[], effectiveFrom: "", settlementSchedule: "monthly" as "monthly" | "biweekly", exceptions: "", contractReference: "" });
  const { pending, run } = useRun(dict);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            createAgreement(centerId, {
              basis: f.basis,
              percent: f.basis === "percent" ? Number(f.percent) : undefined,
              fixedEgp: f.basis === "fixed" ? Number(f.fixedEgp) : undefined,
              categories: f.categories,
              effectiveFrom: f.effectiveFrom,
              settlementSchedule: f.settlementSchedule,
              exceptions: f.exceptions || undefined,
              contractReference: f.contractReference || undefined,
            }),
          C.created,
        );
      }}
    >
      <Field label={C.basis} htmlFor="ag-basis">
        <Select id="ag-basis" value={f.basis} onChange={(e) => setF({ ...f, basis: e.target.value as typeof f.basis })}>
          <option value="percent">{C.percent}</option>
          <option value="fixed">{C.fixed}</option>
        </Select>
      </Field>
      {f.basis === "percent" ? (
        <Field label={C.percentValue} htmlFor="ag-pct"><Input id="ag-pct" inputMode="decimal" className="tabular" value={f.percent} onChange={(e) => setF({ ...f, percent: e.target.value })} /></Field>
      ) : (
        <Field label={C.fixedValue} htmlFor="ag-fix"><Input id="ag-fix" inputMode="numeric" className="tabular" value={f.fixedEgp} onChange={(e) => setF({ ...f, fixedEgp: e.target.value.replace(/\D/g, "") })} /></Field>
      )}
      <Field label={C.effectiveFrom} htmlFor="ag-from"><Input id="ag-from" type="date" value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} /></Field>
      <Field label={C.schedule} htmlFor="ag-sch">
        <Select id="ag-sch" value={f.settlementSchedule} onChange={(e) => setF({ ...f, settlementSchedule: e.target.value as typeof f.settlementSchedule })}>
          <option value="monthly">{C.monthly}</option>
          <option value="biweekly">{C.biweekly}</option>
        </Select>
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">{C.categories}</legend>
        <div className="flex flex-wrap gap-2">
          {CARE_CATEGORIES.map((c) => (
            <label key={c} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs">
              <input type="checkbox" className="accent-brand-600" checked={f.categories.includes(c)} onChange={(e) => setF({ ...f, categories: e.target.checked ? [...f.categories, c] : f.categories.filter((x) => x !== c) })} />
              {dict.care.enums.category[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={C.contractRef} htmlFor="ag-ref"><Input id="ag-ref" maxLength={120} value={f.contractReference} onChange={(e) => setF({ ...f, contractReference: e.target.value })} /></Field>
      <Field label={C.exceptions} htmlFor="ag-exc"><Input id="ag-exc" maxLength={1000} value={f.exceptions} onChange={(e) => setF({ ...f, exceptions: e.target.value })} /></Field>
      <div className="sm:col-span-2"><Button type="submit" size="sm" loading={pending} disabled={!f.effectiveFrom}>{C.create}</Button></div>
    </form>
  );
}

export function AgreementActions({ dict, id, status }: { dict: D; id: string; status: "draft" | "active" | "ended" }) {
  const C = dict.booking.commission;
  const [end, setEnd] = useState("");
  const { pending, run } = useRun(dict);
  if (status === "draft")
    return (
      <div className="flex gap-2">
        <Button size="sm" loading={pending} onClick={() => run(() => activateAgreement(id), C.activated)}>{C.activate}</Button>
        <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => deleteDraftAgreement(id), C.deleteDraft)}>{C.deleteDraft}</Button>
      </div>
    );
  if (status === "active")
    return (
      <div className="flex flex-wrap items-end gap-2">
        <Field label={C.effectiveTo} htmlFor={`ae-${id}`}><Input id={`ae-${id}`} type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        <Button size="sm" variant="danger" disabled={!end} loading={pending} onClick={() => run(() => endAgreement(id, end), C.ended)}>{C.end}</Button>
      </div>
    );
  return null;
}

export function LedgerActions({ dict, id, status, inSettlement }: { dict: D; id: string; status: string; inSettlement: boolean }) {
  const C = dict.booking.commission;
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const { pending, run } = useRun(dict);
  if (inSettlement || status === "settled" || status === "waived") return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>{C.adjust}</Button>
        {status === "pending_verification" && <Button size="sm" variant="ghost" disabled={reason.trim().length < 3} loading={pending} onClick={() => run(() => setLedgerStatus(id, "confirmed", reason), C.confirm)}>{C.confirm}</Button>}
        {status !== "disputed" && <Button size="sm" variant="ghost" disabled={reason.trim().length < 3} loading={pending} onClick={() => run(() => setLedgerStatus(id, "waived", reason), C.waive)}>{C.waive}</Button>}
      </div>
      <Input aria-label={C.reason} placeholder={C.reason} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="h-8 text-xs" />
      {open && (
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label={C.delta} placeholder={C.delta} inputMode="numeric" className="h-8 w-28 text-xs tabular" value={delta} onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ""))} />
          <Button size="sm" disabled={!delta || reason.trim().length < 3} loading={pending} onClick={() => run(() => adjustLedger(id, { deltaEgp: Number(delta), reason }), C.adjusted, () => { setOpen(false); setDelta(""); setReason(""); })}>{C.adjust}</Button>
        </div>
      )}
    </div>
  );
}

export function SettlementForm({ dict, centerId }: { dict: D; centerId: string }) {
  const C = dict.booking.commission;
  const [f, setF] = useState({ from: "", to: "" });
  const { pending, run } = useRun(dict);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => createSettlement(centerId, f), C.issued); }}>
      <Field label={C.periodFrom} htmlFor="st-from"><Input id="st-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
      <Field label={C.periodTo} htmlFor="st-to"><Input id="st-to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
      <Button type="submit" size="sm" loading={pending} disabled={!f.from || !f.to}>{C.issue}</Button>
    </form>
  );
}

export function SettlementActions({ dict, id }: { dict: D; id: string }) {
  const C = dict.booking.commission;
  const [note, setNote] = useState("");
  const { pending, run } = useRun(dict);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={C.paymentNote} htmlFor={`sp-${id}`}><Input id={`sp-${id}`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
      <Button size="sm" disabled={note.trim().length < 3} loading={pending} onClick={() => run(() => markSettlementPaid(id, note), C.paid)}>{C.markPaid}</Button>
      <Button size="sm" variant="ghost" disabled={note.trim().length < 3} loading={pending} onClick={() => run(() => voidSettlement(id, note), C.voided)}>{C.void}</Button>
    </div>
  );
}
