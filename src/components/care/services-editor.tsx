"use client";

import { useState } from "react";
import { saveCenterService, setCenterServiceActive } from "@/server/actions/care";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { CARE_CATEGORIES } from "@/lib/care";
import { servicePriceText } from "./service-price";
import type { Locale } from "@/i18n/config";
import type { ValidationKey } from "@/lib/validation";
import { useAction, type CareDict } from "./shared";

type Service = { id: string; category: string; nameAr: string; nameEn: string; priceMode: "fixed" | "quote" | "estimate"; priceEgp: number | null; priceMaxEgp: number | null; durationMin: number; active: boolean; bookable: boolean };

export function ServicesEditor({ locale, dict, centerId, services, editable }: { locale: Locale; dict: CareDict; centerId: string; services: Service[]; editable: boolean }) {
  const D = dict.care.dash;
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { pending, run } = useAction(dict);
  return (
    <div className="flex flex-col gap-3">
      {services.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line">
          {services.map((s) =>
            editing === s.id ? (
              <li key={s.id} className="p-4">
                <ServiceForm locale={locale} dict={dict} centerId={centerId} service={s} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium"><bdi>{locale === "ar" ? s.nameAr : s.nameEn}</bdi></p>
                  <p className="text-ink-3">
                    {dict.care.enums.category[s.category as keyof typeof dict.care.enums.category]} ·{" "}
                    <span className="tabular">{servicePriceText(s, locale, { priceFrom: D.priceFromTpl, priceRange: D.priceRangeTpl, priceAfterInspection: dict.care.detail.onQuotation })}</span> ·{" "}
                    {dict.care.detail.durationMin.replace("{n}", String(s.durationMin))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={s.active ? "success" : "neutral"}>{s.active ? D.active : D.inactive}</Badge>
                  {s.active && !s.bookable && <Badge tone="neutral">{D.notBookable}</Badge>}
                  {editable && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s.id)}>{D.editService}</Button>
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setCenterServiceActive(centerId, s.id, !s.active), D.saved)}>
                        {s.active ? D.disable : D.enable}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {editable &&
        (editing === "new" ? (
          <div className="rounded-[var(--radius-md)] border border-line p-4">
            <ServiceForm locale={locale} dict={dict} centerId={centerId} onDone={() => setEditing(null)} />
          </div>
        ) : (
          <div>
            <Button variant="secondary" onClick={() => setEditing("new")}>{D.addService}</Button>
          </div>
        ))}
    </div>
  );
}

function ServiceForm({ dict, centerId, service, onDone }: { locale: Locale; dict: CareDict; centerId: string; service?: Service; onDone: () => void }) {
  const D = dict.care.dash;
  const [mode, setMode] = useState<"fixed" | "estimate" | "quote">(service?.priceMode ?? "fixed");
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});
  const { pending, run } = useAction(dict);
  const err = (k: string) => (errors[k] ? dict.validation[errors[k]] : undefined);
  const p = service?.id ?? "new";
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget).entries());
    run(() => saveCenterService(centerId, service?.id ?? null, raw), D.saved, onDone, (r) => setErrors((r.fields ?? {}) as Record<string, ValidationKey>));
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label={D.category} htmlFor={`cat-${p}`} required requiredLabel={dict.common.required}>
        <Select id={`cat-${p}`} name="category" defaultValue={service?.category ?? "routine_maintenance"}>
          {CARE_CATEGORIES.map((c) => <option key={c} value={c}>{dict.care.enums.category[c]}</option>)}
        </Select>
      </Field>
      <Field label={D.duration} htmlFor={`dur-${p}`} error={err("durationMin")} required requiredLabel={dict.common.required}>
        <Input id={`dur-${p}`} name="durationMin" inputMode="numeric" className="tabular" defaultValue={service?.durationMin ?? 60} invalid={!!errors.durationMin} />
      </Field>
      <Field label={D.serviceNameAr} htmlFor={`nar-${p}`} error={err("nameAr")} required requiredLabel={dict.common.required}>
        <Input id={`nar-${p}`} name="nameAr" dir="rtl" defaultValue={service?.nameAr} maxLength={80} invalid={!!errors.nameAr} />
      </Field>
      <Field label={D.serviceNameEn} htmlFor={`nen-${p}`} error={err("nameEn")} required requiredLabel={dict.common.required}>
        <Input id={`nen-${p}`} name="nameEn" dir="ltr" defaultValue={service?.nameEn} maxLength={80} invalid={!!errors.nameEn} />
      </Field>
      <Field label={D.priceMode} htmlFor={`pm-${p}`} required requiredLabel={dict.common.required}>
        <Select id={`pm-${p}`} name="priceMode" value={mode} onChange={(e) => setMode(e.target.value as "fixed" | "estimate" | "quote")}>
          <option value="fixed">{D.priceFixed}</option>
          <option value="estimate">{D.priceEstimate}</option>
          <option value="quote">{D.priceQuote}</option>
        </Select>
      </Field>
      {mode !== "quote" && (
        <Field label={mode === "estimate" ? D.priceFrom : D.price} htmlFor={`pr-${p}`} error={err("priceEgp")} required requiredLabel={dict.common.required}>
          <Input id={`pr-${p}`} name="priceEgp" inputMode="numeric" className="tabular" defaultValue={service?.priceEgp ?? ""} invalid={!!errors.priceEgp} />
        </Field>
      )}
      {mode === "estimate" && (
        <Field label={D.priceTo} htmlFor={`pmx-${p}`} error={err("priceMaxEgp")} hint={D.estimateHint}>
          <Input id={`pmx-${p}`} name="priceMaxEgp" inputMode="numeric" className="tabular" defaultValue={service?.priceMaxEgp ?? ""} invalid={!!errors.priceMaxEgp} />
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="hidden" name="bookable" value="false" />
        <input type="checkbox" name="bookable" value="true" defaultChecked={service?.bookable ?? true} className="size-4 accent-brand-600" />
        {D.bookable}
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" loading={pending}>{D.save}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>{dict.common.cancel}</Button>
      </div>
    </form>
  );
}
