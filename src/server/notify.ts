import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site";
import { centerStatusEmail, listingApprovedEmail, listingRejectedEmail, type CenterNotice } from "@/lib/email-templates";
import type { Locale } from "@/i18n/config";
import { createNotification } from "@/server/notifications";

const loc = (v: string | null | undefined): Locale => (v === "en" ? "en" : "ar");

/**
 * Notifications never block or fail the action that triggered them: the moderation
 * decision is already committed. Failures are logged by sendEmail without content.
 */
async function safely(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch {
    console.error("[notify] notification failed");
  }
}

export async function notifyListingModerated(listingId: string, decision: "approve" | "reject" | "takeDown", reason: string | null) {
  await safely(async () => {
    const [row] = await db
      .select({ title: schema.listings.title, slug: schema.listings.slug, sellerId: schema.listings.sellerId })
      .from(schema.listings)
      .where(eq(schema.listings.id, listingId));
    if (!row) return;
    const kind = decision === "approve" ? "listing_approved" : decision === "reject" ? "listing_rejected" : "listing_taken_down";
    await createNotification(row.sellerId, kind, { title: row.title, reason }, decision === "approve" ? `/cars/${row.slug}` : `/account/listings/${listingId}/edit`);
  });
  return safely(async () => {
    const [row] = await db
      .select({ title: schema.listings.title, slug: schema.listings.slug, email: schema.users.email, locale: schema.users.locale })
      .from(schema.listings)
      .innerJoin(schema.users, eq(schema.users.id, schema.listings.sellerId))
      .where(eq(schema.listings.id, listingId));
    if (!row) return;
    const l = loc(row.locale);
    const msg =
      decision === "approve"
        ? listingApprovedEmail(l, row.title, `${siteUrl()}/${l}/cars/${row.slug}`)
        : listingRejectedEmail(l, row.title, reason ?? "", `${siteUrl()}/${l}/account/listings/${listingId}/edit`, decision === "takeDown");
    await sendEmail({ to: row.email, ...msg });
  });
}

/** Notifies (in-app + email) every active owner/manager of the center. */
export async function notifyCenterStatus(centerId: string, action: CenterNotice, reason: string | null) {
  await safely(async () => {
    const rows = await db
      .select({ userId: schema.centerStaff.userId, role: schema.centerStaff.role, nameAr: schema.serviceCenters.nameAr, nameEn: schema.serviceCenters.nameEn, slug: schema.serviceCenters.slug })
      .from(schema.centerStaff)
      .innerJoin(schema.serviceCenters, eq(schema.serviceCenters.id, schema.centerStaff.centerId))
      .where(and(eq(schema.centerStaff.centerId, centerId), eq(schema.centerStaff.active, true)));
    for (const r of rows.filter((x) => x.role === "owner" || x.role === "manager")) {
      await createNotification(r.userId, "center_status", { action, centerAr: r.nameAr, centerEn: r.nameEn, reason }, `/center/${r.slug}`);
    }
  });
  return safely(async () => {
    const rows = await db
      .select({ nameAr: schema.serviceCenters.nameAr, nameEn: schema.serviceCenters.nameEn, slug: schema.serviceCenters.slug, email: schema.users.email, locale: schema.users.locale, role: schema.centerStaff.role })
      .from(schema.centerStaff)
      .innerJoin(schema.serviceCenters, eq(schema.serviceCenters.id, schema.centerStaff.centerId))
      .innerJoin(schema.users, eq(schema.users.id, schema.centerStaff.userId))
      .where(and(eq(schema.centerStaff.centerId, centerId), eq(schema.centerStaff.active, true)));
    for (const r of rows.filter((x) => x.role === "owner" || x.role === "manager")) {
      const l = loc(r.locale);
      await sendEmail({ to: r.email, ...centerStatusEmail(l, action, l === "ar" ? r.nameAr : r.nameEn, reason, `${siteUrl()}/${l}/center/${r.slug}`) });
    }
  });
}
