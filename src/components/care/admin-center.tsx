"use client";

import { useState } from "react";
import { changeCenterStatus, reviewCredential, setCenterCheck } from "@/server/actions/care-admin";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { actionNeedsReason, nextCenterStatus, ADMIN_CENTER_ACTIONS, type AdminCenterAction, type CenterStatus } from "@/lib/care";
import { useAction, type CareDict } from "./shared";

export function CheckRow({ dict, centerId, criterion, passed, note }: { dict: CareDict; centerId: string; criterion: string; passed: boolean | null; note: string | null }) {
  const A = dict.care.admin;
  const [text, setText] = useState(note ?? "");
  const { pending, run } = useAction(dict);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input aria-label={A.note} placeholder={A.note} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} className="h-9 text-sm sm:flex-1" />
      <div className="flex gap-2">
        <Button size="sm" variant={passed === true ? "primary" : "secondary"} disabled={pending} aria-pressed={passed === true} onClick={() => run(() => setCenterCheck(centerId, criterion, true, text), A.done)}>{A.pass}</Button>
        <Button size="sm" variant={passed === false ? "danger" : "secondary"} disabled={pending} aria-pressed={passed === false} onClick={() => run(() => setCenterCheck(centerId, criterion, false, text), A.done)}>{A.failCheck}</Button>
      </div>
    </div>
  );
}

export function CredentialReview({ dict, credentialId }: { dict: CareDict; credentialId: string }) {
  const A = dict.care.admin;
  const [note, setNote] = useState("");
  const { pending, run } = useAction(dict);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input aria-label={A.note} placeholder={A.note} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="h-9 text-sm sm:flex-1" />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => reviewCredential(credentialId, "accepted", note), A.done)}>{A.accept}</Button>
        <Button size="sm" variant="danger" disabled={pending || note.trim().length < 5} title={A.reasonLabel} onClick={() => run(() => reviewCredential(credentialId, "rejected", note), A.done)}>{A.reject}</Button>
      </div>
    </div>
  );
}

export function CenterStatusActions({ dict, centerId, status, canApprove }: { dict: CareDict; centerId: string; status: CenterStatus; canApprove: boolean }) {
  const A = dict.care.admin;
  const [reason, setReason] = useState("");
  const { pending, run } = useAction(dict);
  const available = ADMIN_CENTER_ACTIONS.filter((a) => nextCenterStatus(status, a));
  if (!available.length) return null;
  const needs = available.some(actionNeedsReason);
  return (
    <div className="flex flex-col gap-3">
      {needs && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="center-reason" className="text-sm font-medium">{A.reasonLabel}</label>
          <Textarea id="center-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="min-h-20!" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {available.map((a: AdminCenterAction) => {
          const danger = a === "reject" || a === "suspend" || a === "revoke";
          const blocked = (a === "approve" && !canApprove) || (actionNeedsReason(a) && reason.trim().length < 5);
          return (
            <Button key={a} size="sm" variant={danger ? "danger" : "primary"} disabled={pending || blocked} onClick={() => run(() => changeCenterStatus(centerId, a, reason), A.done, () => setReason(""))}>
              {A.actions[a]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
