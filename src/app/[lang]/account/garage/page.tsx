import type { Metadata } from "next";
import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { customerVehicles, maintenanceRecords } from "@/server/bookings";
import { getMakes, getModels } from "@/server/listings";
import { Garage } from "@/components/care/garage";
import { Panel } from "@/components/care/booking-parts";
import { formatDate, formatKm, formatPrice } from "@/lib/format";

export const metadata: Metadata = { robots: { index: false } };

export default async function GaragePage({ params }: PageProps<"/[lang]/account/garage">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale, `/${locale}/account/garage`);
  const [vehicles, records, makes, models] = await Promise.all([customerVehicles(user.id), maintenanceRecords(user.id), getMakes(), getModels()]);
  const G = dict.booking.garage;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{G.title}</h1>
      <Panel title={G.vehicles}>
        <Garage locale={locale} dict={{ booking: dict.booking, errors: dict.errors, common: dict.common, validation: dict.validation }} vehicles={vehicles} makes={makes.map((m) => ({ id: m.id, nameAr: m.nameAr, nameEn: m.nameEn }))} models={models.map((m) => ({ id: m.id, makeId: m.makeId, nameAr: m.nameAr, nameEn: m.nameEn }))} />
        <p className="mt-3 text-xs text-ink-3">{G.privacy}</p>
      </Panel>
      <Panel title={G.history}>
        {records.length === 0 ? (
          <p className="text-sm text-ink-3">{G.noHistory}</p>
        ) : (
          <ul className="divide-y divide-line">
            {records.map((r) => (
              <li key={r.reference} className="py-3 text-sm">
                <p className="font-medium"><bdi>{locale === "ar" ? r.serviceNameAr : r.serviceNameEn}</bdi> · <bdi className="text-ink-2">{locale === "ar" ? r.centerNameAr : r.centerNameEn}</bdi></p>
                <p className="text-ink-3">
                  {r.completedAt && formatDate(r.completedAt, locale)}
                  {r.mileageKm != null && <> · {formatKm(r.mileageKm, locale)}</>}
                  {r.finalAmountEgp != null && <> · <span className="tabular">{formatPrice(r.finalAmountEgp, locale)}</span></>}
                  {" · "}<Link href={`/${locale}/account/bookings/${r.reference}`} dir="ltr" className="tabular underline">{r.reference}</Link>
                </p>
                {r.workSummary && <p dir="auto" className="mt-1 text-ink-2">{r.workSummary}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
