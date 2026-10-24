"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { addCenterEquipment, removeCenterEquipment } from "@/server/actions/care";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { EQUIPMENT_KINDS } from "@/lib/care";
import type { ValidationKey } from "@/lib/validation";
import { useAction, type CareDict } from "./shared";

type Item = { id: string; kind: string; details: string | null };

export function EquipmentEditor({ dict, centerId, items, editable }: { dict: CareDict; centerId: string; items: Item[]; editable: boolean }) {
  const D = dict.care.dash;
  const E = dict.care.enums.equipment;
  const [kind, setKind] = useState<string>("obd_scanner");
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});
  const { pending, run } = useAction(dict);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-3">{D.equipmentHint}</p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">{D.noEquipment}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((it) => (
            <li key={it.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas py-1 pe-1 ps-3 text-sm">
              <span>{E[it.kind as keyof typeof E]}{it.details && <span className="text-ink-3"> — <bdi>{it.details}</bdi></span>}</span>
              {editable && (
                <button type="button" aria-label={`${D.remove}: ${E[it.kind as keyof typeof E]}`} disabled={pending} onClick={() => run(() => removeCenterEquipment(centerId, it.id), D.removed)} className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-line hover:text-ink">
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addCenterEquipment(centerId, { kind, details }), D.saved, () => { setDetails(""); setErrors({}); }, (r) => setErrors((r.fields ?? {}) as Record<string, ValidationKey>));
          }}
        >
          <Field label={D.equipmentKind} htmlFor="eq-kind">
            <Select id="eq-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {EQUIPMENT_KINDS.map((k) => <option key={k} value={k}>{E[k]}</option>)}
            </Select>
          </Field>
          <Field label={D.equipmentDetails} htmlFor="eq-details" optional optionalLabel={dict.common.optional} error={errors.details ? dict.validation[errors.details] : undefined}>
            <Input id="eq-details" value={details} maxLength={200} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" loading={pending}>{D.addEquipment}</Button>
        </form>
      )}
    </div>
  );
}
