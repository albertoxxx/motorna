import type { Metadata } from "next";
import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { requireCenterStaffPage } from "@/server/center-page";
import { centerBookingCounts, centerMonthlyReport, settlements } from "@/server/bookings";
import { CenterSubnav } from "@/components/care/center-subnav";
import { Panel } from "@/components/care/booking-parts";
import { BOOKING_STATUSES, cairoDate } from "@/lib/booking";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { robots: { index: false } };

const shift = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export default async function ReportsPage({ params, searchParams }: PageProps<"/[lang]/center/[slug]/reports">) {
  const { locale, dict } = await resolveLocale(params);
  const { slug } = await params;
  const sp = await searchParams;
  const { center } = await requireCenterStaffPage(locale, slug, "/reports");
  const thisMonth = cairoDate(new Date()).date.slice(0, 7);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : thisMonth;
  const [r, counts, sts] = await Promise.all([centerMonthlyReport(center.id, month), centerBookingCounts(center.id), settlements(center.id)]);
  const T = dict.booking;
  const R = T.report;
  const label = formatDate(`${month}-15T12:00:00Z`, locale, { month: "long", year: "numeric" });
  return (
    <div className="container-page max-w-4xl py-10">
      <p className="text-sm font-semibold text-brand-700">{dict.care.dash.title}</p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl"><bdi>{locale === "ar" ? center.nameAr : center.nameEn}</bdi></h1>
      <CenterSubnav locale={locale} slug={slug} active="reports" labels={T.subnav} actionCount={counts.action} />
      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{R.title}: {label}</h2>
        <div className="flex gap-2 text-sm">
          <Link className="rounded-full bg-navy-900/[0.05] px-3 py-1.5 hover:bg-navy-900/10" href={`/${locale}/center/${slug}/reports?month=${shift(month, -1)}`}>‹</Link>
          {month < thisMonth && <Link className="rounded-full bg-navy-900/[0.05] px-3 py-1.5 hover:bg-navy-900/10" href={`/${locale}/center/${slug}/reports?month=${shift(month, 1)}`}>›</Link>}
        </div>
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <Panel title={`${R.bookings} (${r.total})`}>
          {r.total === 0 ? <p className="text-sm text-ink-3">{R.noData}</p> : (
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              {BOOKING_STATUSES.filter((s) => r.byStatus[s]).map((s) => (<div key={s} className="contents"><dt className="text-ink-2">{T.status[s]}</dt><dd className="tabular">{r.byStatus[s]}</dd></div>))}
            </dl>
          )}
          {r.reviews.count > 0 && <p className="mt-3 text-sm">{R.reviews}: <span className="tabular font-semibold">{r.reviews.average}</span>/5 ({r.reviews.count})</p>}
        </Panel>
        <Panel title={R.commission}>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-ink-2">{R.completedRevenue}</dt><dd className="tabular">{formatPrice(r.completedRevenueEgp, locale)}</dd>
            <dt className="text-ink-2">{R.pending}</dt><dd className="tabular">{formatPrice(r.commission.pending, locale)}</dd>
            <dt className="text-ink-2">{R.confirmed}</dt><dd className="tabular">{formatPrice(r.commission.confirmed, locale)}</dd>
            <dt className="text-ink-2">{R.settled}</dt><dd className="tabular">{formatPrice(r.commission.settled, locale)}</dd>
            {r.commission.waived > 0 && (<><dt className="text-ink-2">{R.waived}</dt><dd className="tabular">{formatPrice(r.commission.waived, locale)}</dd></>)}
          </dl>
          <p className="mt-3 text-xs text-ink-3">{T.provider.commissionNote}</p>
        </Panel>
      </div>
      {r.ledger.length > 0 && (
        <div className="mt-5">
          <Panel title={R.ledger}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-start text-xs text-ink-3"><tr><th className="py-2 text-start">{T.commission.booking}</th><th className="text-start">{T.commission.completed}</th><th className="text-start">{R.rate}</th><th className="text-start">{R.effective}</th><th className="text-start">{dict.booking.admin.filterStatus}</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {r.ledger.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2"><Link href={`/${locale}/center/${slug}/bookings/${l.bookingReference}`} dir="ltr" className="tabular underline">{l.bookingReference}</Link></td>
                      <td className="tabular">{formatPrice(l.completedAmountEgp, locale)}</td>
                      <td className="tabular">{l.basis === "percent" ? `${(l.percentBps ?? 0) / 100}%` : formatPrice(l.fixedEgp ?? 0, locale)}</td>
                      <td className="tabular">{formatPrice(l.commissionEgp + l.adjustmentsEgp, locale)}</td>
                      <td>{T.ledgerStatus[l.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
      {sts.length > 0 && (
        <div className="mt-5">
          <Panel title={T.commission.settlements}>
            <ul className="divide-y divide-line text-sm">
              {sts.map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span><span dir="ltr" className="tabular font-medium">{s.reference}</span> · {formatDate(s.periodStart, locale)} – {formatDate(s.periodEnd, locale)}</span>
                  <span><span className="tabular font-semibold">{formatPrice(s.totalEgp, locale)}</span> · {T.settlementStatus[s.status]}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
