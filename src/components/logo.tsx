import Link from "next/link";
import type { Locale } from "@/i18n/config";

/** Wordmark with a plate-shaped mark: the blue band of an Egyptian private plate. */
export function Logo({ locale, inverted = false }: { locale: Locale; inverted?: boolean }) {
  return (
    <Link href={`/${locale}`} className="group inline-flex items-center gap-2.5" aria-label="MOTORNA">
      <span
        className={`relative inline-flex h-7 w-10 flex-col overflow-hidden rounded-[4px] border ${inverted ? "border-white/70" : "border-navy-900"} bg-white`}
        aria-hidden
      >
        <span className="h-2 bg-plate" />
        <span className="flex flex-1 items-center justify-center text-[9px] font-bold leading-none tracking-wide text-navy-900">M</span>
      </span>
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
      <div className="flex items-center justify-between bg-plate px-3 py-0.5 text-[11px] font-semibold text-white">
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
