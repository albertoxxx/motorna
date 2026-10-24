import Link from "next/link";
import { Fuel, Gauge, MapPin, Settings2, ImageIcon } from "lucide-react";
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
  previousPrice,
}: {
  item: ListingCardData;
  previousPrice?: number;
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
    <article className="group relative flex flex-row overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface transition-colors hover:border-line-strong sm:flex-col">
      {/* Phones: compact row (photo beside details). From 640px: classic vertical card. */}
      <div className="relative min-h-32 w-[42%] max-w-48 shrink-0 self-stretch overflow-hidden bg-canvas sm:aspect-[4/3] sm:min-h-0 sm:w-auto sm:max-w-none sm:self-auto">
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            alt={`${make} ${model} ${item.year}`}
            width={640}
            height={480}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-ink-3">
            <ImageIcon className="size-8" aria-hidden />
            <span className="sr-only">{dict.listing.noPhotos}</span>
          </div>
        )}
        {item.status === "sold" && (
          <span className="absolute start-2 top-2 rounded bg-navy-900 px-2 py-1 text-xs font-semibold text-white sm:start-3 sm:top-3">{dict.listing.soldBadge}</span>
        )}
        {item.condition === "new" && item.status !== "sold" && (
          <span className="absolute start-2 top-2 rounded bg-white px-2 py-1 text-xs font-semibold text-navy-900 sm:start-3 sm:top-3">{dict.enums.condition.new}</span>
        )}
        <div className="absolute end-2 top-2 z-10 sm:end-3 sm:top-3">
          <FavoriteButton
            listingId={item.id}
            initial={saved}
            signedIn={signedIn}
            signInHref={`/${locale}/auth/sign-in?next=${encodeURIComponent(href)}`}
            labels={{ save: dict.listing.save, saved: dict.listing.saved, signIn: dict.listing.saveSignIn, error: dict.errors.generic }}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:gap-3 sm:p-4">
        <div>
          <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-snug text-ink">
            <Link href={href} className="after:absolute after:inset-0 after:content-['']">
              {make} {model} <span className="tabular text-ink-2">{item.year}</span>
            </Link>
          </h3>
          {item.trim && <p className="mt-0.5 truncate text-sm text-ink-3">{item.trim}</p>}
        </div>
        <p className="tabular flex flex-wrap items-baseline gap-x-2 text-base font-bold text-navy-900 sm:text-lg">
          {formatPrice(item.priceEgp, locale)}
          {previousPrice && previousPrice > item.priceEgp && (
            <span className="text-xs font-medium text-ink-3">
              <span className="sr-only">{dict.listing.wasPrice} </span>
              <s>{formatPrice(previousPrice, locale)}</s>
            </span>
          )}
        </p>
        <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-[0.8rem] text-ink-2 sm:gap-x-4 sm:gap-y-1.5 sm:border-t sm:border-line sm:pt-3">
          <li className="flex items-center gap-1.5">
            <Gauge className="size-3.5 text-ink-3" aria-hidden />
            <span className="tabular">{formatKm(item.mileageKm, locale)}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Settings2 className="size-3.5 text-ink-3" aria-hidden />
            {dict.enums.transmission[item.transmission]}
          </li>
          <li className="flex items-center gap-1.5">
            <Fuel className="size-3.5 text-ink-3" aria-hidden />
            {dict.enums.fuel[item.fuelType]}
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
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
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
