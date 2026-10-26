import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { adminLicenceQueue } from "@/server/verification";
import { LicenceReview } from "@/components/licence-review";
import { Notice } from "@/components/ui/states";
import { formatRelative } from "@/lib/format";

export default async function AdminLicences({ params }: PageProps<"/[lang]/admin/licences">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const rows = await adminLicenceQueue();
  const V = dict.verify;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{V.adminTitle}</h1>
      <p className="text-sm text-ink-2">{V.adminIntro}</p>
      {rows.length === 0 ? <p className="text-sm text-ink-3">{V.adminEmpty}</p> : (
        <ul className="flex flex-col gap-4">
          {rows.map((r) => {
            const mismatch = r.makeId !== r.snapshotMakeId || (r.modelId ?? null) !== (r.snapshotModelId ?? null) || r.year !== r.snapshotYear;
            const files = [["front", r.frontType], ...(r.hasBack ? [["back", r.backType]] : [])] as [string, string | null][];
            return (
              <li key={r.id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/${locale}/cars/${r.slug}`} className="font-semibold hover:underline">
                    <bdi>{locale === "ar" ? r.makeAr : r.makeEn} {r.modelAr ? (locale === "ar" ? r.modelAr : r.modelEn) : ""} {r.year}</bdi>
                  </Link>
                  <span className="text-xs text-ink-3"><bdi>{r.sellerName}</bdi> · {formatRelative(r.createdAt, locale)}</span>
                </div>
                <p className="text-sm text-ink-3"><bdi>{r.title}</bdi></p>
                {mismatch && <Notice tone="warning" className="mt-3"><p>{V.adminMismatch}</p></Notice>}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {files.map(([side, type]) => (
                    <a key={side} href={`/api/licence/${r.id}/${side}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-[var(--radius-md)] border border-line bg-canvas">
                      {type?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/licence/${r.id}/${side}`} alt={side === "front" ? V.front : V.back} className="max-h-72 w-full object-contain" />
                      ) : (
                        <span className="block p-4 text-sm font-medium text-brand-700 underline">{V.openFile.replace("{side}", side === "front" ? V.front : V.back)}</span>
                      )}
                    </a>
                  ))}
                </div>
                <div className="mt-4"><LicenceReview dict={{ verify: V, errors: dict.errors }} checkId={r.id} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
