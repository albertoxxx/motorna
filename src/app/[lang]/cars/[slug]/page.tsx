import type { Metadata } from "next";
import { isColorKey } from "@/lib/validation";
import { BackToResults } from "@/components/back-to-results";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileCheck2, Gauge, Settings2, Fuel, MapPin, ShieldAlert, UserRound, Pencil, MessageSquare } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { t } from "@/i18n/t";
import type { Locale } from "@/i18n/config";
import { getCurrentUser } from "@/server/session";
import { favoriteIds } from "@/server/queries";
import { countSellerActive, getListingBySlug, similarListings } from "@/server/listings";
import { isPubliclyVisible } from "@/lib/listing-state";
import { formatDate, formatKm, formatNumber, formatPrice, formatRelative } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { Gallery } from "@/components/gallery";
import { ContactPanel } from "@/components/contact-panel";
import { ReportButton } from "@/components/report-button";
import { ShareButton } from "@/components/share-button";
import { TrustPanel } from "@/components/trust-panel";
import { listingTrust } from "@/server/verification";
import { FavoriteButton } from "@/components/favorite-button";
import { ListingCard } from "@/components/listing-card";
import { PlateTag } from "@/components/logo";
import { Badge, statusTone } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { ButtonLink, buttonClass } from "@/components/ui/button";

async function load(params: PageProps<"/[lang]/cars/[slug]">["params"]) {
  const { lang, slug } = await params;
  const { locale, dict } = await resolveLocale(Promise.resolve({ lang }));
  const data = await getListingBySlug(slug);
  return { locale, dict, data };
}

export async function generateMetadata({ params }: PageProps<"/[lang]/cars/[slug]">): Promise<Metadata> {
  const { locale, dict, data } = await load(params);
  if (!data || !isPubliclyVisible(data.listing.status, data.listing.deletedAt)) return { title: dict.common.notFoundTitle, robots: { index: false } };
  const l = data.listing;
  const title = `${locale === "ar" ? data.make.nameAr : data.make.nameEn} ${locale === "ar" ? data.model.nameAr : data.model.nameEn} ${l.year} — ${formatPrice(l.priceEgp, locale)}`;
  const description = `${formatKm(l.mileageKm, locale)} · ${dict.enums.transmission[l.transmission]} · ${locale === "ar" ? data.city.nameAr : data.city.nameEn}`;
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/cars/${l.slug}`, languages: { ar: `/ar/cars/${l.slug}`, en: `/en/cars/${l.slug}` } },
    openGraph: { title, description, images: data.images[0] ? [{ url: data.images[0].url, width: data.images[0].width, height: data.images[0].height }] : undefined },
    robots: l.status === "sold" ? { index: false, follow: true } : undefined,
  };
}

function Spec({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="text-end font-medium text-ink">{value}</dd>
    </div>
  );
}

export default async function ListingPage({ params }: PageProps<"/[lang]/cars/[slug]">) {
  const { locale, dict, data } = await load(params);
  if (!data) notFound();
  const user = await getCurrentUser();
  const l = data.listing;
  const seller = data.seller;
  const isOwner = user?.id === l.sellerId;
  const isAdmin = user?.role === "admin";
  const visible = isPubliclyVisible(l.status, l.deletedAt) && !data.seller.suspendedAt;
  if (!visible && !isOwner && !isAdmin) notFound();

  const [saved, similar, sellerActive, trust] = await Promise.all([
    favoriteIds(user?.id, [l.id]),
    l.status === "published" ? similarListings(l) : Promise.resolve([]),
    countSellerActive(l.sellerId),
    listingTrust({ id: l.id, sellerId: l.sellerId, makeId: l.makeId, modelId: l.modelId, year: l.year }),
  ]);
  const similarSaved = await favoriteIds(user?.id, similar.map((s) => s.id));

  const L = dict.listing;
  const make = locale === "ar" ? data.make.nameAr : data.make.nameEn;
  const model = locale === "ar" ? data.model.nameAr : data.model.nameEn;
  const city = locale === "ar" ? data.city.nameAr : data.city.nameEn;
  const name = `${make} ${model} ${l.year}`;
  const selfHref = `/${locale}/cars/${l.slug}`;
  const showMobileBar = !isOwner && l.status === "published";
  const signInHref = `/${locale}/auth/sign-in?next=${encodeURIComponent(selfHref)}`;

  const statusMsg =
    l.status === "rejected"
      ? t(L.statusNotice.rejected, { reason: l.rejectionReason ?? "—" })
      : l.status !== "published"
        ? L.statusNotice[l.status as Exclude<typeof l.status, "published" | "rejected">]
        : null;

  // Structured data only with fields we actually have.
  const jsonLd =
    l.status === "published"
      ? {
          "@context": "https://schema.org",
          "@type": "Car",
          name: `${data.make.nameEn} ${data.model.nameEn} ${l.year}`,
          brand: { "@type": "Brand", name: data.make.nameEn },
          model: data.model.nameEn,
          vehicleModelDate: String(l.year),
          mileageFromOdometer: { "@type": "QuantitativeValue", value: l.mileageKm, unitCode: "KMT" },
          vehicleTransmission: l.transmission,
          fuelType: l.fuelType,
          itemCondition: l.condition === "new" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
          image: data.images.map((i) => `${siteUrl()}${i.url}`),
          offers: { "@type": "Offer", price: l.priceEgp, priceCurrency: "EGP", availability: "https://schema.org/InStock", url: `${siteUrl()}${selfHref}` },
        }
      : null;

  return (
    <div className={`container-page py-6 sm:py-8 ${showMobileBar ? "pb-28 lg:pb-8" : ""}`}>
      {showMobileBar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="tabular truncate text-lg font-bold text-navy-900">{formatPrice(l.priceEgp, locale)}</p>
              <p className="truncate text-xs text-ink-3">{make} {model} {l.year}</p>
            </div>
            <a href={user ? "#contact" : signInHref} className={buttonClass("primary", "lg", "shrink-0")}>
              <MessageSquare className="size-4" aria-hidden />
              {user ? L.contactSeller : dict.nav.signIn}
            </a>
          </div>
        </div>
      )}
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}

      <div className="mb-2"><BackToResults locale={locale} label={L.backToResults} /></div>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-3">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href={`/${locale}/cars`} className="hover:text-ink">{dict.nav.browse}</Link></li>
          <li aria-hidden>/</li>
          <li><Link href={`/${locale}/cars?make=${data.make.slug}`} className="hover:text-ink">{make}</Link></li>
          <li aria-hidden>/</li>
          <li><Link href={`/${locale}/cars?make=${data.make.slug}&model=${data.model.slug}`} className="hover:text-ink">{model}</Link></li>
        </ol>
      </nav>

      {statusMsg && (
        <Notice tone={l.status === "rejected" ? "danger" : "warning"} className="mb-5">
          {statusMsg}
        </Notice>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-1">
          <Gallery images={data.images} alt={name} labels={{ noPhotos: L.noPhotos, photoOf: L.photoOf, prev: dict.common.previous, next: dict.common.nextPage, fullscreen: L.fullscreen, close: dict.nav.close }} />
        </div>

        {/* One summary: after the gallery on mobile, sticky sidebar on desktop */}
        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="lg:sticky lg:top-20">
            <Summary />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-8 lg:col-start-1">

          <section aria-labelledby="specs">
            <h2 id="specs" className="mb-2 text-lg font-bold">{L.specs}</h2>
            <dl className="grid rounded-[var(--radius-lg)] border border-line bg-surface px-5 sm:grid-cols-2 sm:gap-x-10">
              <Spec label={L.year} value={<span className="tabular">{l.year}</span>} />
              <Spec label={L.mileage} value={<span className="tabular">{formatKm(l.mileageKm, locale)}</span>} />
              <Spec label={L.condition} value={dict.enums.condition[l.condition]} />
              <Spec label={L.transmission} value={dict.enums.transmission[l.transmission]} />
              <Spec label={L.fuel} value={dict.enums.fuel[l.fuelType]} />
              <Spec label={L.body} value={l.bodyType ? dict.enums.body[l.bodyType] : <span className="text-ink-3">{dict.common.notProvided}</span>} />
              <Spec label={L.engine} value={l.engineCc ? <span className="tabular">{formatNumber(l.engineCc, locale)} {L.cc}</span> : <span className="text-ink-3">{dict.common.notProvided}</span>} />
              <Spec label={L.color} value={l.color ? (isColorKey(l.color) ? dict.enums.color[l.color] : <bdi>{l.color}</bdi>) : <span className="text-ink-3">{dict.common.notProvided}</span>} />
              <Spec label={L.trim} value={l.trim ? <span className="ltr-run">{l.trim}</span> : <span className="text-ink-3">{dict.common.notProvided}</span>} />
              <Spec label={L.location} value={`${city}${l.area ? ` — ${l.area}` : ""}`} />
            </dl>
          </section>

          <section aria-labelledby="desc">
            <h2 id="desc" className="mb-3 text-lg font-bold">{L.description}</h2>
            {l.description.trim() ? (
              <p dir="auto" className="max-w-[70ch] whitespace-pre-line leading-relaxed text-ink-2">{l.description}</p>
            ) : (
              <p className="text-ink-3">{L.noDescription}</p>
            )}
          </section>

          <section aria-labelledby="defects">
            <h2 id="defects" className="mb-3 text-lg font-bold">{L.knownDefects}</h2>
            {l.knownDefects?.trim() ? (
              <p dir="auto" className="max-w-[70ch] whitespace-pre-line leading-relaxed text-ink-2">{l.knownDefects}</p>
            ) : (
              <p className="text-ink-3">{L.noKnownDefects}</p>
            )}
          </section>

          <aside className="rounded-[var(--radius-lg)] border border-warning-600/30 bg-warning-50 p-5">
            <h2 className="mb-2 flex items-center gap-2 font-semibold text-warning-700">
              <ShieldAlert className="size-5" />
              {L.safetyTitle}
            </h2>
            <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm leading-relaxed text-ink-2">
              {L.safetyTips.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </aside>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-14" aria-labelledby="similar">
          <h2 id="similar" className="mb-5 text-xl font-bold">{L.similar}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {similar.map((s) => (
              <ListingCard key={s.id} item={s} locale={locale} dict={dict} saved={similarSaved.has(s.id)} signedIn={!!user} />
            ))}
          </div>
        </section>
      )}
    </div>
  );

  function Summary() {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {l.status !== "published" && <Badge tone={statusTone(l.status)}>{dict.enums.status[l.status]}</Badge>}
            <Badge>{dict.enums.condition[l.condition]}</Badge>
            {trust.licence.state === "verified" && <Badge tone="success" icon={<FileCheck2 className="size-3.5" aria-hidden />}>{dict.verify.badge}</Badge>}
          </div>
          <h1 className="text-2xl font-bold leading-tight">
            {make} {model} <span className="tabular">{l.year}</span>
          </h1>
          {l.trim && <p className="ltr-run mt-1 text-ink-3">{l.trim}</p>}
          <div className="mt-4">
            <PlateTag caption={l.negotiable ? L.negotiable : L.fixedPrice}>{formatPrice(l.priceEgp, locale as Locale)}</PlateTag>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-3 text-sm text-ink-2">
            <li className="flex items-center gap-2"><CalendarDays className="size-4 text-ink-3" /><span className="tabular">{l.year}</span></li>
            <li className="flex items-center gap-2"><Gauge className="size-4 text-ink-3" /><span className="tabular">{formatKm(l.mileageKm, locale)}</span></li>
            <li className="flex items-center gap-2"><Settings2 className="size-4 text-ink-3" />{dict.enums.transmission[l.transmission]}</li>
            <li className="flex items-center gap-2"><Fuel className="size-4 text-ink-3" />{dict.enums.fuel[l.fuelType]}</li>
            <li className="col-span-2 flex items-center gap-2"><MapPin className="size-4 text-ink-3" />{city}{l.area ? ` — ${l.area}` : ""}</li>
          </ul>
          {l.publishedAt && (
            <p className="mt-4 text-xs text-ink-3">
              {L.postedAt} {formatRelative(l.publishedAt, locale)}
            </p>
          )}
        </div>

        <div id="contact" className="scroll-mt-24 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          {isOwner ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-2">{L.ownListing}</p>
              <ButtonLink href={`/${locale}/account/listings/${l.id}/edit`} variant="dark" size="lg" className="w-full">
                <Pencil className="size-4" />
                {L.manageListing}
              </ButtonLink>
            </div>
          ) : l.status === "published" ? (
            <ContactPanel
              listingId={l.id}
              locale={locale}
              signedIn={!!user}
              sellerHasPhone={seller.phoneAvailable}
              signInHref={signInHref}
              dict={{ listing: dict.listing, errors: dict.errors, common: dict.common, messages: dict.messages }}
            />
          ) : (
            <p className="text-sm text-ink-3">{dict.messages.listingUnavailable}</p>
          )}
          {!isOwner && l.status === "published" && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <FavoriteButton
                listingId={l.id}
                initial={saved.has(l.id)}
                signedIn={!!user}
                signInHref={signInHref}
                variant="full"
                labels={{ save: L.save, saved: L.saved, signIn: L.saveSignIn, error: dict.errors.generic }}
              />
              <ShareButton title={`${make} ${model} ${l.year}`} labels={{ share: L.share, copied: L.linkCopied, failed: L.shareFailed }} />
              <ReportButton
                listingId={l.id}
                signedIn={!!user}
                signInHref={signInHref}
                dict={{ listing: dict.listing, enums: dict.enums, errors: dict.errors, common: dict.common, nav: dict.nav, validation: dict.validation }}
              />
            </div>
          )}
        </div>

        <TrustPanel listingStatus={l.status} dict={dict} locale={locale} phoneVerified={trust.phone} licence={trust.licence} />

        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-3">{L.seller}</h2>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-navy-900 text-white">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold"><bdi>{seller.name}</bdi></p>
              <p className="text-sm text-ink-3">
                {seller.role === "dealer" ? dict.seller.dealer : dict.seller.individual} · {L.memberSince}{" "}
                {formatDate(seller.createdAt, locale, { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-2">
            {sellerActive === 1 ? L.activeListingsOne : <><span className="tabular font-semibold">{formatNumber(sellerActive, locale)}</span> {L.activeListings}</>}
          </p>
                    <Link href={`/${locale}/sellers/${seller.id}`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
            {L.viewProfile}
          </Link>
        </div>
      </div>
    );
  }
}
