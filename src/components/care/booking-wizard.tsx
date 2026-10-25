"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Info, Plus, X } from "lucide-react";
import { createBooking, bookingTimes } from "@/server/actions/bookings";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDate, formatKm } from "@/lib/format";
import { servicePriceText } from "./service-price";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";

type Service = { id: string; nameAr: string; nameEn: string; category: string; priceMode: "fixed" | "estimate" | "quote"; priceEgp: number | null; priceMaxEgp: number | null; durationMin: number };
type Vehicle = { id: string; makeId: number; modelId: number | null; year: number; mileageKm: number | null; nickname: string | null; makeAr: string; makeEn: string; modelAr: string | null; modelEn: string | null };
type Make = { id: number; nameAr: string; nameEn: string };
type Model = { id: number; makeId: number; nameAr: string; nameEn: string };
type Slot = { start: string; label: string };
type Picked = { date: string; time: string; start: string };

export type WizardProps = {
  locale: Locale;
  dict: Pick<Dictionary, "booking" | "care" | "common" | "errors" | "validation">;
  center: { id: string; slug: string; nameAr: string; nameEn: string; category: keyof Dictionary["care"]["providers"]; address: string; area: string | null; city: string; phone: string; lastVerifiedAt: string | null };
  services: Service[];
  initialServiceId?: string;
  vehicles: Vehicle[];
  makes: Make[];
  models: Model[];
  dates: string[];
  settings: { mode: "slots" | "manual"; cancelCutoffHours: number; policy: string };
  contact: { name: string; phone: string };
};

const STEPS = ["service", "vehicle", "time", "details", "review"] as const;
type Step = (typeof STEPS)[number];

export function BookingWizard(p: WizardProps) {
  const { locale, dict } = p;
  const T = dict.booking;
  const W = T.wizard;
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>(p.initialServiceId && p.services.some((s) => s.id === p.initialServiceId) ? "vehicle" : "service");
  const [serviceId, setServiceId] = useState(p.initialServiceId && p.services.some((s) => s.id === p.initialServiceId) ? p.initialServiceId : (p.services[0]?.id ?? ""));
  const [vehicleChoice, setVehicleChoice] = useState<string>(p.vehicles[0]?.id ?? "new");
  const [veh, setVeh] = useState({ makeId: "", modelId: "", modelText: "", year: "", mileageKm: "", save: true });
  const [date, setDate] = useState(p.dates[0] ?? "");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [contact, setContact] = useState({ name: p.contact.name, phone: p.contact.phone, note: "" });
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingSlots, startSlots] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [requestKey] = useState(() => crypto.randomUUID());

  const service = p.services.find((s) => s.id === serviceId);
  const maxTimes = p.settings.mode === "slots" ? 1 : 3;
  const name = (r: { nameAr: string; nameEn: string }) => (locale === "ar" ? r.nameAr : r.nameEn);
  const makeModels = useMemo(() => p.models.filter((m) => String(m.makeId) === veh.makeId), [p.models, veh.makeId]);
  const dayLabel = (d: string) => formatDate(`${d}T12:00:00Z`, locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo" });
  const timeLabel = (iso: string) => formatDate(iso, locale, { hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" });

  useEffect(() => {
    if (step !== "time" || !service || !date) return;
    startSlots(async () => {
      const r = await bookingTimes(p.center.id, service.id, date);
      setSlots(r.ok ? r.data : []);
      if (!r.ok) toast(dict.errors[r.error], "error");
    });
  }, [step, service, date, p.center.id, dict.errors, toast]);

  const vehicleSummary = () => {
    if (vehicleChoice !== "new") {
      const v = p.vehicles.find((x) => x.id === vehicleChoice)!;
      return `${locale === "ar" ? v.makeAr : v.makeEn} ${v.modelAr ? (locale === "ar" ? v.modelAr : v.modelEn) : ""} ${v.year}`.replace(/\s+/g, " ");
    }
    const mk = p.makes.find((m) => String(m.id) === veh.makeId);
    const md = p.models.find((m) => String(m.id) === veh.modelId);
    return `${mk ? name(mk) : ""} ${md ? name(md) : veh.modelText} ${veh.year}`.replace(/\s+/g, " ");
  };

  function validate(s: Step): boolean {
    const e: Record<string, string> = {};
    if (s === "service" && !service) e.service = dict.validation.required;
    if (s === "vehicle" && vehicleChoice === "new") {
      if (!veh.makeId) e.makeId = dict.validation.required;
      const y = Number(veh.year);
      if (!y || y < 1950 || y > new Date().getFullYear() + 1) e.year = dict.validation.year;
      if (veh.mileageKm && !(Number(veh.mileageKm) >= 0 && Number(veh.mileageKm) <= 3_000_000)) e.mileageKm = dict.validation.mileage;
    }
    if (s === "time" && picked.length === 0) e.time = dict.validation.required;
    if (s === "details") {
      if (contact.name.trim().length < 2) e.name = dict.validation.nameLength;
      if (!/^(\+?20|0)1[0125]\d{8}$/.test(contact.phone.replace(/[\s-]/g, ""))) e.phone = dict.validation.phone;
    }
    if (s === "review" && !accept) e.accept = dict.validation.required;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const go = (to: Step) => {
    const i = STEPS.indexOf(step);
    if (STEPS.indexOf(to) > i && !validate(step)) return;
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function toggle(slot: Slot) {
    const exists = picked.some((x) => x.start === slot.start);
    if (exists) return setPicked(picked.filter((x) => x.start !== slot.start));
    if (maxTimes === 1) return setPicked([{ date, time: slot.label, start: slot.start }]);
    if (picked.length >= maxTimes) return;
    setPicked([...picked, { date, time: slot.label, start: slot.start }].sort((a, b) => a.start.localeCompare(b.start)));
  }

  function submit() {
    if (!validate("review") || !service) return;
    startSubmit(async () => {
      const r = await createBooking({
        centerId: p.center.id,
        serviceId: service.id,
        requestKey,
        ...(vehicleChoice !== "new"
          ? { vehicleId: vehicleChoice }
          : {
              vehicle: {
                makeId: Number(veh.makeId),
                modelId: veh.modelId && veh.modelId !== "other" ? Number(veh.modelId) : undefined,
                modelText: veh.modelId === "other" ? veh.modelText : undefined,
                year: Number(veh.year),
                mileageKm: veh.mileageKm ? Number(veh.mileageKm) : undefined,
                save: veh.save,
              },
            }),
        times: picked.map(({ date, time }) => ({ date, time })),
        contactName: contact.name,
        contactPhone: contact.phone,
        note: contact.note || undefined,
        acceptPolicy: true,
      });
      if (!r.ok) {
        toast(dict.errors[r.error], "error");
        if (r.error === "slotTaken") {
          setPicked([]);
          setStep("time");
          setSlots(null);
        }
        return;
      }
      toast(W.submitted);
      router.push(`/${locale}/account/bookings/${r.data.reference}?new=1`);
    });
  }

  const price = service ? servicePriceText(service, locale, T) : "";
  const priceNote = service ? (service.priceMode === "fixed" ? T.fixedNote : service.priceMode === "estimate" ? T.estimateNote : T.quoteNote) : "";

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex gap-1 overflow-x-auto text-xs sm:text-sm" aria-label={W.title}>
        {STEPS.map((s, i) => {
          const idx = STEPS.indexOf(step);
          const done = i < idx;
          return (
            <li key={s} className="flex shrink-0 items-center gap-1.5">
              <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold", done ? "bg-success-700 text-white" : i === idx ? "bg-navy-900 text-white" : "bg-navy-900/10 text-ink-2")} aria-hidden>
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("me-2", i === idx ? "font-semibold text-ink" : "text-ink-3")} aria-current={i === idx ? "step" : undefined}>{W.steps[s]}</span>
            </li>
          );
        })}
      </ol>

      <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
        {step === "service" && (
          <fieldset>
            <legend className="mb-4 text-lg font-semibold">{W.chooseService}</legend>
            <div className="flex flex-col gap-2">
              {p.services.map((s) => (
                <label key={s.id} className={cn("flex cursor-pointer items-start justify-between gap-3 rounded-[var(--radius-md)] border p-4", serviceId === s.id ? "border-brand-600 bg-brand-50/50" : "border-line hover:border-ink-3")}>
                  <span className="flex items-start gap-3">
                    <input type="radio" name="service" value={s.id} checked={serviceId === s.id} onChange={() => setServiceId(s.id)} className="mt-1 size-4 accent-brand-600" />
                    <span>
                      <span className="block font-medium"><bdi>{name(s)}</bdi></span>
                      <span className="block text-sm text-ink-3">{dict.care.enums.category[s.category as keyof Dictionary["care"]["enums"]["category"]]} · {W.duration.replace("{n}", String(s.durationMin))}</span>
                    </span>
                  </span>
                  <span className="text-end text-sm">
                    <span className="block tabular font-semibold">{servicePriceText(s, locale, T)}</span>
                    {s.priceMode !== "quote" && <span className="block text-xs text-ink-3">{T.priceMode[s.priceMode]}</span>}
                  </span>
                </label>
              ))}
            </div>
            {errors.service && <p role="alert" className="mt-2 text-sm text-danger-700">{errors.service}</p>}
          </fieldset>
        )}

        {step === "vehicle" && (
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-lg font-semibold">{W.steps.vehicle}</legend>
            {p.vehicles.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{W.savedVehicles}</p>
                {p.vehicles.map((v) => (
                  <label key={v.id} className={cn("flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border p-3", vehicleChoice === v.id ? "border-brand-600 bg-brand-50/50" : "border-line")}>
                    <input type="radio" name="veh" checked={vehicleChoice === v.id} onChange={() => setVehicleChoice(v.id)} className="size-4 accent-brand-600" />
                    <span className="text-sm">
                      <bdi className="font-medium">{locale === "ar" ? v.makeAr : v.makeEn} {v.modelAr ? (locale === "ar" ? v.modelAr : v.modelEn) : ""} {v.year}</bdi>
                      {v.nickname && <span className="text-ink-3"> · <bdi>{v.nickname}</bdi></span>}
                      {v.mileageKm != null && <span className="text-ink-3"> · {formatKm(v.mileageKm, locale)}</span>}
                    </span>
                  </label>
                ))}
                <label className={cn("flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border p-3", vehicleChoice === "new" ? "border-brand-600 bg-brand-50/50" : "border-line")}>
                  <input type="radio" name="veh" checked={vehicleChoice === "new"} onChange={() => setVehicleChoice("new")} className="size-4 accent-brand-600" />
                  <span className="text-sm font-medium">{W.newVehicle}</span>
                </label>
              </div>
            )}
            {vehicleChoice === "new" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={W.make} htmlFor="bk-make" required requiredLabel={dict.common.required} error={errors.makeId}>
                  <Select id="bk-make" value={veh.makeId} invalid={!!errors.makeId} onChange={(e) => setVeh({ ...veh, makeId: e.target.value, modelId: "" })}>
                    <option value="">—</option>
                    {p.makes.map((m) => <option key={m.id} value={m.id}>{name(m)}</option>)}
                  </Select>
                </Field>
                <Field label={W.model} htmlFor="bk-model">
                  <Select id="bk-model" value={veh.modelId} disabled={!veh.makeId} onChange={(e) => setVeh({ ...veh, modelId: e.target.value })}>
                    <option value="">—</option>
                    {makeModels.map((m) => <option key={m.id} value={m.id}>{name(m)}</option>)}
                    <option value="other">{W.modelOther}</option>
                  </Select>
                </Field>
                {veh.modelId === "other" && (
                  <Field label={W.modelText} htmlFor="bk-mtext">
                    <Input id="bk-mtext" maxLength={60} value={veh.modelText} onChange={(e) => setVeh({ ...veh, modelText: e.target.value })} />
                  </Field>
                )}
                <Field label={W.year} htmlFor="bk-year" required requiredLabel={dict.common.required} error={errors.year}>
                  <Input id="bk-year" inputMode="numeric" className="tabular" value={veh.year} invalid={!!errors.year} onChange={(e) => setVeh({ ...veh, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
                </Field>
                <Field label={W.mileage} htmlFor="bk-km" error={errors.mileageKm}>
                  <Input id="bk-km" inputMode="numeric" className="tabular" value={veh.mileageKm} invalid={!!errors.mileageKm} onChange={(e) => setVeh({ ...veh, mileageKm: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
                </Field>
                <Checkbox className="sm:col-span-2" label={W.saveVehicle} checked={veh.save} onChange={(e) => setVeh({ ...veh, save: e.target.checked })} />
              </div>
            )}
          </fieldset>
        )}

        {step === "time" && service && (
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-lg font-semibold">{W.steps.time}</legend>
            <Notice tone="info"><p>{p.settings.mode === "slots" ? W.modeSlots : W.modeManual}</p></Notice>
            <Field label={W.date} htmlFor="bk-date">
              <Select id="bk-date" value={date} onChange={(e) => { setDate(e.target.value); setSlots(null); }}>
                {p.dates.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
              </Select>
            </Field>
            <div aria-live="polite">
              {loadingSlots || slots === null ? (
                <p className="text-sm text-ink-3">{W.loadingSlots}</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-ink-3">{W.noSlots}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 xs:grid-cols-4 sm:grid-cols-6">
                  {slots.map((s) => {
                    const on = picked.some((x) => x.start === s.start);
                    const full = !on && maxTimes > 1 && picked.length >= maxTimes;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        aria-pressed={on}
                        disabled={full}
                        onClick={() => toggle(s)}
                        className={cn("h-10 rounded-[var(--radius-sm)] border text-sm tabular", on ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-line-strong hover:border-brand-600 disabled:opacity-40")}
                      >
                        <bdi>{timeLabel(s.start)}</bdi>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {picked.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">{W.requestedTimes}</p>
                <ul className="flex flex-col gap-2">
                  {picked.map((x, i) => (
                    <li key={x.start} className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-canvas px-3 py-2 text-sm">
                      <span className="flex items-center gap-2"><Clock className="size-4 text-ink-3" aria-hidden />{maxTimes > 1 && <span className="text-ink-3">{W.preferred.replace("{n}", String(i + 1))}:</span>} <bdi>{dayLabel(x.date)} · {timeLabel(x.start)}</bdi></span>
                      <button type="button" onClick={() => setPicked(picked.filter((y) => y.start !== x.start))} className="text-ink-3 hover:text-danger-700" aria-label={W.removeTime}><X className="size-4" aria-hidden /></button>
                    </li>
                  ))}
                </ul>
                {maxTimes > 1 && picked.length < maxTimes && <p className="mt-2 flex items-center gap-1 text-xs text-ink-3"><Plus className="size-3" aria-hidden />{W.addTime}</p>}
              </div>
            )}
            <p className="text-xs text-ink-3">{W.timesLocal}</p>
            {errors.time && <p role="alert" className="text-sm text-danger-700">{errors.time}</p>}
          </fieldset>
        )}

        {step === "details" && (
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-1 text-lg font-semibold sm:col-span-2">{W.steps.details}</legend>
            <Field label={W.contactName} htmlFor="bk-name" required requiredLabel={dict.common.required} error={errors.name}>
              <Input id="bk-name" autoComplete="name" value={contact.name} maxLength={80} invalid={!!errors.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
            </Field>
            <Field label={W.contactPhone} htmlFor="bk-phone" required requiredLabel={dict.common.required} error={errors.phone}>
              <Input id="bk-phone" type="tel" dir="ltr" autoComplete="tel" inputMode="tel" className="tabular" value={contact.phone} invalid={!!errors.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
            </Field>
            <Field label={W.note} htmlFor="bk-note" className="sm:col-span-2">
              <Textarea id="bk-note" rows={3} maxLength={1000} dir="auto" placeholder={W.notePlaceholder} value={contact.note} onChange={(e) => setContact({ ...contact, note: e.target.value })} />
            </Field>
          </fieldset>
        )}

        {step === "review" && service && (
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-semibold">{W.reviewTitle}</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-ink-3">{W.provider}</dt>
              <dd>
                <p className="font-medium"><bdi>{name(p.center)}</bdi></p>
                <p className="text-ink-2">{dict.care.providers[p.center.category].short} · {dict.care.verification[p.center.category].badge}</p>
                {p.center.lastVerifiedAt && <p className="text-xs text-ink-3">{T.verifiedOn.replace("{date}", formatDate(p.center.lastVerifiedAt, locale))}</p>}
                <p dir="auto" className="text-ink-2">{p.center.address}{p.center.area ? `، ${p.center.area}` : ""} — {p.center.city}</p>
                <p dir="ltr" className="tabular text-ink-2 rtl:text-end">{p.center.phone}</p>
              </dd>
              <dt className="text-ink-3">{W.service}</dt>
              <dd>
                <p className="font-medium"><bdi>{name(service)}</bdi></p>
                <p className="text-ink-2">{dict.care.enums.category[service.category as keyof Dictionary["care"]["enums"]["category"]]} · {W.duration.replace("{n}", String(service.durationMin))}</p>
              </dd>
              <dt className="text-ink-3">{W.price}</dt>
              <dd>
                <p className="tabular font-semibold">{price}{service.priceMode !== "quote" && <span className="ms-1.5 text-xs font-normal text-ink-3">({T.priceMode[service.priceMode]})</span>}</p>
                <p className="text-xs text-ink-3">{priceNote} {T.payDirect}</p>
              </dd>
              <dt className="text-ink-3">{W.vehicle}</dt>
              <dd><bdi>{vehicleSummary()}</bdi></dd>
              <dt className="text-ink-3">{W.requestedTimes}</dt>
              <dd>
                <ul className="flex flex-col gap-1">
                  {picked.map((x) => <li key={x.start} className="font-medium"><bdi>{dayLabel(x.date)} · {timeLabel(x.start)}</bdi></li>)}
                </ul>
                <p className="text-xs text-ink-3">{W.timesLocal}</p>
              </dd>
              <dt className="text-ink-3">{W.contactName}</dt>
              <dd><bdi>{contact.name}</bdi> · <span dir="ltr" className="tabular">{contact.phone}</span></dd>
              {contact.note && (
                <>
                  <dt className="text-ink-3">{W.note}</dt>
                  <dd dir="auto" className="whitespace-pre-line">{contact.note}</dd>
                </>
              )}
            </dl>
            <div className="rounded-[var(--radius-md)] border border-line bg-canvas p-4 text-sm">
              <p className="font-semibold">{W.policyTitle}</p>
              <p className="mt-1 text-ink-2">{W.policyDefault.replace("{h}", String(p.settings.cancelCutoffHours))}</p>
              {p.settings.policy && (
                <p className="mt-2 text-ink-2"><span className="font-medium">{W.providerPolicy}: </span><bdi className="whitespace-pre-line">{p.settings.policy}</bdi></p>
              )}
              <p className="mt-3 font-semibold">{W.sharingTitle}</p>
              <p className="mt-1 text-ink-2">{W.sharing}</p>
            </div>
            <div className="flex gap-2 text-sm text-ink-2"><Info className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /><p>{W.notConfirmedYet}</p></div>
            <Checkbox label={W.acceptPolicy} checked={accept} onChange={(e) => setAccept(e.target.checked)} aria-invalid={!!errors.accept || undefined} />
            {errors.accept && <p role="alert" className="-mt-3 text-sm text-danger-700">{errors.accept}</p>}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-3">
        {step !== "service" ? (
          <Button variant="secondary" onClick={() => go(STEPS[STEPS.indexOf(step) - 1])} disabled={submitting}>{W.back}</Button>
        ) : <span />}
        {step === "review" ? (
          <Button onClick={submit} loading={submitting}>{W.submit}</Button>
        ) : (
          <Button onClick={() => go(STEPS[STEPS.indexOf(step) + 1])}>{W.next}</Button>
        )}
      </div>
    </div>
  );
}
