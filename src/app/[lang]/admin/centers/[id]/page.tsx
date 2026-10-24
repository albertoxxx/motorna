import { notFound } from "next/navigation";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { centerAudit, centerWorkspace } from "@/server/care";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { careStatusTone } from "@/components/care/status";
import { CenterStatusActions, CheckRow, CredentialReview } from "@/components/care/admin-center";
import { applicableCriteria, approvalBlockers } from "@/lib/care";
import { formatDate, formatPrice } from "@/lib/format";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function AdminCenterPage({ params }: PageProps<"/[lang]/admin/centers/[id]">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [ws, history] = await Promise.all([centerWorkspace(id), centerAudit(id)]);
  if (!ws) notFound();
  const { center: c } = ws;
  const K = dict.care;
  const A = K.admin;
  const cdict = { care: dict.care, common: dict.common, validation: dict.validation, errors: dict.errors };
  const offersInspection = ws.services.some((s) => s.category === "pre_purchase_inspection" && s.active);
  const blockers = approvalBlockers({
    checks: Object.fromEntries(Object.entries(ws.checks).map(([k, v]) => [k, v!.passed])),
    offersInspection,
    credentials: ws.credentials,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold"><bdi>{c.nameEn}</bdi> · <bdi>{c.nameAr}</bdi></h1>
          <Badge tone={careStatusTone(c.status)}>{K.enums.status[c.status]}</Badge>
        </div>
        {c.statusReason && <p className="mt-1 text-sm text-ink-3">{K.dash.reason}: <bdi>{c.statusReason}</bdi></p>}
      </div>

      <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-3">{K.address}</dt><dd dir="auto">{c.address}{c.area && ` — ${c.area}`}</dd></div>
          <div><dt className="text-ink-3">{K.phone}</dt><dd className="ltr-run">{c.phone}</dd></div>
          {c.email && <div><dt className="text-ink-3">{K.email}</dt><dd className="ltr-run">{c.email}</dd></div>}
          {c.website && <div><dt className="text-ink-3">{K.website}</dt><dd className="ltr-run">{c.website}</dd></div>}
          <div className="sm:col-span-2"><dt className="text-ink-3">{K.about}</dt><dd dir="auto" className="whitespace-pre-line">{c.description || "—"}</dd></div>
        </dl>
        <h3 className="mb-2 mt-5 text-sm font-semibold">{K.services}</h3>
        {ws.services.length === 0 ? <p className="text-sm text-ink-3">{K.noServices}</p> : (
          <ul className="text-sm">
            {ws.services.map((s) => (
              <li key={s.id} className={s.active ? "" : "text-ink-3 line-through"}>
                {K.enums.category[s.category]} — <bdi>{s.nameEn}</bdi> — {s.priceMode === "fixed" && s.priceEgp != null ? formatPrice(s.priceEgp, locale) : K.onQuotation}
              </li>
            ))}
          </ul>
        )}
        <h3 className="mb-2 mt-5 text-sm font-semibold">{K.dash.staffTitle}</h3>
        <ul className="text-sm">
          {ws.staff.map((m) => <li key={m.userId}><bdi>{m.name}</bdi> <span className="ltr-run text-ink-3">{m.email}</span> — {K.enums.staffRole[m.role]}{!m.active && ` (${K.dash.inactiveStaff})`}</li>)}
        </ul>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <h2 className="mb-3 text-lg font-semibold">{K.dash.docsTitle}</h2>
        {ws.credentials.length === 0 ? <p className="text-sm text-ink-3">{K.dash.noDocs}</p> : (
          <ul className="flex flex-col gap-4">
            {ws.credentials.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{K.enums.credential[d.kind]}</span>
                  {d.number && <span className="ltr-run text-ink-3">{d.number}</span>}
                  {d.expiresAt && <span className="text-ink-3">{K.dash.docExpires}: {formatDate(d.expiresAt, locale)}</span>}
                  <Badge tone={d.reviewState === "accepted" ? "success" : d.reviewState === "rejected" ? "danger" : "warning"}>{K.enums.review[d.reviewState]}</Badge>
                  <a href={`/api/care/credentials/${d.id}`} target="_blank" rel="noopener" className="font-medium text-brand-700 hover:underline">{K.dash.view}</a>
                </div>
                {d.reviewState === "pending" && <CredentialReview dict={cdict} credentialId={d.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <h2 className="mb-3 text-lg font-semibold">{A.checklist}</h2>
        {!offersInspection && <p className="mb-3 text-sm text-ink-3">{A.noInspection}</p>}
        <ul className="flex flex-col gap-4">
          {applicableCriteria(offersInspection).map((k) => {
            const ck = ws.checks[k];
            return (
              <li key={k} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{K.criteria[k].title}</span>
                  <Badge tone={ck?.passed ? "success" : ck ? "danger" : "neutral"}>{ck?.passed ? A.pass : ck ? A.failCheck : A.notChecked}</Badge>
                </div>
                <p className="text-sm text-ink-3">{K.criteria[k].body}</p>
                <CheckRow dict={cdict} centerId={c.id} criterion={k} passed={ck ? ck.passed : null} note={ck?.note ?? null} />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        {blockers.length > 0 && (c.status === "under_review" || c.status === "applied") && (
          <Notice tone="warning" className="mb-4">
            <p className="font-semibold">{A.blockersTitle}</p>
            <ul className="mt-1 list-disc ps-5">
              {blockers.map((b) => {
                const [type, key] = b.split(":");
                return (
                  <li key={b}>
                    {type === "check" ? K.criteria[key as keyof typeof K.criteria].title : A.blockerDocument.replace("{doc}", K.enums.credential[key as keyof typeof K.enums.credential])}
                  </li>
                );
              })}
            </ul>
          </Notice>
        )}
        <CenterStatusActions dict={cdict} centerId={c.id} status={c.status} canApprove={blockers.length === 0} />
      </section>

      <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <h2 className="mb-3 text-lg font-semibold">{A.history}</h2>
        <ol className="flex flex-col gap-1.5 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-2">
              <span className="tabular text-ink-3">{formatDate(h.createdAt, locale, { dateStyle: "short", timeStyle: "short" })}</span>
              <code className="text-xs">{h.action}</code>
              <span className="text-ink-2"><bdi>{h.actorName ?? "—"}</bdi></span>
              {typeof (h.metadata as { reason?: string }).reason === "string" && <span className="text-ink-3">— <bdi>{(h.metadata as { reason: string }).reason}</bdi></span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
