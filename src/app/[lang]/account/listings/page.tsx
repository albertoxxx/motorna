import Link from "next/link";
import { Plus, CarFront } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { myListings } from "@/server/listings";
import { ButtonLink } from "@/components/ui/button";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { MyListingActions } from "@/components/my-listing-actions";
import { formatKm, formatPrice } from "@/lib/format";

export const metadata = { robots: { index: false } };

export default async function MyListingsPage({ params }: PageProps<"/[lang]/account/listings">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale);
  const items = await myListings(user.id);
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{dict.account.myListings}</h1>
        <ButtonLink href={`/${locale}/sell`} size="sm"><Plus className="size-4" />{dict.account.newListing}</ButtonLink>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<CarFront className="size-8" />} title={dict.account.noListingsTitle} body={dict.account.noListingsBody} action={<ButtonLink href={`/${locale}/sell`}>{dict.home.sellerCta}</ButtonLink>} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((l) => (
            <li key={l.id} className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-4 sm:flex-row">
              <div className="h-28 w-full shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-canvas sm:w-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.coverUrl && <img src={l.coverUrl} alt="" className="size-full object-cover" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(l.status)}>{dict.enums.status[l.status]}</Badge>
                  <span className="text-xs text-ink-3 tabular">{l.imageCount} {dict.listing.photos}</span>
                </div>
                <Link href={`/${locale}/cars/${l.slug}`} className="truncate font-semibold hover:underline"><bdi>{l.title}</bdi></Link>
                <p className="tabular text-sm text-ink-2">
                  {formatPrice(l.priceEgp, locale)} — {formatKm(l.mileageKm, locale)}
                </p>
                <div className="mt-auto pt-1">
                  <MyListingActions id={l.id} status={l.status} editHref={`/${locale}/account/listings/${l.id}/edit`} dict={{ account: dict.account, common: dict.common, errors: dict.errors }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
