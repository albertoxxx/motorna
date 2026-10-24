import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { resolveLocale } from "@/i18n/server";
import { getCurrentUser } from "@/server/session";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/auth-forms";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/sign-up">): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.auth.signUpTitle, robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[lang]/auth/sign-up">) {
  const { locale, dict } = await resolveLocale(params);
  if (await getCurrentUser()) redirect(`/${locale}`);
  return (
    <AuthShell title={dict.auth.signUpTitle} body={dict.auth.signUpBody}>
      <Suspense>
        <SignUpForm locale={locale} a={dict.auth} />
      </Suspense>
    </AuthShell>
  );
}
