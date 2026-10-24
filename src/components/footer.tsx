import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Logo } from "./logo";

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const p = (s: string) => `/${locale}${s}`;
  const cols = [
    { title: dict.footer.help, links: [[dict.pages.faq, "/faq"], [dict.pages.verification, "/verification"], [dict.pages.contact, "/contact"]] },
    { title: dict.footer.company, links: [[dict.pages.about, "/about"], [dict.nav.browse, "/cars"], [dict.nav.sell, "/sell"], [dict.footer.care, "/care"]] },
    { title: dict.footer.legal, links: [[dict.pages.terms, "/terms"], [dict.pages.privacy, "/privacy"]] },
  ];
  return (
    <footer className="mt-20 bg-navy-900 text-white/80">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 flex flex-col gap-4 md:col-span-1">
          <Logo locale={locale} inverted />
          <p className="max-w-xs text-sm leading-relaxed text-white/60">{dict.footer.disclaimer}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="mb-3 text-sm font-semibold text-white">{c.title}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={p(href)} className="text-white/70 hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-white/50">
          <span>© {new Date().getFullYear()} MOTORNA. {dict.footer.rights}</span>
          <span>{dict.meta.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
