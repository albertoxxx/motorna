"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyCenter, updateCenterProfile } from "@/server/actions/care";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { VEHICLE_TYPES } from "@/lib/care";
import type { ValidationKey } from "@/lib/validation";
import { useAction, type CareDict, type City } from "./shared";

export type CenterProfileValues = {
  nameAr: string;
  nameEn: string;
  cityId: number | string;
  area: string | null;
  address: string;
  phone: string;
  email: string | null;
  website: string | null;
  description: string;
  vehicleTypes: string[];
  quotationPolicy: string;
};

/** Used both for a new application (no centerId) and for editing an existing center. */
export function CenterProfileForm({
  locale,
  dict,
  cities,
  centerId,
  initial,
  identityLocked,
}: {
  locale: string;
  dict: CareDict;
  cities: City[];
  centerId?: string;
  initial?: CenterProfileValues;
  identityLocked?: boolean;
}) {
  const P = dict.care.apply;
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});
  const { pending, run } = useAction(dict);
  const router = useRouter();
  const err = (k: string) => (errors[k] ? dict.validation[errors[k]] : undefined);
  const req = { required: true, requiredLabel: dict.common.required };
  const opt = { optional: true, optionalLabel: dict.common.optional };
  const name = (c: City) => (locale === "ar" ? c.nameAr : c.nameEn);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw: Record<string, unknown> = Object.fromEntries(fd.entries());
    raw.vehicleTypes = fd.getAll("vehicleTypes");
    raw.acceptTerms = fd.get("acceptTerms") === "on";
    if (centerId) {
      run(() => updateCenterProfile(centerId, raw), dict.care.dash.saved, () => setErrors({}), (r) => setErrors((r.fields ?? {}) as Record<string, ValidationKey>));
    } else {
      run(
        () => applyCenter(raw),
        P.submitted,
        (r) => {
          const data = (r as unknown as { data: { slug: string } }).data;
          router.push(`/${locale}/center/${data.slug}`);
        },
        (r) => setErrors((r.fields ?? {}) as Record<string, ValidationKey>),
      );
    }
  }

  const v = initial;
  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2" noValidate>
      {identityLocked && <p className="text-sm text-ink-3 sm:col-span-2">{dict.care.dash.identityLocked}</p>}
      <Field label={P.nameAr} htmlFor="nameAr" error={err("nameAr")} {...req}>
        <Input id="nameAr" name="nameAr" dir="rtl" defaultValue={v?.nameAr} maxLength={80} readOnly={identityLocked} invalid={!!errors.nameAr} />
      </Field>
      <Field label={P.nameEn} htmlFor="nameEn" error={err("nameEn")} {...req}>
        <Input id="nameEn" name="nameEn" dir="ltr" defaultValue={v?.nameEn} maxLength={80} readOnly={identityLocked} invalid={!!errors.nameEn} />
      </Field>
      <Field label={P.city} htmlFor="cityId" error={err("cityId")} {...req}>
        {identityLocked ? (
          <>
            <input type="hidden" name="cityId" value={String(v?.cityId ?? "")} />
            <Input id="cityId" readOnly value={(() => { const c = cities.find((x) => String(x.id) === String(v?.cityId)); return c ? name(c) : ""; })()} />
          </>
        ) : (
          <Select id="cityId" name="cityId" defaultValue={String(v?.cityId ?? cities.find((c) => c.nameEn === "Alexandria")?.id ?? "")} invalid={!!errors.cityId}>
            <option value="">—</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}
          </Select>
        )}
      </Field>
      <Field label={P.area} htmlFor="area" {...opt}>
        <Input id="area" name="area" defaultValue={v?.area ?? ""} maxLength={80} />
      </Field>
      <Field className="sm:col-span-2" label={P.address} htmlFor="address" error={err("address")} {...req}>
        <Input id="address" name="address" dir="auto" defaultValue={v?.address} maxLength={200} readOnly={identityLocked} invalid={!!errors.address} />
      </Field>
      <Field label={P.phone} htmlFor="phone" hint={P.phoneHint} error={err("phone")} {...req}>
        <Input id="phone" name="phone" type="tel" dir="ltr" inputMode="tel" defaultValue={v?.phone} invalid={!!errors.phone} />
      </Field>
      <Field label={P.email} htmlFor="email" error={err("email")} {...opt}>
        <Input id="email" name="email" type="email" dir="ltr" defaultValue={v?.email ?? ""} invalid={!!errors.email} />
      </Field>
      <Field className="sm:col-span-2" label={P.website} htmlFor="website" error={err("website")} {...opt}>
        <Input id="website" name="website" type="url" dir="ltr" placeholder="https://" defaultValue={v?.website ?? ""} invalid={!!errors.website} />
      </Field>
      <Field className="sm:col-span-2" label={P.description} htmlFor="description" hint={P.descriptionHint} error={err("description")} {...opt}>
        <Textarea id="description" name="description" dir="auto" rows={4} maxLength={3000} defaultValue={v?.description} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">{P.vehicleTypes}</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {VEHICLE_TYPES.map((t) => (
            <Checkbox key={t} name="vehicleTypes" value={t} defaultChecked={v?.vehicleTypes.includes(t)} label={dict.care.enums.vehicleType[t]} />
          ))}
        </div>
      </fieldset>
      <Field className="sm:col-span-2" label={P.quotationPolicy} htmlFor="quotationPolicy" hint={P.quotationPolicyHint} {...opt}>
        <Textarea id="quotationPolicy" name="quotationPolicy" dir="auto" rows={3} maxLength={1000} defaultValue={v?.quotationPolicy} />
      </Field>
      {!centerId && (
        <div className="sm:col-span-2">
          <Checkbox name="acceptTerms" label={P.acceptTerms} />
          {errors.acceptTerms && <p className="mt-1 text-sm text-danger-700" role="alert">{err("acceptTerms")}</p>}
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>{centerId ? dict.care.dash.save : P.submit}</Button>
      </div>
    </form>
  );
}
