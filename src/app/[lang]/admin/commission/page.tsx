import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db, schema } from "@/db";
import { ledger } from "@/server/bookings";
import { Panel } from "@/components/care/booking-parts";
import { Notice } from "@/components/ui/states";
import { formatPrice } from "@/lib/format";

export default async function CommissionHome({ params }: PageProps<"/[lang]/admin/commission">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const C = dict.booking.commission;
  const centers = await db
    .select({ id: schema.serviceCenters.id, nameAr: schema.serviceCenters.nameAr, nameEn: schema.serviceCenters.nameEn, status: schema.serviceCenters.status, pilot: schema.centerBookingSettings.pilotEnabled })
    .from(schema.serviceCenters)
    .leftJoin(schema.centerBookingSettings, eq(schema.centerBookingSettings.centerId, schema.serviceCenters.id))
    .where(inArray(schema.serviceCenters.status, ["approved", "suspended", "revoked"]));
  const rows = await ledger();
  const due = (id: string) => rows.filter((r) => r.centerId === id && (r.status === "confirmed" || r.status === "payable")).reduce((a, r) => a + r.commissionEgp + r.adjustmentsEgp, 0);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{C.title}</h1>
      <p className="text-sm text-ink-2">{C.intro}</p>
      <Notice tone="warning"><p>{C.legalNote}</p></Notice>
      <Panel title={C.centers}>
        {centers.length === 0 ? <p className="text-sm text-ink-3">—</p> : (
          <ul className="divide-y divide-line text-sm">
            {centers.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/${locale}/admin/commission/${c.id}`} className="font-medium hover:underline"><bdi>{locale === "ar" ? c.nameAr : c.nameEn}</bdi></Link>
                <span className="text-ink-3">{c.pilot ? dict.booking.admin.pilot : dict.booking.admin.pilotOffState} · <span className="tabular">{formatPrice(due(c.id), locale)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
