"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/server/actions/profile";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ValidationKey } from "@/lib/validation";

type Profile = { name: string; email: string; phone: string | null; showPhone: boolean; cityId: number | null; locale: string };

export function ProfileForm({
  locale,
  profile,
  cities,
  dict,
}: {
  locale: string;
  profile: Profile;
  cities: { id: number; nameAr: string; nameEn: string }[];
  dict: Pick<Dictionary, "account" | "common" | "validation" | "errors" | "auth">;
}) {
  const A = dict.account;
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});
  const [pending, start] = useTransition();
  const [pwPending, startPw] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());
    start(async () => {
      const res = await updateProfile({ ...raw, showPhone: fd.get("showPhone") === "on" });
      if (!res.ok) {
        setErrors(res.fields ?? {});
        return toast(dict.errors[res.error], "error");
      }
      setErrors({});
      toast(A.profileSaved);
      const nextLocale = String(fd.get("locale"));
      if (nextLocale !== locale) router.push(`/${nextLocale}/account/profile`);
      router.refresh();
    });
  }

  function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const newPassword = String(fd.get("newPassword"));
    if (newPassword.length < 8) return toast(dict.auth.errors.weak, "error");
    startPw(async () => {
      const { error } = await authClient.changePassword({
        currentPassword: String(fd.get("currentPassword")),
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) return toast(error.status === 429 ? dict.auth.errors.rate : dict.auth.errors.invalid, "error");
      form.reset();
      toast(A.passwordChanged);
    });
  }

  const err = (k: string) => (errors[k] ? dict.validation[errors[k]] : undefined);
  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={save} className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
        <Field label={A.name} htmlFor="name" error={err("name")}>
          <Input id="name" name="name" defaultValue={profile.name} required maxLength={60} invalid={!!errors.name} />
        </Field>
        <Field label={A.email} htmlFor="email">
          <Input id="email" defaultValue={profile.email} disabled dir="ltr" />
        </Field>
        <Field label={A.phone} htmlFor="phone" hint={A.phoneHint} error={err("phone")} optional optionalLabel={dict.common.optional}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={profile.phone ?? ""} dir="ltr" invalid={!!errors.phone} autoComplete="tel" />
        </Field>
        <p className="-mt-2 text-sm text-ink-3">{A.phonePerListing}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={A.city} htmlFor="cityId" optional optionalLabel={dict.common.optional}>
            <Select id="cityId" name="cityId" defaultValue={profile.cityId ?? ""}>
              <option value="">—</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.nameAr : c.nameEn}</option>)}
            </Select>
          </Field>
          <Field label={A.language} htmlFor="locale">
            <Select id="locale" name="locale" defaultValue={profile.locale}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </Select>
          </Field>
        </div>
        <Button type="submit" loading={pending} className="self-start">{dict.common.save}</Button>
      </form>

      <form onSubmit={changePassword} className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{A.changePassword}</h2>
        <Field label={A.currentPassword} htmlFor="currentPassword">
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required dir="ltr" />
        </Field>
        <Field label={A.newPassword} htmlFor="newPassword" hint={dict.auth.passwordHint}>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} dir="ltr" />
        </Field>
        <Button type="submit" variant="secondary" loading={pwPending} className="self-start">{A.changePassword}</Button>
      </form>
    </div>
  );
}
