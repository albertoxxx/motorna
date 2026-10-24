import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { centersForUser } from "@/server/care";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { careStatusTone } from "@/components/care/status";

export const metadata: Metadata = { robots: { index: false } };

export default async function MyCentersPage({ params }: PageProps<"/[lang]/center">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale, `/${locale}/center`);
  const mine = await centersForUser(user.id);
  if (mine.length === 1) redirect(`/${locale}/center/${mine[0].slug}`);
  const D = dict.care.dash;
  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="mb-6 text-2xl font-bold">{D.myCenters}</h1>
      {mine.length === 0 ? (
        <EmptyState title={D.noCenters} action={<ButtonLink href={`/${locale}/care/apply`}>{dict.care.applyCta}</ButtonLink>} />
      ) : (
        <ul className="flex flex-col gap-3">
          {mine.map((c) => (
            <li key={c.id}>
              <Link href={`/${locale}/center/${c.slug}`} className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-4 hover:border-line-strong">
                <span className="font-semibold"><bdi>{locale === "ar" ? c.nameAr : c.nameEn}</bdi></span>
                <Badge tone={careStatusTone(c.status)}>{dict.care.enums.status[c.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
