import { getCurrentUser } from "@/server/session";
import { unreadCount } from "@/server/queries";
import { centersForUser } from "@/server/care";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { HeaderClient } from "./header-client";

export async function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const user = await getCurrentUser();
  const [unread, centers] = user ? await Promise.all([unreadCount(user.id), centersForUser(user.id)]) : [0, []];
  return (
    <HeaderClient
      locale={locale}
      nav={dict.nav}
      user={user ? { name: user.name, isAdmin: user.role === "admin", hasCenter: centers.length > 0 } : null}
      unread={unread}
    />
  );
}
