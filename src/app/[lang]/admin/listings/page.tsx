import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { moderationQueue } from "@/server/queries";
import { ModerationActions } from "@/components/admin-actions";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatKm, formatPrice, formatRelative } from "@/lib/format";

export default async function ModerationPage({ params }: PageProps<"/[lang]/admin/listings">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const queue = await moderationQueue();
  const A = dict.admin;
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">{A.moderation}</h1>
      <details className="mb-6 text-sm text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">{A.checklist}</summary>
        <ul className="mt-2 list-disc ps-5">{A.checklistItems.map((i) => <li key={i}>{i}</li>)}</ul>
      </details>
      {queue.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="size-8" />} title={A.queueEmpty} />
      ) : (
        <ul className="flex flex-col gap-4">
          {queue.map((l) => (
            <li key={l.id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/${locale}/cars/${l.slug}`} className="text-lg font-semibold hover:underline"><bdi>{l.title}</bdi></Link>
                  {!l.modelVerified && (
                    <p className="mt-1">
                      <Badge tone="warning">{A.newModel}: {l.makeNameEn} {l.modelNameEn}</Badge>
                      <span className="ms-2 text-xs text-ink-3">{A.newModelHint}</span>
                    </p>
                  )}
                  <p className="tabular mt-1 text-sm text-ink-2">
                    {formatPrice(l.priceEgp, locale)} — {formatKm(l.mileageKm, locale)} — {locale === "ar" ? l.cityNameAr : l.cityNameEn}
                  </p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-ink-3">
                    <dt>{A.submittedBy}</dt>
                    <dd className="text-ink-2"><bdi>{l.sellerName}</bdi> · <bdi dir="ltr">{l.sellerEmail}</bdi></dd>
                    <dt>{dict.listing.memberSince}</dt>
                    <dd className="tabular">{formatDate(l.sellerCreatedAt, locale)}</dd>
                    <dt>{A.submittedAt}</dt>
                    <dd>{l.submittedAt ? formatRelative(l.submittedAt, locale) : "—"}</dd>
                  </dl>
                </div>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto">
                {l.images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={img.id} src={img.thumbUrl} alt="" className="h-24 w-32 shrink-0 rounded-[var(--radius-sm)] object-cover" />
                ))}
              </div>
              <p dir="auto" className="mt-4 line-clamp-4 whitespace-pre-line text-sm text-ink-2">{l.description}</p>
              {l.knownDefects && (
                <p dir="auto" className="mt-2 whitespace-pre-line text-sm text-ink-2">
                  <span className="font-semibold text-ink">{dict.listing.knownDefects}: </span>
                  {l.knownDefects}
                </p>
              )}
              <div className="mt-4 border-t border-line pt-4">
                <ModerationActions listingId={l.id} dict={{ admin: dict.admin, errors: dict.errors, common: dict.common }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
