"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVehicle, saveVehicle } from "@/server/actions/bookings";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";

type V = { id: string; makeAr: string; makeEn: string; modelAr: string | null; modelEn: string | null; year: number; mileageKm: number | null; nickname: string | null };

export function Garage({ locale, dict, vehicles, makes, models }: { locale: Locale; dict: Pick<Dictionary, "booking" | "errors" | "common" | "validation">; vehicles: V[]; makes: { id: number; nameAr: string; nameEn: string }[]; models: { id: number; makeId: number; nameAr: string; nameEn: string }[] }) {
  const G = dict.booking.garage;
  const W = dict.booking.wizard;
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ makeId: "", modelId: "", year: "", mileageKm: "", nickname: "" });
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const name = (r: { nameAr: string; nameEn: string }) => (locale === "ar" ? r.nameAr : r.nameEn);
  const makeModels = useMemo(() => models.filter((m) => String(m.makeId) === f.makeId), [models, f.makeId]);
  const act = (fn: () => Promise<{ ok: boolean; error?: keyof Dictionary["errors"] }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(dict.errors[r.error ?? "generic"], "error");
      toast(msg);
      after?.();
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-3">
      {vehicles.length === 0 ? (
        <p className="text-sm text-ink-3">{G.noVehicles}</p>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line">
          {vehicles.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span><bdi className="font-medium">{locale === "ar" ? v.makeAr : v.makeEn} {v.modelAr ? (locale === "ar" ? v.modelAr : v.modelEn) : ""} {v.year}</bdi>{v.nickname && <span className="text-ink-3"> · <bdi>{v.nickname}</bdi></span>}</span>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => deleteVehicle(v.id), G.removed)}>{G.remove}</Button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form
          className="grid gap-3 rounded-[var(--radius-md)] border border-line p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => saveVehicle(null, f), G.saved, () => { setAdding(false); setF({ makeId: "", modelId: "", year: "", mileageKm: "", nickname: "" }); });
          }}
        >
          <Field label={W.make} htmlFor="g-make" required requiredLabel={dict.common.required}>
            <Select id="g-make" value={f.makeId} onChange={(e) => setF({ ...f, makeId: e.target.value, modelId: "" })}>
              <option value="">—</option>
              {makes.map((m) => <option key={m.id} value={m.id}>{name(m)}</option>)}
            </Select>
          </Field>
          <Field label={W.model} htmlFor="g-model">
            <Select id="g-model" value={f.modelId} disabled={!f.makeId} onChange={(e) => setF({ ...f, modelId: e.target.value })}>
              <option value="">—</option>
              {makeModels.map((m) => <option key={m.id} value={m.id}>{name(m)}</option>)}
            </Select>
          </Field>
          <Field label={W.year} htmlFor="g-year" required requiredLabel={dict.common.required}><Input id="g-year" inputMode="numeric" className="tabular" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></Field>
          <Field label={W.mileage} htmlFor="g-km"><Input id="g-km" inputMode="numeric" className="tabular" value={f.mileageKm} onChange={(e) => setF({ ...f, mileageKm: e.target.value.replace(/\D/g, "").slice(0, 7) })} /></Field>
          <Field label={G.nickname} htmlFor="g-nick" className="sm:col-span-2"><Input id="g-nick" maxLength={40} value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} /></Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" loading={pending} disabled={!f.makeId || f.year.length !== 4}>{G.save}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>{dict.common.cancel}</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setAdding(true)}>{G.add}</Button>
      )}
    </div>
  );
}
