import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/ar/account", "/en/account", "/ar/admin", "/en/admin", "/ar/auth", "/en/auth", "/ar/sell", "/en/sell", "/ar/center", "/en/center", "/ar/care/apply", "/en/care/apply"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
