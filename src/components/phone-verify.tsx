"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleDashed } from "lucide-react";
import { confirmPhoneCode, requestPhoneCode } from "@/server/actions/verification";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { Dictionary } from "@/i18n/dictionaries/ar";

/** Phone verification by SMS code. Only offered when an SMS provider is configured (`available`). */
export function PhoneVerify({ dict, phone, verified, available }: { dict: Pick<Dictionary, "verify" | "errors">; phone: string | null; verified: boolean; available: boolean }) {
  const V = dict.verify;
  const [sent, setSent] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <section aria-labelledby="pv-title" className="mt-8 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <h2 id="pv-title" className="text-lg font-semibold">{V.phoneTitle}</h2>
      <p className={`mt-2 flex items-center gap-2 text-sm font-medium ${verified ? "text-success-700" : "text-ink-3"}`}>
        {verified ? <CircleCheck className="size-4" aria-hidden /> : <CircleDashed className="size-4" aria-hidden />}
        {verified ? V.phoneVerified : V.phoneNotVerified}
        {phone && <span dir="ltr" className="tabular font-normal text-ink-3">({phone})</span>}
      </p>
      {!verified && (
        <div className="mt-3 flex flex-col gap-3">
          {!available ? (
            <p className="text-sm text-ink-3">{V.phoneUnavailable}</p>
          ) : !phone ? (
            <p className="text-sm text-ink-3">{V.phoneNeedNumber}</p>
          ) : (
            <>
              <Button size="sm" variant="secondary" className="self-start" loading={pending && sent === null}
                onClick={() => start(async () => {
                  const r = await requestPhoneCode();
                  if (!r.ok) return toast(dict.errors[r.error], "error");
                  setSent(r.data.expiresInMin);
                })}>{V.sendCode}</Button>
              {sent !== null && (
                <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const r = await confirmPhoneCode(code);
                    if (!r.ok) return toast(dict.errors[r.error], "error");
                    toast(V.confirmed);
                    router.refresh();
                  });
                }}>
                  <p className="w-full text-sm text-ink-2">{V.codeSent.replace("{phone}", phone).replace("{n}", String(sent))}</p>
                  <Field label={V.codeLabel} htmlFor="pv-code">
                    <Input id="pv-code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} className="w-36 tabular tracking-widest" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d٠-٩]/g, "").slice(0, 6))} />
                  </Field>
                  <Button type="submit" size="md" loading={pending} disabled={code.length !== 6}>{V.confirm}</Button>
                </form>
              )}
            </>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-ink-3">{V.changeNote}</p>
    </section>
  );
}
