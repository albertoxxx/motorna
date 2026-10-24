import Link from "next/link";
import { CircleCheck, CircleDashed, Clock } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";

type State = "done" | "pending" | "none";

/**
 * Each trust signal shown separately. Only "listing review" is backed by a
 * real process today (moderation); the others stay "not yet" until their
 * verification records exist.
 */
export function TrustPanel({ listingStatus, dict, locale }: { listingStatus: string; dict: Dictionary; locale: string }) {
  const T = dict.listing.trust;
  const review: State = listingStatus === "published" || listingStatus === "sold" ? "done" : listingStatus === "pending_review" ? "pending" : "none";
  const rows: { label: string; state: State; value: string }[] = [
    { label: T.listingReview, state: review, value: review === "done" ? T.reviewed : review === "pending" ? T.inReview : T.notReviewed },
    { label: T.sellerIdentity, state: "none", value: T.notVerified },
    { label: T.documents, state: "none", value: T.notReviewed },
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
            <dd className={`flex items-center gap-1.5 font-medium ${r.state === "done" ? "text-success-700" : r.state === "pending" ? "text-warning-700" : "text-ink-3"}`}>
              {icon(r.state)}
              {r.value}
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
