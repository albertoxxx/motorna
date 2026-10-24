import { CONDITIONS, TRANSMISSIONS, FUELS, BODIES } from "./validation";

export const SORTS = ["newest", "price_asc", "price_desc", "mileage_asc", "year_desc"] as const;
export type Sort = (typeof SORTS)[number];
export const PAGE_SIZE = 24;

export type SearchFilters = {
  q?: string;
  make?: string;
  model?: string;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
  condition?: (typeof CONDITIONS)[number];
  transmission?: (typeof TRANSMISSIONS)[number];
  fuel?: (typeof FUELS)[number];
  body?: (typeof BODIES)[number];
  city?: string;
  sort: Sort;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const slug = (v: string | undefined) => (v && /^[a-z0-9-]{1,40}$/.test(v) ? v : undefined);
const int = (v: string | undefined, min: number, max: number) => {
  if (!v) return undefined;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};
const oneOf = <T extends readonly string[]>(v: string | undefined, list: T) =>
  v && (list as readonly string[]).includes(v) ? (v as T[number]) : undefined;

/** Parses untrusted URL search params into a safe, typed filter object. */
export function parseSearchParams(raw: Raw): SearchFilters {
  const q = first(raw.q)?.trim().slice(0, 80);
  const f: SearchFilters = {
    q: q || undefined,
    make: slug(first(raw.make)),
    model: slug(first(raw.model)),
    priceMin: int(first(raw.priceMin), 0, 1_000_000_000),
    priceMax: int(first(raw.priceMax), 0, 1_000_000_000),
    yearMin: int(first(raw.yearMin), 1950, 2100),
    yearMax: int(first(raw.yearMax), 1950, 2100),
    mileageMax: int(first(raw.mileageMax), 0, 2_000_000),
    condition: oneOf(first(raw.condition), CONDITIONS),
    transmission: oneOf(first(raw.transmission), TRANSMISSIONS),
    fuel: oneOf(first(raw.fuel), FUELS),
    body: oneOf(first(raw.body), BODIES),
    city: slug(first(raw.city)),
    sort: oneOf(first(raw.sort), SORTS) ?? "newest",
    page: int(first(raw.page), 1, 500) ?? 1,
  };
  if (!f.make) f.model = undefined;
  if (f.priceMin !== undefined && f.priceMax !== undefined && f.priceMin > f.priceMax) {
    [f.priceMin, f.priceMax] = [f.priceMax, f.priceMin];
  }
  if (f.yearMin !== undefined && f.yearMax !== undefined && f.yearMin > f.yearMax) {
    [f.yearMin, f.yearMax] = [f.yearMax, f.yearMin];
  }
  return f;
}

/** Builds a query string from filters (omits defaults). */
export function toQueryString(f: Partial<SearchFilters>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "sort" && v === "newest") continue;
    if (k === "page" && v === 1) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function activeFilterCount(f: SearchFilters) {
  const keys: (keyof SearchFilters)[] = [
    "q", "make", "model", "priceMin", "priceMax", "yearMin", "yearMax",
    "mileageMax", "condition", "transmission", "fuel", "body", "city",
  ];
  return keys.filter((k) => f[k] !== undefined).length;
}
