import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/server";
import { getStaticPage } from "@/content/pages";
import { StaticPageView } from "@/components/static-page";
import { contactEmail } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const { locale } = await resolveLocale(params);
  const page = getStaticPage(locale, "contact");
  return { title: page.title, alternates: { canonical: `/${locale}/contact`, languages: { ar: "/ar/contact", en: "/en/contact" } } };
}

export default async function Page({ params }: PageProps<"/[lang]/contact">) {
  const { locale, dict } = await resolveLocale(params);
  const email = contactEmail();
  return (
    <StaticPageView page={getStaticPage(locale, "contact")} locale={locale} dict={dict}>
      <section>
        <h2 className="mb-3 text-xl font-semibold">{locale === "ar" ? "البريد الإلكتروني" : "Email"}</h2>
        {email ? (
          <a href={`mailto:${email}`} dir="ltr" className="font-medium text-brand-700 hover:underline">{email}</a>
        ) : (
          <p className="text-ink-3">{locale === "ar" ? "هيتم نشر بريد الدعم قبل الإطلاق." : "A support address will be published before launch."}</p>
        )}
      </section>
    </StaticPageView>
  );
}
