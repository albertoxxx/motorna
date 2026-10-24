import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Wrench } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { approvedCenters } from "@/server/care";
import { getCities } from "@/server/listings";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/states";
import { CARE_CATEGORIES, CENTER_CRITERIA } from "@/lib/care";
import { formatNumber } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/care">): Promise<Metadata> {
  const { locale, dict } = await resolveLocale(params);
  return { title: dict.care.title, description: dict.care.intro, alternates: { canonical: `/${locale}/care`, languages: { ar: "/ar/care", en: "/en/care" } } };
}

export default async function CarePage({ params, searchParams }: PageProps<"/[lang]/care">) {
  const { locale, dict } = await resolveLocale(params);
  const K = dict.care;
  const sp = await searchParams;
  const city = typeof sp.city === "string" && /^[a-z-]{2,40}$/.test(sp.city) ? sp.city : undefined;
  const category = typeof sp.category === "string" && (CARE_CATEGORIES as readonly string[]).includes(sp.category) ? sp.category : undefined;
  const [centers, cities] = await Promise.all([approvedCenters({ city, category }), getCities()]);
  const filtered = !!(city || category);
  const nm = (r: { nameAr: string; nameEn: string }) => (locale === "ar" ? r.nameAr : r.nameEn);

  return (
    <div className="container-page py-10">
      <p className="text-sm font-semibold text-brand-700">{K.name}</p>
      <h1 className="mt-1 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">{K.title}</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-ink-2">{K.intro}</p>
      <Notice className="mt-5 max-w-2xl">{K.bookingSoon}</Notice>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="dir">
          <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{K.filterCity}</span>
              <select name="city" defaultValue={city ?? ""} className="h-11 min-w-44 rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3">
                <option value="">{K.allCities}</option>
                {cities.map((c) => <option key={c.slug} value={c.slug}>{nm(c)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{K.filterCategory}</span>
              <select name="category" defaultValue={category ?? ""} className="h-11 min-w-44 rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3">
                <option value="">{K.allCategories}</option>
                {CARE_CATEGORIES.map((c) => <option key={c} value={c}>{K.enums.category[c]}</option>)}
              </select>
            </label>
            <button type="submit" className="h-11 rounded-[var(--radius-sm)] bg-navy-900 px-5 text-sm font-semibold text-white">{K.filterApply}</button>
          </form>
          <h2 id="dir" className="mb-4 text-sm text-ink-3" aria-live="polite">
            {centers.length === 1 ? K.countOne : K.count.replace("{n}", formatNumber(centers.length, locale))}
          </h2>
          {centers.length === 0 ? (
            <EmptyState
              icon={<Wrench className="size-8" aria-hidden />}
              title={filtered ? K.emptyFiltered : K.emptyTitle}
              body={filtered ? undefined : K.emptyBody}
              action={!filtered ? <ButtonLink href={`/${locale}/care/apply`}>{K.applyCta}</ButtonLink> : undefined}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {centers.map((c) => (
                <li key={c.id} className="relative flex flex-col gap-2 rounded-[var(--radius-lg)] border border-line bg-surface p-4 hover:border-line-strong">
                  <h3 className="font-semibold">
                    <Link href={`/${locale}/care/centers/${c.slug}`} className="after:absolute after:inset-0"><bdi>{nm(c)}</bdi></Link>
                  </h3>
                  <p className="flex items-center gap-1.5 text-sm text-ink-2">
                    <MapPin className="size-3.5 text-ink-3" aria-hidden />
                    {locale === "ar" ? c.cityNameAr : c.cityNameEn}{c.area && <>، <bdi>{c.area}</bdi></>}
                  </p>
                  {c.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.categories.slice(0, 4).map((k) => <Badge key={k}>{K.enums.category[k]}</Badge>)}
                      {c.categories.length > 4 && <Badge>+{c.categories.length - 4}</Badge>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="criteria" className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
            <h2 id="criteria" className="font-semibold">{K.criteriaTitle}</h2>
            <ul className="mt-3 flex flex-col gap-3 text-sm">
              {CENTER_CRITERIA.map((c) => (
                <li key={c}>
                  <p className="font-medium">{K.criteria[c].title}</p>
                  <p className="text-ink-2">{K.criteria[c].body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-ink-3">{K.approvalMeaning}</p>
          </section>
          {centers.length > 0 && (
            <div className="rounded-[var(--radius-lg)] bg-navy-900 p-5 text-white">
              <p className="font-semibold">{K.applyLead}</p>
              <Link href={`/${locale}/care/apply`} className="mt-2 inline-block text-sm font-medium underline">{K.applyCta}</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
