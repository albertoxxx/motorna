import Link from "next/link";
import { X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { toQueryString, type SearchFilters } from "@/lib/search-params";
import { formatCompactPrice, formatKm } from "@/lib/format";

type Named = { slug: string; nameEn: string; nameAr: string };

/** One removable chip per active filter, plus "Clear all". Plain links: work without JS. */
export function FilterChips({
  locale,
  dict,
  filters,
  makes,
  models,
  cities,
}: {
  locale: Locale;
  dict: Dictionary;
  filters: SearchFilters;
  makes: (Named & { id: number })[];
  models: (Named & { makeId: number })[];
  cities: Named[];
}) {
  const S = dict.search;
  const name = (r?: Named) => (r ? (locale === "ar" ? r.nameAr : r.nameEn) : "");
  const make = makes.find((m) => m.slug === filters.make);
  const model = models.find((m) => m.slug === filters.model && m.makeId === make?.id);
  const price = (n: number) => formatCompactPrice(n, locale);

  const chips: { key: (keyof SearchFilters)[]; label: string }[] = [];
  if (filters.q) chips.push({ key: ["q"], label: `“${filters.q}”` });
  if (make) chips.push({ key: ["make", "model"], label: name(make) });
  if (model) chips.push({ key: ["model"], label: name(model) });
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    const label =
      filters.priceMin !== undefined && filters.priceMax !== undefined
        ? `${price(filters.priceMin)} – ${price(filters.priceMax)}`
        : filters.priceMax !== undefined
          ? `${S.chipUpTo} ${price(filters.priceMax)}`
          : `${S.chipFrom} ${price(filters.priceMin!)}`;
    chips.push({ key: ["priceMin", "priceMax"], label });
  }
  if (filters.yearMin !== undefined || filters.yearMax !== undefined) {
    const label =
      filters.yearMin !== undefined && filters.yearMax !== undefined
        ? `${filters.yearMin} – ${filters.yearMax}`
        : filters.yearMin !== undefined
          ? `${S.chipFrom} ${filters.yearMin}`
          : `${S.chipUpTo} ${filters.yearMax}`;
    chips.push({ key: ["yearMin", "yearMax"], label });
  }
  if (filters.mileageMin !== undefined || filters.mileageMax !== undefined) {
    const label =
      filters.mileageMin !== undefined && filters.mileageMax !== undefined
        ? `${formatKm(filters.mileageMin, locale)} – ${formatKm(filters.mileageMax, locale)}`
        : filters.mileageMax !== undefined
          ? `${S.chipUpTo} ${formatKm(filters.mileageMax, locale)}`
          : `${S.chipFrom} ${formatKm(filters.mileageMin!, locale)}`;
    chips.push({ key: ["mileageMin", "mileageMax"], label });
  }
  if (filters.condition) chips.push({ key: ["condition"], label: dict.enums.condition[filters.condition] });
  if (filters.transmission) chips.push({ key: ["transmission"], label: dict.enums.transmission[filters.transmission] });
  if (filters.fuel) chips.push({ key: ["fuel"], label: dict.enums.fuel[filters.fuel] });
  if (filters.body) chips.push({ key: ["body"], label: dict.enums.body[filters.body] });
  if (filters.city) chips.push({ key: ["city"], label: name(cities.find((c) => c.slug === filters.city)) });

  if (chips.length === 0) return null;
  const without = (keys: (keyof SearchFilters)[]) => {
    const next: Partial<SearchFilters> = { ...filters, page: 1 };
    for (const k of keys) delete next[k];
    return `/${locale}/cars${toQueryString(next)}`;
  };
  const clearAll = `/${locale}/cars${toQueryString({ sort: filters.sort })}`;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={S.activeFilters}>
      {chips.map((c) => (
        <Link
          key={c.key.join("-")}
          href={without(c.key)}
          scroll={false}
          aria-label={`${S.removeFilter}: ${c.label}`}
          className="tabular inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface py-1 pe-2 ps-3 text-sm text-ink hover:border-ink-3"
        >
          {c.label}
          <X className="size-3.5 text-ink-3" aria-hidden />
        </Link>
      ))}
      <Link href={clearAll} scroll={false} className="px-1 text-sm font-medium text-brand-700 hover:underline">
        {S.clearFilters}
      </Link>
    </div>
  );
}
