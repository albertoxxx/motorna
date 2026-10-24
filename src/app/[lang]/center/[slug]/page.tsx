import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { centerIdBySlug, centerWorkspace, staffRole } from "@/server/care";
import { getCities } from "@/server/listings";
import { canManageCenter, identityLocked, isPubliclyVisible, profileEditable } from "@/lib/care";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { careStatusTone } from "@/components/care/status";
import { CenterProfileForm } from "@/components/care/center-profile-form";
import { ServicesEditor } from "@/components/care/services-editor";
import { HoursEditor } from "@/components/care/hours-editor";
import { DocsPanel } from "@/components/care/docs-panel";
import { StaffPanel } from "@/components/care/staff-panel";
import { ResubmitButton } from "@/components/care/resubmit-button";

export const metadata: Metadata = { robots: { index: false } };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
      <h2 id={id} className="mb-4 text-lg font-semibold">{title}</h2>
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
  const [ws, cities] = await Promise.all([centerWorkspace(centerId), getCities()]);
  if (!ws) notFound();
  const { center: c } = ws;
  const D = dict.care.dash;
  const manage = canManageCenter(role);
  const editable = manage && profileEditable(c.status);
  const cdict = { care: dict.care, common: dict.common, validation: dict.validation, errors: dict.errors };
  const tone = c.status === "approved" ? "success" : c.status === "rejected" || c.status === "suspended" || c.status === "revoked" ? "danger" : "info";

  return (
    <div className="container-page max-w-4xl py-10">
      <p className="text-sm font-semibold text-brand-700">{D.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold"><bdi>{locale === "ar" ? c.nameAr : c.nameEn}</bdi></h1>
        <Badge tone={careStatusTone(c.status)}>{dict.care.enums.status[c.status]}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-3">{D.role}: {dict.care.enums.staffRole[role]}</p>

      <Notice tone={tone} className="mt-5">
        <p>{D.statusBody[c.status]}</p>
        {c.statusReason && <p className="mt-1"><span className="font-semibold">{D.reason}:</span> <bdi>{c.statusReason}</bdi></p>}
        {isPubliclyVisible(c.status) && <Link href={`/${locale}/care/centers/${c.slug}`} className="mt-1 inline-block font-semibold underline">{D.viewPublic}</Link>}
        {c.status === "rejected" && role === "owner" && <div className="mt-3"><ResubmitButton dict={cdict} centerId={c.id} /></div>}
      </Notice>

      <div className="mt-6 flex flex-col gap-6">
        {manage && (
          <Section id="profile" title={D.profile}>
            <CenterProfileForm
              locale={locale}
              dict={cdict}
              cities={cities}
              centerId={c.id}
              identityLocked={identityLocked(c.status)}
              initial={{ ...c, cityId: c.cityId }}
            />
          </Section>
        )}
        <Section id="services" title={D.servicesTitle}>
          <ServicesEditor locale={locale} dict={cdict} centerId={c.id} services={ws.services} editable={editable} />
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
