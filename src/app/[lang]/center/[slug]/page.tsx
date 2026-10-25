import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, Circle } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { centerIdBySlug, centerWorkspace, staffRole } from "@/server/care";
import { getCities, getMakes } from "@/server/listings";
import { canManageCenter, identityLocked, isPubliclyVisible, profileEditable, submissionGaps, SUBMITTABLE } from "@/lib/care";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { careStatusTone } from "@/components/care/status";
import { CenterProfileForm } from "@/components/care/center-profile-form";
import { ServicesEditor } from "@/components/care/services-editor";
import { EquipmentEditor } from "@/components/care/equipment-editor";
import { TechniciansEditor } from "@/components/care/technicians-editor";
import { HoursEditor } from "@/components/care/hours-editor";
import { DocsPanel } from "@/components/care/docs-panel";
import { StaffPanel } from "@/components/care/staff-panel";
import { SubmitApplicationButton } from "@/components/care/submit-button";
import { MakesEditor } from "@/components/care/makes-editor";
import { PhotosPanel } from "@/components/care/photos-panel";
import { CenterSubnav } from "@/components/care/center-subnav";
import { centerBookingCounts } from "@/server/bookings";

export const metadata: Metadata = { robots: { index: false } };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
      <h2 id={`${id}-h`} className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function CenterDashboard({ params }: PageProps<"/[lang]/center/[slug]">) {
  const { locale, dict } = await resolveLocale(params);
  const { slug } = await params;
  const user = await requireUser(locale, `/${locale}/center/${slug}`);
  const centerId = await centerIdBySlug(slug);
  if (!centerId) notFound();
  const role = await staffRole(user.id, centerId);
  if (!role) redirect(`/${locale}`);
  const [ws, cities, allMakes, counts] = await Promise.all([centerWorkspace(centerId), getCities(), getMakes(), centerBookingCounts(centerId)]);
  if (!ws) notFound();
  const { center: c } = ws;
  const D = dict.care.dash;
  const manage = canManageCenter(role);
  const editable = manage && profileEditable(c.status);
  const cdict = { care: dict.care, common: dict.common, validation: dict.validation, errors: dict.errors };
  const tone = c.status === "approved" ? "success" : c.status === "changes_requested" ? "warning" : c.status === "rejected" || c.status === "suspended" || c.status === "revoked" ? "danger" : "info";
  const gaps = submissionGaps({ category: c.category, services: ws.services, makes: ws.makes, equipment: ws.equipment, technicians: ws.technicians, credentials: ws.credentials });
  const canSubmit = SUBMITTABLE.includes(c.status);
  const offersInspection = ws.services.some((x) => x.category === "pre_purchase_inspection" && x.active);
  const checklist: { key: keyof typeof D.gaps; done: boolean; href: string }[] = [
    { key: "profile", done: true, href: "#profile" },
    { key: "services", done: !gaps.includes("services"), href: "#services" },
    ...(c.category === "authorized_service" ? [{ key: "makes" as const, done: !gaps.includes("makes"), href: "#makes" }] : []),
    ...(c.category === "inspection_center" || offersInspection ? [{ key: "equipment" as const, done: !gaps.includes("equipment"), href: "#equipment" }] : []),
    ...(c.category !== "authorized_service" ? [{ key: "technicians" as const, done: !gaps.includes("technicians"), href: "#technicians" }] : []),
    { key: "documents", done: !gaps.includes("documents"), href: "#docs" },
    ...(c.category === "authorized_service" ? [{ key: "authorization" as const, done: !gaps.includes("authorization"), href: "#docs" }] : []),
    ...(c.category === "inspection_center" ? [{ key: "sampleReport" as const, done: !gaps.includes("sampleReport"), href: "#docs" }] : []),
  ];

  return (
    <div className="container-page max-w-4xl py-10">
      <p className="text-sm font-semibold text-brand-700">{D.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl"><bdi>{locale === "ar" ? c.nameAr : c.nameEn}</bdi></h1>
        <Badge tone={careStatusTone(c.status)}>{dict.care.enums.status[c.status]}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-3">{dict.care.providers[c.category].short} · {D.role}: {dict.care.enums.staffRole[role]}</p>

      <CenterSubnav locale={locale} slug={c.slug} active="dashboard" labels={dict.booking.subnav} actionCount={counts.action} />

      <Notice tone={tone} className="mt-5">
        <p>{D.statusBody[c.status]}</p>
        {c.statusReason && <p className="mt-2"><span className="font-semibold">{D.reason}:</span> <bdi>{c.statusReason}</bdi></p>}
        {isPubliclyVisible(c.status) && <Link href={`/${locale}/care/centers/${c.slug}`} className="mt-1 inline-block font-semibold underline">{D.viewPublic}</Link>}
      </Notice>

      {canSubmit && manage && (
        <section aria-labelledby="checklist" className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
          <h2 id="checklist" className="text-lg font-semibold">{D.checklistTitle}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {checklist.map((i) => (
              <li key={i.key}>
                <a href={i.href} className="flex items-center gap-2.5 text-sm hover:underline">
                  {i.done ? (
                    <span className="grid size-5 place-items-center rounded-full bg-success-700 text-white"><Check className="size-3.5" aria-hidden /></span>
                  ) : (
                    <Circle className="size-5 text-line-strong" aria-hidden />
                  )}
                  <span className={i.done ? "text-ink-2" : "font-medium"}>{D.gaps[i.key]}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-3">{gaps.length === 0 ? D.ready : D.submitHint}</p>
            {role === "owner" && <SubmitApplicationButton dict={cdict} centerId={c.id} disabled={gaps.length > 0} />}
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {manage && (
          <Section id="profile" title={D.profile}>
            <CenterProfileForm locale={locale} dict={cdict} cities={cities} centerId={c.id} identityLocked={identityLocked(c.status)} initial={{ ...c, cityId: c.cityId }} />
          </Section>
        )}
        <Section id="services" title={D.servicesTitle}>
          <ServicesEditor locale={locale} dict={cdict} centerId={c.id} services={ws.services} editable={editable} />
        </Section>
        <Section id="makes" title={D.makesTitle}>
          <MakesEditor locale={locale} dict={cdict} centerId={c.id} all={allMakes.map(({ id, nameAr, nameEn }) => ({ id, nameAr, nameEn }))} selected={ws.makes.map((m) => m.id)} editable={editable && !(c.category === "authorized_service" && identityLocked(c.status))} />
        </Section>
        <Section id="photos" title={D.photosTitle}>
          <PhotosPanel dict={cdict} centerId={c.id} photos={ws.photos} editable={editable} />
        </Section>
        <Section id="equipment" title={D.equipmentTitle}>
          <EquipmentEditor dict={cdict} centerId={c.id} items={ws.equipment} editable={editable} />
        </Section>
        <Section id="technicians" title={D.techniciansTitle}>
          <TechniciansEditor dict={cdict} centerId={c.id} items={ws.technicians} editable={editable} />
        </Section>
        <Section id="hours" title={D.hoursTitle}>
          <HoursEditor dict={cdict} centerId={c.id} hours={ws.hours} editable={editable} />
        </Section>
        {manage && (
          <Section id="docs" title={D.docsTitle}>
            <DocsPanel locale={locale} dict={cdict} centerId={c.id} docs={ws.credentials} editable={editable} />
          </Section>
        )}
        <Section id="staff" title={D.staffTitle}>
          <StaffPanel dict={cdict} centerId={c.id} staff={ws.staff} isOwner={role === "owner"} selfId={user.id} />
        </Section>
      </div>
    </div>
  );
}
