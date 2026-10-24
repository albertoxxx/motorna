"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/** Native share sheet where supported (most phones); otherwise copies the link. */
export function ShareButton({ title, labels }: { title: string; labels: { share: string; copied: string; failed: string } }) {
  const toast = useToast();
  async function onClick() {
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast(labels.copied);
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") toast(labels.failed, "error");
    }
  }
  return (
    <button onClick={onClick} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm text-ink-2 hover:bg-canvas hover:text-ink">
      <Share2 className="size-4" aria-hidden />
      {labels.share}
    </button>
  );
}
