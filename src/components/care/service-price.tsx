import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { BookingDictionary } from "@/i18n/dictionaries/booking-ar";

type P = { priceMode: "fixed" | "estimate" | "quote"; priceEgp: number | null; priceMaxEgp?: number | null };

/** Price text that never presents an estimate as a fixed quote. */
export function servicePriceText(s: P, locale: Locale, T: Pick<BookingDictionary, "priceFrom" | "priceRange" | "priceAfterInspection">) {
  if (s.priceMode === "fixed" && s.priceEgp != null) return formatPrice(s.priceEgp, locale);
  if (s.priceMode === "estimate" && s.priceEgp != null) {
    return s.priceMaxEgp != null && s.priceMaxEgp > s.priceEgp
      ? T.priceRange.replace("{min}", formatPrice(s.priceEgp, locale)).replace("{max}", formatPrice(s.priceMaxEgp, locale))
      : T.priceFrom.replace("{price}", formatPrice(s.priceEgp, locale));
  }
  return T.priceAfterInspection;
}

export function ServicePrice({ s, locale, T }: { s: P; locale: Locale; T: BookingDictionary }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="tabular font-semibold text-navy-900">{servicePriceText(s, locale, T)}</span>
      {s.priceMode !== "quote" && <span className="text-xs font-normal text-ink-3">({T.priceMode[s.priceMode]})</span>}
    </span>
  );
}
