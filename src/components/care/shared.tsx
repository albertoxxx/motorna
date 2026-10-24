"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { Dictionary } from "@/i18n/dictionaries/ar";

export type CareDict = Pick<Dictionary, "care" | "common" | "validation" | "errors">;
export type City = { id: number; nameAr: string; nameEn: string };
type Res = { ok: boolean; error?: keyof Dictionary["errors"]; fields?: Record<string, string> };

/** Runs a server action, toasts the outcome, refreshes the route. */
export function useAction(dict: CareDict) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<Res>, success: string, after?: (r: Res) => void, onError?: (r: Res) => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        onError?.(res);
        toast(dict.errors[res.error ?? "generic"], "error");
        return;
      }
      toast(success);
      after?.(res);
      router.refresh();
    });
  return { pending, run };
}
