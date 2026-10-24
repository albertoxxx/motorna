"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatCompactPrice } from "@/lib/format";

export type TaxonomyMake = { id: number; slug: string; nameEn: string; nameAr: string };
export type TaxonomyModel = { id: number; makeId: number; slug: string; nameEn: string; nameAr: string };
export type CityOption = { slug: string; nameEn: string; nameAr: string };

// Listings may be priced up to EGP 100M, so the budget list must reach past 5M or higher-priced cars become unreachable from here.
const BUDGETS = [300_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000, 7_500_000, 10_000_000, 20_000_000];

export type AvailableMake = { slug: string; count: number };

/**
 * Make options with the makes that currently have published cars listed first (with counts),
 * so buyers aren't steered into searches that can only return nothing.
 */
export function MakeOptions({
  makes,
  available,
  name,
  labels,
}: {
  makes: TaxonomyMake[];
  available: AvailableMake[];
  name: (r: { nameAr: string; nameEn: string }) => string;
  labels: { availableNow: string; allMakes: string };
}) {
  const counts = new Map(available.map((a) => [a.slug, a.count]));
  const withCars = makes.filter((m) => counts.has(m.slug)).sort((a, b) => counts.get(b.slug)! - counts.get(a.slug)!);
  if (withCars.length === 0) return <>{makes.map((m) => <option key={m.slug} value={m.slug}>{name(m)}</option>)}</>;
  return (
    <>
      <optgroup label={labels.availableNow}>
        {withCars.map((m) => <option key={m.slug} value={m.slug}>{`${name(m)} (${counts.get(m.slug)})`}</option>)}
      </optgroup>
      <optgroup label={labels.allMakes}>
        {makes.filter((m) => !counts.has(m.slug)).map((m) => <option key={m.slug} value={m.slug}>{name(m)}</option>)}
      </optgroup>
    </>
  );
}

export function SearchPanel({
  locale,
  makes,
  models,
  cities,
  available,
  labels,
}: {
  locale: Locale;
  makes: TaxonomyMake[];
  models: TaxonomyModel[];
  cities: CityOption[];
  available: AvailableMake[];
  labels: { budget: string; budgetMax: string; make: string; model: string; yearFrom: string; location: string; search: string; any: string; availableNow: string; allMakes: string };
}) {
  const router = useRouter();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [budget, setBudget] = useState("");
  const [year, setYear] = useState("");
  const [city, setCity] = useState("");
  const name = (r: { nameAr: string; nameEn: string }) => (locale === "ar" ? r.nameAr : r.nameEn);
  const makeId = makes.find((m) => m.slug === make)?.id;
  const makeModels = useMemo(() => models.filter((m) => m.makeId === makeId), [models, makeId]);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 25 }, (_, i) => thisYear - i);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams();
    if (make) q.set("make", make);
    if (model) q.set("model", model);
    if (budget) q.set("priceMax", budget);
    if (year) q.set("yearMin", year);
    if (city) q.set("city", city);
    const s = q.toString();
    router.push(`/${locale}/cars${s ? `?${s}` : ""}`);
  }

  return (
    <form onSubmit={submit} role="search" className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(5,minmax(0,1fr))_auto] md:items-end">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        {labels.make}
        <Select value={make} onChange={(e) => { setMake(e.target.value); setModel(""); }}>
          <option value="">{labels.any}</option>
          <MakeOptions makes={makes} available={available} name={name} labels={labels} />
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        {labels.model}
        <Select value={model} onChange={(e) => setModel(e.target.value)} disabled={!make}>
          <option value="">{labels.any}</option>
          {makeModels.map((m) => <option key={m.slug} value={m.slug}>{name(m)}</option>)}
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        {labels.budget}
        <Select value={budget} onChange={(e) => setBudget(e.target.value)}>
          <option value="">{labels.any}</option>
          {BUDGETS.map((b) => <option key={b} value={b}>{labels.budgetMax} {formatCompactPrice(b, locale)}</option>)}
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        {labels.yearFrom}
        <Select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">{labels.any}</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
      </label>
      <label className="col-span-2 flex flex-col gap-1.5 text-sm font-medium text-ink md:col-span-1">
        {labels.location}
        <Select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">{labels.any}</option>
          {cities.map((c) => <option key={c.slug} value={c.slug}>{name(c)}</option>)}
        </Select>
      </label>
      <Button type="submit" size="lg" className="col-span-2 h-11 md:col-span-1">
        <Search className="size-4" />
        {labels.search}
      </Button>
    </form>
  );
}
