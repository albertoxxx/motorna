import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireCenterStaffPage } from "@/server/center-page";
import { centerBooking, openDates, providerSeesContact } from "@/server/bookings";
import { Badge } from "@/components/ui/badge";
import { BookingMessages, BookingStatusBadge, BookingTime, BookingTimeline, Panel } from "@/components/care/booking-parts";
import { ProviderBookingActions } from "@/components/care/booking-actions";
import { servicePriceText } from "@/components/care/service-price";
import { formatKm, formatPrice } from "@/lib/format";

export const metadata: Metadata = { robots: { index: false } };

export default async function CenterBookingDetail({ params }: PageProps<"/[lang]/center/[slug]/bookings/[ref]">) {
  const { locale, dict } = await resolveLocale(params);
  const { slug, ref } = await params;
  const { center, role } = await requireCenterStaffPage(locale, slug, `/bookings/${ref}`);
  const b = await centerBooking(center.id, ref);
  if (!b) notFound();
  const T = dict.booking;
  const P = T.provider;
  const W = T.wizard;
  const dates = await openDates(center.id);
  const vehicle = `${locale === "ar" ? b.makeAr : b.makeEn} ${b.modelAr ? (locale === "ar" ? b.modelAr : b.modelEn) : (b.vehicleModelText ?? "")} ${b.vehicleYear}`.replace(/\s+/g, " ");
  // Contact details are for this booking only; once it has been final for 30 days they're hidden.
  const showContact = providerSeesContact(b);
  return (
    <div className="container-page max-w-4xl py-10">
      <Link href={`/${locale}/center/${slug}/bookings`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />{P.title}
      </Link>
      <header className="mt-4 flex flex-col gap-2">
        <p className="text-sm text-ink-3">{T.ref}: <span dir="ltr" className="tabular font-semibold text-ink">{b.reference}</span></p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold"><bdi>{locale === "ar" ? b.serviceNameAr : b.serviceNameEn}</bdi></h1>
          <BookingStatusBadge status={b.status} T={T} />
          {b.lateCancel && <Badge tone="warning">{T.lateCancelBadge}</Badge>}
        </div>
        {b.statusReason && <p dir="auto" className="text-sm"><span className="font-medium">{dict.care.dash.reason}:</span> {b.statusReason}</p>}
      </header>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title={W.steps.time}>
            <BookingTime b={b} options={b.options} locale={locale} T={T} />
            <p className="mt-2 text-xs text-ink-3">{W.timesLocal}</p>
            {b.status === "alternative_proposed" && <p className="mt-2 text-sm text-ink-2">{P.awaitingCustomer}</p>}
            <div className="mt-4 border-t border-line pt-4">
              <ProviderBookingActions
                locale={locale}
                dict={{ booking: T, errors: dict.errors, validation: dict.validation, common: dict.common }}
                role={role}
                booking={{ id: b.id, status: b.status, startsAt: b.startsAt?.toISOString() ?? null, lateCancel: b.lateCancel, statusSince: b.statusSince.toISOString() }}
                requested={b.options.filter((o) => o.kind === "requested" && o.state === "open").map((o) => ({ id: o.id, startsAt: o.startsAt.toISOString() }))}
                dates={dates}
                openDispute={b.disputes.some((d) => d.status === "open" || d.status === "reviewing")}
              />
            </div>
          </Panel>
          {b.messages.length > 0 && <Panel title={T.messages}><BookingMessages messages={b.messages} locale={locale} T={T} /></Panel>}
          {b.completion && (
            <Panel title={P.complete}>
              <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
                <dt className="text-ink-3">{P.serviceCompleted}</dt><dd>{b.completion.serviceCompleted ? T.admin.yes : T.admin.no}</dd>
                {b.completion.finalAmountEgp != null && (<><dt className="text-ink-3">{P.finalAmount}</dt><dd className="tabular">{formatPrice(b.completion.finalAmountEgp, locale)}</dd></>)}
                {b.completion.workSummary && (<><dt className="text-ink-3">{P.workSummary}</dt><dd dir="auto">{b.completion.workSummary}</dd></>)}
                <dt className="text-ink-3">{T.commission.customerConfirmed}</dt><dd>{b.completion.customerConfirmedAt ? T.admin.yes : T.admin.no}</dd>
              </dl>
              <p className="mt-3 text-xs text-ink-3">{P.commissionNote}</p>
            </Panel>
          )}
          {b.review && (
            <Panel title={T.admin.reviews}>
              <p className="tabular">{"★".repeat(b.review.rating)}<span className="text-ink-3">{"★".repeat(5 - b.review.rating)}</span></p>
              {b.review.comment && <p dir="auto" className="mt-1 text-sm text-ink-2">{b.review.comment}</p>}
            </Panel>
          )}
          {b.disputes.length > 0 && (
            <Panel title={T.admin.disputes}>
              <ul className="flex flex-col gap-2 text-sm">
                {b.disputes.map((d) => (
                  <li key={d.id} className="rounded-[var(--radius-md)] bg-canvas p-3">
                    <p className="font-medium">{T.disputeKinds[d.kind]} · <span className="text-ink-3">{T.disputeStatus[d.status]}</span></p>
                    <p dir="auto" className="mt-1 text-ink-2">{d.description}</p>
                    {d.resolution && <p dir="auto" className="mt-2"><span className="font-medium">{T.actor.admin}:</span> {d.resolution}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title={T.timeline}><BookingTimeline events={b.events} locale={locale} T={T} /></Panel>
        </div>
        <aside className="flex flex-col gap-5">
          <Panel title={P.customer}>
            <p className="font-medium"><bdi>{b.contactName}</bdi></p>
            {showContact && (
              <>
                <a href={`tel:${b.contactPhone}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700"><Phone className="size-4" aria-hidden /><span dir="ltr" className="tabular">{b.contactPhone}</span></a>
                <p className="mt-1 text-xs text-ink-3">{P.phoneNote}</p>
              </>
            )}
            <p className="mt-3 text-sm font-medium">{P.vehicle}</p>
            <p className="text-sm"><bdi>{vehicle}</bdi>{b.vehicleMileageKm != null && <span className="text-ink-3"> · {formatKm(b.vehicleMileageKm, locale)}</span>}</p>
            {b.customerNote && (<><p className="mt-3 text-sm font-medium">{P.note}</p><p dir="auto" className="whitespace-pre-line text-sm text-ink-2">{b.customerNote}</p></>)}
            <p className="mt-3 text-sm font-medium">{W.price}</p>
            <p className="text-sm"><span className="tabular">{servicePriceText(b, locale, T)}</span>{b.priceMode !== "quote" && <span className="text-ink-3"> ({T.priceMode[b.priceMode]})</span>}</p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
