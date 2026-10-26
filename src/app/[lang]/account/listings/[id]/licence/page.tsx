import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { ArrowLeft, FileCheck2, Lock } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { db, schema } from "@/db";
import { licenceChecksFor } from "@/server/verification";
import { licenceState } from "@/lib/verification";
import { LicenceUpload, LicenceWithdraw } from "@/components/licence-upload";
import { Notice } from "@/components/ui/states";
import { formatDate } from "@/lib/format";

export const metadata = { robots: { index: false } };
const UUID = /^[0-9a-f-]{36}$/i;

export default async function LicencePage({ params }: PageProps<"/[lang]/account/listings/[id]/licence">) {
  const { locale, dict } = await resolveLocale(params);
  const { id } = await params;
  const user = await requireUser(locale, `/${locale}/account/listings/${id}/licence`);
  if (!UUID.test(id)) notFound();
  const [l] = await db.select().from(schema.listings).where(and(eq(schema.listings.id, id), isNull(schema.listings.deletedAt)));
  if (!l || l.sellerId !== user.id) notFound();
  const checks = await licenceChecksFor(l.id);
  const state = licenceState(l, checks);
  const pending = checks.find((c) => c.status === "pending");
  const latest = checks[0];
  const accepted = checks.find((c) => c.status === "accepted");
  const stale = !!accepted && state.state !== "verified";
  const canUpload = !pending && ["draft", "pending_review", "published", "rejected"].includes(l.status);
  const V = dict.verify;
  const d = { verify: dict.verify, errors: dict.errors };
  return (
    <div className="max-w-2xl">
      <Link href={`/${locale}/account/listings`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />{dict.account.myListings}
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{V.licenceTitle}</h1>
      <p className="mt-1 text-ink-2"><bdi>{l.title}</bdi></p>

      <div className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <p className="flex items-center gap-2 font-semibold">
          <FileCheck2 className={`size-5 ${state.state === "verified" ? "text-success-700" : "text-ink-3"}`} aria-hidden />
          {state.state === "verified" ? V.status.verified : state.state === "pending" ? V.status.pending : stale ? V.status.stale : latest?.status === "rejected" ? V.status.rejected : V.status.none}
        </p>
        {state.state === "verified" && <p className="mt-1 text-sm text-ink-3">{V.reviewedOn.replace("{date}", formatDate(state.reviewedAt, locale))}</p>}
        {latest?.status === "rejected" && state.state !== "verified" && !pending && latest.reviewNote && (
          <p dir="auto" className="mt-2 rounded-[var(--radius-md)] bg-danger-50 px-3 py-2 text-sm text-danger-700"><span className="font-semibold">{V.rejectedReason}:</span> {latest.reviewNote}</p>
        )}
        {pending && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <a href={`/api/licence/${pending.id}/front`} target="_blank" rel="noopener" className="font-medium text-brand-700 underline">{V.openFile.replace("{side}", V.front)}</a>
            {pending.backKey && <a href={`/api/licence/${pending.id}/back`} target="_blank" rel="noopener" className="font-medium text-brand-700 underline">{V.openFile.replace("{side}", V.back.split("—")[0].trim())}</a>}
            <LicenceWithdraw dict={d} checkId={pending.id} />
          </div>
        )}
      </div>

      <p className="mt-5 text-sm text-ink-2">{V.licenceIntro}</p>
      <p className="mt-2 text-sm text-ink-2">{V.licenceWhat}</p>
      <Notice tone="info" className="mt-4"><p className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden />{V.licencePrivacy}</p></Notice>

      {canUpload && state.state !== "verified" && (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          <LicenceUpload dict={d} listingId={l.id} />
        </div>
      )}
    </div>
  );
}
