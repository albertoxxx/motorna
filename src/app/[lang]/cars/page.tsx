import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { t } from "@/i18n/t";
import { getCurrentUser } from "@/server/session";
import { favoriteIds } from "@/server/queries";
import { getCities, getMakes, getModels, searchListings } from "@/server/listings";
import { activeFilterCount, parseSearchParams, toQueryString } from "@/lib/search-params";
import { ListingCard } from "@/components/listing-card";
import { FiltersDrawerButton, FiltersSidebar, SortSelect } from "@/components/filters";
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
  const saved = await favoriteIds(user?.id, result.items.map((i) => i.id));
  const filterProps = {
    locale,
    dict: { search: dict.search, enums: dict.enums, common: dict.common, nav: dict.nav },
    filters,
    makes,
    models,
    cities,
  };
  const make = makes.find((m) => m.slug === filters.make);
  const heading = make ? `${dict.search.title} — ${locale === "ar" ? make.nameAr : make.nameEn}` : dict.search.title;

  return (
    <div className="container-page py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-sm text-ink-3 tabular" aria-live="polite">
            {t(dict.search.resultsCount, { n: formatNumber(result.total, locale) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FiltersDrawerButton {...filterProps} activeCount={activeFilterCount(filters)} />
          <SortSelect locale={locale} filters={filters} dict={filterProps.dict} />
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <FiltersSidebar {...filterProps} />
        <div>
          {result.items.length ? (
            <>
              <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-3">
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
            <EmptyState
              icon={<SearchX className="size-8" />}
              title={dict.search.noResultsTitle}
              body={dict.search.noResultsBody}
              action={<ButtonLink href={`/${locale}/cars`} variant="secondary">{dict.search.clearFilters}</ButtonLink>}
            />
          )}
        </div>
      </div>
    </div>
  );
}
