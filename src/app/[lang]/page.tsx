import Link from "next/link";
import { ShieldCheck, Flag, BanknoteX, ArrowUpRight } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { t } from "@/i18n/t";
import { getCurrentUser } from "@/server/session";
import { favoriteIds } from "@/server/queries";
import {
  budgetBandCounts,
  countPublished,
  getCities,
  getMakes,
  getModels,
  latestListings,
  popularMakesWithCounts,
} from "@/server/listings";
import { ListingCard, ListingGrid } from "@/components/listing-card";
import { SearchPanel } from "@/components/search-panel";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatCompactPrice, formatNumber } from "@/lib/format";

const BANDS: [number, number | null][] = [
  [0, 500_000],
  [500_000, 1_000_000],
  [1_000_000, 2_000_000],
  [2_000_000, null],
];

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { locale, dict } = await resolveLocale(params);
  const h = dict.home;
  const [user, latest, total, makes, models, cities, popular, bandCounts] = await Promise.all([
    getCurrentUser(),
    latestListings(8),
    countPublished(),
    getMakes(),
    getModels(),
    getCities(),
    popularMakesWithCounts(),
    budgetBandCounts(BANDS),
  ]);
  const saved = await favoriteIds(user?.id, latest.map((l) => l.id));
  const p = (s: string) => `/${locale}${s}`;
  const bandLabel = ([min, max]: [number, number | null]) =>
    min === 0
      ? `${h.budgetUnder} ${formatCompactPrice(max!, locale)}`
      : max === null
        ? `${h.budgetOver} ${formatCompactPrice(min, locale)}`
        : t(h.budgetBetween, { a: formatCompactPrice(min, locale), b: formatCompactPrice(max, locale) });
  const bandHref = ([min, max]: [number, number | null]) =>
    p(`/cars?${new URLSearchParams({ ...(min ? { priceMin: String(min) } : {}), ...(max ? { priceMax: String(max) } : {}) })}`);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-navy-900 text-white">
        <div className="container-page pb-28 pt-14 sm:pt-20 md:pb-32">
          <h1 className="max-w-3xl text-[2.6rem] font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-[3.6rem]">{h.heroTitle}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">{h.heroBody}</p>
        </div>
        <div className="container-page absolute inset-x-0 -bottom-24 md:-bottom-16">
          <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 text-ink shadow-[0_24px_48px_-24px_rgba(16,24,40,0.35)] sm:p-5">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-base font-semibold">{h.searchTitle}</h2>
              <p className="text-sm text-ink-3">
                <span className="tabular font-semibold text-ink">{formatNumber(total, locale)}</span> {h.searchCount}
              </p>
            </div>
            <SearchPanel
              locale={locale}
              makes={makes}
              models={models}
              cities={cities}
              labels={{ budget: h.budget, budgetMax: h.budgetMax, make: h.make, model: h.model, yearFrom: h.yearFrom, location: h.location, search: h.search, any: dict.common.any }}
            />
          </div>
        </div>
      </section>

      <div className="h-32 md:h-24" aria-hidden />

      {/* Latest */}
      <section className="container-page py-10" aria-labelledby="latest">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="latest" className="text-2xl font-bold">{h.featuredTitle}</h2>
          {latest.length > 0 && (
            <Link href={p("/cars")} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              {dict.common.seeAll}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          )}
        </div>
        {latest.length ? (
          <ListingGrid>
            {latest.map((item, i) => (
              <ListingCard key={item.id} item={item} locale={locale} dict={dict} saved={saved.has(item.id)} signedIn={!!user} priority={i < 4} />
            ))}
          </ListingGrid>
        ) : (
          <EmptyState title={h.featuredEmpty} action={<ButtonLink href={p("/sell")}>{h.sellerCta}</ButtonLink>} />
        )}
      </section>

      {/* Makes + budgets */}
      <section className="container-page grid gap-10 py-10 lg:grid-cols-[1.6fr_1fr]">
        <div aria-labelledby="makes">
          <h2 id="makes" className="mb-5 text-xl font-bold">{h.makesTitle}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {popular.map((m) => (
              <li key={m.slug}>
                <Link href={p(`/cars?make=${m.slug}`)} className="flex h-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3.5 hover:border-line-strong">
                  <span className="font-semibold">{locale === "ar" ? m.nameAr : m.nameEn}</span>
                  <span className="tabular text-sm text-ink-3">{formatNumber(m.count, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div aria-labelledby="budget">
          <h2 id="budget" className="mb-5 text-xl font-bold">{h.budgetTitle}</h2>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
            {BANDS.map((b, i) => (
              <li key={i}>
                <Link href={bandHref(b)} className="flex items-center justify-between px-4 py-4 hover:bg-canvas">
                  <span className="tabular font-medium">{bandLabel(b)}</span>
                  <span className="tabular text-sm text-ink-3">{formatNumber(bandCounts[i], locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works — a real sequence, so it is numbered */}
      <section className="container-page py-12" aria-labelledby="how">
        <h2 id="how" className="mb-8 text-2xl font-bold">{h.howTitle}</h2>
        <ol className="grid gap-8 md:grid-cols-3">
          {h.howSteps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="tabular grid size-9 shrink-0 place-items-center rounded-full border-2 border-navy-900 text-sm font-bold">{i + 1}</span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1.5 leading-relaxed text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust */}
      <section className="border-y border-line bg-surface" aria-labelledby="trust">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 id="trust" className="text-2xl font-bold">{h.trustTitle}</h2>
            <Link href={p("/verification")} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              {dict.nav.howItWorks}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </div>
          <ul className="grid gap-8 sm:grid-cols-3">
            {h.trustPoints.map((tp, i) => {
              const Icon = [ShieldCheck, Flag, BanknoteX][i];
              return (
                <li key={tp.title}>
                  <Icon className="mb-3 size-6 text-brand-600" aria-hidden />
                  <h3 className="font-semibold">{tp.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{tp.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Sell CTA */}
      <section className="container-page py-14">
        <div className="grid gap-6 rounded-[var(--radius-lg)] bg-brand-600 px-6 py-10 text-white sm:px-10 md:grid-cols-[2fr_auto] md:items-center">
          <div>
            <h2 className="text-2xl font-bold">{h.sellerTitle}</h2>
            <p className="mt-2 max-w-xl leading-relaxed text-white/85">{h.sellerBody}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={p("/sell")} variant="dark" size="lg">{h.sellerCta}</ButtonLink>
            <ButtonLink href={p("/cars")} size="lg" className="bg-white/10 text-white hover:bg-white/20">{h.buyerCta}</ButtonLink>
          </div>
        </div>
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-3">
          <span className="font-semibold text-ink-2">{h.comingNext}: </span>
          {h.comingNextBody}
        </p>
      </section>
    </>
  );
}
