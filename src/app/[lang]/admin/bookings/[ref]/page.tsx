import { notFound } from "next/navigation";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { adminBooking, ledger } from "@/server/bookings";
import { Badge } from "@/components/ui/badge";
import { BookingMessages, BookingStatusBadge, BookingTime, BookingTimeline, Panel } from "@/components/care/booking-parts";
import { DisputeResolver, ReviewToggle } from "@/components/care/booking-admin-ui";
import { formatPrice } from "@/lib/format";

export default async function AdminBookingDetail({ params }: PageProps<"/[lang]/admin/bookings/[ref]">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const { ref } = await params;
  const b = await adminBooking(ref);
  if (!b) notFound();
  const T = dict.booking;
  const d = { booking: T, errors: dict.errors, common: dict.common, care: dict.care };
  const [lg] = (await ledger({ centerId: b.centerId })).filter((l) => l.bookingReference === b.reference);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold"><span dir="ltr" className="tabular">{b.reference}</span></h1>
        <BookingStatusBadge status={b.status} T={T} />
        {b.lateCancel && <Badge tone="warning">{T.lateCancelBadge}</Badge>}
      </div>
      <p className="text-sm text-ink-2"><bdi>{locale === "ar" ? b.serviceNameAr : b.serviceNameEn}</bdi> · <bdi>{locale === "ar" ? b.centerNameAr : b.centerNameEn}</bdi></p>
      <Panel title={T.wizard.steps.time}><BookingTime b={b} options={b.options} locale={locale} T={T} /></Panel>
      {b.disputes.map((x) => (
        <Panel key={x.id} title={`${T.admin.disputes}: ${T.disputeKinds[x.kind]} · ${T.disputeStatus[x.status]}`}>
          <p className="text-xs text-ink-3">{T.actor[x.openedByRole]}{x.priorStatus && ` · ${T.status[x.priorStatus]}`}</p>
          <p dir="auto" className="mt-1 text-sm">{x.description}</p>
          {x.resolution ? <p dir="auto" className="mt-2 text-sm"><span className="font-medium">{T.actor.admin}:</span> {x.resolution}</p> : (x.status === "open" || x.status === "reviewing") && <div className="mt-4"><DisputeResolver dict={d} disputeId={x.id} status={x.status} kind={x.kind} /></div>}
          <p className="mt-3 text-xs text-ink-3">{T.disputeNote}</p>
        </Panel>
      ))}
      {b.completion && (
        <Panel title={T.provider.complete}>
          <p className="text-sm">{T.provider.serviceCompleted}: {b.completion.serviceCompleted ? T.admin.yes : T.admin.no}{b.completion.finalAmountEgp != null && <> · <span className="tabular">{formatPrice(b.completion.finalAmountEgp, locale)}</span></>}</p>
          {lg && <p className="mt-1 text-sm">{T.commission.ledger}: <span className="tabular">{formatPrice(lg.commissionEgp + lg.adjustmentsEgp, locale)}</span> · {T.ledgerStatus[lg.status]}</p>}
        </Panel>
      )}
      {b.review && (
        <Panel title={T.admin.reviews}>
          <p className="tabular">{"★".repeat(b.review.rating)}<span className="text-ink-3">{"★".repeat(5 - b.review.rating)}</span>{b.review.hidden && <Badge tone="neutral" className="ms-2">{T.admin.hidden}</Badge>}</p>
          {b.review.comment && <p dir="auto" className="mt-1 text-sm">{b.review.comment}</p>}
          <div className="mt-3"><ReviewToggle dict={d} reviewId={b.review.id} hidden={b.review.hidden} /></div>
        </Panel>
      )}
      {b.messages.length > 0 && <Panel title={T.messages}><BookingMessages messages={b.messages} locale={locale} T={T} /></Panel>}
      <Panel title={T.timeline}><BookingTimeline events={b.events} locale={locale} T={T} /></Panel>
    </div>
  );
}
