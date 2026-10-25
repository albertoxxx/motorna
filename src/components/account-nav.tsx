"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function AccountNav({ locale, links }: { locale: string; links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="flex min-w-0 gap-1 overflow-x-auto lg:flex-col">
      {links.map((l) => {
        const href = `/${locale}${l.href}`;
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("shrink-0 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium", active ? "bg-navy-900 text-white" : "text-ink-2 hover:bg-surface hover:text-ink")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
