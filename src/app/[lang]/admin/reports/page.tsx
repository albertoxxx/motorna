import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { reportList } from "@/server/queries";
import { ReportActions } from "@/components/admin-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { formatRelative } from "@/lib/format";

const FILTERS = ["active", "resolved", "dismissed"] as const;

export default async function ReportsPage({ params, searchParams }: PageProps<"/[lang]/admin/reports">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f === sp.status) ?? "active";
  const reports = await reportList(filter === "active" ? undefined : filter);
  const A = dict.admin;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{A.reports}</h1>
      <div className="mb-6 flex gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link key={f} href={`/${locale}/admin/reports${f === "active" ? "" : `?status=${f}`}`} aria-current={f === filter ? "page" : undefined} className={`rounded-full px-3 py-1.5 ${f === filter ? "bg-navy-900 text-white" : "bg-surface text-ink-2 ring-1 ring-line"}`}>
            {f === "active" ? `${dict.enums.reportStatus.open} / ${dict.enums.reportStatus.reviewing}` : dict.enums.reportStatus[f]}
          </Link>
        ))}
      </div>
      {reports.length === 0 ? (
        <EmptyState title={A.reportsEmpty} />
      ) : (
        <ul className="flex flex-col gap-4">
          {reports.map((r) => (
            <li key={r.id} className="grid gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5 md:grid-cols-[1fr_20rem]">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === "open" ? "warning" : r.status === "reviewing" ? "brand" : "neutral"}>{dict.enums.reportStatus[r.status]}</Badge>
                  <Badge tone="danger">{dict.enums.reportReason[r.reason]}</Badge>
                  <span className="text-xs text-ink-3">{formatRelative(r.createdAt, locale)}</span>
                </div>
                {r.listingSlug && <Link href={`/${locale}/cars/${r.listingSlug}`} className="font-semibold hover:underline"><bdi>{r.listingTitle}</bdi></Link>}
                <p dir="auto" className="text-sm text-ink-2">{r.details || "—"}</p>
                <p className="text-xs text-ink-3">
                  {A.submittedBy} <bdi>{r.reporterName}</bdi>
                  {r.reportedUserName && <> — {dict.listing.seller}: <bdi>{r.reportedUserName}</bdi>{r.reportedSuspendedAt && <> ({A.suspended})</>}</>}
                </p>
                {r.resolutionNote && <p className="text-xs text-ink-3">{A.resolutionNote}: <bdi>{r.resolutionNote}</bdi></p>}
              </div>
              {(r.status === "open" || r.status === "reviewing") && (
                <ReportActions
                  reportId={r.id}
                  status={r.status}
                  listingId={r.listingId}
                  listingPublished={r.listingStatus === "published"}
                  userId={r.reportedUserId}
                  userSuspended={!!r.reportedSuspendedAt}
                  dict={{ admin: dict.admin, errors: dict.errors, common: dict.common }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
