import "server-only";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireUser } from "@/server/session";
import { centerIdBySlug, staffRole } from "@/server/care";
import type { Locale } from "@/i18n/config";

/** For provider pages: the signed-in user must be active staff of this center, otherwise 404/redirect. */
export async function requireCenterStaffPage(locale: Locale, slug: string, path: string) {
  const user = await requireUser(locale, `/${locale}/center/${slug}${path}`);
  const centerId = await centerIdBySlug(slug);
  if (!centerId) notFound();
  const role = await staffRole(user.id, centerId);
  if (!role) redirect(`/${locale}`);
  const [center] = await db.select().from(schema.serviceCenters).where(eq(schema.serviceCenters.id, centerId));
  return { user, role, center };
}
