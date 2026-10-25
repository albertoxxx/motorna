import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Check, Globe, Info, Mail, MapPin, Phone, Wrench } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { publicCenterBySlug } from "@/server/care";
import { applicableCriteria, type CenterCriterion } from "@/lib/care";
import { formatDate, formatPrice } from "@/lib/format";
import { Gallery } from "@/components/gallery";

export async function generateMetadata({ params }: PageProps<"/[lang]/care/centers/[slug]">): Promise<Metadata> {
  const { locale, dict } = await resolveLocale(params);
  const { slug } = await params;
  const c = await publicCenterBySlug(slug);
  if (!c) return {};
  const name = locale === "ar" ? c.nameAr : c.nameEn;
  return {
    title: `${name} · ${dict.care.name}`,
    description: c.description?.slice(0, 160) || dict.care.intro,
    alternates: { canonical: `/${locale}/care/centers/${slug}`, languages: { ar: `/ar/care/centers/${slug}`, en: `/en/care/centers/${slug}` } },
  };
}

function Card({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
      <h2 id={id} className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function CenterPublicPage({ params }: PageProps<"/[lang]/care/centers/[slug]">) {
  const { locale, dict } = await resolveLocale(params);
  const { slug } = await params;
  const c = await publicCenterBySlug(slug);
  if (!c) notFound();
  const K = dict.care;
  const D = K.detail;
  const name = locale === "ar" ? c.nameAr : c.nameEn;
  const verified = c.lastVerifiedAt ?? c.approvedAt;
  const offersInspection = c.services.some((s) => s.category === "pre_purchase_inspection");
  const checks = new Map(c.checks.map((k) => [k.criterion as CenterCriterion, k.checkedAt]));
  const confirmed = applicableCriteria(c.category, offersInspection).filter((k) => checks.has(k));
  const equipmentCheck = checks.get("inspection_equipment");
  const order = [6, 0, 1, 2, 3, 4, 5];
  // A pin only when the center supplied one; otherwise a search for the address it entered.
  const hasPin = c.latitude != null && c.longitude != null;
  const mapUrl = hasPin
    ? `https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.address}, ${c.area ?? ""}, ${c.cityNameEn}, Egypt`)}`;
  const sep = locale === "ar" ? "، " : ", ";

  return (
    <div className="container-page py-8 sm:py-10">
      <Link href={`/${locale}/care`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {D.back}
      </Link>

      <header className="mt-4 flex flex-col gap-3 border-b border-line pb-6">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700"><Wrench className="size-4" aria-hidden />{K.name}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl"><bdi>{name}</bdi></h1>
        <p className="flex items-center gap-1.5 text-ink-2">
          <MapPin className="size-4 text-ink-3" aria-hidden />
          {locale === "ar" ? c.cityNameAr : c.cityNameEn}{c.area && <>{sep}<bdi>{c.area}</bdi></>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-navy-900 px-3 py-1 text-sm font-medium text-white">{K.providers[c.category].short}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-sm font-medium text-success-700">
            <BadgeCheck className="size-4" aria-hidden />
            {K.verification[c.category].badge}
          </span>
          {verified && <span className="text-sm text-ink-3">{D.lastVerified.replace("{date}", formatDate(verified, locale, { dateStyle: "long" }))}</span>}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {c.photos.length > 0 && (
            <section aria-label={D.photosTitle}>
              <Gallery images={c.photos} alt={name} labels={{ noPhotos: D.photosTitle, photoOf: D.photoOf, prev: dict.common.previous, next: dict.common.nextPage, fullscreen: dict.listing.fullscreen, close: dict.nav.close }} />
            </section>
          )}
          {c.description && (
            <Card id="about" title={D.about}>
              <p dir="auto" className="whitespace-pre-line leading-relaxed text-ink-2">{c.description}</p>
              {c.vehicleTypes.length > 0 && (
                <p className="mt-4 text-sm"><span className="font-medium">{D.vehicleTypes}: </span><span className="text-ink-2">{c.vehicleTypes.map((t) => K.enums.vehicleType[t as keyof typeof K.enums.vehicleType] ?? t).join(sep)}</span></p>
              )}
            </Card>
          )}

          <Card id="services" title={D.services}>
            {c.services.length === 0 ? (
              <p className="text-ink-3">{D.noServices}</p>
            ) : (
              <ul className="-my-3 divide-y divide-line">
                {c.services.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                    <div className="min-w-0">
                      <p className="font-medium"><bdi>{locale === "ar" ? s.nameAr : s.nameEn}</bdi></p>
                      <p className="text-sm text-ink-3">{K.enums.category[s.category]} · {D.durationMin.replace("{n}", String(s.durationMin))}</p>
                    </div>
                    <p className="tabular font-semibold text-navy-900">{s.priceMode === "fixed" && s.priceEgp != null ? formatPrice(s.priceEgp, locale) : D.onQuotation}</p>
                  </li>
                ))}
              </ul>
            )}
            {c.quotationPolicy && (
              <div className="mt-5 rounded-[var(--radius-md)] bg-canvas p-4 text-sm">
                <p className="font-medium">{D.quotationPolicy}</p>
                <p dir="auto" className="mt-1 whitespace-pre-line text-ink-2">{c.quotationPolicy}</p>
              </div>
            )}
          </Card>

          <Card id="makes" title={D.makesTitle}>
            {c.makes.length === 0 ? (
              <p className="text-ink-3">{D.noMakes}</p>
            ) : (
              <>
                {c.category === "authorized_service" && <p className="mb-2 text-sm text-ink-3">{D.makesAuthorized}</p>}
                <ul className="flex flex-wrap gap-2">
                  {c.makes.map((m) => <li key={m.id}><Link href={`/${locale}/care?make=${m.slug}`} className="inline-block rounded-md bg-navy-900/[0.05] px-2.5 py-1 text-sm hover:bg-navy-900/10">{locale === "ar" ? m.nameAr : m.nameEn}</Link></li>)}
                </ul>
              </>
            )}
          </Card>

          <Card id="equipment" title={D.equipmentTitle}>
            {c.equipment.length === 0 ? (
              <p className="text-ink-3">{D.noEquipment}</p>
            ) : (
              <>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {c.equipment.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                      <span>{K.enums.equipment[e.kind]}{e.details && <span className="text-ink-3"> — <bdi>{e.details}</bdi></span>}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-ink-3">
                  {D.equipmentDeclared}
                  {offersInspection && equipmentCheck && <> {D.equipmentConfirmed.replace("{date}", formatDate(equipmentCheck, locale))}</>}
                </p>
              </>
            )}
          </Card>

          {c.technicians.length > 0 && (
            <Card id="technicians" title={D.techniciansTitle}>
              <p className="text-sm font-medium">{c.technicians.length === 1 ? D.techniciansOne : D.techniciansCount.replace("{n}", String(c.technicians.length))}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {c.technicians.filter((t) => t.specialty || t.yearsExperience != null).map((t, i) => (
                  <li key={i} className="rounded-md bg-navy-900/[0.05] px-2.5 py-1 text-sm text-ink-2">
                    {t.specialty && <bdi>{t.specialty}</bdi>}
                    {t.specialty && t.yearsExperience != null && " · "}
                    {t.yearsExperience != null && D.years.replace("{n}", String(t.yearsExperience))}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card id="review" title={D.verificationTitle}>
            <p className="text-sm font-medium">{K.verification[c.category].badge}</p>
            <p className="mt-1 text-sm text-ink-2">{K.verification[c.category].body}</p>
            <p className="mt-3 text-sm text-ink-2">{D.scopeBody}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {confirmed.map((k) => (
                <li key={k} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-700 text-white"><Check className="size-3.5" aria-hidden /></span>
                  <div>
                    <p className="text-sm font-medium">{K.criteria[k].title}</p>
                    <p className="text-sm text-ink-2">{K.criteria[k].body}</p>
                    <p className="text-xs text-ink-3">{D.checkedOn.replace("{date}", formatDate(checks.get(k)!, locale))}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-3">{K.verification.separate}</p>
            <div className="mt-4 flex gap-3 rounded-[var(--radius-md)] border border-warning-600/30 bg-warning-50 p-4 text-sm text-warning-700">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">{D.notLicenseTitle}</p>
                <p className="mt-1">{D.notLicenseBody}</p>
              </div>
            </div>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <Card id="contact" title={D.contact}>
            <div className="flex flex-col gap-2">
              <a href={`tel:${c.phone}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                <Phone className="size-4" aria-hidden />
                {D.call} <span dir="ltr" className="tabular">{c.phone}</span>
              </a>
              {c.email && (
                <a href={`mailto:${c.email}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-4 text-sm font-medium hover:bg-canvas">
                  <Mail className="size-4" aria-hidden />{D.email}
                </a>
              )}
              {c.website && (
                <a href={c.website} target="_blank" rel="nofollow noopener" className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-4 text-sm font-medium hover:bg-canvas">
                  <Globe className="size-4" aria-hidden />{D.website}
                </a>
              )}
            </div>
            <p className="mt-4 text-xs text-ink-3">{D.bookingNow}</p>
          </Card>

          <Card id="location" title={D.location}>
            <p dir="auto" className="text-sm text-ink-2">{c.address}</p>
            <a href={mapUrl} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
              <MapPin className="size-4" aria-hidden />{hasPin ? D.openPin : D.openMap}
            </a>
          </Card>

          <Card id="hours" title={D.hours}>
            {c.hours.length === 0 ? (
              <p className="text-sm text-ink-3">{D.noHours}</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {order.map((d) => {
                  const h = c.hours.find((x) => x.weekday === d);
                  return (
                    <div key={d} className="contents">
                      <dt className="text-ink-2">{K.enums.weekday[d]}</dt>
                      <dd className="tabular text-end" dir="ltr">{h ? `${h.opens}–${h.closes}` : <span className="text-ink-3">{D.closed}</span>}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
