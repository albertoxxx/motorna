"use client";

import { useMemo, useState } from "react";
import { setCenterMakes } from "@/server/actions/care";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useAction, type CareDict } from "./shared";

type Make = { id: number; nameAr: string; nameEn: string };

export function MakesEditor({ locale, dict, centerId, all, selected, editable }: { locale: string; dict: CareDict; centerId: string; all: Make[]; selected: number[]; editable: boolean }) {
  const D = dict.care.dash;
  const [picked, setPicked] = useState<Set<number>>(new Set(selected));
  const [q, setQ] = useState("");
  const { pending, run } = useAction(dict);
  const name = (m: Make) => (locale === "ar" ? m.nameAr : m.nameEn);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? all.filter((m) => m.nameAr.includes(q.trim()) || m.nameEn.toLowerCase().includes(t)) : all;
    // Selected makes first, so they're easy to review.
    return [...list].sort((a, b) => Number(picked.has(b.id)) - Number(picked.has(a.id)));
  }, [all, q, picked]);
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (!editable) {
    const names = all.filter((m) => selected.includes(m.id)).map(name);
    return <p className="text-sm text-ink-2">{names.length ? names.join(locale === "ar" ? "، " : ", ") : dict.care.detail.noMakes}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-3">{D.makesHint}</p>
      <Input aria-label={D.makesSearch} placeholder={D.makesSearch} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto rounded-[var(--radius-md)] border border-line p-2 sm:grid-cols-3">
        {shown.map((m) => (
          <li key={m.id}>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-canvas">
              <input type="checkbox" className="size-4 accent-brand-600" checked={picked.has(m.id)} onChange={() => toggle(m.id)} />
              {name(m)}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <Button variant="secondary" loading={pending} onClick={() => run(() => setCenterMakes(centerId, [...picked]), D.saved)}>{D.makesSave}</Button>
        <span className="tabular text-sm text-ink-3">{picked.size}</span>
      </div>
    </div>
  );
}
