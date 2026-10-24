import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { resolveLocale } from "@/i18n/server";
import { getCurrentUser } from "@/server/session";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "@/components/auth-forms";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/forgot-password">): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.auth.forgotTitle, robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[lang]/auth/forgot-password">) {
  const { locale, dict } = await resolveLocale(params);
  if (await getCurrentUser()) redirect(`/${locale}`);
  return (
    <AuthShell title={dict.auth.forgotTitle} body={dict.auth.forgotBody}>
      <Suspense>
        <ForgotForm locale={locale} a={dict.auth} />
      </Suspense>
    </AuthShell>
  );
}
