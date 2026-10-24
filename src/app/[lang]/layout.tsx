import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import "../globals.css";
import { dirOf, locales } from "@/i18n/config";
import { resolveLocale } from "@/i18n/server";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ToastProvider } from "@/components/ui/toast";
import { siteUrl } from "@/lib/site";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { locale, dict } = await resolveLocale(params);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${dict.meta.siteName} — ${dict.meta.tagline}`, template: `%s · ${dict.meta.siteName}` },
    description: dict.meta.description,
    alternates: { languages: { ar: "/ar", en: "/en" } },
    openGraph: { siteName: dict.meta.siteName, locale: locale === "ar" ? "ar_EG" : "en_EG", type: "website" },
  };
}

export const viewport: Viewport = { themeColor: "#101828", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { locale, dict } = await resolveLocale(params);
  return (
    <html lang={locale} dir={dirOf(locale)} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ToastProvider closeLabel={dict.nav.close}>
          <Header locale={locale} dict={dict} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer locale={locale} dict={dict} />
        </ToastProvider>
      </body>
    </html>
  );
}
