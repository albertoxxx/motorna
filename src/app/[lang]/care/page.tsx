import type { Metadata } from "next";
import Link from "next/link";
import { Check, FileCheck2, Search, ShieldCheck, Wrench } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { approvedCenters, centersForUser, directoryAreas } from "@/server/care";
import { getCurrentUser } from "@/server/session";
import { getCities } from "@/server/listings";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { CenterCard } from "@/components/care/center-card";
import { CARE_CATEGORIES, CENTER_CRITERIA, DIRECTORY_PAGE_SIZE, DIRECTORY_SORTS, OPEN_APPLICATION, type DirectorySort } from "@/lib/care";
import { formatNumber } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/care">): Promise<Metadata> {
  const { locale, dict } = await resolveLocale(params);
  return { title: dict.care.title, description: dict.care.intro, alternates: { canonical: `/${locale}/care`, languages: { ar: "/ar/care", en: "/en/care" } } };
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const selectCls = "h-11 w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25";

export default async function CarePage({ params, searchParams }: PageProps<"/[lang]/care">) {
  const { locale, dict } = await resolveLocale(params);
  const K = dict.care;
  const sp = await searchParams;
  const cityRaw = one(sp.city);
  const city = cityRaw && /^[a-z-]{2,40}$/.test(cityRaw) ? cityRaw : undefined;
  const areaRaw = one(sp.area)?.trim();
  const area = areaRaw && areaRaw.length <= 80 ? areaRaw : undefined;
  const catRaw = one(sp.category);
  const category = catRaw && (CARE_CATEGORIES as readonly string[]).includes(catRaw) ? catRaw : undefined;
  const sortRaw = one(sp.sort);
  const sort: DirectorySort = DIRECTORY_SORTS.includes(sortRaw as DirectorySort) ? (sortRaw as DirectorySort) : "name";
  const pageNum = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);

  const user = await getCurrentUser();
  const [result, cities, areas, mine] = await Promise.all([
    approvedCenters({ city, area, category, sort, page: pageNum }),
    getCities(),
    directoryAreas(city),
    user ? centersForUser(user.id) : Promise.resolve([]),
  ]);
  const myApp = mine.find((c) => c.role === "owner" && (OPEN_APPLICATION as readonly string[]).includes(c.status)) ?? mine[0];
  const filtered = !!(city || area || category);
  const nm = (r: { nameAr: string; nameEn: string }) => (locale === "ar" ? r.nameAr : r.nameEn);
  const qs = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const all = { city, area, category, sort: sort === "name" ? undefined : sort, ...over };
    for (const [k, v] of Object.entries(all)) if (v) q.set(k, v);
    const s = q.toString();
    return `/${locale}/care${s ? `?${s}` : ""}`;
  };
  const from = (result.page - 1) * DIRECTORY_PAGE_SIZE + 1;
  const to = from + result.items.length - 1;
  const partnerHref = myApp ? `/${locale}/center/${myApp.slug}` : `/${locale}/care/apply`;

  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="container-page pb-10 pt-10 sm:pt-14">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70">
            <Wrench className="size-4" aria-hidden />
            {K.name}
          </p>
          <h1 className="mt-2 max-w-3xl text-[2rem] font-bold leading-[1.15] tracking-tight sm:text-5xl">{K.title}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-white/70 sm:text-lg">{K.intro}</p>

          <form method="get" action={`/${locale}/care`} className="mt-8 grid grid-cols-2 gap-3 rounded-[var(--radius-lg)] bg-surface p-4 text-ink shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)] sm:p-5 lg:grid-cols-[1fr_1fr_1fr_0.8fr_auto]">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{K.filters.city}</span>
              <select name="city" defaultValue={city ?? ""} className={selectCls}>
                <option value="">{K.filters.allCities}</option>
                {cities.map((c) => <option key={c.slug} value={c.slug}>{nm(c)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{K.filters.area}</span>
              <select name="area" defaultValue={area ?? ""} className={selectCls} disabled={areas.length === 0 && !area}>
                <option value="">{K.filters.allAreas}</option>
                {area && !areas.includes(area) && <option value={area}>{area}</option>}
                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{K.filters.category}</span>
              <select name="category" defaultValue={category ?? ""} className={selectCls}>
                <option value="">{K.filters.allCategories}</option>
                {CARE_CATEGORIES.map((c) => <option key={c} value={c}>{K.enums.category[c]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{K.filters.sort}</span>
              <select name="sort" defaultValue={sort} className={selectCls}>
                <option value="name">{K.filters.sortName}</option>
                <option value="recent">{K.filters.sortRecent}</option>
              </select>
            </label>
            <div className="col-span-2 flex items-end gap-2 lg:col-span-1">
              <button type="submit" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 lg:flex-none">
                <Search className="size-4" aria-hidden />
                {K.filters.apply}
              </button>
            </div>
          </form>
          {filtered && (
            <Link href={`/${locale}/care`} className="mt-3 inline-block text-sm font-medium text-white/80 underline hover:text-white">{K.filters.clear}</Link>
          )}
        </div>
      </section>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_21rem]">
        <section aria-labelledby="results" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="results" className="text-xl font-bold">
              {result.total === 1 ? K.countOne : K.count.replace("{n}", formatNumber(result.total, locale))}
            </h2>
            {result.pages > 1 && (
              <p className="text-sm text-ink-3">
                {K.countOf.replace("{from}", formatNumber(from, locale)).replace("{to}", formatNumber(to, locale)).replace("{n}", formatNumber(result.total, locale))}
              </p>
            )}
          </div>
          <p className="mb-5 text-sm text-ink-3">{K.bookingSoon}</p>

          {result.total === 0 && !filtered ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface p-6 sm:p-8">
              <ShieldCheck className="size-8 text-brand-600" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">{K.emptyTitle}</h3>
              <p className="mt-2 max-w-xl leading-relaxed text-ink-2">{K.emptyBody}</p>
              <p className="mt-5 text-sm font-semibold">{K.emptyPreviewTitle}</p>
              <ul className="mt-2 flex flex-col gap-2 text-sm text-ink-2">
                {K.emptyPreview.map((t) => (
                  <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success-700" aria-hidden />{t}</li>
                ))}
              </ul>
              <ButtonLink href={partnerHref} className="mt-6">{myApp ? K.myApplication : K.applyCta}</ButtonLink>
            </div>
          ) : result.total === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface p-6 sm:p-8">
              <h3 className="text-lg font-semibold">{K.emptyFiltered}</h3>
              <p className="mt-2 text-ink-2">{K.emptyFilteredBody}</p>
              <ButtonLink href={`/${locale}/care`} variant="secondary" className="mt-5">{K.filters.clear}</ButtonLink>
            </div>
          ) : (
            <>
              <ul className="grid gap-4 sm:grid-cols-2">
                {result.items.map((c) => (
                  <li key={c.id}><CenterCard c={c} locale={locale} K={K} /></li>
                ))}
              </ul>
              <Pagination page={result.page} pageCount={result.pages} hrefFor={(p) => qs({ page: p > 1 ? String(p) : undefined })} dict={dict} />
            </>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="partner" className="rounded-[var(--radius-lg)] bg-brand-600 p-6 text-white">
            <h2 id="partner" className="text-lg font-bold">{K.partnerTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/85">{K.partnerBody}</p>
            <ul className="mt-4 flex flex-col gap-1.5 text-sm">
              {K.partnerPoints.map((t) => <li key={t} className="flex items-center gap-2"><Check className="size-4 shrink-0" aria-hidden />{t}</li>)}
            </ul>
            <ButtonLink href={partnerHref} variant="dark" className="mt-5 w-full">{myApp ? K.myApplication : K.applyCta}</ButtonLink>
          </section>

          <section aria-labelledby="how" className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
            <h2 id="how" className="font-semibold">{K.howTitle}</h2>
            <ol className="mt-4 flex flex-col gap-4">
              {K.howSteps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="tabular grid size-7 shrink-0 place-items-center rounded-full border-2 border-navy-900 text-xs font-bold" aria-hidden>{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-sm text-ink-2">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="criteria" className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
            <h2 id="criteria" className="flex items-center gap-2 font-semibold"><FileCheck2 className="size-4 text-brand-600" aria-hidden />{K.criteriaTitle}</h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm">
              {CENTER_CRITERIA.map((c) => (
                <li key={c}>
                  <p className="font-medium">{K.criteria[c].title}</p>
                  <p className="text-ink-2">{K.criteria[c].body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">{K.approvalMeaning}</p>
          </section>
        </aside>
      </div>
    </>
  );
}
