import type { Metadata } from "next";
import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { centersForUser } from "@/server/care";
import { getCities } from "@/server/listings";
import { CenterProfileForm } from "@/components/care/center-profile-form";
import { Notice } from "@/components/ui/states";

export async function generateMetadata({ params }: PageProps<"/[lang]/care/apply">): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.care.apply.title, robots: { index: false } };
}

export default async function ApplyPage({ params }: PageProps<"/[lang]/care/apply">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale, `/${locale}/care/apply`);
  const [mine, cities] = await Promise.all([centersForUser(user.id), getCities()]);
  const pending = mine.find((c) => c.role === "owner" && (c.status === "applied" || c.status === "under_review"));
  const P = dict.care.apply;
  return (
    <div className="container-page max-w-3xl py-10">
      <p className="text-sm font-semibold text-brand-700">{dict.care.name}</p>
      <h1 className="mt-1 text-3xl font-bold">{P.title}</h1>
      <p className="mt-2 text-ink-2">{P.body}</p>
      {pending ? (
        <Notice className="mt-6">
          {P.pending}{" "}
          <Link href={`/${locale}/center/${pending.slug}`} className="font-semibold underline">{P.openDashboard}</Link>
        </Notice>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-3">{P.next}</p>
          <div className="mt-6 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-7">
            <CenterProfileForm locale={locale} dict={{ care: dict.care, common: dict.common, validation: dict.validation, errors: dict.errors }} cities={cities} />
          </div>
        </>
      )}
    </div>
  );
}
