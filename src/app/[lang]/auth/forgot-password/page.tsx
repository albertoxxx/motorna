import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { resolveLocale } from "@/i18n/server";
import { getCurrentUser } from "@/server/session";
import { AuthShell } from "@/components/auth-shell";
import Link from "next/link";
import { ForgotForm } from "@/components/auth-forms";
import { Notice } from "@/components/ui/states";
import { emailDeliveryAvailable } from "@/lib/email";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/forgot-password">): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.auth.forgotTitle, robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[lang]/auth/forgot-password">) {
  const { locale, dict } = await resolveLocale(params);
  if (await getCurrentUser()) redirect(`/${locale}`);
  // Never tell someone "a link is on its way" when no email can actually be sent.
  if (!emailDeliveryAvailable()) {
    return (
      <AuthShell title={dict.auth.forgotTitle}>
        <Notice tone="warning" className="mt-4">
          {dict.auth.resetUnavailable}{" "}
          <Link href={`/${locale}/contact`} className="font-semibold underline">{dict.pages.contact}</Link>
        </Notice>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={dict.auth.forgotTitle} body={dict.auth.forgotBody}>
      <Suspense>
        <ForgotForm locale={locale} a={dict.auth} />
      </Suspense>
    </AuthShell>
  );
}
