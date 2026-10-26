"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawLicence } from "@/server/actions/verification";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { Dictionary } from "@/i18n/dictionaries/ar";

type D = Pick<Dictionary, "verify" | "errors">;

export function LicenceUpload({ dict, listingId }: { dict: D; listingId: string }) {
  const V = dict.verify;
  const form = useRef<HTMLFormElement>(null);
  const [hasFront, setHasFront] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      ref={form}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(form.current!);
        start(async () => {
          const res = await fetch(`/api/listings/${listingId}/licence`, { method: "POST", body: fd });
          const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: keyof Dictionary["errors"] };
          if (!res.ok || !body.ok) return toast(dict.errors[body.error ?? "generic"] ?? dict.errors.generic, "error");
          toast(V.uploaded);
          form.current?.reset();
          setHasFront(false);
          router.refresh();
        });
      }}
    >
      <Field label={V.front} htmlFor="lc-front" hint={V.fileTypes} required requiredLabel="*">
        <input id="lc-front" name="front" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setHasFront(!!e.target.files?.length)} className="text-sm file:me-3 file:rounded-[var(--radius-sm)] file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:text-sm" />
      </Field>
      <Field label={V.back} htmlFor="lc-back">
        <input id="lc-back" name="back" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm file:me-3 file:rounded-[var(--radius-sm)] file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:text-sm" />
      </Field>
      <Button type="submit" className="self-start" loading={pending} disabled={!hasFront}>{V.upload}</Button>
    </form>
  );
}

export function LicenceWithdraw({ dict, checkId }: { dict: D; checkId: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={() => start(async () => {
      const r = await withdrawLicence(checkId);
      if (!r.ok) return toast(dict.errors[r.error], "error");
      toast(dict.verify.withdrawn);
      router.refresh();
    })}>{dict.verify.withdraw}</Button>
  );
}
