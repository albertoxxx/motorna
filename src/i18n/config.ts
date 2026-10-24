export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export const hasLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value);
export const dirOf = (locale: Locale) => (locale === "ar" ? "rtl" : "ltr");

/**
 * Number locale. Arabic UI uses Western digits by default — the convention on
 * Egyptian marketplaces and easier when comparing prices. Set to "ar-EG" for
 * Arabic-Indic digits.
 */
export const numberLocale: Record<Locale, string> = {
  ar: "ar-EG-u-nu-latn",
  en: "en-EG",
};
