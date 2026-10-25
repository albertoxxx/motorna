"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateListing, setUserSuspension, updateReport } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { Dictionary } from "@/i18n/dictionaries/ar";

type D = Pick<Dictionary, "admin" | "errors" | "common">;

function useRun(dict: D) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<{ ok: boolean; error?: keyof Dictionary["errors"] }>, ok: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(dict.errors[res.error ?? "generic"], "error");
      toast(ok);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

export function ModerationActions({ listingId, dict }: { listingId: string; dict: D }) {
  const { pending, run } = useRun(dict);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const A = dict.admin;
  return rejecting ? (
    <div className="flex flex-col gap-2">
      <label htmlFor={`reason-${listingId}`} className="text-sm font-medium">{A.rejectReason}</label>
      <Textarea id={`reason-${listingId}`} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-20!" maxLength={500} />
      <div className="flex gap-2">
        <Button variant="danger" size="sm" disabled={pending || reason.trim().length < 5} onClick={() => run(() => moderateListing(listingId, "reject", reason), A.rejected)}>{A.reject}</Button>
        <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>{dict.common.cancel}</Button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(() => moderateListing(listingId, "approve"), A.approved)}>{A.approve}</Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => setRejecting(true)}>{A.reject}</Button>
    </div>
  );
}

export function ReportActions({
  reportId,
  status,
  listingId,
  listingPublished,
  userId,
  userSuspended,
  dict,
}: {
  reportId: string;
  status: string;
  listingId: string | null;
  listingPublished: boolean;
  userId: string | null;
  userSuspended: boolean;
  dict: D;
}) {
  const { pending, run } = useRun(dict);
  const [note, setNote] = useState("");
  const A = dict.admin;
  return (
    <div className="flex flex-col gap-2">
      <Textarea aria-label={A.resolutionNote} placeholder={A.resolutionNote} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16! text-sm" maxLength={1000} />
      <div className="flex flex-wrap gap-2">
        {status === "open" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => updateReport(reportId, { status: "reviewing", note }), A.markReviewing)}>{A.markReviewing}</Button>}
        <Button size="sm" variant="dark" disabled={pending} onClick={() => run(() => updateReport(reportId, { status: "resolved", note }), A.resolve)}>{A.resolve}</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => updateReport(reportId, { status: "dismissed", note }), A.dismiss)}>{A.dismiss}</Button>
        {listingId && listingPublished && (
          <Button size="sm" variant="danger" disabled={pending || note.trim().length < 5} title={A.rejectReasonRequired} onClick={() => run(() => moderateListing(listingId, "takeDown", note), A.takeDown)}>{A.takeDown}</Button>
        )}
        {userId && (
          userSuspended ? (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setUserSuspension(userId, false), A.unsuspendUser)}>{A.unsuspendUser}</Button>
          ) : (
            <Button size="sm" variant="danger" disabled={pending || note.trim().length < 5} title={A.rejectReasonRequired} onClick={() => run(() => setUserSuspension(userId, true, note), A.suspended)}>{A.suspendUser}</Button>
          )
        )}
      </div>
    </div>
  );
}

/** Suspend (with a reason) or reinstate one user from the admin user directory. */
export function UserSuspensionControl({ userId, suspended, dict }: { userId: string; suspended: boolean; dict: D }) {
  const { pending, run } = useRun(dict);
  const [note, setNote] = useState("");
  const A = dict.admin;
  if (suspended) return <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setUserSuspension(userId, false), A.unsuspendUser)}>{A.unsuspendUser}</Button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label={A.usersSuspendReason} placeholder={A.usersSuspendReason} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="h-9! w-56 text-sm" />
      <Button size="sm" variant="danger" disabled={pending || note.trim().length < 5} onClick={() => run(() => setUserSuspension(userId, true, note), A.suspended)}>{A.suspendUser}</Button>
    </div>
  );
}
