import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Check, ClipboardCheck, Search, ShieldCheck, Store, Wrench } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { approvedCenters, centersForUser, directoryAreas, directoryMakes, providerCounts } from "@/server/care";
import { getCurrentUser } from "@/server/session";
import { getCities } from "@/server/listings";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { CenterCard } from "@/components/care/center-card";
import { CARE_CATEGORIES, DIRECTORY_PAGE_SIZE, DIRECTORY_SORTS, OPEN_APPLICATION, PROVIDER_CATEGORIES, type DirectorySort, type ProviderCategory } from "@/lib/care";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

export async function generateMetadata({ params }: PageProps<"/[lang]/care">): Promise<Metadata> {
  const { locale, dict } = await resolveLocale(params);
  return { title: dict.care.title, description: dict.care.intro, alternates: { canonical: `/${locale}/care`, languages: { ar: "/ar/care", en: "/en/care" } } };
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const selectCls = "h-11 w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25";
const PROVIDER_ICONS = { authorized_service: BadgeCheck, independent_workshop: Wrench, inspection_center: ClipboardCheck } as const;

export default async function CarePage({ params, searchParams }: PageProps<"/[lang]/care">) {
  const { locale, dict } = await resolveLocale(params);
  const K = dict.care;
  const sp = await searchParams;
  const qRaw = one(sp.q)?.trim();
  const q = qRaw && qRaw.length <= 80 ? qRaw : undefined;
  const cityRaw = one(sp.city);
  const city = cityRaw && /^[a-z-]{2,40}$/.test(cityRaw) ? cityRaw : undefined;
  const areaRaw = one(sp.area)?.trim();
  const area = areaRaw && areaRaw.length <= 80 ? areaRaw : undefined;
  const provRaw = one(sp.provider);
  const provider = PROVIDER_CATEGORIES.includes(provRaw as ProviderCategory) ? (provRaw as ProviderCategory) : undefined;
  const svcRaw = one(sp.service) ?? one(sp.category); // "category" kept for old links
  const service = svcRaw && (CARE_CATEGORIES as readonly string[]).includes(svcRaw) ? svcRaw : undefined;
  const makeRaw = one(sp.make);
  const make = makeRaw && /^[a-z0-9-]{1,40}$/.test(makeRaw) ? makeRaw : undefined;
  const sortRaw = one(sp.sort);
  const sort: DirectorySort = DIRECTORY_SORTS.includes(sortRaw as DirectorySort) ? (sortRaw as DirectorySort) : "name";
  const pageNum = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);

  const user = await getCurrentUser();
  const [result, cities, areas, makes, counts, mine] = await Promise.all([
    approvedCenters({ q, city, area, provider, category: service, make, sort, page: pageNum }),
    getCities(),
    directoryAreas(city),
    directoryMakes(),
    providerCounts(),
    user ? centersForUser(user.id) : Promise.resolve([]),
  ]);
  const myApp = mine.find((c) => c.role === "owner" && (OPEN_APPLICATION as readonly string[]).includes(c.status)) ?? mine[0];
  const filtered = !!(q || city || area || provider || service || make);
  const anyApproved = Object.values(counts).some((n) => (n ?? 0) > 0);
  const nm = (r: { nameAr: string; nameEn: string }) => (locale === "ar" ? r.nameAr : r.nameEn);
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { q, city, area, provider, service, make, sort: sort === "name" ? undefined : sort, ...over };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    const str = p.toString();
    return `/${locale}/care${str ? `?${str}` : ""}`;
  };
  const from = (result.page - 1) * DIRECTORY_PAGE_SIZE + 1;
  const to = from + result.items.length - 1;
  const partnerHref = myApp ? `/${locale}/center/${myApp.slug}` : `/${locale}/care/apply`;
  const totalApproved = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="container-page pb-8 pt-10 sm:pt-14">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70"><Wrench className="size-4" aria-hidden />{K.name}</p>
          <h1 className="mt-2 max-w-3xl text-[2rem] font-bold leading-[1.15] tracking-tight sm:text-5xl">{K.title}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-white/70 sm:text-lg">{K.intro}</p>

          <form method="get" action={`/${locale}/care`} role="search" className="mt-8 grid grid-cols-2 gap-3 rounded-[var(--radius-lg)] bg-surface p-4 text-ink shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)] sm:p-5 lg:grid-cols-4">
            <label className="col-span-2 flex flex-col gap-1.5 text-sm lg:col-span-4">
              <span className="font-medium">{K.filters.q}</span>
              <span className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <input type="search" name="q" defaultValue={q ?? ""} placeholder={K.filters.qPlaceholder} maxLength={80} className={cn(selectCls, "ps-9")} />
              </span>
            </label>
            {provider === undefined ? null : <input type="hidden" name="provider" value={provider} />}
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
              <select name="service" defaultValue={service ?? ""} className={selectCls}>
                <option value="">{K.filters.allCategories}</option>
                {CARE_CATEGORIES.map((c) => <option key={c} value={c}>{K.enums.category[c]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{K.filters.make}</span>
              <select name="make" defaultValue={make ?? ""} className={selectCls} disabled={makes.length === 0 && !make}>
                <option value="">{K.filters.allMakes}</option>
                {makes.map((m) => <option key={m.slug} value={m.slug}>{nm(m)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm lg:col-span-2">
              <span className="font-medium">{K.filters.sort}</span>
              <select name="sort" defaultValue={sort} className={selectCls}>
                <option value="name">{K.filters.sortName}</option>
                <option value="recent">{K.filters.sortRecent}</option>
              </select>
            </label>
            <div className="col-span-2 flex items-end">
              <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
                <Search className="size-4" aria-hidden />{K.filters.apply}
              </button>
            </div>
          </form>
          {filtered && <Link href={`/${locale}/care`} className="mt-3 inline-block text-sm font-medium text-white/80 underline hover:text-white">{K.filters.clear}</Link>}
        </div>
      </section>

      <div className="container-page py-8">
        <nav aria-label={K.filters.provider} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[undefined, ...PROVIDER_CATEGORIES].map((pc) => {
            const active = pc === provider;
            const n = pc ? counts[pc] ?? 0 : totalApproved;
            return (
              <Link key={pc ?? "all"} href={qs({ provider: pc, page: undefined })} aria-current={active ? "page" : undefined}
                className={cn("inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium", active ? "bg-navy-900 text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:ring-line-strong")}>
                {pc ? K.providers[pc].name : K.filters.allProviders}
                <span className={cn("tabular rounded-full px-1.5 text-xs", active ? "bg-white/20" : "bg-navy-900/[0.06]")}>{formatNumber(n, locale)}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="container-page grid gap-10 pb-12 lg:grid-cols-[1fr_21rem]">
        <section aria-labelledby="results" className="min-w-0">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="results" className="text-xl font-bold">{result.total === 1 ? K.countOne : K.count.replace("{n}", formatNumber(result.total, locale))}</h2>
            {result.pages > 1 && (
              <p className="text-sm text-ink-3">{K.countOf.replace("{from}", formatNumber(from, locale)).replace("{to}", formatNumber(to, locale)).replace("{n}", formatNumber(result.total, locale))}</p>
            )}
          </div>
          <p className="mb-5 text-sm text-ink-3">{K.detail.bookingNow}</p>

          {result.total === 0 && !anyApproved ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface p-6 sm:p-8">
              <ShieldCheck className="size-8 text-brand-600" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">{K.emptyTitle}</h3>
              <p className="mt-2 max-w-xl leading-relaxed text-ink-2">{K.emptyBody}</p>
              <p className="mt-5 text-sm font-semibold">{K.emptyPreviewTitle}</p>
              <ul className="mt-2 flex flex-col gap-2 text-sm text-ink-2">
                {K.emptyPreview.map((t) => <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success-700" aria-hidden />{t}</li>)}
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
                {result.items.map((c) => <li key={c.id}><CenterCard c={c} locale={locale} K={K} /></li>)}
              </ul>
              <Pagination page={result.page} pageCount={result.pages} hrefFor={(p) => qs({ page: p > 1 ? String(p) : undefined })} dict={dict} />
            </>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="partner" className="rounded-[var(--radius-lg)] bg-brand-600 p-6 text-white">
            <Store className="size-6" aria-hidden />
            <h2 id="partner" className="mt-2 text-lg font-bold">{K.partnerTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/85">{K.partnerBody}</p>
            <ul className="mt-4 flex flex-col gap-1.5 text-sm">
              {K.partnerPoints.map((t) => <li key={t} className="flex items-center gap-2"><Check className="size-4 shrink-0" aria-hidden />{t}</li>)}
            </ul>
            <ButtonLink href={partnerHref} variant="dark" className="mt-5 w-full">{myApp ? K.myApplication : K.applyCta}</ButtonLink>
          </section>

          <section aria-labelledby="verify" className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
            <h2 id="verify" className="font-semibold">{K.criteriaTitle}</h2>
            <ul className="mt-4 flex flex-col gap-4">
              {PROVIDER_CATEGORIES.map((pc) => {
                const Icon = PROVIDER_ICONS[pc];
                return (
                  <li key={pc} className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><Icon className="size-4" aria-hidden /></span>
                    <div>
                      <p className="text-sm font-semibold">{K.providers[pc].name}</p>
                      <p className="text-sm text-ink-2">{K.verification[pc].body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">{K.verification.separate} {K.approvalMeaning}</p>
          </section>

          <section aria-labelledby="how" className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
            <h2 id="how" className="font-semibold">{K.howTitle}</h2>
            <ol className="mt-4 flex flex-col gap-4">
              {K.howSteps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="tabular grid size-7 shrink-0 place-items-center rounded-full border-2 border-navy-900 text-xs font-bold" aria-hidden>{i + 1}</span>
                  <div><p className="text-sm font-medium">{s.title}</p><p className="text-sm text-ink-2">{s.body}</p></div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
