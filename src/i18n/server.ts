import "server-only";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "./config";
import ar from "./dictionaries/ar";
import en from "./dictionaries/en";
import type { Dictionary } from "./dictionaries/ar";

const dictionaries: Record<Locale, Dictionary> = { ar, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Validates the [lang] param and returns locale + dictionary. */
export async function resolveLocale(params: Promise<{ lang: string }>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return { locale: lang, dict: dictionaries[lang] };
}
