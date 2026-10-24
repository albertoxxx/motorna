import Link from "next/link";
import type { Locale } from "@/i18n/config";

/** Plate-shaped mark: Egyptian private-plate band over a drawn "M". Pure SVG, so it's never read as text. */
export function LogoMark({ inverted = false, className = "h-7 w-10" }: { inverted?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 40 28" className={className} aria-hidden focusable="false">
      <rect x="0.75" y="0.75" width="38.5" height="26.5" rx="4" fill="#fff" stroke={inverted ? "rgba(255,255,255,.7)" : "#101828"} strokeWidth="1.5" />
      <path d="M1.5 4.75A4 4 0 0 1 5.5 1.5h29a4 4 0 0 1 4 3.25V9h-37z" fill="#4a90d9" />
      <path d="M13 23V13.2h2.6l4.4 5.6 4.4-5.6H27V23h-2.6v-5.9l-3.6 4.5h-1.6l-3.6-4.5V23z" fill="#101828" />
    </svg>
  );
}

/** Wordmark. The accessible name and extracted text is exactly "MOTORNA". */
export function Logo({ locale, inverted = false }: { locale: Locale; inverted?: boolean }) {
  return (
    <Link href={`/${locale}`} className="group inline-flex shrink-0 items-center gap-2.5">
      <LogoMark inverted={inverted} />
      <span className={`text-[1.15rem] font-extrabold tracking-[0.06em] ${inverted ? "text-white" : "text-navy-900"}`} dir="ltr">
        MOTORNA
      </span>
    </Link>
  );
}

/**
 * Price shown on the details page as an Egyptian-plate-style tag:
 * blue top band with مصر / EGYPT, figures underneath. The one bold
 * brand element; used sparingly.
 */
export function PlateTag({ children, caption }: { children: React.ReactNode; caption?: React.ReactNode }) {
  return (
    <div className="inline-flex min-w-56 flex-col overflow-hidden rounded-[6px] border-2 border-navy-900 bg-white">
      <div className="flex items-center justify-between bg-plate px-3 py-0.5 text-[11px] font-semibold text-white" aria-hidden>
        <span>مصر</span>
        <span dir="ltr" className="tracking-[0.2em]">EGYPT</span>
      </div>
      <div className="px-4 pb-2 pt-1.5">
        <div className="tabular text-[1.75rem] font-bold leading-tight text-navy-900">{children}</div>
        {caption && <div className="text-xs text-ink-3">{caption}</div>}
      </div>
    </div>
  );
}
