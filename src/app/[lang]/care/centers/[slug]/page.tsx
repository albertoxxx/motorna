import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Globe, Mail, MapPin, Phone } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { publicCenterBySlug } from "@/server/care";
import { Notice } from "@/components/ui/states";
import { formatDate, formatPrice } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/care/centers/[slug]">): Promise<Metadata> {
  const { locale } = await resolveLocale(params);
  const { slug } = await params;
  const c = await publicCenterBySlug(slug);
  if (!c) return {};
  return { title: locale === "ar" ? c.nameAr : c.nameEn };
}

export default async function CenterPublicPage({ params }: PageProps<"/[lang]/care/centers/[slug]">) {
  const { locale, dict } = await resolveLocale(params);
  const { slug } = await params;
  const c = await publicCenterBySlug(slug);
  if (!c) notFound();
  const K = dict.care;
  const order = [6, 0, 1, 2, 3, 4, 5];
  return (
    <div className="container-page py-10">
      <p className="text-sm font-semibold text-brand-700">{K.name}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight"><bdi>{locale === "ar" ? c.nameAr : c.nameEn}</bdi></h1>
      <p className="mt-2 flex items-center gap-1.5 text-ink-2">
        <MapPin className="size-4 text-ink-3" aria-hidden />
        {locale === "ar" ? c.cityNameAr : c.cityNameEn}{c.area && <>، <bdi>{c.area}</bdi></>}
      </p>
      {c.approvedAt && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-sm font-medium text-success-700">
          <BadgeCheck className="size-4" aria-hidden />
          {K.approvedOn.replace("{date}", formatDate(c.approvedAt, locale))}
        </p>
      )}
      <p className="mt-2 max-w-2xl text-xs text-ink-3">{K.approvalMeaning}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-8">
          {c.description && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">{K.about}</h2>
              <p dir="auto" className="whitespace-pre-line leading-relaxed text-ink-2">{c.description}</p>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-lg font-semibold">{K.services}</h2>
            {c.services.length === 0 ? (
              <p className="text-ink-3">{K.noServices}</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
                {c.services.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                    <div>
                      <p className="font-medium"><bdi>{locale === "ar" ? s.nameAr : s.nameEn}</bdi></p>
                      <p className="text-sm text-ink-3">{K.enums.category[s.category]} · {K.durationMin.replace("{n}", String(s.durationMin))}</p>
                    </div>
                    <p className="tabular font-semibold text-navy-900">{s.priceMode === "fixed" && s.priceEgp != null ? formatPrice(s.priceEgp, locale) : K.onQuotation}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {c.quotationPolicy && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">{K.quotationPolicy}</h2>
              <p dir="auto" className="whitespace-pre-line text-ink-2">{c.quotationPolicy}</p>
            </section>
          )}
          {c.vehicleTypes.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">{K.vehicleTypes}</h2>
              <p className="text-ink-2">{c.vehicleTypes.map((t) => K.enums.vehicleType[t as keyof typeof K.enums.vehicleType] ?? t).join(locale === "ar" ? "، " : ", ")}</p>
            </section>
          )}
        </div>
        <aside className="flex flex-col gap-6">
          <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
            <h2 className="mb-3 font-semibold">{K.contact}</h2>
            <ul className="flex flex-col gap-2.5 text-sm">
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /><span dir="auto">{c.address}</span></li>
              <li className="flex items-center gap-2"><Phone className="size-4 text-ink-3" aria-hidden /><a href={`tel:${c.phone}`} className="ltr-run font-medium text-brand-700 hover:underline">{c.phone}</a></li>
              {c.email && <li className="flex items-center gap-2"><Mail className="size-4 text-ink-3" aria-hidden /><a href={`mailto:${c.email}`} className="ltr-run text-brand-700 hover:underline">{c.email}</a></li>}
              {c.website && <li className="flex items-center gap-2"><Globe className="size-4 text-ink-3" aria-hidden /><a href={c.website} rel="nofollow noopener" target="_blank" className="ltr-run truncate text-brand-700 hover:underline">{c.website.replace(/^https?:\/\//, "")}</a></li>}
            </ul>
            <Notice className="mt-4 text-sm">{K.bookingSoon}</Notice>
          </section>
          <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
            <h2 className="mb-3 font-semibold">{K.hours}</h2>
            {c.hours.length === 0 ? (
              <p className="text-sm text-ink-3">{K.noHours}</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {order.map((d) => {
                  const h = c.hours.find((x) => x.weekday === d);
                  return (
                    <div key={d} className="contents">
                      <dt className="text-ink-2">{K.enums.weekday[d]}</dt>
                      <dd className="tabular text-end" dir="ltr">{h ? `${h.opens}–${h.closes}` : <span className="text-ink-3">{K.closed}</span>}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
