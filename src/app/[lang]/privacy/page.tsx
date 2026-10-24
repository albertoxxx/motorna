import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/server";
import { getStaticPage } from "@/content/pages";
import { StaticPageView } from "@/components/static-page";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { locale } = await resolveLocale(params);
  const page = getStaticPage(locale, "privacy");
  return { title: page.title, alternates: { canonical: `/${locale}/privacy`, languages: { ar: "/ar/privacy", en: "/en/privacy" } } };
}

export default async function Page({ params }: PageProps<"/[lang]/privacy">) {
  const { locale, dict } = await resolveLocale(params);
  return (
    <StaticPageView page={getStaticPage(locale, "privacy")} locale={locale} dict={dict}>
    </StaticPageView>
  );
}
