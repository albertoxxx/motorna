import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/server";
import { getStaticPage } from "@/content/pages";
import { StaticPageView } from "@/components/static-page";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { locale } = await resolveLocale(params);
  const page = getStaticPage(locale, "about");
  return { title: page.title, alternates: { canonical: `/${locale}/about`, languages: { ar: "/ar/about", en: "/en/about" } } };
}

export default async function Page({ params }: PageProps<"/[lang]/about">) {
  const { locale, dict } = await resolveLocale(params);
  return (
    <StaticPageView page={getStaticPage(locale, "about")} locale={locale} dict={dict}>
    </StaticPageView>
  );
}
