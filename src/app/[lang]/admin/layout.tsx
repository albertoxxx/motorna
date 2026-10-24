import { resolveLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { AccountNav } from "@/components/account-nav";

export const metadata = { robots: { index: false } };

export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/admin">) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdmin(locale);
  const A = dict.admin;
  return (
    <div className="container-page py-8">
      <p className="mb-1 text-sm font-semibold text-brand-700">{A.title}</p>
      <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
        <AccountNav
          locale={locale}
          links={[
            { href: "/admin/listings", label: A.moderation },
            { href: "/admin/reports", label: A.reports },
            { href: "/admin/centers", label: dict.care.admin.centers },
            { href: "/admin/audit", label: A.audit },
          ]}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
