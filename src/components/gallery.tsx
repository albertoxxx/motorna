"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Img = { id: string; url: string; thumbUrl: string; width: number; height: number };
type Labels = { noPhotos: string; photoOf: string; prev: string; next: string; fullscreen?: string; close?: string };

const fmt = (tpl: string, i: number, n: number) => tpl.replace("{i}", String(i)).replace("{n}", String(n));

/** Listing gallery: arrows, keyboard, swipe, thumbnails, and a fullscreen viewer. */
export function Gallery({ images, alt, labels }: { images: Img[]; alt: string; labels: Labels }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const touchX = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const n = images.length;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (full && !d.open) d.showModal();
    if (!full && d.open) d.close();
  }, [full]);

  if (n === 0) {
    return (
      <div className="grid aspect-[3/2] place-items-center rounded-[var(--radius-lg)] border border-line bg-surface text-ink-3">
        <div className="flex flex-col items-center gap-2"><ImageIcon className="size-8" />{labels.noPhotos}</div>
      </div>
    );
  }

  const go = (d: number) => setI((x) => (x + d + n) % n);
  // In RTL the "next" photo is to the left, matching reading direction.
  const dirSign = () => (typeof document !== "undefined" && document.dir === "rtl" ? -1 : 1);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") go(-dirSign());
    if (e.key === "ArrowRight") go(dirSign());
  };
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => (touchX.current = e.touches[0].clientX),
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      touchX.current = null;
      if (Math.abs(dx) > 40) go((dx < 0 ? 1 : -1) * dirSign());
    },
  };
  const current = images[i];
  const counter = (
    <span dir="ltr" className="tabular rounded bg-navy-950/75 px-2 py-1 text-xs text-white" aria-live="polite">
      {i + 1} / {n}
    </span>
  );
  const arrows = (size: string) =>
    n > 1 && (
      <>
        <button onClick={() => go(-1)} aria-label={labels.prev} className={cn("absolute start-3 top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy-900 shadow hover:bg-white", size)}>
          <ChevronLeft className="size-5 rtl:rotate-180" />
        </button>
        <button onClick={() => go(1)} aria-label={labels.next} className={cn("absolute end-3 top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy-900 shadow hover:bg-white", size)}>
          <ChevronRight className="size-5 rtl:rotate-180" />
        </button>
      </>
    );

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-[3/2] touch-pan-y overflow-hidden rounded-[var(--radius-lg)] bg-navy-950"
        tabIndex={0}
        onKeyDown={onKey}
        {...swipe}
        aria-roledescription="carousel"
        aria-label={alt}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          onError={(e) => {
            // Fall back to the thumbnail, then hide, so a missing file never shows a broken icon.
            const el = e.currentTarget;
            if (el.dataset.fallback !== "1") { el.dataset.fallback = "1"; el.src = current.thumbUrl; } else { el.style.visibility = "hidden"; }
          }}
          src={current.url}
          alt={`${alt} — ${fmt(labels.photoOf, i + 1, n)}`}
          width={current.width}
          height={current.height}
          fetchPriority={i === 0 ? "high" : "auto"}
          className="size-full object-contain"
        />
        {arrows("size-10")}
        <div className="absolute bottom-3 end-3 flex items-center gap-2">
          {counter}
          {labels.fullscreen && (
            <button onClick={() => setFull(true)} aria-label={labels.fullscreen} className="grid size-8 place-items-center rounded bg-navy-950/75 text-white hover:bg-navy-950">
              <Maximize2 className="size-4" />
            </button>
          )}
        </div>
      </div>
      {n > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
          {images.map((img, k) => (
            <button
              key={img.id}
              role="tab"
              onClick={() => setI(k)}
              aria-label={fmt(labels.photoOf, k + 1, n)}
              aria-selected={k === i}
              className={cn("h-16 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2", k === i ? "border-brand-600" : "border-transparent opacity-75 hover:opacity-100")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumbUrl} alt="" className="size-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setFull(false)}
        aria-label={alt}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-navy-950 p-0 backdrop:bg-navy-950"
      >
        {full && (
          <div className="relative flex size-full items-center justify-center" onKeyDown={onKey} {...swipe}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={`${alt} — ${fmt(labels.photoOf, i + 1, n)}`} className="max-h-full max-w-full object-contain" />
            {arrows("size-12")}
            <div className="absolute end-3 top-3 flex items-center gap-2">
              {counter}
              <button onClick={() => setFull(false)} aria-label={labels.close} className="grid size-10 place-items-center rounded-full bg-white/90 text-navy-900 hover:bg-white" autoFocus>
                <X className="size-5" />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
