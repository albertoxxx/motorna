import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { adminStats } from "@/server/queries";
import { formatNumber } from "@/lib/format";

export default async function AdminHome({ params }: PageProps<"/[lang]/admin">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const s = await adminStats();
  const A = dict.admin;
  const tiles = [
    { label: A.pendingCount, value: s.pending, href: "/admin/listings", urgent: s.pending > 0 },
    { label: A.openReports, value: s.reports, href: "/admin/reports", urgent: s.reports > 0 },
    { label: A.publishedCount, value: s.published, href: "/cars" },
    { label: A.usersCount, value: s.users },
  ];
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{A.dashboard}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <>
              <p className="text-sm text-ink-3">{tile.label}</p>
              <p className={`tabular mt-1 text-3xl font-bold ${tile.urgent ? "text-warning-700" : "text-ink"}`}>{formatNumber(tile.value, locale)}</p>
            </>
          );
          return tile.href ? (
            <Link key={tile.label} href={`/${locale}${tile.href}`} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5 hover:border-line-strong">{body}</Link>
          ) : (
            <div key={tile.label} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">{body}</div>
          );
        })}
      </div>
    </div>
  );
}
