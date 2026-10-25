import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { publicCenterBySlug, staffRole } from "@/server/care";
import { bookingSettings, centerBookable, customerVehicles, openDates } from "@/server/bookings";
import { getMakes, getModels } from "@/server/listings";
import { db, schema } from "@/db";
import { BookingWizard } from "@/components/care/booking-wizard";
import { Notice } from "@/components/ui/states";

export const metadata: Metadata = { robots: { index: false } };

export default async function BookPage({ params, searchParams }: PageProps<"/[lang]/care/centers/[slug]/book">) {
  const { locale, dict } = await resolveLocale(params);
  const { slug } = await params;
  const sp = await searchParams;
  const user = await requireUser(locale, `/${locale}/care/centers/${slug}/book${typeof sp.service === "string" ? `?service=${encodeURIComponent(sp.service)}` : ""}`);
  const c = await publicCenterBySlug(slug);
  if (!c) notFound();
  const T = dict.booking;
  const back = (
    <Link href={`/${locale}/care/centers/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      <bdi>{locale === "ar" ? c.nameAr : c.nameEn}</bdi>
    </Link>
  );
  const [bookable, isStaff] = await Promise.all([centerBookable(c.id), staffRole(user.id, c.id)]);
  const services = c.services.filter((s) => s.bookable);
  if (!bookable || isStaff || services.length === 0) {
    return (
      <div className="container-page max-w-3xl py-10">
        {back}
        <h1 className="mt-4 text-2xl font-bold">{T.wizard.title}</h1>
        <Notice tone="warning" className="mt-5"><p>{isStaff ? dict.errors.forbidden : T.notBookable}</p></Notice>
      </div>
    );
  }
  const [settings, vehicles, makes, models, dates, [profile]] = await Promise.all([
    bookingSettings(c.id),
    customerVehicles(user.id),
    getMakes(),
    getModels(),
    openDates(c.id),
    db.select({ name: schema.users.name, phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, user.id)),
  ]);
  const policy = locale === "ar" ? settings.policyAr || settings.policyEn : settings.policyEn || settings.policyAr;
  return (
    <div className="container-page max-w-3xl py-8 sm:py-10">
      {back}
      <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{T.wizard.title}</h1>
      <p className="mt-1 text-ink-2"><bdi>{locale === "ar" ? c.nameAr : c.nameEn}</bdi> · {dict.care.providers[c.category].short}</p>
      <div className="mt-6">
        <BookingWizard
          locale={locale}
          dict={{ booking: dict.booking, care: dict.care, common: dict.common, errors: dict.errors, validation: dict.validation }}
          center={{ id: c.id, slug: c.slug, nameAr: c.nameAr, nameEn: c.nameEn, category: c.category, address: c.address, area: c.area, city: locale === "ar" ? c.cityNameAr : c.cityNameEn, phone: c.phone, lastVerifiedAt: (c.lastVerifiedAt ?? c.approvedAt)?.toISOString() ?? null }}
          services={services.map((s) => ({ id: s.id, nameAr: s.nameAr, nameEn: s.nameEn, category: s.category, priceMode: s.priceMode, priceEgp: s.priceEgp, priceMaxEgp: s.priceMaxEgp, durationMin: s.durationMin }))}
          initialServiceId={typeof sp.service === "string" ? sp.service : undefined}
          vehicles={vehicles}
          makes={makes.map((m) => ({ id: m.id, nameAr: m.nameAr, nameEn: m.nameEn }))}
          models={models.map((m) => ({ id: m.id, makeId: m.makeId, nameAr: m.nameAr, nameEn: m.nameEn }))}
          dates={dates}
          settings={{ mode: settings.mode, cancelCutoffHours: settings.cancelCutoffHours, policy }}
          contact={{ name: profile?.name ?? "", phone: profile?.phone ?? "" }}
        />
      </div>
    </div>
  );
}
