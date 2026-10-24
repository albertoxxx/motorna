import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { cn } from "@/lib/cn";

export function Pagination({
  page,
  pageCount,
  hrefFor,
  dict,
}: {
  page: number;
  pageCount: number;
  hrefFor: (p: number) => string;
  dict: Dictionary;
}) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );
  const item = "inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm tabular";
  return (
    <nav aria-label={dict.common.page} className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={cn(item, "border-line-strong bg-surface hover:bg-canvas")} rel="prev">
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          <span className="sr-only sm:not-sr-only sm:ms-1">{dict.common.previous}</span>
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-ink-3">…</span>}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "border-navy-900 bg-navy-900 text-white" : "border-line-strong bg-surface hover:bg-canvas")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount && (
        <Link href={hrefFor(page + 1)} className={cn(item, "border-line-strong bg-surface hover:bg-canvas")} rel="next">
          <span className="sr-only sm:not-sr-only sm:me-1">{dict.common.nextPage}</span>
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
