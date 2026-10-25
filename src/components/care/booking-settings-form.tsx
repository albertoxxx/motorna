"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addClosure, removeClosure, saveBookingSettings } from "@/server/actions/bookings";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatAppointment } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";

type D = Pick<Dictionary, "booking" | "errors" | "common" | "validation">;
type S = { accepting: boolean; mode: "slots" | "manual"; slotIntervalMin: number; capacity: number; minNoticeHours: number; maxAdvanceDays: number; cancelCutoffHours: number; policyAr: string; policyEn: string };

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

export function BookingSettingsForm({ dict, centerId, initial, pilotEnabled, editable }: { dict: D; centerId: string; initial: S; pilotEnabled: boolean; editable: boolean }) {
  const S = dict.booking.schedule;
  const [v, setV] = useState(initial);
  const { pending, run } = useRun(dict);
  const num = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Number(e.target.value.replace(/\D/g, "") || 0) });
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => saveBookingSettings(centerId, v), S.saved); }}>
      <Checkbox className="sm:col-span-2" label={S.accepting} checked={v.accepting} disabled={!pilotEnabled || !editable} onChange={(e) => setV({ ...v, accepting: e.target.checked })} />
      <Field label={S.mode} htmlFor="bs-mode" className="sm:col-span-2">
        <Select id="bs-mode" value={v.mode} disabled={!editable} onChange={(e) => setV({ ...v, mode: e.target.value as S["mode"] })}>
          <option value="manual">{S.modeManual}</option>
          <option value="slots">{S.modeSlots}</option>
        </Select>
      </Field>
      <Field label={S.interval} htmlFor="bs-int">
        <Select id="bs-int" value={v.slotIntervalMin} disabled={!editable} onChange={(e) => setV({ ...v, slotIntervalMin: Number(e.target.value) })}>
          {[15, 30, 60].map((n) => <option key={n} value={n}>{S.minutes.replace("{n}", String(n))}</option>)}
        </Select>
      </Field>
      <Field label={S.capacity} htmlFor="bs-cap" hint={S.capacityHelp}><Input id="bs-cap" inputMode="numeric" className="tabular" value={v.capacity} disabled={!editable} onChange={num("capacity")} /></Field>
      <Field label={S.notice} htmlFor="bs-notice"><Input id="bs-notice" inputMode="numeric" className="tabular" value={v.minNoticeHours} disabled={!editable} onChange={num("minNoticeHours")} /></Field>
      <Field label={S.advance} htmlFor="bs-adv"><Input id="bs-adv" inputMode="numeric" className="tabular" value={v.maxAdvanceDays} disabled={!editable} onChange={num("maxAdvanceDays")} /></Field>
      <Field label={S.cutoff} htmlFor="bs-cut"><Input id="bs-cut" inputMode="numeric" className="tabular" value={v.cancelCutoffHours} disabled={!editable} onChange={num("cancelCutoffHours")} /></Field>
      <Field label={S.policyAr} htmlFor="bs-par" hint={S.policyHelp} className="sm:col-span-2"><Textarea id="bs-par" dir="rtl" rows={2} maxLength={1000} value={v.policyAr} disabled={!editable} onChange={(e) => setV({ ...v, policyAr: e.target.value })} /></Field>
      <Field label={S.policyEn} htmlFor="bs-pen" className="sm:col-span-2"><Textarea id="bs-pen" dir="ltr" rows={2} maxLength={1000} value={v.policyEn} disabled={!editable} onChange={(e) => setV({ ...v, policyEn: e.target.value })} /></Field>
      {editable && <div className="sm:col-span-2"><Button type="submit" loading={pending}>{S.save}</Button></div>}
    </form>
  );
}

export function ClosuresEditor({ locale, dict, centerId, closures, editable }: { locale: Locale; dict: D; centerId: string; closures: { id: string; startsAt: string; endsAt: string; reason: string | null }[]; editable: boolean }) {
  const S = dict.booking.schedule;
  const [f, setF] = useState({ startDate: "", startTime: "00:00", endDate: "", endTime: "23:59", reason: "" });
  const { pending, run } = useRun(dict);
  return (
    <div className="flex flex-col gap-3">
      {closures.length === 0 ? <p className="text-sm text-ink-3">{S.closuresEmpty}</p> : (
        <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line">
          {closures.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span><bdi>{formatAppointment(c.startsAt, locale)}</bdi> → <bdi>{formatAppointment(c.endsAt, locale)}</bdi>{c.reason && <span className="text-ink-3"> · <bdi>{c.reason}</bdi></span>}</span>
              {editable && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeClosure(centerId, c.id), S.saved)}>{S.remove}</Button>}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addClosure(centerId, f), S.saved, () => setF({ ...f, startDate: "", endDate: "", reason: "" })); }}>
          <Field label={S.from} htmlFor="cl-sd"><Input id="cl-sd" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value })} /></Field>
          <Field label="" htmlFor="cl-st"><Input id="cl-st" type="time" aria-label={S.from} value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></Field>
          <Field label={S.to} htmlFor="cl-ed"><Input id="cl-ed" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
          <Field label="" htmlFor="cl-et"><Input id="cl-et" type="time" aria-label={S.to} value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></Field>
          <Field label={S.reason} htmlFor="cl-r"><Input id="cl-r" maxLength={120} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          <Button type="submit" variant="secondary" loading={pending} disabled={!f.startDate || !f.endDate}>{S.addClosure}</Button>
        </form>
      )}
    </div>
  );
}
