"use client";

import { useState } from "react";
import { addCenterStaff, removeCenterStaff } from "@/server/actions/care";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useAction, type CareDict } from "./shared";

type Member = { userId: string; role: string; active: boolean; name: string; email: string };

export function StaffPanel({ dict, centerId, staff, isOwner, selfId }: { dict: CareDict; centerId: string; staff: Member[]; isOwner: boolean; selfId: string }) {
  const D = dict.care.dash;
  const R = dict.care.enums.staffRole;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "technician">("technician");
  const { pending, run } = useAction(dict);
  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line">
        {staff.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium"><bdi>{m.name}</bdi></p>
              <p className="ltr-run text-ink-3">{m.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={m.active ? "brand" : "neutral"}>{m.active ? R[m.role as keyof typeof R] : D.inactiveStaff}</Badge>
              {isOwner && m.active && m.role !== "owner" && m.userId !== selfId && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeCenterStaff(centerId, m.userId), D.removed)}>{D.removeStaff}</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {isOwner && (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addCenterStaff(centerId, email, role), D.staffAdded, () => setEmail(""));
          }}
        >
          <Field label={D.staffEmail} htmlFor="staff-email" hint={D.staffHint}>
            <Input id="staff-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label={D.staffRole} htmlFor="staff-role">
            <Select id="staff-role" value={role} onChange={(e) => setRole(e.target.value as "manager" | "technician")}>
              <option value="technician">{R.technician}</option>
              <option value="manager">{R.manager}</option>
            </Select>
          </Field>
          <Button type="submit" loading={pending} className="sm:mb-[1.6rem]">{D.addStaff}</Button>
        </form>
      )}
    </div>
  );
}
