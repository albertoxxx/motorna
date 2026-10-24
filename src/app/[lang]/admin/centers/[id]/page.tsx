import { notFound } from "next/navigation";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { centerAudit, centerWorkspace, reviewNotes } from "@/server/care";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { careStatusTone } from "@/components/care/status";
import { CenterStatusActions, CheckRow, CredentialReview, ReviewNoteForm } from "@/components/care/admin-center";
import { applicableCriteria, approvalBlockers } from "@/lib/care";
import { formatDate, formatPrice } from "@/lib/format";

const UUID = /^[0-9a-f-]{36}$/i;

function Box({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function AdminCenterPage({ params }: PageProps<"/[lang]/admin/centers/[id]">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [ws, history, notes] = await Promise.all([centerWorkspace(id), centerAudit(id), reviewNotes(id)]);
  if (!ws) notFound();
  const { center: c } = ws;
  const K = dict.care;
  const A = K.admin;
  const D = K.detail;
  const cdict = { care: dict.care, common: dict.common, validation: dict.validation, errors: dict.errors };
  const offersInspection = ws.services.some((s) => s.category === "pre_purchase_inspection" && s.active);
  const blockers = approvalBlockers({
    checks: Object.fromEntries(Object.entries(ws.checks).map(([k, v]) => [k, v!.passed])),
    offersInspection,
    credentials: ws.credentials,
  });
  const isDraft = c.status === "draft";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold"><bdi>{c.nameEn}</bdi> · <bdi>{c.nameAr}</bdi></h1>
          <Badge tone={careStatusTone(c.status)}>{K.enums.status[c.status]}</Badge>
        </div>
        {c.submittedAt && <p className="mt-1 text-sm text-ink-3">{A.submittedOn.replace("{date}", formatDate(c.submittedAt, locale))}</p>}
        {c.statusReason && <p className="mt-1 text-sm text-ink-3">{K.dash.reason}: <bdi>{c.statusReason}</bdi></p>}
        {isDraft && <Notice tone="warning" className="mt-3">{A.draftNotice}</Notice>}
      </div>

      <Box title={K.dash.profile}>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-3">{D.location}</dt><dd dir="auto">{c.address}{c.area && ` — ${c.area}`}</dd></div>
          <div><dt className="text-ink-3">{K.apply.phone}</dt><dd className="ltr-run">{c.phone}</dd></div>
          {c.email && <div><dt className="text-ink-3">{D.email}</dt><dd className="ltr-run">{c.email}</dd></div>}
          {c.website && <div><dt className="text-ink-3">{D.website}</dt><dd className="ltr-run break-all">{c.website}</dd></div>}
          <div className="sm:col-span-2"><dt className="text-ink-3">{D.about}</dt><dd dir="auto" className="whitespace-pre-line">{c.description || "—"}</dd></div>
          {c.quotationPolicy && <div className="sm:col-span-2"><dt className="text-ink-3">{D.quotationPolicy}</dt><dd dir="auto" className="whitespace-pre-line">{c.quotationPolicy}</dd></div>}
        </dl>
      </Box>

      <div className="grid gap-6 md:grid-cols-2">
        <Box title={D.services}>
          {ws.services.length === 0 ? <p className="text-sm text-ink-3">{D.noServices}</p> : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {ws.services.map((s) => (
                <li key={s.id} className={s.active ? "" : "text-ink-3 line-through"}>
                  {K.enums.category[s.category]} — <bdi>{s.nameEn}</bdi> — <span className="tabular">{s.priceMode === "fixed" && s.priceEgp != null ? formatPrice(s.priceEgp, locale) : D.onQuotation}</span>
                </li>
              ))}
            </ul>
          )}
        </Box>
        <Box title={D.equipmentTitle}>
          {ws.equipment.length === 0 ? <p className="text-sm text-ink-3">{D.noEquipment}</p> : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {ws.equipment.map((e) => <li key={e.id}>{K.enums.equipment[e.kind]}{e.details && <span className="text-ink-3"> — <bdi>{e.details}</bdi></span>}</li>)}
            </ul>
          )}
        </Box>
        <Box title={K.dash.techniciansTitle}>
          {ws.technicians.length === 0 ? <p className="text-sm text-ink-3">{K.dash.noTechnicians}</p> : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {ws.technicians.map((t) => (
                <li key={t.id} className={t.active ? "" : "text-ink-3 line-through"}>
                  <bdi className="font-medium">{t.fullName}</bdi>
                  <span className="text-ink-3"> — {[t.specialty, t.yearsExperience != null ? D.years.replace("{n}", String(t.yearsExperience)) : null, t.certifications].filter(Boolean).join(" · ") || "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Box>
        <Box title={K.dash.staffTitle}>
          <ul className="flex flex-col gap-1.5 text-sm">
            {ws.staff.map((m) => <li key={m.userId}><bdi>{m.name}</bdi> <span className="ltr-run text-ink-3">{m.email}</span> — {K.enums.staffRole[m.role]}{!m.active && ` (${K.dash.inactiveStaff})`}</li>)}
          </ul>
        </Box>
      </div>

      <Box title={K.dash.docsTitle}>
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
                {d.reviewNote && <p className="text-xs text-ink-3"><bdi>{d.reviewNote}</bdi></p>}
                {d.reviewState === "pending" && !isDraft && <CredentialReview dict={cdict} credentialId={d.id} />}
              </li>
            ))}
          </ul>
        )}
      </Box>

      {!isDraft && (
        <Box title={A.checklist}>
          {!offersInspection && <p className="mb-3 text-sm text-ink-3">{A.noInspection}</p>}
          <ul className="flex flex-col gap-4">
            {applicableCriteria(offersInspection).map((k) => {
              const ck = ws.checks[k];
              return (
                <li key={k} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{K.criteria[k].title}</span>
                    <Badge tone={ck?.passed ? "success" : ck ? "danger" : "neutral"}>{ck?.passed ? A.pass : ck ? A.failCheck : A.notChecked}</Badge>
                    {ck && <span className="text-xs text-ink-3">{formatDate(ck.checkedAt, locale)}</span>}
                  </div>
                  <p className="text-sm text-ink-3">{K.criteria[k].body}</p>
                  <CheckRow dict={cdict} centerId={c.id} criterion={k} passed={ck ? ck.passed : null} note={ck?.note ?? null} />
                </li>
              );
            })}
          </ul>
        </Box>
      )}

      {!isDraft && (
        <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          {blockers.length > 0 && (c.status === "under_review" || c.status === "applied") && (
            <Notice tone="warning" className="mb-4">
              <p className="font-semibold">{A.blockersTitle}</p>
              <ul className="mt-1 list-disc ps-5">
                {blockers.map((b) => {
                  const [type, key] = b.split(":");
                  return <li key={b}>{type === "check" ? K.criteria[key as keyof typeof K.criteria].title : A.blockerDocument.replace("{doc}", K.enums.credential[key as keyof typeof K.enums.credential])}</li>;
                })}
              </ul>
            </Notice>
          )}
          <CenterStatusActions dict={cdict} centerId={c.id} status={c.status} canApprove={blockers.length === 0} />
        </section>
      )}

      <Box title={A.notesTitle} hint={A.notesHint}>
        {notes.length === 0 ? <p className="mb-3 text-sm text-ink-3">{A.noNotes}</p> : (
          <ul className="mb-4 flex flex-col gap-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-[var(--radius-md)] bg-canvas p-3 text-sm">
                <p dir="auto" className="whitespace-pre-line">{n.body}</p>
                <p className="mt-1 text-xs text-ink-3"><bdi>{n.authorName ?? "—"}</bdi> · {formatDate(n.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</p>
              </li>
            ))}
          </ul>
        )}
        <ReviewNoteForm dict={cdict} centerId={c.id} />
      </Box>

      <Box title={A.history}>
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
      </Box>
    </div>
  );
}
