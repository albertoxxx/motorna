"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { reportListing } from "@/server/actions/engagement";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { REPORT_REASONS } from "@/lib/validation";
import type { Dictionary } from "@/i18n/dictionaries/ar";

export function ReportButton({
  listingId,
  signedIn,
  signInHref,
  dict,
}: {
  listingId: string;
  signedIn: boolean;
  signInHref: string;
  dict: Pick<Dictionary, "listing" | "enums" | "errors" | "common" | "nav" | "validation">;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setInvalid(true);
    start(async () => {
      const res = await reportListing(listingId, { reason, details });
      if (!res.ok) return toast(dict.errors[res.error], "error");
      toast(dict.listing.reportSent);
      setOpen(false);
      setReason("");
      setDetails("");
    });
  }

  return (
    <>
      <button
        onClick={() => (signedIn ? setOpen(true) : router.push(signInHref))}
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-danger-700"
      >
        <Flag className="size-4" />
        {dict.listing.report}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={dict.listing.reportTitle} closeLabel={dict.nav.close}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={dict.listing.reportReason} htmlFor="report-reason" error={invalid ? dict.validation.required : undefined}>
            <Select id="report-reason" value={reason} invalid={invalid} onChange={(e) => { setReason(e.target.value); setInvalid(false); }}>
              <option value="">—</option>
              {REPORT_REASONS.map((r) => <option key={r} value={r}>{dict.enums.reportReason[r]}</option>)}
            </Select>
          </Field>
          <Field label={dict.listing.reportDetails} htmlFor="report-details" optional optionalLabel={dict.common.optional}>
            <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} className="min-h-24!" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
            <Button type="submit" variant="dark" loading={pending}>{dict.common.send}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
