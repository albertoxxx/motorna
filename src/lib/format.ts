import { numberLocale, type Locale } from "@/i18n/config";

export function formatNumber(n: number, locale: Locale) {
  return new Intl.NumberFormat(numberLocale[locale]).format(n);
}

export function formatPrice(egp: number, locale: Locale) {
  const n = formatNumber(egp, locale);
  return locale === "ar" ? `${n} جنيه` : `EGP ${n}`;
}

export function formatKm(km: number, locale: Locale) {
  const n = formatNumber(km, locale);
  return locale === "ar" ? `${n} كم` : `${n} km`;
}

/** Compact budget label e.g. 1.2M / 1.2 مليون */
export function formatCompactPrice(egp: number, locale: Locale) {
  if (egp >= 1_000_000) {
    const v = new Intl.NumberFormat(numberLocale[locale], { maximumFractionDigits: 2 }).format(egp / 1_000_000);
    return locale === "ar" ? `${v} مليون` : `${v}M`;
  }
  if (egp >= 1_000) {
    const v = new Intl.NumberFormat(numberLocale[locale], { maximumFractionDigits: 0 }).format(egp / 1_000);
    return locale === "ar" ? `${v} ألف` : `${v}K`;
  }
  return formatNumber(egp, locale);
}

export function formatDate(d: Date | string, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat(numberLocale[locale], opts).format(typeof d === "string" ? new Date(d) : d);
}

export function formatRelative(d: Date | string, locale: Locale, now = new Date()) {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(numberLocale[locale], { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(date, locale);
}

/** Pick the localized name from a row with nameAr / nameEn. */
export function localName(row: { nameAr: string; nameEn: string }, locale: Locale) {
  return locale === "ar" ? row.nameAr : row.nameEn;
}

/** Appointment date and time, always in Cairo time (bookings are stored in UTC). */
export function formatAppointment(d: Date | string, locale: Locale) {
  return formatDate(d, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" });
}
