/** Only allow same-origin relative redirects ("/ar/..."), never "//evil.com" or absolute URLs. */
export function safeNext(next: string | null | undefined, fallback: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
