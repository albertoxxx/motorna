import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/server";
import { getStaticPage } from "@/content/pages";
import { StaticPageView } from "@/components/static-page";

export async function generateMetadata({ params }: PageProps<"/[lang]/verification">): Promise<Metadata> {
  const { locale } = await resolveLocale(params);
  const page = getStaticPage(locale, "verification");
  return { title: page.title, alternates: { canonical: `/${locale}/verification`, languages: { ar: "/ar/verification", en: "/en/verification" } } };
}

export default async function Page({ params }: PageProps<"/[lang]/verification">) {
  const { locale, dict } = await resolveLocale(params);
  return (
    <StaticPageView page={getStaticPage(locale, "verification")} locale={locale} dict={dict}>
    </StaticPageView>
  );
}
