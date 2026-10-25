"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

const KEY = "motorna:lastResults";

/** Placed on the cars list: remembers the current search (filters + page) for "Back to results". */
export function RememberResults() {
  const pathname = usePathname();
  const sp = useSearchParams();
  useEffect(() => {
    try {
      const q = sp.toString();
      sessionStorage.setItem(KEY, `${pathname}${q ? `?${q}` : ""}`);
    } catch {
      /* storage unavailable: the link falls back to the plain list */
    }
  }, [pathname, sp]);
  return null;
}

/** Returns to the last search the visitor ran on this site (same language), or to the cars list. */
export function BackToResults({ locale, label }: { locale: string; label: string }) {
  const router = useRouter();
  return (
    <Link
      href={`/${locale}/cars`}
      onClick={(e) => {
        try {
          const last = sessionStorage.getItem(KEY);
          // Only same-site, same-language list URLs are accepted.
          if (last && last.startsWith(`/${locale}/cars?`)) {
            e.preventDefault();
            router.push(last);
          }
        } catch {
          /* storage unavailable: follow the plain link */
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
    >
      <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
      {label}
    </Link>
  );
}
