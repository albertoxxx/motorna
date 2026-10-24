"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { SearchFilters } from "@/lib/search-params";
import { SORTS, toQueryString } from "@/lib/search-params";
import { BODIES, CONDITIONS, FUELS, TRANSMISSIONS } from "@/lib/validation";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { CityOption, TaxonomyMake, TaxonomyModel } from "./search-panel";

type Props = {
  locale: Locale;
  dict: Pick<Dictionary, "search" | "enums" | "common" | "nav">;
  filters: SearchFilters;
  makes: TaxonomyMake[];
  models: TaxonomyModel[];
  cities: CityOption[];
};

function FilterForm({ locale, dict, filters, makes, models, cities, onDone }: Props & { onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState<SearchFilters>(filters);
  const s = dict.search;
  const name = (r: { nameAr: string; nameEn: string }) => (locale === "ar" ? r.nameAr : r.nameEn);
  const makeId = makes.find((m) => m.slug === f.make)?.id;
  const makeModels = useMemo(() => models.filter((m) => m.makeId === makeId), [models, makeId]);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 40 }, (_, i) => thisYear + 1 - i);
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
            {makes.map((m) => <option key={m.slug} value={m.slug}>{name(m)}</option>)}
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
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">{s.priceMin} / {s.priceMax}</legend>
        <label className={label}>
          {s.priceMin}
          <Input inputMode="numeric" className="tabular" value={f.priceMin ?? ""} onChange={(e) => set("priceMin", num(e.target.value))} />
        </label>
        <label className={label}>
          {s.priceMax}
          <Input inputMode="numeric" className="tabular" value={f.priceMax ?? ""} onChange={(e) => set("priceMax", num(e.target.value))} />
        </label>
      </fieldset>
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
      <label className={label}>
        {s.mileageMax}
        <Select value={f.mileageMax ?? ""} onChange={(e) => set("mileageMax", num(e.target.value))}>
          <option value="">{dict.common.any}</option>
          {[10_000, 30_000, 60_000, 100_000, 150_000, 200_000].map((k) => (
            <option key={k} value={k}>{new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-EG").format(k)} {locale === "ar" ? "كم" : "km"}</option>
          ))}
        </Select>
      </label>
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
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1" loading={pending}>{s.showResults}</Button>
        <Button type="button" variant="ghost" onClick={clear}>{dict.common.clear}</Button>
      </div>
    </form>
  );
}

export function FiltersSidebar(props: Props) {
  return (
    <aside className="hidden lg:block" aria-label={props.dict.search.filters}>
      <div className="sticky top-20 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <FilterForm key={JSON.stringify(props.filters)} {...props} />
      </div>
    </aside>
  );
}

export function FiltersDrawerButton(props: Props & { activeCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="lg:hidden">
        <SlidersHorizontal className="size-4" />
        {props.dict.search.filters}
        {props.activeCount > 0 && <span className="tabular rounded-full bg-navy-900 px-1.5 text-xs text-white">{props.activeCount}</span>}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={props.dict.search.filters} closeLabel={props.dict.nav.close} variant="drawer">
        <FilterForm {...props} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function SortSelect({ locale, filters, dict }: Pick<Props, "locale" | "filters" | "dict">) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-ink-2">
      <span className="hidden sm:inline">{dict.search.sort}</span>
      <Select
        className="h-10 w-auto min-w-44"
        value={filters.sort}
        onChange={(e) => router.push(`/${locale}/cars${toQueryString({ ...filters, sort: e.target.value as SearchFilters["sort"], page: 1 })}`)}
        aria-label={dict.search.sort}
      >
        {SORTS.map((s) => <option key={s} value={s}>{dict.search.sortOptions[s]}</option>)}
      </Select>
    </label>
  );
}
