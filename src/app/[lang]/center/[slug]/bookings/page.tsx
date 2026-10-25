import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireCenterStaffPage } from "@/server/center-page";
import { CENTER_TABS, centerBookingCounts, centerBookings, type CenterTab } from "@/server/bookings";
import { CenterSubnav } from "@/components/care/center-subnav";
import { BookingStatusBadge } from "@/components/care/booking-parts";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { formatAppointment, formatRelative } from "@/lib/format";

export const metadata: Metadata = { robots: { index: false } };

export default async function CenterBookings({ params, searchParams }: PageProps<"/[lang]/center/[slug]/bookings">) {
  const { locale, dict } = await resolveLocale(params);
  const { slug } = await params;
  const sp = await searchParams;
  const tab: CenterTab = CENTER_TABS.includes(sp.tab as CenterTab) ? (sp.tab as CenterTab) : "action";
  const { center } = await requireCenterStaffPage(locale, slug, "/bookings");
  const [rows, counts] = await Promise.all([centerBookings(center.id, tab), centerBookingCounts(center.id)]);
  const T = dict.booking;
  const P = T.provider;
  return (
    <div className="container-page max-w-4xl py-10">
      <p className="text-sm font-semibold text-brand-700">{dict.care.dash.title}</p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl"><bdi>{locale === "ar" ? center.nameAr : center.nameEn}</bdi></h1>
      <CenterSubnav locale={locale} slug={slug} active="bookings" labels={T.subnav} actionCount={counts.action} />
      <div className="mt-5 flex gap-2" role="tablist">
        {CENTER_TABS.map((t) => (
          <Link key={t} role="tab" aria-selected={t === tab} href={`/${locale}/center/${slug}/bookings?tab=${t}`}
            className={cn("rounded-full px-3 py-1.5 text-sm font-medium", t === tab ? "bg-navy-900 text-white" : "bg-navy-900/[0.05] text-ink-2 hover:bg-navy-900/10")}>
            {P.tabs[t]}{t === "action" && counts.action > 0 && <span className="ms-1 tabular">({counts.action})</span>}{t === "upcoming" && counts.upcoming > 0 && <span className="ms-1 tabular">({counts.upcoming})</span>}
          </Link>
        ))}
      </div>
      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="size-8" aria-hidden />} title={P.empty[tab]} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
            {rows.map((b) => (
              <li key={b.id}>
                <Link href={`/${locale}/center/${slug}/bookings/${b.reference}`} className="flex flex-wrap items-start justify-between gap-3 p-4 hover:bg-canvas">
                  <div className="min-w-0">
                    <p className="font-medium"><bdi>{locale === "ar" ? b.serviceNameAr : b.serviceNameEn}</bdi> · <bdi className="text-ink-2">{b.contactName}</bdi></p>
                    <p className="mt-0.5 text-sm text-ink-3">
                      <bdi>{locale === "ar" ? b.makeAr : b.makeEn} {b.vehicleYear}</bdi> · <span dir="ltr" className="tabular">{b.reference}</span> · {formatRelative(b.updatedAt, locale)}
                    </p>
                    <p className="mt-1 text-sm">
                      {b.startsAt ? (
                        <bdi className="font-medium">{formatAppointment(b.startsAt, locale)}</bdi>
                      ) : (
                        b.openTimes.length > 0 && (
                          <span className="text-warning-700">{b.openTimes[0].kind === "proposed" ? P.proposedOpen : P.requested}: <bdi>{b.openTimes.map((o) => formatAppointment(o.startsAt, locale)).join(" · ")}</bdi></span>
                        )
                      )}
                    </p>
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
