import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserRound } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { t } from "@/i18n/t";
import { getCurrentUser } from "@/server/session";
import { favoriteIds, getPublicSeller } from "@/server/queries";
import { sellerPublicListings } from "@/server/listings";
import { ListingCard } from "@/components/listing-card";
import { EmptyState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/sellers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { dict } = await resolveLocale(params);
  const s = await getPublicSeller(id);
  return { title: s ? s.name : dict.common.notFoundTitle, robots: { index: false, follow: true } };
}

export default async function SellerPage({ params }: PageProps<"/[lang]/sellers/[id]">) {
  const { id } = await params;
  const { locale, dict } = await resolveLocale(params);
  const seller = await getPublicSeller(id);
  if (!seller) notFound();
  const [user, items] = await Promise.all([getCurrentUser(), sellerPublicListings(seller.id)]);
  const saved = await favoriteIds(user?.id, items.map((i) => i.id));
  return (
    <div className="container-page py-8">
      <div className="mb-8 flex items-center gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <span className="grid size-14 place-items-center rounded-full bg-navy-900 text-white"><UserRound className="size-6" /></span>
        <div>
          <h1 className="text-2xl font-bold"><bdi>{seller.name}</bdi></h1>
          <p className="text-sm text-ink-3">
            {seller.role === "dealer" ? dict.seller.dealer : dict.seller.individual} — {dict.seller.memberSince} {formatDate(seller.createdAt, locale, { month: "long", year: "numeric" })}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">{dict.seller.notVerified}</p>
        </div>
      </div>
      <h2 className="mb-5 text-xl font-bold">{t(dict.seller.listings, { name: seller.name })}</h2>
      {items.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((i) => <ListingCard key={i.id} item={i} locale={locale} dict={dict} saved={saved.has(i.id)} signedIn={!!user} />)}
        </div>
      ) : (
        <EmptyState title={dict.seller.noListings} />
      )}
    </div>
  );
}
