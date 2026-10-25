"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, Heart, LayoutList, LogOut, Menu, MessageSquare, Shield, User, X, ChevronDown, Plus, Wrench } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { authClient } from "@/lib/auth-client";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "./logo";
import { cn } from "@/lib/cn";

type Props = {
  locale: Locale;
  nav: Dictionary["nav"];
  user: { name: string; isAdmin: boolean; hasCenter: boolean } | null;
  unread: number;
  notifications: number;
};

export function switchLocalePath(pathname: string, to: Locale) {
  const parts = pathname.split("/");
  parts[1] = to;
  return parts.join("/") || `/${to}`;
}

export function HeaderClient({ locale, nav, user, unread, notifications }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const other: Locale = locale === "ar" ? "en" : "ar";
  const p = (s: string) => `/${locale}${s}`;

  // Close menus on navigation (state adjustment during render, no effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  async function signOut() {
    await authClient.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  const accountLinks = [
    { href: p("/account/notifications"), label: nav.notifications, icon: Bell, badge: notifications },
    { href: p("/account/listings"), label: nav.myListings, icon: LayoutList },
    { href: p("/account/favorites"), label: nav.favorites, icon: Heart },
    { href: p("/account/messages"), label: nav.messages, icon: MessageSquare, badge: unread },
    { href: p("/account/profile"), label: nav.profile, icon: User },
    ...(user?.hasCenter ? [{ href: p("/center"), label: nav.myCenter, icon: Wrench }] : []),
    ...(user?.isAdmin ? [{ href: p("/admin"), label: nav.admin, icon: Shield }] : []),
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded focus:bg-navy-900 focus:px-3 focus:py-2 focus:text-white">
        {nav.skipToContent}
      </a>
      <div className="container-page flex h-16 items-center gap-3 sm:gap-6">
        <Logo locale={locale} />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          <Link href={p("/cars")} className={cn("whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium", isActive(p("/cars")) ? "text-ink" : "text-ink-2 hover:text-ink")}>
            {nav.browse}
          </Link>
          <Link href={p("/care")} className={cn("whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium", isActive(p("/care")) ? "text-ink" : "text-ink-2 hover:text-ink")}>
            {nav.care}
          </Link>
          <Link href={p("/faq")} className={cn("whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium", isActive(p("/faq")) ? "text-ink" : "text-ink-2 hover:text-ink")}>
            {nav.help}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <Link
            href={switchLocalePath(pathname, other)}
            hrefLang={other}
            aria-label={nav.languageLabel}
            className="hidden rounded-md px-2.5 py-2 text-sm font-medium text-ink-2 hover:bg-canvas hover:text-ink sm:inline-flex"
            lang={other}
          >
            {nav.language}
          </Link>
          {user && (
            <Link
              href={p("/account/notifications")}
              aria-label={notifications > 0 ? `${nav.notifications} (${notifications})` : nav.notifications}
              className="relative inline-flex size-10 items-center justify-center rounded-md text-ink hover:bg-canvas"
            >
              <Bell className="size-5" aria-hidden />
              {notifications > 0 && (
                <span className="tabular absolute -top-0.5 end-0.5 grid min-w-5 place-items-center rounded-full bg-danger-600 px-1 text-[0.7rem] font-semibold leading-5 text-white ring-2 ring-surface" aria-hidden>
                  {notifications > 9 ? "9+" : notifications}
                </span>
              )}
            </Link>
          )}
          {user ? (
            <div className="relative hidden lg:block" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="relative inline-flex h-10 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-ink hover:bg-canvas"
              >
                <span className="grid size-7 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-white">{user.name.trim().charAt(0).toUpperCase()}</span>
                <span className="max-w-32 truncate"><bdi>{user.name}</bdi></span>
                <ChevronDown className="size-4 text-ink-3" />
                {unread > 0 && <span className="absolute start-6 top-1.5 size-2.5 rounded-full bg-danger-600 ring-2 ring-surface" aria-label={`${unread}`} />}
              </button>
              {menuOpen && (
                <div role="menu" className="absolute end-0 top-12 w-60 overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">
                  {accountLinks.map((l) => (
                    <Link key={l.href} role="menuitem" href={l.href} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-canvas">
                      <l.icon className="size-4 text-ink-3" />
                      <span className="flex-1">{l.label}</span>
                      {!!l.badge && <span className="tabular rounded-full bg-danger-600 px-1.5 text-xs font-semibold text-white">{l.badge}</span>}
                    </Link>
                  ))}
                  <div className="my-1 border-t border-line" />
                  <button role="menuitem" onClick={signOut} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-canvas">
                    <LogOut className="size-4 text-ink-3" />
                    {nav.signOut}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href={p("/auth/sign-in")} className="hidden whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-canvas lg:inline-flex">
              {nav.signIn}
            </Link>
          )}
          <Link href={p("/sell")} aria-label={nav.sell} className={buttonClass("primary", "md", "hidden px-3 sm:inline-flex xs:px-4")}>
            <Plus className="size-4" />
            {/* Icon-only on the narrowest phones so the header never scrolls sideways. */}
            <span className="max-xs:sr-only">{nav.sell}</span>
          </Link>
          <button
            className="relative inline-flex size-10 items-center justify-center rounded-md text-ink hover:bg-canvas lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? nav.close : nav.menu}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            {!mobileOpen && unread > 0 && <span className="absolute end-2 top-2 size-2.5 rounded-full bg-danger-600 ring-2 ring-surface" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav id="mobile-nav" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-surface lg:hidden" aria-label="Mobile">
          <div className="container-page flex flex-col py-3">
            <Link href={p("/sell")} className={buttonClass("primary", "lg", "mb-3 w-full")}>
              <Plus className="size-4" />
              {nav.sell}
            </Link>
            <Link href={p("/cars")} className="rounded-md px-2 py-3 font-medium text-ink">{nav.browse}</Link>
            <Link href={p("/care")} className="rounded-md px-2 py-3 font-medium text-ink">{nav.care}</Link>
            <Link href={p("/faq")} className="rounded-md px-2 py-3 font-medium text-ink">{nav.help}</Link>
            <div className="my-2 border-t border-line" />
            {user ? (
              <>
                {accountLinks.map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-md px-2 py-3 text-ink">
                    <l.icon className="size-4 text-ink-3" />
                    <span className="flex-1">{l.label}</span>
                    {!!l.badge && <span className="tabular rounded-full bg-danger-600 px-1.5 text-xs font-semibold text-white">{l.badge}</span>}
                  </Link>
                ))}
                <button onClick={signOut} className="flex items-center gap-3 rounded-md px-2 py-3 text-start text-ink">
                  <LogOut className="size-4 text-ink-3" />
                  {nav.signOut}
                </button>
              </>
            ) : (
              <div className="flex gap-2 py-1">
                <Link href={p("/auth/sign-in")} className={buttonClass("secondary", "md", "flex-1")}>{nav.signIn}</Link>
                <Link href={p("/auth/sign-up")} className={buttonClass("dark", "md", "flex-1")}>{nav.signUp}</Link>
              </div>
            )}
            <Link href={switchLocalePath(pathname, other)} lang={other} className="mt-2 rounded-md px-2 py-3 text-ink-2">
              {nav.language}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
