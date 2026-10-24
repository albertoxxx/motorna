import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { adminCenterList, centerStatusCounts } from "@/server/care";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { careStatusTone } from "@/components/care/status";
import type { CenterStatus } from "@/lib/care";
import { formatRelative } from "@/lib/format";

const TABS = {
  queue: ["applied", "under_review"],
  changes_requested: ["changes_requested"],
  approved: ["approved"],
  suspended: ["suspended"],
  rejected: ["rejected"],
  revoked: ["revoked"],
  draft: ["draft"],
} satisfies Record<string, CenterStatus[]>;
type Tab = keyof typeof TABS;

export default async function AdminCentersPage({ params, searchParams }: PageProps<"/[lang]/admin/centers">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const sp = await searchParams;
  const tab: Tab = typeof sp.tab === "string" && sp.tab in TABS ? (sp.tab as Tab) : "queue";
  const [list, counts] = await Promise.all([adminCenterList(TABS[tab]), centerStatusCounts()]);
  const K = dict.care;
  const countFor = (t: Tab) => TABS[t].reduce((n, s) => n + (counts[s] ?? 0), 0);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{K.admin.centers}</h1>
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {(Object.keys(TABS) as Tab[]).map((t) => {
          const active = t === tab;
          return (
            <Link key={t} href={`/${locale}/admin/centers${t === "queue" ? "" : `?tab=${t}`}`} aria-current={active ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${active ? "bg-navy-900 text-white" : "bg-surface text-ink-2 ring-1 ring-line"}`}>
              {K.admin.tabs[t]}
              <span className={`tabular rounded-full px-1.5 text-xs ${active ? "bg-white/20" : "bg-navy-900/[0.06]"}`}>{countFor(t)}</span>
            </Link>
          );
        })}
      </div>
      {list.length === 0 ? (
        <EmptyState title={K.admin.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/${locale}/admin/centers/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-4 hover:border-line-strong">
                <div>
                  <p className="font-semibold"><bdi>{locale === "ar" ? c.nameAr : c.nameEn}</bdi></p>
                  <p className="text-sm text-ink-3">
                    {locale === "ar" ? c.cityNameAr : c.cityNameEn} · {K.admin.owner}: <bdi>{c.ownerName}</bdi> ·{" "}
                    {c.submittedAt ? K.admin.submittedOn.replace("{date}", formatRelative(c.submittedAt, locale)) : formatRelative(c.createdAt, locale)}
                  </p>
                </div>
                <Badge tone={careStatusTone(c.status)}>{K.enums.status[c.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
