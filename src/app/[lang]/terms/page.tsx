import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/server";
import { getStaticPage } from "@/content/pages";
import { StaticPageView } from "@/components/static-page";

export async function generateMetadata({ params }: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { locale } = await resolveLocale(params);
  const page = getStaticPage(locale, "terms");
  return { title: page.title, alternates: { canonical: `/${locale}/terms`, languages: { ar: "/ar/terms", en: "/en/terms" } } };
}

export default async function Page({ params }: PageProps<"/[lang]/terms">) {
  const { locale, dict } = await resolveLocale(params);
  return (
    <StaticPageView page={getStaticPage(locale, "terms")} locale={locale} dict={dict}>
    </StaticPageView>
  );
}
