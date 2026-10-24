import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import type { UserRole } from "@/db/schema";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  suspended: boolean;
};

/** Reads the session once per request. Returns null when signed out or suspended. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string; suspendedAt?: Date | null };
  if (u.suspendedAt) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u.role as UserRole) ?? "user",
    suspended: false,
  };
});

export async function requireUser(locale: Locale, nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/${locale}/auth/sign-in${next}`);
  }
  return user;
}

export async function requireAdmin(locale: Locale): Promise<CurrentUser> {
  const user = await requireUser(locale, `/${locale}/admin`);
  if (user.role !== "admin") redirect(`/${locale}`);
  return user;
}
