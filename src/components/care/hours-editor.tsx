"use client";

import { useState } from "react";
import { setCenterHours } from "@/server/actions/care";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useAction, type CareDict } from "./shared";

type Row = { weekday: number; opens: string; closes: string };

/** Seven rows; an empty day means closed. Order follows the Egyptian week (Saturday first). */
export function HoursEditor({ dict, centerId, hours, editable }: { dict: CareDict; centerId: string; hours: Row[]; editable: boolean }) {
  const D = dict.care.dash;
  const order = [6, 0, 1, 2, 3, 4, 5];
  const [rows, setRows] = useState<Record<number, { opens: string; closes: string }>>(
    Object.fromEntries(order.map((d) => {
      const h = hours.find((x) => x.weekday === d);
      return [d, { opens: h?.opens ?? "", closes: h?.closes ?? "" }];
    })),
  );
  const { pending, run } = useAction(dict);
  const save = () =>
    run(
      () => setCenterHours(centerId, order.filter((d) => rows[d].opens && rows[d].closes).map((d) => ({ weekday: d, ...rows[d] }))),
      D.saved,
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-3">{D.hoursHint}</p>
      <div className="grid gap-2">
        {order.map((d) => (
          <div key={d} className="grid grid-cols-[minmax(3.5rem,6rem)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 text-sm">
            <span className="font-medium">{dict.care.enums.weekday[d]}</span>
            <Input type="time" className="min-w-0 px-2!" aria-label={`${dict.care.enums.weekday[d]} ${D.opens}`} value={rows[d].opens} disabled={!editable} onChange={(e) => setRows((r) => ({ ...r, [d]: { ...r[d], opens: e.target.value } }))} />
            <Input type="time" className="min-w-0 px-2!" aria-label={`${dict.care.enums.weekday[d]} ${D.closes}`} value={rows[d].closes} disabled={!editable} onChange={(e) => setRows((r) => ({ ...r, [d]: { ...r[d], closes: e.target.value } }))} />
          </div>
        ))}
      </div>
      {editable && (
        <div>
          <Button variant="secondary" loading={pending} onClick={save}>{D.saveHours}</Button>
        </div>
      )}
    </div>
  );
}
