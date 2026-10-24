import Link from "next/link";
import { Gauge, MapPin, Settings2, ImageIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ListingCardData } from "@/server/listings";
import { formatKm, formatPrice } from "@/lib/format";
import { FavoriteButton } from "./favorite-button";

export function ListingCard({
  item,
  locale,
  dict,
  saved,
  signedIn,
  priority,
}: {
  item: ListingCardData;
  locale: Locale;
  dict: Dictionary;
  saved: boolean;
  signedIn: boolean;
  priority?: boolean;
}) {
  const make = locale === "ar" ? item.makeNameAr : item.makeNameEn;
  const model = locale === "ar" ? item.modelNameAr : item.modelNameEn;
  const city = locale === "ar" ? item.cityNameAr : item.cityNameEn;
  const href = `/${locale}/cars/${item.slug}`;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface transition-colors hover:border-line-strong">
      <div className="relative aspect-[4/3] overflow-hidden bg-canvas">
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            alt={`${make} ${model} ${item.year}`}
            width={640}
            height={480}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid size-full place-items-center text-ink-3">
            <ImageIcon className="size-8" aria-hidden />
            <span className="sr-only">{dict.listing.noPhotos}</span>
          </div>
        )}
        {item.status === "sold" && (
          <span className="absolute start-3 top-3 rounded bg-navy-900 px-2 py-1 text-xs font-semibold text-white">{dict.listing.soldBadge}</span>
        )}
        {item.condition === "new" && item.status !== "sold" && (
          <span className="absolute start-3 top-3 rounded bg-white px-2 py-1 text-xs font-semibold text-navy-900">{dict.enums.condition.new}</span>
        )}
        <div className="absolute end-3 top-3 z-10">
          <FavoriteButton
            listingId={item.id}
            initial={saved}
            signedIn={signedIn}
            signInHref={`/${locale}/auth/sign-in?next=${encodeURIComponent(href)}`}
            labels={{ save: dict.listing.save, saved: dict.listing.saved, signIn: dict.listing.saveSignIn, error: dict.errors.generic }}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-[0.95rem] font-semibold leading-snug text-ink">
            <Link href={href} className="after:absolute after:inset-0 after:content-['']">
              {make} {model} <span className="tabular text-ink-2">{item.year}</span>
            </Link>
          </h3>
          {item.trim && <p className="mt-0.5 truncate text-sm text-ink-3">{item.trim}</p>}
        </div>
        <p className="tabular text-lg font-bold text-navy-900">{formatPrice(item.priceEgp, locale)}</p>
        <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[0.8rem] text-ink-2">
          <li className="flex items-center gap-1.5">
            <Gauge className="size-3.5 text-ink-3" aria-hidden />
            <span className="tabular">{formatKm(item.mileageKm, locale)}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Settings2 className="size-3.5 text-ink-3" aria-hidden />
            {dict.enums.transmission[item.transmission]}
          </li>
          <li className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-ink-3" aria-hidden />
            {city}
          </li>
        </ul>
      </div>
    </article>
  );
}

export function ListingGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
      <div className="skeleton aspect-[4/3]" />
      <div className="flex flex-col gap-3 p-4">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-5 w-1/2 rounded" />
        <div className="skeleton h-3 w-full rounded" />
      </div>
    </div>
  );
}
