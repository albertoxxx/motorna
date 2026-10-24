import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/server";
import { getStaticPage } from "@/content/pages";
import { StaticPageView } from "@/components/static-page";

export async function generateMetadata({ params }: PageProps<"/[lang]/faq">): Promise<Metadata> {
  const { locale } = await resolveLocale(params);
  const page = getStaticPage(locale, "faq");
  return { title: page.title, alternates: { canonical: `/${locale}/faq`, languages: { ar: "/ar/faq", en: "/en/faq" } } };
}

export default async function Page({ params }: PageProps<"/[lang]/faq">) {
  const { locale, dict } = await resolveLocale(params);
  return (
    <StaticPageView page={getStaticPage(locale, "faq")} locale={locale} dict={dict}>
    </StaticPageView>
  );
}
