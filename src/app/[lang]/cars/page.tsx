import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { t } from "@/i18n/t";
import { getCurrentUser } from "@/server/session";
import { favoriteIds } from "@/server/queries";
import { getCities, getMakes, getModels, latestListings, searchListings } from "@/server/listings";
import { activeFilterCount, PAGE_SIZE, parseSearchParams, toQueryString } from "@/lib/search-params";
import { ListingCard } from "@/components/listing-card";
import { FiltersButton, FiltersPanel, SortSelect } from "@/components/filters";
import { FilterChips } from "@/components/filter-chips";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/cars">): Promise<Metadata> {
  const { dict, locale } = await resolveLocale(params);
  const f = parseSearchParams(await searchParams);
  const hasFilters = activeFilterCount(f) > 0 || f.page > 1;
  return {
    title: dict.search.title,
    alternates: { canonical: `/${locale}/cars`, languages: { ar: "/ar/cars", en: "/en/cars" } },
    // Filtered permutations shouldn't compete with the canonical browse page.
    robots: hasFilters ? { index: false, follow: true } : undefined,
  };
}

export default async function CarsPage({ params, searchParams }: PageProps<"/[lang]/cars">) {
  const { locale, dict } = await resolveLocale(params);
  const filters = parseSearchParams(await searchParams);
  const [user, result, makes, models, cities] = await Promise.all([
    getCurrentUser(),
    searchListings(filters),
    getMakes(),
    getModels(),
    getCities(),
  ]);
  const noMatches = result.items.length === 0;
  // When nothing matches, show the newest real listings so the page is still useful.
  const fallback = noMatches && activeFilterCount(filters) > 0 ? await latestListings(6) : [];
  const saved = await favoriteIds(user?.id, [...result.items, ...fallback].map((i) => i.id));
  const filterProps = {
    locale,
    dict: { search: dict.search, enums: dict.enums, common: dict.common, nav: dict.nav },
    filters,
    makes,
    models,
    cities,
  };
  const chipProps = { locale, dict, filters, makes, models, cities };
  const make = makes.find((m) => m.slug === filters.make);
  const heading = make ? `${dict.search.title} — ${locale === "ar" ? make.nameAr : make.nameEn}` : dict.search.title;
  const from = (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.page * PAGE_SIZE, result.total);

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{heading}</h1>
          <p className="tabular mt-1 text-sm text-ink-3" aria-live="polite">
            {result.total > PAGE_SIZE
              ? t(dict.search.resultsRange, { from: formatNumber(from, locale), to: formatNumber(to, locale), n: formatNumber(result.total, locale) })
              : t(dict.search.resultsCount, { n: formatNumber(result.total, locale) })}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <FiltersButton label={dict.search.filters} activeCount={activeFilterCount(filters)} />
          <SortSelect locale={locale} filters={filters} dict={filterProps.dict} />
        </div>
      </div>
      <div className="mb-5">
        <FilterChips {...chipProps} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <FiltersPanel {...filterProps} />
        <div className="min-w-0">
          {!noMatches ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {result.items.map((item, i) => (
                  <ListingCard key={item.id} item={item} locale={locale} dict={dict} saved={saved.has(item.id)} signedIn={!!user} priority={i < 3} />
                ))}
              </div>
              <Pagination
                page={result.page}
                pageCount={result.pageCount}
                dict={dict}
                hrefFor={(p) => `/${locale}/cars${toQueryString({ ...filters, page: p })}`}
              />
            </>
          ) : (
            <div className="flex flex-col gap-10">
              <EmptyState
                icon={<SearchX className="size-8" />}
                title={dict.search.noResultsTitle}
                body={dict.search.noResultsBody}
                action={
                  activeFilterCount(filters) > 0 ? (
                    <div className="flex flex-col items-start gap-3 sm:items-center">
                      <p className="text-sm font-medium text-ink-2">{dict.search.noResultsTry}</p>
                      <FilterChips {...chipProps} />
                    </div>
                  ) : (
                    <ButtonLink href={`/${locale}/sell`}>{dict.home.sellerCta}</ButtonLink>
                  )
                }
              />
              {fallback.length > 0 && (
                <section aria-labelledby="fallback">
                  <h2 id="fallback" className="mb-4 text-lg font-bold">{dict.search.noResultsLatest}</h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                    {fallback.map((item) => (
                      <ListingCard key={item.id} item={item} locale={locale} dict={dict} saved={saved.has(item.id)} signedIn={!!user} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
