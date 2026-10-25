import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { adminBookings, openDisputes } from "@/server/bookings";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/booking";
import { BookingStatusBadge, Panel } from "@/components/care/booking-parts";
import { cn } from "@/lib/cn";
import { formatAppointment, formatRelative } from "@/lib/format";

export default async function AdminBookings({ params, searchParams }: PageProps<"/[lang]/admin/bookings">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const sp = await searchParams;
  const status = BOOKING_STATUSES.includes(sp.status as BookingStatus) ? (sp.status as BookingStatus) : undefined;
  const [rows, disputes] = await Promise.all([adminBookings(status), openDisputes()]);
  const T = dict.booking;
  const A = T.admin;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{A.bookings}</h1>
      <Panel title={`${A.disputes} (${disputes.length})`}>
        {disputes.length === 0 ? <p className="text-sm text-ink-3">{A.disputesEmpty}</p> : (
          <ul className="divide-y divide-line">
            {disputes.map((d) => (
              <li key={d.id} className="py-3 text-sm">
                <Link href={`/${locale}/admin/bookings/${d.reference}`} className="font-medium hover:underline"><span dir="ltr" className="tabular">{d.reference}</span> · {T.disputeKinds[d.kind]}</Link>
                <p className="text-ink-3"><bdi>{locale === "ar" ? d.centerNameAr : d.centerNameEn}</bdi> · {T.actor[d.openedByRole]} · {T.disputeStatus[d.status]} · {formatRelative(d.createdAt, locale)}</p>
                <p dir="auto" className="mt-1 line-clamp-2 text-ink-2">{d.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Link href={`/${locale}/admin/bookings`} className={cn("rounded-full px-3 py-1 text-xs font-medium", !status ? "bg-navy-900 text-white" : "bg-navy-900/[0.05]")}>{A.all}</Link>
          {BOOKING_STATUSES.map((s) => (
            <Link key={s} href={`/${locale}/admin/bookings?status=${s}`} className={cn("rounded-full px-3 py-1 text-xs font-medium", status === s ? "bg-navy-900 text-white" : "bg-navy-900/[0.05]")}>{T.status[s]}</Link>
          ))}
        </div>
        {rows.length === 0 ? <p className="text-sm text-ink-3">—</p> : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
            {rows.map((b) => (
              <li key={b.id}>
                <Link href={`/${locale}/admin/bookings/${b.reference}`} className="flex flex-wrap items-start justify-between gap-3 p-4 hover:bg-canvas">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium"><span dir="ltr" className="tabular">{b.reference}</span> · <bdi>{locale === "ar" ? b.serviceNameAr : b.serviceNameEn}</bdi></p>
                    <p className="text-ink-3"><bdi>{locale === "ar" ? b.centerNameAr : b.centerNameEn}</bdi> · {b.startsAt ? <bdi>{formatAppointment(b.startsAt, locale)}</bdi> : formatRelative(b.createdAt, locale)}</p>
                  </div>
                  <BookingStatusBadge status={b.status} T={T} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
