"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Accessible modal built on the native <dialog> element (focus trap + Esc for free). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  closeLabel,
  variant = "modal",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel: string;
  variant?: "modal" | "drawer";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className={cn(
        "m-0 max-h-none max-w-none bg-transparent p-0 backdrop:bg-navy-950/50",
        variant === "modal" ? "inset-0 m-auto w-[min(32rem,calc(100%-2rem))]" : "inset-y-0 end-0 start-auto h-dvh w-[min(26rem,100%)]",
      )}
    >
      <div
        className={cn(
          "flex flex-col bg-surface",
          variant === "modal" ? "max-h-[85dvh] rounded-[var(--radius-lg)]" : "h-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button onClick={onClose} aria-label={closeLabel} className="rounded p-1 text-ink-3 hover:bg-canvas hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </dialog>
  );
}
