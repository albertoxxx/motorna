"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { safeNext } from "@/lib/safe-next";
import type { Dictionary } from "@/i18n/dictionaries/ar";

type A = Dictionary["auth"];

function mapError(a: A, err: { status?: number; code?: string; message?: string } | null | undefined) {
  if (!err) return a.errors.generic;
  if (err.status === 429) return a.errors.rate;
  const code = err.code ?? "";
  if (code.includes("INVALID_EMAIL_OR_PASSWORD") || code.includes("INVALID_PASSWORD") || code.includes("USER_NOT_FOUND")) return a.errors.invalid;
  if (code.includes("USER_ALREADY_EXISTS")) return a.errors.exists;
  if (code.includes("PASSWORD_TOO_SHORT")) return a.errors.weak;
  if (code.includes("FAILED_TO_CREATE_SESSION")) return a.errors.suspended;
  return a.errors.generic;
}

/** Explains why an account is needed, based on where the person was going. */
function WhyAccount({ next, a }: { next: string | null; a: A }) {
  if (!next) return null;
  const msg = /\/cars\//.test(next) || /\/account\/(messages|favorites)/.test(next) ? a.why.listing : /\/sell/.test(next) ? a.why.sell : /\/(care|center)/.test(next) ? a.why.care : null;
  if (!msg) return null;
  return <Notice className="text-sm">{msg}</Notice>;
}

export function SignInForm({ locale, a }: { locale: string; a: A }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const next = safeNext(sp.get("next"), `/${locale}`);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const { error } = await authClient.signIn.email({ email: String(fd.get("email")), password: String(fd.get("password")) });
      if (error) return setError(mapError(a, error));
      router.push(next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate={false}>
      <WhyAccount next={sp.get("next") ? next : null} a={a} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label={a.email} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </Field>
      <Field label={a.password} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} dir="ltr" />
      </Field>
      <Link href={`/${locale}/auth/forgot-password`} className="-mt-1 self-end text-sm text-brand-700 hover:underline">{a.forgot}</Link>
      <Button type="submit" size="lg" loading={pending}>{a.submitSignIn}</Button>
      <p className="text-center text-sm text-ink-2">
        {a.noAccount}{" "}
        <Link href={`/${locale}/auth/sign-up${sp.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-brand-700 hover:underline">
          {a.signUpTitle}
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm({ locale, a }: { locale: string; a: A }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const next = safeNext(sp.get("next"), `/${locale}`);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password.length < 8) return setError(a.errors.weak);
    setError(null);
    start(async () => {
      const { error } = await authClient.signUp.email({
        name: String(fd.get("name")).trim(),
        email: String(fd.get("email")).trim(),
        password,
      });
      if (error) return setError(mapError(a, error));
      router.push(next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <WhyAccount next={sp.get("next") ? next : null} a={a} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label={a.name} htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required minLength={2} maxLength={60} />
      </Field>
      <Field label={a.email} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </Field>
      <Field label={a.password} htmlFor="password" hint={a.passwordHint}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} dir="ltr" />
      </Field>
      <Button type="submit" size="lg" loading={pending}>{a.submitSignUp}</Button>
      <p className="text-xs leading-relaxed text-ink-3">
        {a.terms}{" "}
        <Link href={`/${locale}/terms`} className="underline">↗</Link>
      </p>
      <p className="text-center text-sm text-ink-2">
        {a.haveAccount}{" "}
        <Link href={`/${locale}/auth/sign-in${sp.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-brand-700 hover:underline">{a.signInTitle}</Link>
      </p>
    </form>
  );
}

export function ForgotForm({ locale, a }: { locale: string; a: A }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const { error } = await authClient.requestPasswordReset({
        email: String(fd.get("email")).trim(),
        redirectTo: `/${locale}/auth/reset-password`,
      });
      // Same message whether or not the email exists (no account enumeration).
      if (error?.status === 429) return setError(a.errors.rate);
      setSent(true);
    });
  }
  if (sent) return <Notice tone="success">{a.linkSent}</Notice>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label={a.email} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </Field>
      <Button type="submit" size="lg" loading={pending}>{a.sendLink}</Button>
    </form>
  );
}

export function ResetForm({ locale, a }: { locale: string; a: A }) {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token");
  const [error, setError] = useState<string | null>(sp.get("error") ? a.resetInvalid : null);
  const [pending, start] = useTransition();
  if (!token) return <Notice tone="danger">{a.resetInvalid}</Notice>;
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pw = String(new FormData(e.currentTarget).get("password"));
    if (pw.length < 8) return setError(a.errors.weak);
    start(async () => {
      const { error } = await authClient.resetPassword({ newPassword: pw, token: token! });
      if (error) return setError(error.status === 429 ? a.errors.rate : a.resetInvalid);
      router.push(`/${locale}/auth/sign-in?reset=1`);
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label={a.password} htmlFor="password" hint={a.passwordHint}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} dir="ltr" />
      </Field>
      <Button type="submit" size="lg" loading={pending}>{a.resetSubmit}</Button>
    </form>
  );
}
