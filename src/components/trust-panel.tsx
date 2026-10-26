import Link from "next/link";
import { CircleCheck, CircleDashed, Clock } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { LicenceState } from "@/lib/verification";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";

type State = "done" | "pending" | "none";

/**
 * Each trust signal shown separately and only when backed by a real record:
 * listing review (moderation), seller phone (SMS code), vehicle licence (admin review).
 * Technical inspection stays "not inspected" until inspection reports exist.
 */
export function TrustPanel({ listingStatus, dict, locale, phoneVerified = false, licence = { state: "none" } }: { listingStatus: string; dict: Dictionary; locale: Locale; phoneVerified?: boolean; licence?: LicenceState }) {
  const T = dict.listing.trust;
  const review: State = listingStatus === "published" || listingStatus === "sold" ? "done" : listingStatus === "pending_review" ? "pending" : "none";
  const lic: State = licence.state === "verified" ? "done" : licence.state === "pending" ? "pending" : "none";
  const rows: { label: string; state: State; value: string; sub?: string }[] = [
    { label: T.listingReview, state: review, value: review === "done" ? T.reviewed : review === "pending" ? T.inReview : T.notReviewed },
    { label: T.sellerIdentity, state: phoneVerified ? "done" : "none", value: phoneVerified ? T.verified : T.notVerified },
    {
      label: T.documents,
      state: lic,
      value: lic === "done" ? T.reviewed : lic === "pending" ? T.inReview : T.notReviewed,
      sub: licence.state === "verified" ? formatDate(licence.reviewedAt, locale) : undefined,
    },
    { label: T.inspection, state: "none", value: T.notInspected },
  ];
  const icon = (s: State) =>
    s === "done" ? <CircleCheck className="size-4 text-success-700" aria-hidden /> : s === "pending" ? <Clock className="size-4 text-warning-700" aria-hidden /> : <CircleDashed className="size-4 text-ink-3" aria-hidden />;
  return (
    <section aria-labelledby="trust-title" className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <h2 id="trust-title" className="mb-3 text-sm font-semibold text-ink-3">{T.title}</h2>
      <dl className="flex flex-col gap-2.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="text-ink-2">{r.label}</dt>
            <dd className={`flex items-center gap-1.5 text-end font-medium ${r.state === "done" ? "text-success-700" : r.state === "pending" ? "text-warning-700" : "text-ink-3"}`}>
              {icon(r.state)}
              <span>{r.value}{r.sub && <span className="block text-xs font-normal text-ink-3">{r.sub}</span>}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        {T.note}{" "}
        <Link href={`/${locale}/verification`} className="text-brand-700 hover:underline">{T.learnMore}</Link>
      </p>
    </section>
  );
}
