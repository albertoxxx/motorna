import Link from "next/link";
import { cn } from "@/lib/cn";

export function CenterSubnav({ locale, slug, active, labels, actionCount }: { locale: string; slug: string; active: "dashboard" | "bookings" | "schedule" | "reports"; labels: { dashboard: string; bookings: string; schedule: string; reports: string }; actionCount?: number }) {
  const items = [
    { k: "dashboard", href: `/${locale}/center/${slug}` },
    { k: "bookings", href: `/${locale}/center/${slug}/bookings` },
    { k: "schedule", href: `/${locale}/center/${slug}/schedule` },
    { k: "reports", href: `/${locale}/center/${slug}/reports` },
  ] as const;
  return (
    <nav aria-label={labels.dashboard} className="mt-5 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((i) => (
        <Link key={i.k} href={i.href} aria-current={active === i.k ? "page" : undefined}
          className={cn("-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium", active === i.k ? "border-brand-600 text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
          {labels[i.k]}
          {i.k === "bookings" && !!actionCount && <span className="grid min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white tabular">{actionCount}</span>}
        </Link>
      ))}
    </nav>
  );
}
