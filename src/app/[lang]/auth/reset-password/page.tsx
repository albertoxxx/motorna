import type { Metadata } from "next";
import { Suspense } from "react";
import { resolveLocale } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "@/components/auth-forms";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/reset-password">): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.auth.resetTitle, robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[lang]/auth/reset-password">) {
  const { locale, dict } = await resolveLocale(params);
  return (
    <AuthShell title={dict.auth.resetTitle} >
      <Suspense>
        <ResetForm locale={locale} a={dict.auth} />
      </Suspense>
    </AuthShell>
  );
}
