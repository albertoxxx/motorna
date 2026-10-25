import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db, schema } from "@/db";
import { agreements, ledger, settlements } from "@/server/bookings";
import { Panel } from "@/components/care/booking-parts";
import { Badge } from "@/components/ui/badge";
import { AgreementActions, AgreementForm, LedgerActions, SettlementActions, SettlementForm } from "@/components/care/booking-admin-ui";
import { formatDate, formatPrice } from "@/lib/format";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function CenterCommission({ params }: PageProps<"/[lang]/admin/commission/[centerId]">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const { centerId } = await params;
  if (!UUID.test(centerId)) notFound();
  const [center] = await db.select().from(schema.serviceCenters).where(eq(schema.serviceCenters.id, centerId));
  if (!center) notFound();
  const [ags, rows, sts] = await Promise.all([agreements(centerId), ledger({ centerId }), settlements(centerId)]);
  const T = dict.booking;
  const C = T.commission;
  const d = { booking: T, errors: dict.errors, common: dict.common, care: dict.care };
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/${locale}/admin/commission`} className="text-sm font-medium text-brand-700 hover:underline">{C.title}</Link>
        <h1 className="mt-1 text-2xl font-bold"><bdi>{locale === "ar" ? center.nameAr : center.nameEn}</bdi></h1>
      </div>
      <Panel title={C.agreements}>
        {ags.length === 0 ? <p className="text-sm text-ink-3">{C.noAgreements}</p> : (
          <ul className="flex flex-col gap-3">
            {ags.map((a) => (
              <li key={a.id} className="rounded-[var(--radius-md)] border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.status === "active" ? "success" : "neutral"}>{C.agreementStatus[a.status]}</Badge>
                  <span className="tabular font-semibold">{a.basis === "percent" ? `${(a.percentBps ?? 0) / 100}%` : formatPrice(a.fixedEgp ?? 0, locale)}</span>
                  <span className="text-ink-3">{a.basis === "percent" ? C.percent : C.fixed}</span>
                </div>
                <p className="mt-1 text-ink-2">
                  {C.effectiveFrom}: {formatDate(a.effectiveFrom, locale)}{a.effectiveTo && <> · {C.effectiveTo}: {formatDate(a.effectiveTo, locale)}</>} · {a.settlementSchedule === "monthly" ? C.monthly : C.biweekly}
                </p>
                <p className="text-ink-3">{a.categories?.length ? a.categories.map((c) => dict.care.enums.category[c]).join("، ") : C.categories.split("(")[0]}{a.contractReference && <> · {C.contractRef}: <bdi>{a.contractReference}</bdi></>}</p>
                {a.exceptions && <p dir="auto" className="text-ink-3">{C.exceptions}: {a.exceptions}</p>}
                <div className="mt-2"><AgreementActions dict={d} id={a.id} status={a.status} /></div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-3">{C.immutableNote}</p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">{C.newAgreement}</summary>
          <div className="mt-3"><AgreementForm dict={d} centerId={centerId} /></div>
        </details>
      </Panel>

      <Panel title={C.ledger}>
        {rows.length === 0 ? <p className="text-sm text-ink-3">{C.ledgerEmpty}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="text-xs text-ink-3">
                <tr><th className="py-2 text-start">{C.booking}</th><th className="text-start">{C.completed}</th><th className="text-start">{C.rate}</th><th className="text-start">{C.base}</th><th className="text-start">{C.adjustments}</th><th className="text-start">{C.effective}</th><th className="text-start">{T.admin.filterStatus}</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2"><Link href={`/${locale}/admin/bookings/${l.bookingReference}`} dir="ltr" className="tabular underline">{l.bookingReference}</Link><p className="text-xs text-ink-3">{formatDate(l.completedAt, locale)}</p></td>
                    <td className="tabular">{formatPrice(l.completedAmountEgp, locale)}{l.agreedPriceEgp != null && <p className="text-xs text-ink-3">{C.agreed}: {formatPrice(l.agreedPriceEgp, locale)}</p>}</td>
                    <td className="tabular">{l.basis === "percent" ? `${(l.percentBps ?? 0) / 100}%` : formatPrice(l.fixedEgp ?? 0, locale)}</td>
                    <td className="tabular">{formatPrice(l.commissionEgp, locale)}</td>
                    <td className="tabular">{l.adjustmentsEgp ? formatPrice(l.adjustmentsEgp, locale) : "—"}</td>
                    <td className="tabular font-semibold">{formatPrice(l.commissionEgp + l.adjustmentsEgp, locale)}</td>
                    <td>{T.ledgerStatus[l.status]}<p className="text-xs text-ink-3">{C.customerConfirmed}: {l.customerConfirmedAt ? T.admin.yes : T.admin.no}</p></td>
                    <td className="w-48"><LedgerActions dict={d} id={l.id} status={l.status} inSettlement={!!l.settlementId} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={C.settlements}>
        <SettlementForm dict={d} centerId={centerId} />
        {sts.length === 0 ? <p className="mt-3 text-sm text-ink-3">{C.settlementsEmpty}</p> : (
          <ul className="mt-4 flex flex-col gap-3">
            {sts.map((s) => (
              <li key={s.id} className="rounded-[var(--radius-md)] border border-line p-3 text-sm">
                <p><span dir="ltr" className="tabular font-semibold">{s.reference}</span> · {formatDate(s.periodStart, locale)} – {formatDate(s.periodEnd, locale)} · {C.total}: <span className="tabular font-semibold">{formatPrice(s.totalEgp, locale)}</span> · {T.settlementStatus[s.status]}</p>
                {s.paymentNote && <p dir="auto" className="text-ink-3">{s.paymentNote}{s.settledAt && ` · ${formatDate(s.settledAt, locale)}`}</p>}
                {s.status === "issued" && <div className="mt-2"><SettlementActions dict={d} id={s.id} /></div>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
