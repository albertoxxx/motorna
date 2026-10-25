"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Star } from "lucide-react";
import {
  bookingTimes,
  confirmCompletion,
  customerBookingAction,
  openBookingDispute,
  providerBookingAction,
  submitReview,
} from "@/server/actions/bookings";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatAppointment, formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { BookingStatus } from "@/lib/booking";

type D = Pick<Dictionary, "booking" | "errors" | "validation" | "common">;
type Res = { ok: boolean; error?: keyof Dictionary["errors"] };

function useRun(dict: D) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<Res>, success: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast(dict.errors[r.error ?? "generic"], "error");
        return;
      }
      toast(success);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

type TimeValue = { date: string; time: string; start?: string };

/**
 * Picks 1–max times. With `lookup` it lists the center's available times for the date (customers);
 * otherwise it's a free date + time entry (providers proposing, within their own hours).
 */
function TimePicker({ locale, dict, centerId, serviceId, dates, max, onChange, lookup }: { locale: Locale; dict: D; centerId: string; serviceId: string | null; dates: string[]; max: number; onChange: (v: TimeValue[]) => void; lookup: boolean }) {
  const W = dict.booking.wizard;
  const [date, setDate] = useState(dates[0] ?? "");
  const [slots, setSlots] = useState<{ start: string; label: string }[] | null>(null);
  const [picked, setPicked] = useState<TimeValue[]>([]);
  const [free, setFree] = useState({ date: dates[0] ?? "", time: "10:00" });
  const [loading, start] = useTransition();
  useEffect(() => {
    if (!lookup || !serviceId || !date) return;
    start(async () => {
      const r = await bookingTimes(centerId, serviceId, date);
      setSlots(r.ok ? r.data : []);
    });
  }, [lookup, centerId, serviceId, date]);
  const set = (v: TimeValue[]) => {
    setPicked(v);
    onChange(v);
  };
  const label = (iso: string) => formatDate(iso, locale, { hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" });
  const day = (d: string) => formatDate(`${d}T12:00:00Z`, locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo" });
  return (
    <div className="flex flex-col gap-3">
      {lookup ? (
        <>
          <Field label={W.date} htmlFor="tp-date">
            <Select id="tp-date" value={date} onChange={(e) => { setDate(e.target.value); setSlots(null); }}>
              {dates.map((d) => <option key={d} value={d}>{day(d)}</option>)}
            </Select>
          </Field>
          {loading || slots === null ? (
            <p className="text-sm text-ink-3">{W.loadingSlots}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-ink-3">{W.noSlots}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 xs:grid-cols-4 sm:grid-cols-6">
              {slots.map((s) => {
                const on = picked.some((p) => p.start === s.start);
                return (
                  <button key={s.start} type="button" aria-pressed={on} disabled={!on && max > 1 && picked.length >= max}
                    onClick={() => set(on ? picked.filter((p) => p.start !== s.start) : max === 1 ? [{ date, time: s.label, start: s.start }] : [...picked, { date, time: s.label, start: s.start }])}
                    className={cn("h-10 rounded-[var(--radius-sm)] border text-sm tabular", on ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-line-strong hover:border-brand-600 disabled:opacity-40")}>
                    <bdi>{label(s.start)}</bdi>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={W.date} htmlFor="tp-fd"><Input id="tp-fd" type="date" value={free.date} min={dates[0]} onChange={(e) => setFree({ ...free, date: e.target.value })} /></Field>
          <Field label={W.time} htmlFor="tp-ft"><Input id="tp-ft" type="time" step={900} value={free.time} onChange={(e) => setFree({ ...free, time: e.target.value })} /></Field>
          <Button type="button" variant="secondary" disabled={!free.date || !free.time || picked.length >= max} onClick={() => set([...picked.filter((p) => !(p.date === free.date && p.time === free.time)), { ...free }])}>{W.addTime}</Button>
        </div>
      )}
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {picked.map((p) => (
            <li key={`${p.date}${p.time}`} className="inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1">
              <bdi>{day(p.date)} · {p.start ? label(p.start) : p.time}</bdi>
              <button type="button" className="text-ink-3 hover:text-danger-700" onClick={() => set(picked.filter((x) => x !== p))} aria-label={W.removeTime}>×</button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-3">{W.timesLocal}</p>
    </div>
  );
}

type CustomerProps = {
  locale: Locale;
  dict: D;
  booking: {
    id: string;
    status: BookingStatus;
    mode: "slots" | "manual";
    centerId: string;
    serviceId: string | null;
    startsAt: string | null;
    cancelCutoffHours: number;
    completedAt: string | null;
    statusSince: string;
  };
  proposed: { id: string; startsAt: string }[];
  dates: string[];
  completion: { serviceCompleted: boolean; customerConfirmedAt: string | null } | null;
  hasReview: boolean;
  openDispute: boolean;
  disputeWindowDays: number | null;
  confirmDeadline: string | null;
};

export function CustomerBookingActions(p: CustomerProps) {
  const { dict, locale, booking: b } = p;
  const T = dict.booking;
  const A = T.actions;
  const { pending, run } = useRun(dict);
  const [panel, setPanel] = useState<null | "cancel" | "reschedule" | "decline" | "report" | "support">(null);
  const [times, setTimes] = useState<TimeValue[]>([]);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<keyof typeof T.disputeKinds>("completion_disagreement");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sure, setSure] = useState(false);
  const max = b.mode === "slots" ? 1 : 3;
  const [now] = useState(() => Date.now());
  const hoursLeft = b.startsAt ? (new Date(b.startsAt).getTime() - now) / 3_600_000 : Infinity;
  const late = b.status === "confirmed" && hoursLeft < b.cancelCutoffHours;
  const cancellable = ["pending_provider", "alternative_proposed", "awaiting_customer", "confirmed"].includes(b.status);
  const withinWindow = p.disputeWindowDays != null && now - new Date(b.statusSince).getTime() <= p.disputeWindowDays * 86_400_000;
  const canReport = !p.openDispute && withinWindow && ["completed", "no_show", "cancelled_provider"].includes(b.status);
  const toggle = (k: typeof panel) => {
    setPanel(panel === k ? null : k);
    setTimes([]);
    setText("");
    setSure(false);
  };
  const reportKinds = (b.status === "no_show" ? ["no_show_dispute", "other"] : b.status === "cancelled_provider" ? ["service_unavailable", "conduct", "other"] : ["completion_disagreement", "price_disagreement", "conduct", "other"]) as (keyof typeof T.disputeKinds)[];

  return (
    <div className="flex flex-col gap-4">
      {b.status === "alternative_proposed" && p.proposed.length > 0 && (
        <div className="flex flex-col gap-2">
          {p.proposed.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-warning-600/30 bg-warning-50 p-3">
              <span className="font-medium"><bdi>{formatAppointment(o.startsAt, locale)}</bdi></span>
              <Button size="sm" loading={pending} onClick={() => run(() => customerBookingAction(b.id, { action: "acceptAlternative", optionId: o.id }), A.acceptedAlt)}>{A.acceptAlt}</Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" className="self-start" onClick={() => toggle("decline")}>{A.declineAlt}</Button>
          {panel === "decline" && (
            <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-line p-4">
              <TimePicker locale={locale} dict={dict} centerId={b.centerId} serviceId={b.serviceId} dates={p.dates} max={max} onChange={setTimes} lookup />
              <Textarea aria-label={A.replyPlaceholder} placeholder={A.replyPlaceholder} rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
              <Button size="sm" className="self-start" disabled={!times.length} loading={pending}
                onClick={() => run(() => customerBookingAction(b.id, { action: "declineAlternative", times: times.map(({ date, time }) => ({ date, time })), message: text || undefined }), A.sent, () => setPanel(null))}>{A.send}</Button>
            </div>
          )}
        </div>
      )}

      {b.status === "awaiting_customer" && (
        <div className="flex flex-col gap-2">
          <Textarea aria-label={A.replyPlaceholder} placeholder={A.replyPlaceholder} rows={3} maxLength={1000} dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" className="self-start" disabled={!text.trim()} loading={pending} onClick={() => run(() => customerBookingAction(b.id, { action: "reply", message: text }), A.sent, () => setText(""))}>{A.reply}</Button>
        </div>
      )}

      {b.status === "completed" && p.completion?.serviceCompleted && (
        <div className="flex flex-col gap-3">
          {p.completion.customerConfirmedAt ? (
            <p className="flex items-center gap-2 text-sm text-success-700"><Check className="size-4" aria-hidden />{A.customerConfirmed.replace("{date}", formatDate(p.completion.customerConfirmedAt, locale))}</p>
          ) : (
            withinWindow && (
              <div className="flex flex-col gap-2">
                {p.confirmDeadline && <p className="text-sm text-ink-2">{A.confirmWindow.replace("{date}", formatDate(p.confirmDeadline, locale, { dateStyle: "long" }))}</p>}
                <Button size="sm" className="self-start" loading={pending} onClick={() => run(() => confirmCompletion(b.id), A.confirmedDone)}>{A.confirmDone}</Button>
              </div>
            )
          )}
          {!p.hasReview && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-line p-4">
              <p className="text-sm font-semibold">{A.review}</p>
              <div role="radiogroup" aria-label={A.rating} className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}/5`} onClick={() => setRating(n)} className="p-1">
                    <Star className={cn("size-6", n <= rating ? "fill-warning-600 text-warning-600" : "text-ink-3")} aria-hidden />
                  </button>
                ))}
              </div>
              <Textarea aria-label={A.comment} placeholder={A.comment} rows={2} maxLength={1000} dir="auto" value={comment} onChange={(e) => setComment(e.target.value)} />
              <Button size="sm" className="self-start" disabled={!rating} loading={pending} onClick={() => run(() => submitReview(b.id, { rating, comment: comment || undefined }), A.reviewed)}>{A.send}</Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {b.status === "confirmed" && !late && <Button variant="secondary" size="sm" onClick={() => toggle("reschedule")}>{A.reschedule}</Button>}
        {cancellable && <Button variant="danger" size="sm" onClick={() => toggle("cancel")}>{A.cancel}</Button>}
        {canReport && <Button variant="secondary" size="sm" onClick={() => { toggle("report"); setKind(reportKinds[0]); }}>{A.report}</Button>}
        <Button variant="ghost" size="sm" onClick={() => toggle("support")}>{A.support}</Button>
      </div>

      {panel === "reschedule" && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-line p-4">
          <p className="text-sm text-ink-2">{A.rescheduleHelp}</p>
          <TimePicker locale={locale} dict={dict} centerId={b.centerId} serviceId={b.serviceId} dates={p.dates} max={max} onChange={setTimes} lookup />
          <Button size="sm" className="self-start" disabled={!times.length} loading={pending}
            onClick={() => run(() => customerBookingAction(b.id, { action: "reschedule", times: times.map(({ date, time }) => ({ date, time })) }), A.rescheduled, () => setPanel(null))}>{A.send}</Button>
        </div>
      )}
      {panel === "cancel" && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-danger-600/30 p-4">
          {late ? <Notice tone="warning"><p>{A.cancelLateWarning.replace("{h}", String(b.cancelCutoffHours))}</p></Notice> : <p className="text-sm">{A.cancelConfirm}</p>}
          <Field label={A.cancelReason} htmlFor="cx-reason"><Input id="cx-reason" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <Checkbox label={A.cancelConfirm} checked={sure} onChange={(e) => setSure(e.target.checked)} />
          <Button variant="danger" size="sm" className="self-start" disabled={!sure} loading={pending} onClick={() => run(() => customerBookingAction(b.id, { action: "cancel", reason: text || undefined }), A.cancelled, () => setPanel(null))}>{A.cancel}</Button>
        </div>
      )}
      {(panel === "report" || panel === "support") && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-line p-4">
          {panel === "report" && (
            <Field label={A.reportKind} htmlFor="rp-kind">
              <Select id="rp-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                {reportKinds.map((k) => <option key={k} value={k}>{T.disputeKinds[k]}</option>)}
              </Select>
            </Field>
          )}
          <Field label={A.reportDesc} htmlFor="rp-desc"><Textarea id="rp-desc" rows={3} maxLength={2000} dir="auto" value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <p className="text-xs text-ink-3">{T.disputeNote}</p>
          <Button size="sm" className="self-start" disabled={text.trim().length < 5} loading={pending}
            onClick={() => run(() => openBookingDispute(b.id, { kind: panel === "support" ? "support" : kind, description: text }), A.reported, () => setPanel(null))}>{A.send}</Button>
        </div>
      )}
    </div>
  );
}

type ProviderProps = {
  locale: Locale;
  dict: D;
  role: "owner" | "manager" | "technician";
  booking: { id: string; status: BookingStatus; startsAt: string | null; lateCancel: boolean; statusSince: string };
  requested: { id: string; startsAt: string }[];
  dates: string[];
  openDispute: boolean;
};

export function ProviderBookingActions(p: ProviderProps) {
  const { dict, locale, booking: b, role } = p;
  const P = dict.booking.provider;
  const A = dict.booking.actions;
  const { pending, run } = useRun(dict);
  const [panel, setPanel] = useState<null | "propose" | "ask" | "decline" | "cancel" | "complete" | "dispute">(null);
  const [times, setTimes] = useState<TimeValue[]>([]);
  const [text, setText] = useState("");
  const [c, setC] = useState({ done: true, amount: "", summary: "", km: "" });
  const manage = role === "owner" || role === "manager";
  const [now] = useState(() => Date.now());
  const start = b.startsAt ? new Date(b.startsAt).getTime() : null;
  const canCheckIn = b.status === "confirmed" && start != null && start - now <= 2 * 3_600_000;
  const canNoShow = b.status === "confirmed" && start != null && now >= start + 30 * 60_000;
  const canDisputeLate = manage && !p.openDispute && b.status === "cancelled_customer" && b.lateCancel && now - new Date(b.statusSince).getTime() <= 7 * 86_400_000;
  const toggle = (k: typeof panel) => {
    setPanel(panel === k ? null : k);
    setTimes([]);
    setText("");
  };

  return (
    <div className="flex flex-col gap-4">
      {b.status === "pending_provider" && manage && p.requested.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{P.requested}</p>
          {p.requested.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line p-3">
              <span className="font-medium"><bdi>{formatAppointment(o.startsAt, locale)}</bdi></span>
              <Button size="sm" loading={pending} onClick={() => run(() => providerBookingAction(b.id, { action: "accept", optionId: o.id }), P.accepted)}>{P.accept}</Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {manage && (b.status === "pending_provider" || b.status === "awaiting_customer") && <Button variant="secondary" size="sm" onClick={() => toggle("propose")}>{P.propose}</Button>}
        {manage && b.status === "pending_provider" && <Button variant="secondary" size="sm" onClick={() => toggle("ask")}>{P.ask}</Button>}
        {manage && (b.status === "pending_provider" || b.status === "awaiting_customer") && <Button variant="danger" size="sm" onClick={() => toggle("decline")}>{P.decline}</Button>}
        {canCheckIn && <Button size="sm" loading={pending} onClick={() => run(() => providerBookingAction(b.id, { action: "checkIn" }), P.checkedIn)}>{P.checkIn}</Button>}
        {b.status === "checked_in" && <Button size="sm" onClick={() => toggle("complete")}>{P.complete}</Button>}
        {canNoShow && <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => providerBookingAction(b.id, { action: "noShow" }), P.noShowDone)}>{P.noShow}</Button>}
        {manage && (b.status === "confirmed" || b.status === "checked_in") && <Button variant="danger" size="sm" onClick={() => toggle("cancel")}>{P.providerCancel}</Button>}
        {canDisputeLate && <Button variant="secondary" size="sm" onClick={() => toggle("dispute")}>{P.disputeLate}</Button>}
      </div>
      {b.status === "confirmed" && !canNoShow && start != null && now > start && <p className="text-xs text-ink-3">{P.noShowConfirm}</p>}

      {panel === "propose" && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-line p-4">
          <p className="text-sm text-ink-2">{P.proposeHelp}</p>
          <TimePicker locale={locale} dict={dict} centerId="" serviceId={null} dates={p.dates} max={3} onChange={setTimes} lookup={false} />
          <Textarea aria-label={A.replyPlaceholder} rows={2} maxLength={1000} dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" className="self-start" disabled={!times.length} loading={pending}
            onClick={() => run(() => providerBookingAction(b.id, { action: "propose", times: times.map(({ date, time }) => ({ date, time })), message: text || undefined }), P.proposed, () => setPanel(null))}>{A.send}</Button>
        </div>
      )}
      {panel === "ask" && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-line p-4">
          <Textarea aria-label={P.ask} placeholder={P.askPlaceholder} rows={3} maxLength={1000} dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" className="self-start" disabled={!text.trim()} loading={pending} onClick={() => run(() => providerBookingAction(b.id, { action: "ask", message: text }), A.sent, () => setPanel(null))}>{A.send}</Button>
        </div>
      )}
      {(panel === "decline" || panel === "cancel" || panel === "dispute") && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-danger-600/30 p-4">
          <Field label={panel === "decline" ? P.declineReason : panel === "cancel" ? P.providerCancelReason : A.reportDesc} htmlFor="pv-reason">
            <Textarea id="pv-reason" rows={2} maxLength={500} dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Button variant="danger" size="sm" className="self-start" disabled={text.trim().length < (panel === "dispute" ? 5 : 3)} loading={pending}
            onClick={() =>
              run(
                () => (panel === "dispute" ? openBookingDispute(b.id, { kind: "late_cancellation", description: text }) : providerBookingAction(b.id, panel === "decline" ? { action: "decline", reason: text } : { action: "providerCancel", reason: text })),
                panel === "decline" ? P.declined : A.sent,
                () => setPanel(null),
              )
            }>{A.send}</Button>
        </div>
      )}
      {panel === "complete" && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-line p-4">
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="done" checked={c.done} onChange={() => setC({ ...c, done: true })} className="size-4 accent-brand-600" />{P.serviceCompleted}</label>
            {manage && <label className="flex items-center gap-2"><input type="radio" name="done" checked={!c.done} onChange={() => setC({ ...c, done: false })} className="size-4 accent-brand-600" />{P.serviceNotCompleted}</label>}
          </div>
          {c.done && (
            <Field label={P.finalAmount} htmlFor="pv-amt" hint={P.finalAmountHelp} required requiredLabel={dict.common.required}>
              <Input id="pv-amt" inputMode="numeric" className="tabular" value={c.amount} onChange={(e) => setC({ ...c, amount: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
            </Field>
          )}
          <Field label={P.workSummary} htmlFor="pv-sum"><Textarea id="pv-sum" rows={2} maxLength={2000} dir="auto" value={c.summary} onChange={(e) => setC({ ...c, summary: e.target.value })} /></Field>
          {c.done && <Field label={P.mileage} htmlFor="pv-km"><Input id="pv-km" inputMode="numeric" className="tabular" value={c.km} onChange={(e) => setC({ ...c, km: e.target.value.replace(/\D/g, "").slice(0, 7) })} /></Field>}
          <p className="text-xs text-ink-3">{P.commissionNote}</p>
          <Button size="sm" className="self-start" disabled={c.done ? !c.amount : c.summary.trim().length < 3} loading={pending}
            onClick={() =>
              run(
                () => providerBookingAction(b.id, { action: "complete", completion: { serviceCompleted: c.done, finalAmountEgp: c.amount ? Number(c.amount) : undefined, workSummary: c.summary || undefined, mileageKm: c.km ? Number(c.km) : undefined } }),
                P.completed,
                () => setPanel(null),
              )
            }>{A.send}</Button>
        </div>
      )}
    </div>
  );
}
