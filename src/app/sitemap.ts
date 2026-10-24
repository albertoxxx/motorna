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
  const alt = (p: string) => ({ languages: { ar: `${base}/ar${p}`, en: `${base}/en${p}` } });
  return [
    ...staticPaths.map((p) => ({ url: `${base}/ar${p}`, alternates: alt(p) })),
    ...listings.map((l) => ({ url: `${base}/ar/cars/${l.slug}`, lastModified: l.updatedAt, alternates: alt(`/cars/${l.slug}`) })),
  ];
}
