export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Support email, read at request time (not inlined at build), so changing it
 * in Vercel takes effect without depending on a rebuild. CONTACT_EMAIL also works.
 */
export function contactEmail(): string | null {
  const env = process.env as Record<string, string | undefined>;
  const v = (env["CONTACT_EMAIL"] ?? env["NEXT_PUBLIC_CONTACT_EMAIL"] ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}
