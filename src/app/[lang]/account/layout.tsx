import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { AccountNav } from "@/components/account-nav";

export default async function AccountLayout({ children, params }: LayoutProps<"/[lang]/account">) {
  const { locale, dict } = await resolveLocale(params);
  await requireUser(locale, `/${locale}/account/listings`);
  return (
    <div className="container-page py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[13rem_1fr]">
        <AccountNav
          locale={locale}
          links={[
            { href: "/account/notifications", label: dict.nav.notifications },
            { href: "/account/listings", label: dict.nav.myListings },
            { href: "/account/favorites", label: dict.nav.favorites },
            { href: "/account/messages", label: dict.nav.messages },
            { href: "/account/profile", label: dict.nav.profile },
          ]}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
