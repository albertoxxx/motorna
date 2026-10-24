import type { Metadata } from "next";
import Link from "next/link";
import { resolveLocale } from "@/i18n/server";
import { getCurrentUser } from "@/server/session";
import { centersForUser } from "@/server/care";
import { getCities } from "@/server/listings";
import { CenterProfileForm } from "@/components/care/center-profile-form";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { OPEN_APPLICATION } from "@/lib/care";

export async function generateMetadata({ params }: PageProps<"/[lang]/care/apply">): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.care.apply.title, robots: { index: false } };
}

export default async function ApplyPage({ params }: PageProps<"/[lang]/care/apply">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await getCurrentUser();
  const [mine, cities] = await Promise.all([user ? centersForUser(user.id) : Promise.resolve([]), getCities()]);
  const open = mine.find((c) => c.role === "owner" && (OPEN_APPLICATION as readonly string[]).includes(c.status));
  const P = dict.care.apply;
  return (
    <div className="container-page py-10">
      <p className="text-sm font-semibold text-brand-700">{dict.care.name}</p>
      <h1 className="mt-1 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">{P.title}</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-ink-2">{P.body}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside>
          <h2 className="text-sm font-semibold text-ink-3">{P.stepsTitle}</h2>
          <ol className="mt-3 flex flex-col gap-1">
            {P.steps.map((s, i) => (
              <li key={s} className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm ${i === 0 ? "bg-surface font-semibold ring-1 ring-line" : "text-ink-2"}`}>
                <span className={`tabular grid size-6 shrink-0 place-items-center rounded-full border text-xs ${i === 0 ? "border-navy-900 bg-navy-900 text-white" : "border-line-strong"}`}>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </aside>
        <div>
          {!user ? (
            <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
              <p className="text-ink-2">{P.signInFirst}</p>
              <ButtonLink href={`/${locale}/auth/sign-in?next=${encodeURIComponent(`/${locale}/care/apply`)}`} className="mt-4">{dict.nav.signIn}</ButtonLink>
            </div>
          ) : open ? (
            <Notice>
              {P.pending}{" "}
              <Link href={`/${locale}/center/${open.slug}`} className="font-semibold underline">{P.openDashboard}</Link>
            </Notice>
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-7">
              <CenterProfileForm locale={locale} dict={{ care: dict.care, common: dict.common, validation: dict.validation, errors: dict.errors }} cities={cities} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
