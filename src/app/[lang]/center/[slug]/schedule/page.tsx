import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/server";
import { requireCenterStaffPage } from "@/server/center-page";
import { bookingSettings, centerBookingCounts, closures } from "@/server/bookings";
import { CenterSubnav } from "@/components/care/center-subnav";
import { BookingSettingsForm, ClosuresEditor } from "@/components/care/booking-settings-form";
import { Panel } from "@/components/care/booking-parts";
import { Notice } from "@/components/ui/states";
import { canManageCenter } from "@/lib/care";

export const metadata: Metadata = { robots: { index: false } };

export default async function SchedulePage({ params }: PageProps<"/[lang]/center/[slug]/schedule">) {
  const { locale, dict } = await resolveLocale(params);
  const { slug } = await params;
  const { center, role } = await requireCenterStaffPage(locale, slug, "/schedule");
  const [s, cl, counts] = await Promise.all([bookingSettings(center.id), closures(center.id), centerBookingCounts(center.id)]);
  const S = dict.booking.schedule;
  const editable = canManageCenter(role);
  const d = { booking: dict.booking, errors: dict.errors, common: dict.common, validation: dict.validation };
  return (
    <div className="container-page max-w-4xl py-10">
      <p className="text-sm font-semibold text-brand-700">{dict.care.dash.title}</p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl"><bdi>{locale === "ar" ? center.nameAr : center.nameEn}</bdi></h1>
      <CenterSubnav locale={locale} slug={slug} active="schedule" labels={dict.booking.subnav} actionCount={counts.action} />
      <Notice tone={s.pilotEnabled && center.status === "approved" ? "success" : "info"} className="mt-5"><p>{s.pilotEnabled && center.status === "approved" ? S.pilotOn : S.pilotOff}</p></Notice>
      <div className="mt-5 flex flex-col gap-5">
        <Panel title={S.title}>
          <BookingSettingsForm dict={d} centerId={center.id} pilotEnabled={s.pilotEnabled && center.status === "approved"} editable={editable}
            initial={{ accepting: s.accepting, mode: s.mode, slotIntervalMin: s.slotIntervalMin, capacity: s.capacity, minNoticeHours: s.minNoticeHours, maxAdvanceDays: s.maxAdvanceDays, cancelCutoffHours: s.cancelCutoffHours, policyAr: s.policyAr, policyEn: s.policyEn }} />
          <p className="mt-4 text-xs text-ink-3">{S.hoursNote}</p>
        </Panel>
        <Panel title={S.closures}>
          <ClosuresEditor locale={locale} dict={d} centerId={center.id} editable={editable} closures={cl.map((c) => ({ id: c.id, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString(), reason: c.reason }))} />
        </Panel>
      </div>
    </div>
  );
}
