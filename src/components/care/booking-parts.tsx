import { Check, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAppointment, formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { BookingDictionary } from "@/i18n/dictionaries/booking-ar";
import type { BookingStatus } from "@/lib/booking";

export function bookingTone(s: BookingStatus): "success" | "warning" | "danger" | "brand" | "neutral" {
  if (s === "confirmed" || s === "checked_in" || s === "completed") return "success";
  if (s === "alternative_proposed" || s === "awaiting_customer" || s === "disputed") return "warning";
  if (s === "declined" || s === "cancelled_provider" || s === "no_show") return "danger";
  if (s === "pending_provider") return "brand";
  return "neutral";
}

export function BookingStatusBadge({ status, T }: { status: BookingStatus; T: BookingDictionary }) {
  return <Badge tone={bookingTone(status)}>{T.status[status]}</Badge>;
}

type Opt = { id: string; kind: "requested" | "proposed"; state: "open" | "accepted" | "declined" | "withdrawn"; startsAt: Date; round: number };

/** The confirmed time, or the open requested/proposed times clearly labelled as not confirmed. */
export function BookingTime({ b, options, locale, T }: { b: { status: BookingStatus; startsAt: Date | null }; options: Opt[]; locale: Locale; T: BookingDictionary }) {
  if (b.startsAt) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-success-700">{T.confirmedTime}</p>
        <p className="mt-0.5 text-lg font-semibold"><bdi>{formatAppointment(b.startsAt, locale)}</bdi></p>
      </div>
    );
  }
  const open = options.filter((o) => o.state === "open");
  if (!open.length) return null;
  const proposed = open.some((o) => o.kind === "proposed");
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-warning-700">{proposed ? T.proposedTime : T.requestedTime}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {open.map((o) => (
          <li key={o.id} className="flex items-center gap-2 font-medium"><Clock className="size-4 text-ink-3" aria-hidden /><bdi>{formatAppointment(o.startsAt, locale)}</bdi></li>
        ))}
      </ul>
    </div>
  );
}

type Ev = { id: string; action: string; toStatus: BookingStatus; actorRole: "customer" | "provider" | "admin" | "system"; note: string | null; createdAt: Date };

export function BookingTimeline({ events, locale, T }: { events: Ev[]; locale: Locale; T: BookingDictionary }) {
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e, i) => (
        <li key={e.id} className="flex gap-3 text-sm">
          <span className={i === events.length - 1 ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-navy-900 text-white" : "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-navy-900/10 text-ink-2"} aria-hidden>
            {i === events.length - 1 ? <Circle className="size-2.5 fill-current" /> : <Check className="size-3" />}
          </span>
          <div className="min-w-0">
            <p className="font-medium">{T.event[e.action as keyof BookingDictionary["event"]] ?? e.action} <span className="font-normal text-ink-3">· {T.actor[e.actorRole]}</span></p>
            {e.note && <p dir="auto" className="text-ink-2">{e.note}</p>}
            <p className="text-xs text-ink-3"><bdi>{formatDate(e.createdAt, locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" })}</bdi> · {T.status[e.toStatus]}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function BookingMessages({ messages, locale, T }: { messages: { id: string; authorRole: "customer" | "provider" | "admin" | "system"; body: string; createdAt: Date }[]; locale: Locale; T: BookingDictionary }) {
  if (!messages.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {messages.map((m) => (
        <li key={m.id} className="rounded-[var(--radius-md)] bg-canvas p-3 text-sm">
          <p className="text-xs font-semibold text-ink-3">{T.actor[m.authorRole]} · <bdi>{formatDate(m.createdAt, locale, { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Cairo" })}</bdi></p>
          <p dir="auto" className="mt-1 whitespace-pre-line">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function Panel({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <h2 id={id} className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
