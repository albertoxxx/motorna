import { Heart } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { userFavoriteListingIds } from "@/server/queries";
import { listingsByIds } from "@/server/listings";
import { ListingCard } from "@/components/listing-card";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { robots: { index: false } };

export default async function FavoritesPage({ params }: PageProps<"/[lang]/account/favorites">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale);
  const ids = await userFavoriteListingIds(user.id);
  const rows = await listingsByIds(ids);
  const items = ids.map((id) => rows.find((r) => r.id === id)).filter((r) => r && (r.status === "published" || r.status === "sold"));
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{dict.account.favoritesTitle}</h1>
      {items.length === 0 ? (
        <EmptyState icon={<Heart className="size-8" />} title={dict.account.favoritesEmptyTitle} body={dict.account.favoritesEmptyBody} action={<ButtonLink href={`/${locale}/cars`} variant="secondary">{dict.nav.browse}</ButtonLink>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {items.map((item) => <ListingCard key={item!.id} item={item!} locale={locale} dict={dict} saved signedIn />)}
        </div>
      )}
    </div>
  );
}
