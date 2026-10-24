import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";

function preferredLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get("locale")?.value;
  if (cookie && hasLocale(cookie)) return cookie;
  const accept = req.headers.get("accept-language") ?? "";
  // Arabic is the default market language; English only if clearly preferred first.
  const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") ? "en" : defaultLocale;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const seg = pathname.split("/")[1];
  if (seg && hasLocale(seg)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (req.cookies.get("locale")?.value !== seg) {
      res.cookies.set("locale", seg, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  }
  const url = req.nextUrl.clone();
  url.pathname = `/${preferredLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|media|_next|favicon.ico|robots.txt|sitemap.xml|icon|apple-icon|.*\\.[a-z0-9]+$).*)"],
};
