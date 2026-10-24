"use client";

import { useState } from "react";
import { addCenterTechnician, removeCenterTechnician } from "@/server/actions/care";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { ValidationKey } from "@/lib/validation";
import { useAction, type CareDict } from "./shared";

type Tech = { id: string; fullName: string; specialty: string | null; yearsExperience: number | null; certifications: string | null; active: boolean };

export function TechniciansEditor({ dict, centerId, items, editable }: { dict: CareDict; centerId: string; items: Tech[]; editable: boolean }) {
  const D = dict.care.dash;
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});
  const { pending, run } = useAction(dict);
  const active = items.filter((t) => t.active);
  const err = (k: string) => (errors[k] ? dict.validation[errors[k]] : undefined);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-3">{D.techniciansHint}</p>
      {active.length === 0 ? (
        <p className="text-sm text-ink-3">{D.noTechnicians}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line">
          {active.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium"><bdi>{t.fullName}</bdi></p>
                <p className="text-ink-3">
                  {[t.specialty, t.yearsExperience != null ? dict.care.detail.years.replace("{n}", String(t.yearsExperience)) : null, t.certifications].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {editable && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeCenterTechnician(centerId, t.id), D.removed)}>{D.remove}</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form
          className="grid gap-4 rounded-[var(--radius-md)] border border-line p-4 sm:grid-cols-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const raw = Object.fromEntries(new FormData(form).entries());
            run(() => addCenterTechnician(centerId, raw), D.saved, () => { form.reset(); setErrors({}); }, (r) => setErrors((r.fields ?? {}) as Record<string, ValidationKey>));
          }}
        >
          <Field label={D.techName} htmlFor="t-name" error={err("fullName")} required requiredLabel={dict.common.required}>
            <Input id="t-name" name="fullName" dir="auto" maxLength={80} invalid={!!errors.fullName} />
          </Field>
          <Field label={D.techSpecialty} htmlFor="t-spec" optional optionalLabel={dict.common.optional}>
            <Input id="t-spec" name="specialty" dir="auto" maxLength={80} />
          </Field>
          <Field label={D.techYears} htmlFor="t-years" error={err("yearsExperience")} optional optionalLabel={dict.common.optional}>
            <Input id="t-years" name="yearsExperience" inputMode="numeric" className="tabular" invalid={!!errors.yearsExperience} />
          </Field>
          <Field label={D.techCerts} htmlFor="t-certs" optional optionalLabel={dict.common.optional}>
            <Input id="t-certs" name="certifications" dir="auto" maxLength={300} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary" loading={pending}>{D.addTechnician}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
