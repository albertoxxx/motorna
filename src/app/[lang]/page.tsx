import Link from "next/link";
import { ShieldCheck, Flag, BanknoteX, ArrowUpRight, Plus, Sparkles, Wrench } from "lucide-react";
import { features } from "@/lib/features";
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
  priceReducedListings,
  makesWithListings,
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

/** Below this many published cars, the home page says plainly that inventory is still small. */
const EARLY_DAYS_THRESHOLD = 12;

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { locale, dict } = await resolveLocale(params);
  const h = dict.home;
  const [user, latest, total, makes, models, cities, popular, bandCounts, reduced] = await Promise.all([
    getCurrentUser(),
    latestListings(8),
    countPublished(),
    getMakes(),
    getModels(),
    getCities(),
    popularMakesWithCounts(),
    budgetBandCounts(BANDS),
    priceReducedListings(4),
  ]);
  const saved = await favoriteIds(user?.id, [...latest, ...reduced.map((r) => r.item)].map((l) => l.id));
  // A category list with a single entry only repeats the one card above it, so each
  // list needs at least two non-empty entries before it is shown.
  const makesWithCars = popular.filter((m) => m.count > 0);
  const bandsWithCars = BANDS.map((band, i) => ({ band, count: bandCounts[i] })).filter((b) => b.count > 0);
  const showMakes = makesWithCars.length >= 2;
  const showBands = bandsWithCars.length >= 2;
  const earlyDays = total > 0 && total < EARLY_DAYS_THRESHOLD;
  // Makes that actually have listings, most first (quick links + "available now" in the make picker).
  const available = await makesWithListings();
  const quickMakes = available.slice(0, 6);
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
      {/* Hero: search is the focal point and sits in normal flow, so nothing overlaps on phones. */}
      <section className="bg-navy-900 text-white">
        <div className="container-page pb-10 pt-10 sm:pb-14 sm:pt-16">
          <h1 className="max-w-3xl text-[2.25rem] font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-[3.4rem]">{h.heroTitle}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">{h.heroBody}</p>

          <div className="mt-8 rounded-[var(--radius-lg)] bg-surface p-4 text-ink shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)] sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-lg font-semibold">{h.searchTitle}</h2>
              <p className="text-sm text-ink-3" aria-live="polite">
                <span className="tabular font-semibold text-ink">{formatNumber(total, locale)}</span> {total === 1 ? h.searchCountOne : h.searchCount}
              </p>
            </div>
            <SearchPanel
              locale={locale}
              makes={makes}
              models={models}
              cities={cities}
              available={available}
              labels={{ budget: h.budget, budgetMax: h.budgetMax, make: h.make, model: h.model, yearFrom: h.yearFrom, location: h.location, search: h.search, any: dict.common.any, availableNow: dict.search.availableNow, allMakes: dict.search.allMakes }}
            />
            {features.assistant && (
              <Link href={p("/assistant")} className="mt-4 flex items-center gap-3 rounded-[var(--radius-md)] border border-brand-600/25 bg-brand-50 px-4 py-3 text-sm font-medium text-navy-800 hover:border-brand-600/50">
                <Sparkles className="size-4 text-brand-600" aria-hidden />
                {h.assistantCta}
              </Link>
            )}
          </div>

          <nav aria-label={h.makesTitle} className="mt-5 flex flex-wrap items-center gap-2">
            {quickMakes.map((m) => (
              <Link key={m.slug} href={p(`/cars?make=${m.slug}`)} className="rounded-full border border-white/20 px-3.5 py-1.5 text-sm text-white/85 hover:border-white/50 hover:text-white">
                {locale === "ar" ? m.nameAr : m.nameEn}
              </Link>
            ))}
            <Link href={p("/sell")} className="ms-auto inline-flex items-center gap-1.5 text-sm font-medium text-white hover:underline">
              <Plus className="size-4" aria-hidden />
              {h.heroSellLink}
            </Link>
          </nav>
        </div>
      </section>

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

      {/* Small inventory: say so honestly instead of padding the page. */}
      {earlyDays && (
        <section className="container-page pb-4" aria-labelledby="early">
          <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 id="early" className="text-lg font-semibold">{h.earlyTitle}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">
                {t(h.earlyBody, { n: total === 1 ? h.earlyCountOne : t(h.earlyCount, { n: formatNumber(total, locale) }) })}
              </p>
            </div>
            <ButtonLink href={p("/sell")} className="shrink-0">{h.sellerCta}</ButtonLink>
          </div>
        </section>
      )}

      {/* Recently reduced: only listings whose price actually dropped (from price history). */}
      {reduced.length > 0 && (
        <section className="container-page py-10" aria-labelledby="reduced">
          <h2 id="reduced" className="mb-6 text-2xl font-bold">{h.reducedTitle}</h2>
          <ListingGrid>
            {reduced.map(({ item, previousPrice }) => (
              <ListingCard key={item.id} item={item} previousPrice={previousPrice} locale={locale} dict={dict} saved={saved.has(item.id)} signedIn={!!user} />
            ))}
          </ListingGrid>
        </section>
      )}

      {/* Makes + budgets: only categories that currently have cars. */}
      {(showMakes || showBands) && (
        <section className="container-page grid gap-10 py-10 lg:grid-cols-[1.6fr_1fr]">
          {showMakes && (
            <div aria-labelledby="makes">
              <h2 id="makes" className="mb-5 text-xl font-bold">{h.makesTitle}</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {makesWithCars.map((m) => (
                  <li key={m.slug}>
                    <Link
                      href={p(`/cars?make=${m.slug}`)}
                      aria-label={`${locale === "ar" ? m.nameAr : m.nameEn}: ${t(h.carsCount, { n: formatNumber(m.count, locale) })}`}
                      className="flex h-full min-h-12 items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 hover:border-line-strong"
                    >
                      <span className="font-semibold">{locale === "ar" ? m.nameAr : m.nameEn}</span>
                      <span className="tabular rounded-full bg-navy-900/[0.06] px-2 py-0.5 text-xs text-ink-2" aria-hidden>
                        {formatNumber(m.count, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={p("/cars")} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">{h.allMakesLink}</Link>
            </div>
          )}
          {showBands && (
            <div aria-labelledby="budget">
              <h2 id="budget" className="mb-5 text-xl font-bold">{h.budgetTitle}</h2>
              <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
                {bandsWithCars.map(({ band, count }, i) => (
                  <li key={i}>
                    <Link
                      href={bandHref(band)}
                      aria-label={`${bandLabel(band)}: ${t(h.carsCount, { n: formatNumber(count, locale) })}`}
                      className="flex min-h-12 items-center justify-between px-4 py-3.5 hover:bg-canvas"
                    >
                      <span className="tabular font-medium">{bandLabel(band)}</span>
                      <span className="tabular rounded-full bg-navy-900/[0.06] px-2 py-0.5 text-xs text-ink-2" aria-hidden>
                        {formatNumber(count, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* How it works — a real sequence, so it is numbered */}
      <section className="container-page py-12" aria-labelledby="how">
        <h2 id="how" className="mb-8 text-2xl font-bold">{h.howTitle}</h2>
        <ol className="grid gap-8 md:grid-cols-3">
          {h.howSteps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="tabular grid size-9 shrink-0 place-items-center rounded-full border-2 border-navy-900 text-sm font-bold" aria-hidden>{i + 1}</span>
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
        {/* Workshops and inspection centers: entry point to the MOTORNA Care application. */}
        <div className="mt-4 flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><Wrench className="size-5" aria-hidden /></span>
            <div>
              <h2 className="font-semibold">{h.careTitle}</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-2">{h.careBody}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ButtonLink href={p("/care/apply")} variant="secondary">{h.careCta}</ButtonLink>
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
