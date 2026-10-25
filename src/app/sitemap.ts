import type { MetadataRoute } from "next";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticPaths = ["", "/cars", "/about", "/verification", "/faq", "/contact", "/terms", "/privacy", "/care"];
  const listings = await db
    .select({ slug: schema.listings.slug, updatedAt: schema.listings.updatedAt })
    .from(schema.listings)
    .where(and(eq(schema.listings.status, "published"), isNull(schema.listings.deletedAt)))
    .orderBy(desc(schema.listings.publishedAt))
    .limit(45000);
  // Approved Care providers only (the directory never shows unreviewed centers).
  const centers = await db
    .select({ slug: schema.serviceCenters.slug, updatedAt: schema.serviceCenters.updatedAt })
    .from(schema.serviceCenters)
    .where(eq(schema.serviceCenters.status, "approved"))
    .limit(5000);
  const alt = (p: string) => ({ languages: { ar: `${base}/ar${p}`, en: `${base}/en${p}` } });
  return [
    ...staticPaths.map((p) => ({ url: `${base}/ar${p}`, alternates: alt(p) })),
    ...listings.map((l) => ({ url: `${base}/ar/cars/${l.slug}`, lastModified: l.updatedAt, alternates: alt(`/cars/${l.slug}`) })),
    ...centers.map((c) => ({ url: `${base}/ar/care/centers/${c.slug}`, lastModified: c.updatedAt, alternates: alt(`/care/centers/${c.slug}`) })),
  ];
}
