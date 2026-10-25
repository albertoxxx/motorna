import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Clock, MapPin, Wrench } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { CareDictionary } from "@/i18n/dictionaries/care-ar";
import { formatDate } from "@/lib/format";

export type CenterCardData = {
  slug: string;
  nameAr: string;
  nameEn: string;
  area: string | null;
  cityNameAr: string;
  cityNameEn: string;
  lastVerifiedAt: Date | null;
  approvedAt: Date | null;
  categories: string[];
  category: "authorized_service" | "independent_workshop" | "inspection_center";
  coverUrl: string | null;
  makes: { nameAr: string; nameEn: string }[];
  today: null | { closed: true } | { closed: false; opens: string; closes: string };
};

/** Directory card. Only rendered for approved centers, so the review badge is always backed by a recorded approval. */
export function CenterCard({ c, locale, K }: { c: CenterCardData; locale: Locale; K: CareDictionary }) {
  const verified = c.lastVerifiedAt ?? c.approvedAt;
  const name = locale === "ar" ? c.nameAr : c.nameEn;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface transition-colors hover:border-line-strong">
      <div className="relative aspect-[16/9] bg-canvas">
        {c.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.coverUrl} alt="" loading="lazy" decoding="async" width={640} height={360} className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-ink-3"><Wrench className="size-8" aria-hidden /></div>
        )}
        <span className="absolute start-3 top-3 rounded-md bg-surface/95 px-2 py-1 text-xs font-semibold text-navy-900 shadow-sm">{K.providers[c.category].short}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-snug">
          <Link href={`/${locale}/care/centers/${c.slug}`} className="after:absolute after:inset-0 after:content-['']"><bdi>{name}</bdi></Link>
        </h3>
        <ArrowUpRight className="mt-1 size-4 shrink-0 text-ink-3 transition-colors group-hover:text-brand-700 rtl:-scale-x-100" aria-hidden />
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-2">
        <MapPin className="size-3.5 shrink-0 text-ink-3" aria-hidden />
        <span>{locale === "ar" ? c.cityNameAr : c.cityNameEn}{c.area && <>{locale === "ar" ? "، " : ", "}<bdi>{c.area}</bdi></>}</span>
      </p>
      <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
        <BadgeCheck className="size-3.5" aria-hidden />
        {K.verification[c.category].badge}
        {verified && <span className="font-normal text-success-700/80">· {K.card.verifiedOn.replace("{date}", formatDate(verified, locale))}</span>}
      </p>
      {c.makes.length > 0 && (
        <p className="mt-3 line-clamp-1 text-sm text-ink-2">
          <span className="text-ink-3">{K.detail.makesTitle}: </span>
          {c.makes.slice(0, 4).map((m) => (locale === "ar" ? m.nameAr : m.nameEn)).join(locale === "ar" ? "، " : ", ")}
          {c.makes.length > 4 && ` +${c.makes.length - 4}`}
        </p>
      )}
      {c.categories.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={K.detail.services}>
          {c.categories.slice(0, 3).map((k) => (
            <li key={k} className="rounded-md bg-navy-900/[0.05] px-2 py-1 text-xs text-ink-2">{K.enums.category[k as keyof typeof K.enums.category]}</li>
          ))}
          {c.categories.length > 3 && <li className="rounded-md bg-navy-900/[0.05] px-2 py-1 text-xs text-ink-3">+{c.categories.length - 3}</li>}
        </ul>
      )}
      <p className="mt-auto flex items-center gap-1.5 border-t border-line pt-3 text-sm text-ink-2 [&:not(:first-child)]:mt-4">
        <Clock className="size-3.5 shrink-0 text-ink-3" aria-hidden />
        {c.today === null ? (
          <span className="text-ink-3">{K.card.noHours}</span>
        ) : c.today.closed ? (
          <span>{K.card.closedToday}</span>
        ) : (
          <span>{K.card.today.split("{hours}")[0]}<span dir="ltr" className="tabular">{c.today.opens}–{c.today.closes}</span></span>
        )}
      </p>
      </div>
    </article>
  );
}
