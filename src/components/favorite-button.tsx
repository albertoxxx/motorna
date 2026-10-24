"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/server/actions/engagement";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type Labels = { save: string; saved: string; signIn: string; error: string };

export function FavoriteButton({
  listingId,
  initial,
  signedIn,
  signInHref,
  labels,
  variant = "overlay",
}: {
  listingId: string;
  initial: boolean;
  signedIn: boolean;
  signInHref: string;
  labels: Labels;
  variant?: "overlay" | "full";
}) {
  const [saved, setSaved] = useOptimistic(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      toast(labels.signIn, "error");
      router.push(signInHref);
      return;
    }
    start(async () => {
      setSaved(!saved);
      const res = await toggleFavorite(listingId);
      if (!res.ok) toast(labels.error, "error");
      router.refresh();
    });
  }

  const label = saved ? labels.saved : labels.save;
  if (variant === "full") {
    return (
      <button
        onClick={onClick}
        aria-pressed={saved}
        disabled={pending}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 text-sm font-medium transition-colors",
          saved ? "border-danger-600/30 bg-danger-50 text-danger-700" : "border-line-strong bg-surface text-ink hover:bg-canvas",
        )}
      >
        <Heart className={cn("size-4", saved && "fill-current")} />
        {label}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      disabled={pending}
      className="grid size-9 place-items-center rounded-full bg-white/95 text-navy-900 shadow-sm ring-1 ring-black/5 transition hover:scale-105"
    >
      <Heart className={cn("size-[18px]", saved && "fill-danger-600 text-danger-600")} />
    </button>
  );
}
