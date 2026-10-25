import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CheckCircle2, Phone } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { customerBooking, openDates } from "@/server/bookings";
import { DISPUTE_WINDOW_DAYS, LEDGER_AUTO_CONFIRM_DAYS } from "@/lib/booking";
import { Notice } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { BookingMessages, BookingStatusBadge, BookingTime, BookingTimeline, Panel } from "@/components/care/booking-parts";
import { CustomerBookingActions } from "@/components/care/booking-actions";
import { servicePriceText } from "@/components/care/service-price";
import { formatDate, formatKm, formatPrice } from "@/lib/format";

export const metadata: Metadata = { robots: { index: false } };

export default async function BookingDetail({ params, searchParams }: PageProps<"/[lang]/account/bookings/[ref]">) {
  const { locale, dict } = await resolveLocale(params);
  const { ref } = await params;
  const sp = await searchParams;
  const user = await requireUser(locale, `/${locale}/account/bookings/${ref}`);
  const b = await customerBooking(user.id, ref);
  if (!b) notFound();
  const T = dict.booking;
  const W = T.wizard;
  const dates = ["pending_provider", "alternative_proposed", "confirmed", "awaiting_customer"].includes(b.status) ? await openDates(b.centerId) : [];
  const proposed = b.options.filter((o) => o.kind === "proposed" && o.state === "open");
  const openDispute = b.disputes.some((d) => d.status === "open" || d.status === "reviewing");
  const vehicle = `${locale === "ar" ? b.makeAr : b.makeEn} ${b.modelAr ? (locale === "ar" ? b.modelAr : b.modelEn) : (b.vehicleModelText ?? "")} ${b.vehicleYear}`.replace(/\s+/g, " ");
  const confirmDeadline = b.completedAt ? new Date(b.completedAt.getTime() + LEDGER_AUTO_CONFIRM_DAYS * 86_400_000).toISOString() : null;
  const priceNote = b.priceMode === "fixed" ? T.fixedNote : b.priceMode === "estimate" ? T.estimateNote : T.quoteNote;
  return (
    <div className="flex flex-col gap-5">
      <Link href={`/${locale}/account/bookings`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />{T.myBookings}
      </Link>
      {sp.new === "1" && (
        <Notice tone="success">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" aria-hidden />{W.submitted}</p>
          <p className="mt-1">{W.notConfirmedYet}</p>
        </Notice>
      )}
      <header className="flex flex-col gap-2">
        <p className="text-sm text-ink-3">{T.ref}: <span dir="ltr" className="tabular font-semibold text-ink">{b.reference}</span></p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold"><bdi>{locale === "ar" ? b.serviceNameAr : b.serviceNameEn}</bdi></h1>
          <BookingStatusBadge status={b.status} T={T} />
          {b.lateCancel && <Badge tone="warning">{T.lateCancelBadge}</Badge>}
        </div>
        <p className="text-ink-2">{T.statusHelp[b.status]}</p>
        {b.statusReason && <p dir="auto" className="text-sm"><span className="font-medium">{dict.care.dash.reason}:</span> {b.statusReason}</p>}
        {b.lateCancel && <p className="text-xs text-ink-3">{T.lateCancelHelp}</p>}
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title={W.steps.time}>
            <BookingTime b={b} options={b.options} locale={locale} T={T} />
            <p className="mt-2 text-xs text-ink-3">{W.timesLocal}</p>
            <div className="mt-4 border-t border-line pt-4">
              <CustomerBookingActions
                locale={locale}
                dict={{ booking: T, errors: dict.errors, validation: dict.validation, common: dict.common }}
                booking={{ id: b.id, status: b.status, mode: b.mode, centerId: b.centerId, serviceId: b.serviceId, startsAt: b.startsAt?.toISOString() ?? null, cancelCutoffHours: b.cancelCutoffHours, completedAt: b.completedAt?.toISOString() ?? null, statusSince: b.statusSince.toISOString() }}
                proposed={proposed.map((o) => ({ id: o.id, startsAt: o.startsAt.toISOString() }))}
                dates={dates}
                completion={b.completion ? { serviceCompleted: b.completion.serviceCompleted, customerConfirmedAt: b.completion.customerConfirmedAt?.toISOString() ?? null } : null}
                hasReview={!!b.review}
                openDispute={openDispute}
                disputeWindowDays={DISPUTE_WINDOW_DAYS[b.status] ?? null}
                confirmDeadline={confirmDeadline}
              />
            </div>
          </Panel>

          {b.messages.length > 0 && <Panel title={T.messages}><BookingMessages messages={b.messages} locale={locale} T={T} /></Panel>}

          <Panel title={W.steps.review}>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[9rem_1fr]">
              <dt className="text-ink-3">{W.price}</dt>
              <dd>
                <span className="tabular font-semibold">{servicePriceText(b, locale, T)}</span>
                {b.priceMode !== "quote" && <span className="ms-1.5 text-xs text-ink-3">({T.priceMode[b.priceMode]})</span>}
                <p className="text-xs text-ink-3">{priceNote} {T.payDirect}</p>
                {b.completion?.finalAmountEgp != null && <p className="mt-1">{dict.booking.provider.finalAmount}: <span className="tabular font-semibold">{formatPrice(b.completion.finalAmountEgp, locale)}</span></p>}
              </dd>
              <dt className="text-ink-3">{W.vehicle}</dt>
              <dd><bdi>{vehicle}</bdi>{b.vehicleMileageKm != null && <span className="text-ink-3"> · {formatKm(b.vehicleMileageKm, locale)}</span>}</dd>
              <dt className="text-ink-3">{W.contactName}</dt>
              <dd><bdi>{b.contactName}</bdi> · <span dir="ltr" className="tabular">{b.contactPhone}</span></dd>
              {b.customerNote && (<><dt className="text-ink-3">{W.note}</dt><dd dir="auto" className="whitespace-pre-line">{b.customerNote}</dd></>)}
              {b.completion?.workSummary && (<><dt className="text-ink-3">{dict.booking.provider.workSummary}</dt><dd dir="auto" className="whitespace-pre-line">{b.completion.workSummary}</dd></>)}
              <dt className="text-ink-3">{W.policyTitle}</dt>
              <dd className="text-ink-2">{W.policyDefault.replace("{h}", String(b.cancelCutoffHours))}</dd>
            </dl>
          </Panel>

          {b.disputes.length > 0 && (
            <Panel title={T.actions.report}>
              <ul className="flex flex-col gap-3 text-sm">
                {b.disputes.map((d) => (
                  <li key={d.id} className="rounded-[var(--radius-md)] bg-canvas p-3">
                    <p className="font-medium">{T.disputeKinds[d.kind]} · <span className="text-ink-3">{T.disputeStatus[d.status]}</span></p>
                    <p dir="auto" className="mt-1 text-ink-2">{d.description}</p>
                    {d.resolution && <p dir="auto" className="mt-2"><span className="font-medium">{T.actor.admin}:</span> {d.resolution}</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-3">{T.disputeNote}</p>
            </Panel>
          )}

          <Panel title={T.timeline}><BookingTimeline events={b.events} locale={locale} T={T} /></Panel>
        </div>

        <aside className="flex flex-col gap-5">
          <Panel title={T.providerDetails}>
            <p className="font-semibold"><Link href={`/${locale}/care/centers/${b.centerSlug}`} className="hover:underline"><bdi>{locale === "ar" ? b.centerNameAr : b.centerNameEn}</bdi></Link></p>
            <p className="text-sm text-ink-2">{dict.care.providers[b.centerCategory].short}</p>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-success-700"><BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden />{dict.care.verification[b.centerCategory].badge}</p>
            {b.centerLastVerifiedAt && <p className="text-xs text-ink-3">{T.verifiedOn.replace("{date}", formatDate(b.centerLastVerifiedAt, locale))}</p>}
            <p className="mt-2 text-xs text-ink-3">{dict.care.approvalMeaning}</p>
            <p dir="auto" className="mt-3 text-sm text-ink-2">{b.centerAddress}{b.centerArea ? ` — ${b.centerArea}` : ""}</p>
            <a href={`tel:${b.centerPhone}`} className="mt-3 inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3 text-sm font-medium hover:bg-canvas">
              <Phone className="size-4" aria-hidden />{T.callProvider} <span dir="ltr" className="tabular">{b.centerPhone}</span>
            </a>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
