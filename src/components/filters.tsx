"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatKm } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { SearchFilters } from "@/lib/search-params";
import { SORTS, toQueryString } from "@/lib/search-params";
import { BODIES, CONDITIONS, FUELS, TRANSMISSIONS } from "@/lib/validation";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { MakeOptions, type AvailableMake, type CityOption, type TaxonomyMake, type TaxonomyModel } from "./search-panel";

type Props = {
  locale: Locale;
  dict: Pick<Dictionary, "search" | "enums" | "common" | "nav">;
  filters: SearchFilters;
  makes: TaxonomyMake[];
  models: TaxonomyModel[];
  cities: CityOption[];
  available: AvailableMake[];
};

function FilterForm({ locale, dict, filters, makes, models, cities, available, onDone }: Props & { onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState<SearchFilters>(filters);
  const s = dict.search;
  const name = (r: { nameAr: string; nameEn: string }) => (locale === "ar" ? r.nameAr : r.nameEn);
  const makeId = makes.find((m) => m.slug === f.make)?.id;
  const makeModels = useMemo(() => models.filter((m) => m.makeId === makeId), [models, makeId]);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 40 }, (_, i) => thisYear + 1 - i);
  const kmLabel = (k: number) => formatKm(k, locale);
  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => setF((o) => ({ ...o, [k]: v }));
  const num = (v: string) => {
    const n = Number(v.replace(/[^\d]/g, ""));
    return v.trim() === "" || !Number.isFinite(n) ? undefined : n;
  };

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    start(() => {
      router.push(`/${locale}/cars${toQueryString({ ...f, page: 1 })}`);
      onDone?.();
    });
  }
  function clear() {
    start(() => {
      router.push(`/${locale}/cars`);
      onDone?.();
    });
  }

  const label = "flex flex-col gap-1.5 text-sm font-medium text-ink";
  return (
    <form onSubmit={apply} className="flex flex-col gap-4">
      <label className={label}>
        {s.keyword}
        <Input value={f.q ?? ""} onChange={(e) => set("q", e.target.value || undefined)} placeholder={s.keywordPlaceholder} maxLength={80} />
      </label>
      <label className={label}>
        {dict.search.city}
        <Select value={f.city ?? ""} onChange={(e) => set("city", e.target.value || undefined)}>
          <option value="">{dict.common.any}</option>
          {cities.map((c) => <option key={c.slug} value={c.slug}>{name(c)}</option>)}
        </Select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          {s.make}
          <Select value={f.make ?? ""} onChange={(e) => setF((o) => ({ ...o, make: e.target.value || undefined, model: undefined }))}>
            <option value="">{dict.common.any}</option>
            <MakeOptions makes={makes} available={available} name={name} labels={{ availableNow: s.availableNow, allMakes: s.allMakes }} />
          </Select>
        </label>
        <label className={label}>
          {s.model}
          <Select value={f.model ?? ""} onChange={(e) => set("model", e.target.value || undefined)} disabled={!f.make}>
            <option value="">{dict.common.any}</option>
            {makeModels.map((m) => <option key={m.slug} value={m.slug}>{name(m)}</option>)}
          </Select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          {s.priceMin}
          <Input inputMode="numeric" className="tabular" value={f.priceMin ?? ""} onChange={(e) => set("priceMin", num(e.target.value))} />
        </label>
        <label className={label}>
          {s.priceMax}
          <Input inputMode="numeric" className="tabular" value={f.priceMax ?? ""} onChange={(e) => set("priceMax", num(e.target.value))} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          {s.yearMin}
          <Select value={f.yearMin ?? ""} onChange={(e) => set("yearMin", num(e.target.value))}>
            <option value="">{dict.common.any}</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </label>
        <label className={label}>
          {s.yearMax}
          <Select value={f.yearMax ?? ""} onChange={(e) => set("yearMax", num(e.target.value))}>
            <option value="">{dict.common.any}</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          {s.mileageMin}
          <Select value={f.mileageMin ?? ""} onChange={(e) => set("mileageMin", num(e.target.value))}>
            <option value="">{dict.common.any}</option>
            {[0, 10_000, 30_000, 60_000, 100_000, 150_000].map((k) => (
              <option key={k} value={k}>{kmLabel(k)}</option>
            ))}
          </Select>
        </label>
        <label className={label}>
          {s.mileageMax}
          <Select value={f.mileageMax ?? ""} onChange={(e) => set("mileageMax", num(e.target.value))}>
            <option value="">{dict.common.any}</option>
            {[10_000, 30_000, 60_000, 100_000, 150_000, 200_000].map((k) => (
              <option key={k} value={k}>{kmLabel(k)}</option>
            ))}
          </Select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          {s.transmission}
          <Select value={f.transmission ?? ""} onChange={(e) => set("transmission", (e.target.value || undefined) as SearchFilters["transmission"])}>
            <option value="">{dict.common.any}</option>
            {TRANSMISSIONS.map((v) => <option key={v} value={v}>{dict.enums.transmission[v]}</option>)}
          </Select>
        </label>
        <label className={label}>
          {s.condition}
          <Select value={f.condition ?? ""} onChange={(e) => set("condition", (e.target.value || undefined) as SearchFilters["condition"])}>
            <option value="">{dict.common.any}</option>
            {CONDITIONS.map((v) => <option key={v} value={v}>{dict.enums.condition[v]}</option>)}
          </Select>
        </label>
        <label className={label}>
          {s.fuel}
          <Select value={f.fuel ?? ""} onChange={(e) => set("fuel", (e.target.value || undefined) as SearchFilters["fuel"])}>
            <option value="">{dict.common.any}</option>
            {FUELS.map((v) => <option key={v} value={v}>{dict.enums.fuel[v]}</option>)}
          </Select>
        </label>
        <label className={label}>
          {s.body}
          <Select value={f.body ?? ""} onChange={(e) => set("body", (e.target.value || undefined) as SearchFilters["body"])}>
            <option value="">{dict.common.any}</option>
            {BODIES.map((v) => <option key={v} value={v}>{dict.enums.body[v]}</option>)}
          </Select>
        </label>
      </div>
      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-surface px-4 py-3 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:pt-2">
        <Button type="submit" className="flex-1" loading={pending}>{s.showResults}</Button>
        <Button type="button" variant="ghost" onClick={clear}>{dict.common.clear}</Button>
      </div>
    </form>
  );
}

const OPEN_EVENT = "motorna:open-filters";

/**
 * One filter form for every screen size: inline sticky sidebar from 1024px,
 * full-screen drawer below it (opened by <FiltersButton>). Never rendered twice.
 */
export function FiltersPanel(props: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onOpen = () => {
      triggerRef.current = document.activeElement as HTMLElement;
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <aside aria-label={props.dict.search.filters} className={cn(open ? "fixed inset-0 z-50 flex flex-col bg-surface lg:static lg:z-auto lg:block lg:bg-transparent" : "hidden lg:block")}>
      <div
        ref={panelRef}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-labelledby={open ? "filters-title" : undefined}
        className={cn(open ? "flex h-full flex-col lg:block lg:h-auto" : "", "lg:sticky lg:top-20 lg:rounded-[var(--radius-lg)] lg:border lg:border-line lg:bg-surface lg:p-5")}
      >
        {open && (
          <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
            <h2 id="filters-title" className="text-lg font-semibold">{props.dict.search.filters}</h2>
            <button onClick={() => setOpen(false)} aria-label={props.dict.nav.close} className="rounded p-2 text-ink-3 hover:bg-canvas hover:text-ink">
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className={cn(open && "flex-1 overflow-y-auto px-4 py-4 lg:overflow-visible lg:p-0")}>
          <FilterForm key={JSON.stringify(props.filters)} {...props} onDone={() => setOpen(false)} />
        </div>
      </div>
    </aside>
  );
}

export function FiltersButton({ label, activeCount }: { label: string; activeCount: number }) {
  return (
    <Button variant="secondary" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className="lg:hidden" aria-haspopup="dialog">
      <SlidersHorizontal className="size-4" />
      {label}
      {activeCount > 0 && (
        <span className="tabular rounded-full bg-navy-900 px-1.5 text-xs text-white">
          <span className="sr-only">: </span>
          {activeCount}
        </span>
      )}
    </Button>
  );
}

export function SortSelect({ locale, filters, dict }: Pick<Props, "locale" | "filters" | "dict">) {
  const router = useRouter();
  return (
    <label className="flex flex-1 items-center gap-2 text-sm text-ink-2 sm:flex-none">
      <span className="hidden sm:inline">{dict.search.sort}</span>
      <Select
        className="h-10 w-full sm:w-auto sm:min-w-44"
        value={filters.sort}
        onChange={(e) => router.push(`/${locale}/cars${toQueryString({ ...filters, sort: e.target.value as SearchFilters["sort"], page: 1 })}`)}
        aria-label={dict.search.sort}
      >
        {SORTS.map((s) => <option key={s} value={s}>{dict.search.sortOptions[s]}</option>)}
      </Select>
    </label>
  );
}
