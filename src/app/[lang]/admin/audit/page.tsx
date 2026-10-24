import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { auditList } from "@/server/queries";
import { EmptyState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";

export default async function AuditPage({ params }: PageProps<"/[lang]/admin/audit">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const rows = await auditList();
  const A = dict.admin;
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{A.audit}</h1>
      {rows.length === 0 ? (
        <EmptyState title={A.auditEmpty} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-start text-ink-3">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{A.when}</th>
                <th className="px-4 py-3 text-start font-medium">{A.actor}</th>
                <th className="px-4 py-3 text-start font-medium">{A.action}</th>
                <th className="px-4 py-3 text-start font-medium">{A.entity}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="tabular whitespace-nowrap px-4 py-3 text-ink-2">{formatDate(r.createdAt, locale, { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-4 py-3">{r.actorName ?? "—"}</td>
                  <td className="px-4 py-3"><code className="text-xs" dir="ltr">{r.action}</code>{typeof r.metadata?.reason === "string" && <p className="text-xs text-ink-3">{r.metadata.reason}</p>}</td>
                  <td className="px-4 py-3"><code className="text-xs text-ink-3" dir="ltr">{r.entityType}:{r.entityId.slice(0, 8)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
