"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { CREDENTIAL_KINDS } from "@/lib/care";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { CareDict } from "./shared";

type Doc = { id: string; kind: string; number: string | null; expiresAt: Date | null; reviewState: string; reviewNote: string | null; createdAt: Date };

export function DocsPanel({ locale, dict, centerId, docs, editable }: { locale: Locale; dict: CareDict; centerId: string; docs: Doc[]; editable: boolean }) {
  const D = dict.care.dash;
  const E = dict.care.enums;
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return toast(dict.errors.documentType, "error");
    setBusy(true);
    try {
      const res = await fetch(`/api/care/centers/${centerId}/credentials`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({ ok: false, error: "generic" }));
      if (!json.ok) toast(dict.errors[json.error as keyof typeof dict.errors] ?? dict.errors.generic, "error");
      else {
        toast(D.uploaded);
        formRef.current?.reset();
        router.refresh();
      }
    } catch {
      toast(dict.errors.generic, "error");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-3">{D.docsHint}</p>
      {docs.length === 0 ? (
        <p className="text-sm text-ink-3">{D.noDocs}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{E.credential[d.kind as keyof typeof E.credential]}{d.number && <span className="ltr-run ms-2 text-ink-3">{d.number}</span>}</p>
                <p className="text-ink-3">
                  {d.expiresAt ? `${D.docExpires}: ${formatDate(d.expiresAt, locale)}` : formatDate(d.createdAt, locale)}
                  {d.reviewNote && <> · <bdi>{d.reviewNote}</bdi></>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={d.reviewState === "accepted" ? "success" : d.reviewState === "rejected" ? "danger" : "warning"}>{E.review[d.reviewState as keyof typeof E.review]}</Badge>
                <a href={`/api/care/credentials/${d.id}`} target="_blank" rel="noopener" className="font-medium text-brand-700 hover:underline">{D.view}</a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form ref={formRef} onSubmit={upload} className="grid gap-4 rounded-[var(--radius-md)] border border-line p-4 sm:grid-cols-2">
          <Field label={D.docKind} htmlFor="doc-kind" required requiredLabel={dict.common.required}>
            <Select id="doc-kind" name="kind" defaultValue="commercial_register">
              {CREDENTIAL_KINDS.map((k) => <option key={k} value={k}>{E.credential[k]}</option>)}
            </Select>
          </Field>
          <Field label={D.docNumber} htmlFor="doc-number" optional optionalLabel={dict.common.optional}>
            <Input id="doc-number" name="number" dir="ltr" maxLength={60} />
          </Field>
          <Field label={D.docExpires} htmlFor="doc-exp" optional optionalLabel={dict.common.optional}>
            <Input id="doc-exp" name="expiresAt" type="date" dir="ltr" />
          </Field>
          <Field label={D.docFile} htmlFor="doc-file" required requiredLabel={dict.common.required}>
            <Input id="doc-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="py-2" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy}>{D.upload}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
