import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { customerBookings } from "@/server/bookings";
import { ACTIVE } from "@/lib/booking";
import { EmptyState } from "@/components/ui/states";
import { BookingStatusBadge } from "@/components/care/booking-parts";
import { formatAppointment, formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";

export const metadata: Metadata = { robots: { index: false } };

type Rows = Awaited<ReturnType<typeof customerBookings>>;

function BookingList({ items, locale, T }: { items: Rows; locale: Locale; T: Dictionary["booking"] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
      {items.map((b) => (
        <li key={b.id}>
          <Link href={`/${locale}/account/bookings/${b.reference}`} className="flex flex-wrap items-start justify-between gap-3 p-4 hover:bg-canvas">
            <div className="min-w-0">
              <p className="font-medium"><bdi>{locale === "ar" ? b.serviceNameAr : b.serviceNameEn}</bdi> · <bdi className="text-ink-2">{locale === "ar" ? b.centerNameAr : b.centerNameEn}</bdi></p>
              <p className="mt-0.5 text-sm text-ink-3">
                {b.startsAt ? <bdi>{formatAppointment(b.startsAt, locale)}</bdi> : <>{T.requestedAt} {formatDate(b.createdAt, locale)}</>} · <span dir="ltr" className="tabular">{b.reference}</span>
              </p>
            </div>
            <BookingStatusBadge status={b.status} T={T} />
          </Link>
        </li>
      ))}
    </ul>
  );
}


export default async function MyBookings({ params }: PageProps<"/[lang]/account/bookings">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale, `/${locale}/account/bookings`);
  const rows = await customerBookings(user.id);
  const T = dict.booking;
  const active = rows.filter((r) => ACTIVE.includes(r.status)).sort((a, b) => (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity));
  const past = rows.filter((r) => !ACTIVE.includes(r.status));
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{T.myBookings}</h1>
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="size-8" aria-hidden />} title={T.empty} action={<Link href={`/${locale}/care`} className="font-semibold text-brand-700 underline">{dict.care.navLabel}</Link>} />
      ) : (
        <>
          {active.length > 0 && <section><h2 className="mb-3 text-base font-semibold">{T.upcoming}</h2><BookingList items={active} locale={locale} T={T} /></section>}
          {past.length > 0 && <section><h2 className="mb-3 text-base font-semibold">{T.past}</h2><BookingList items={past} locale={locale} T={T} /></section>}
        </>
      )}
    </div>
  );
}
