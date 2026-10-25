"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { fail, ok, type ActionResult } from "@/server/result";
import { locales, type Locale } from "@/i18n/config";

const N = schema.notifications;
const UUID = /^[0-9a-f-]{36}$/i;

/** Opens a notification: marks it read (only if it belongs to the caller) and goes to its page. */
export async function openNotification(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const localeRaw = String(formData.get("locale") ?? "ar");
  const locale: Locale = (locales as readonly string[]).includes(localeRaw) ? (localeRaw as Locale) : "ar";
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);
  if (!UUID.test(id)) redirect(`/${locale}/account/notifications`);
  const [row] = await db
    .update(N)
    .set({ readAt: new Date() })
    .where(and(eq(N.id, id), eq(N.userId, user.id)))
    .returning({ href: N.href });
  revalidatePath("/[lang]", "layout");
  // href is validated as a local path at write time and by a DB check constraint.
  redirect(row ? `/${locale}${row.href}` : `/${locale}/account/notifications`);
}

export async function markAllNotificationsRead(): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  await db.update(N).set({ readAt: new Date() }).where(and(eq(N.userId, user.id), isNull(N.readAt)));
  revalidatePath("/[lang]", "layout");
  return ok(null);
}
