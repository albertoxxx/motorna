"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewLicence } from "@/server/actions/verification";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { Dictionary } from "@/i18n/dictionaries/ar";

export function LicenceReview({ dict, checkId }: { dict: Pick<Dictionary, "verify" | "errors">; checkId: string }) {
  const V = dict.verify;
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (raw: unknown, msg: string) =>
    start(async () => {
      const r = await reviewLicence(checkId, raw);
      if (!r.ok) return toast(dict.errors[r.error], "error");
      toast(msg);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={V.adminExpiry} htmlFor={`exp-${checkId}`}><Input id={`exp-${checkId}`} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></Field>
        <Field label={V.adminNote} htmlFor={`note-${checkId}`}><Input id={`note-${checkId}`} maxLength={500} dir="auto" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <div className="flex gap-2">
        <Button size="sm" loading={pending} onClick={() => run({ decision: "accept", note: note || undefined, expiresAt: expiresAt || undefined }, V.accepted)}>{V.accept}</Button>
        <Button size="sm" variant="danger" loading={pending} disabled={note.trim().length < 5} onClick={() => run({ decision: "reject", note }, V.rejected)}>{V.reject}</Button>
      </div>
    </div>
  );
}
