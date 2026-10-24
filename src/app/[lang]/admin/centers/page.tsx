import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { adminCenterList } from "@/server/care";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { careStatusTone } from "@/components/care/status";
import { CENTER_STATUSES, type CenterStatus } from "@/lib/care";
import { formatRelative } from "@/lib/format";

export default async function AdminCentersPage({ params, searchParams }: PageProps<"/[lang]/admin/centers">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const sp = await searchParams;
  const status = CENTER_STATUSES.find((s) => s === sp.status);
  const list = await adminCenterList(status ? [status] : ["applied", "under_review"]);
  const K = dict.care;
  const tabs: (CenterStatus | "open")[] = ["open", "approved", "suspended", "rejected", "revoked"];
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{K.admin.centers}</h1>
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {tabs.map((t) => {
          const active = (t === "open" && !status) || t === status;
          return (
            <Link key={t} href={`/${locale}/admin/centers${t === "open" ? "" : `?status=${t}`}`} aria-current={active ? "page" : undefined} className={`rounded-full px-3 py-1.5 ${active ? "bg-navy-900 text-white" : "bg-surface text-ink-2 ring-1 ring-line"}`}>
              {t === "open" ? K.admin.filterOpen : K.enums.status[t]}
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
                  <p className="text-sm text-ink-3">{locale === "ar" ? c.cityNameAr : c.cityNameEn} · {K.admin.owner}: <bdi>{c.ownerName}</bdi> · {formatRelative(c.createdAt, locale)}</p>
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
