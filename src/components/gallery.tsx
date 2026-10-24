"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Img = { id: string; url: string; thumbUrl: string; width: number; height: number };

export function Gallery({ images, alt, labels }: { images: Img[]; alt: string; labels: { noPhotos: string; photoOf: string; prev: string; next: string } }) {
  const [i, setI] = useState(0);
  if (images.length === 0) {
    return (
      <div className="grid aspect-[3/2] place-items-center rounded-[var(--radius-lg)] border border-line bg-surface text-ink-3">
        <div className="flex flex-col items-center gap-2"><ImageIcon className="size-8" />{labels.noPhotos}</div>
      </div>
    );
  }
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length);
  const current = images[i];
  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius-lg)] bg-navy-950"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(document.dir === "rtl" ? 1 : -1);
          if (e.key === "ArrowRight") go(document.dir === "rtl" ? -1 : 1);
        }}
        aria-roledescription="carousel"
        aria-label={alt}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={`${alt} — ${labels.photoOf.replace("{i}", String(i + 1)).replace("{n}", String(images.length))}`} width={current.width} height={current.height} className="size-full object-contain" />
        {images.length > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label={labels.prev} className="absolute start-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy-900 shadow hover:bg-white">
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </button>
            <button onClick={() => go(1)} aria-label={labels.next} className="absolute end-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy-900 shadow hover:bg-white">
              <ChevronRight className="size-5 rtl:rotate-180" />
            </button>
            <span dir="ltr" className="tabular absolute bottom-3 end-3 rounded bg-navy-950/75 px-2 py-1 text-xs text-white" aria-live="polite">
              {i + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, k) => (
            <button
              key={img.id}
              onClick={() => setI(k)}
              aria-label={labels.photoOf.replace("{i}", String(k + 1)).replace("{n}", String(images.length))}
              aria-current={k === i}
              className={cn("h-16 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2", k === i ? "border-brand-600" : "border-transparent opacity-75 hover:opacity-100")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
