import { headers } from "next/headers";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/server";
import { ButtonLink } from "@/components/ui/button";

export default async function NotFound() {
  const h = await headers();
  const seg = (h.get("x-pathname") ?? "").split("/")[1] ?? "";
  const locale = hasLocale(seg) ? seg : "ar";
  const dict = getDictionary(locale);
  return (
    <div className="container-page flex flex-col items-start gap-4 py-24">
      <p className="tabular text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-3xl font-bold">{dict.common.notFoundTitle}</h1>
      <p className="text-ink-2">{dict.common.notFoundBody}</p>
      <ButtonLink href={`/${locale}`} variant="dark">{dict.common.goHome}</ButtonLink>
    </div>
  );
}
