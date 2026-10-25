"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ImagePlus, Star, Trash2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { saveListing, deleteImage, reorderImages } from "@/server/actions/listings";
import type { ValidationKey } from "@/lib/validation";
import { BODIES, COLORS, CONDITIONS, FUELS, TRANSMISSIONS, isColorKey, looksLikeEngineSize, maxYear, MIN_YEAR } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatPrice, formatKm } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CityOption, TaxonomyMake, TaxonomyModel } from "./search-panel";

type Values = {
  makeId: string;
  modelId: string;
  modelOther: string;
  trim: string;
  year: string;
  mileageKm: string;
  priceEgp: string;
  negotiable: boolean;
  condition: string;
  transmission: string;
  fuelType: string;
  bodyType: string;
  color: string;
  engineCc: string;
  cityId: string;
  area: string;
  title: string;
  description: string;
  knownDefects: string;
  showPhone: boolean;
  sellerPhone: string;
};

export type ListingFormInitial = Partial<Values> & { id?: string; status?: string };
type Img = { id: string; thumbUrl: string };
type CityWithId = CityOption & { id: number };

// Step groups. Data lives in one state object, so moving between steps never loses input.
const STEP_FIELDS: (keyof Values)[][] = [
  ["makeId", "modelId", "modelOther", "year", "trim"],
  ["transmission", "fuelType", "bodyType", "engineCc", "color"],
  ["condition", "mileageKm"],
  ["priceEgp", "negotiable", "cityId", "area", "showPhone", "sellerPhone"],
  [], // photos
  ["title", "description", "knownDefects"],
  [], // review
];
const USAGE_STEP = 2;
const PRICE_STEP = 3;
const PHOTOS_STEP = 4;
const DETAILS_STEP = 5;
const REVIEW_STEP = 6;

export function ListingForm({
  locale,
  dict,
  makes,
  models,
  cities,
  initial,
  initialImages,
  profilePhone,
}: {
  locale: Locale;
  dict: Pick<Dictionary, "sell" | "enums" | "common" | "validation" | "errors">;
  makes: TaxonomyMake[];
  models: (TaxonomyModel & { bodyType: string | null })[];
  cities: CityWithId[];
  initial: ListingFormInitial;
  initialImages: Img[];
  profilePhone: string;
}) {
  const S = dict.sell;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [id, setId] = useState<string | undefined>(initial.id);
  const [status, setStatus] = useState(initial.status ?? "draft");
  const [images, setImages] = useState<Img[]>(initialImages);
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});
  const [missing, setMissing] = useState<("photos" | "description")[]>([]);
  const [titleTouched, setTitleTouched] = useState(!!initial.title);
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState<Values>({
    makeId: "", modelId: "", modelOther: "", trim: "", year: "", mileageKm: "", priceEgp: "", negotiable: true,
    condition: "used", transmission: "automatic", fuelType: "petrol", bodyType: "", color: "",
    engineCc: "", cityId: String(cities.find((c) => c.slug === "alexandria")?.id ?? ""), area: "", title: "", description: "", knownDefects: "",
    showPhone: false, sellerPhone: profilePhone,
    ...initial,
  });
  // Standard colours are stored as keys; anything else (including older hand-typed values) shows under "other".
  const initialColorWasLegacy = !!initial.color && !isColorKey(initial.color);
  const [colorOther, setColorOther] = useState(initialColorWasLegacy);
  const name = (r: { nameAr: string; nameEn: string }) => (locale === "ar" ? r.nameAr : r.nameEn);
  const makeModels = useMemo(() => models.filter((m) => String(m.makeId) === v.makeId), [models, v.makeId]);
  const years = Array.from({ length: maxYear() - MIN_YEAR + 1 }, (_, i) => maxYear() - i);

  function autoTitle(next: Values) {
    const mk = makes.find((m) => String(m.id) === next.makeId);
    const md = models.find((m) => String(m.id) === next.modelId);
    const modelName = next.modelId === "other" ? next.modelOther.trim() : md?.nameEn;
    return [mk?.nameEn, modelName, next.year, next.trim].filter(Boolean).join(" ");
  }
  function set<K extends keyof Values>(k: K, val: Values[K]) {
    setV((o) => {
      const next = { ...o, [k]: val };
      if (k === "makeId") { next.modelId = ""; next.modelOther = ""; }
      if (k === "modelId") {
        const md = models.find((m) => String(m.id) === val);
        if (md?.bodyType && !o.bodyType) next.bodyType = md.bodyType;
      }
      if (!titleTouched && ["makeId", "modelId", "modelOther", "year", "trim"].includes(k)) next.title = autoTitle(next);
      return next;
    });
    if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  }
  const err = (k: keyof Values) => (errors[k] ? dict.validation[errors[k]] : undefined);

  /** Client-side check for the given steps (the server validates everything again). */
  function localCheck(stepIdx: number[]) {
    const e: Record<string, ValidationKey> = {};
    const req = (k: keyof Values) => !String(v[k]).trim() && (e[k] = "required");
    if (stepIdx.includes(0)) {
      req("makeId"); req("modelId"); req("year");
      if (v.modelId === "other" && !v.modelOther.trim()) e.modelOther = "modelOther";
      if (v.trim.trim() && looksLikeEngineSize(v.trim)) e.trim = "trimIsEngine";
    }
    if (stepIdx.includes(USAGE_STEP)) req("mileageKm");
    if (stepIdx.includes(PRICE_STEP)) {
      req("priceEgp"); req("cityId");
      if (v.showPhone && !v.sellerPhone.trim()) e.sellerPhone = "phone";
    }
    if (stepIdx.includes(DETAILS_STEP)) {
      if (v.title.trim().length < 10 || v.title.trim().length > 100) e.title = "titleLength";
    }
    setErrors(e);
    if (Object.keys(e).length) {
      const first = STEP_FIELDS.findIndex((fs) => fs.some((f) => e[f]));
      if (first >= 0 && first !== step) setStep(first);
      return false;
    }
    return true;
  }

  function persist(intent: "draft" | "submit", after?: (r: { id: string; status: string; missing: ("photos" | "description")[]; slug: string }) => void) {
    start(async () => {
      const res = await saveListing(id ?? null, { ...v, sellerPhone: v.showPhone ? v.sellerPhone : "" }, intent);
      if (!res.ok) {
        if (res.fields) {
          setErrors(res.fields);
          const firstStep = STEP_FIELDS.findIndex((fs) => fs.some((f) => res.fields![f]));
          if (firstStep >= 0) setStep(firstStep);
        }
        toast(dict.errors[res.error], "error");
        return;
      }
      setId(res.data.id);
      setStatus(res.data.status);
      setMissing(res.data.missing);
      // Make the URL resumable while staying on the same route, so later saves
      // (which refresh the current route) never remount the form or reset the step.
      if (!id && window.location.pathname.endsWith("/sell")) {
        window.history.replaceState(null, "", `/${locale}/sell?draft=${res.data.id}`);
      }
      after?.(res.data);
    });
  }

  function next() {
    if (step < PRICE_STEP) {
      if (localCheck([step])) setStep(step + 1);
    } else if (step === PRICE_STEP) {
      // A draft must exist before photos can be uploaded.
      if (localCheck([0, 1, USAGE_STEP, PRICE_STEP])) persist("draft", () => setStep(PHOTOS_STEP));
    } else if (step === DETAILS_STEP) {
      if (localCheck([DETAILS_STEP])) persist("draft", () => setStep(REVIEW_STEP));
    } else {
      setStep(step + 1);
    }
  }

  async function upload(files: FileList | null) {
    if (!files || !id) return;
    const list = Array.from(files).slice(0, Math.max(0, 20 - images.length));
    setUploading(list.length);
    for (const file of list) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(`/api/listings/${id}/images`, { method: "POST", body: fd });
        const json = await res.json();
        if (json.ok) setImages((imgs) => [...imgs, json.image]);
        else toast(dict.errors[json.error as keyof typeof dict.errors] ?? dict.errors.generic, "error");
      } catch {
        toast(dict.errors.generic, "error");
      }
      setUploading((n) => n - 1);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function move(idx: number, delta: number) {
    const to = idx + delta;
    if (!id || to < 0 || to >= images.length) return;
    const next = [...images];
    [next[idx], next[to]] = [next[to], next[idx]];
    setImages(next);
    start(async () => {
      const res = await reorderImages(id, next.map((i) => i.id));
      if (!res.ok) toast(dict.errors[res.error], "error");
    });
  }
  function makeCover(idx: number) {
    if (!id || idx === 0) return;
    const next = [images[idx], ...images.filter((_, i) => i !== idx)];
    setImages(next);
    start(async () => {
      const res = await reorderImages(id, next.map((i) => i.id));
      if (!res.ok) toast(dict.errors[res.error], "error");
    });
  }
  function remove(imgId: string) {
    if (!id) return;
    setImages((imgs) => imgs.filter((i) => i.id !== imgId));
    start(async () => {
      const res = await deleteImage(id, imgId);
      if (!res.ok) toast(dict.errors[res.error], "error");
    });
  }

  const steps = [S.steps.car, S.steps.specs, S.steps.usage, S.steps.priceLocation, S.steps.photos, S.steps.description, S.steps.review];
  const canSubmit = ["draft", "rejected", "archived"].includes(status);
  const mk = makes.find((m) => String(m.id) === v.makeId);
  const md = models.find((m) => String(m.id) === v.modelId);
  const city = cities.find((c) => String(c.id) === v.cityId);

  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
      {/* Phones/tablets: compact progress. Desktop: full step list. */}
      <div className="lg:hidden" aria-live="polite">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-ink">{steps[step]}</span>
          <span className="tabular text-ink-3">{S.stepOf.replace("{i}", String(step + 1)).replace("{n}", String(steps.length))}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label={steps[step]}>
          <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="hidden gap-1 lg:flex lg:flex-col" aria-label={S.title}>
        {steps.map((label, i) => {
          const reachable = i <= step || (i >= PHOTOS_STEP && !!id);
          return (
            <li key={label} className="shrink-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-start text-sm",
                  i === step ? "bg-surface font-semibold text-ink ring-1 ring-line" : "text-ink-2 disabled:text-ink-3",
                )}
              >
                <span className={cn("tabular grid size-6 shrink-0 place-items-center rounded-full border text-xs", i < step ? "border-success-700 bg-success-700 text-white" : i === step ? "border-navy-900 bg-navy-900 text-white" : "border-line-strong")}>
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-7">
        {status === "published" && id && <Notice className="mb-5">{S.reviewNotice} {S.priceOnlyNotice}</Notice>}

        <p className="mb-5 text-xs text-ink-3"><span className="text-danger-600" aria-hidden>*</span> {S.requiredLegend}</p>

        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={S.make} htmlFor="makeId" error={err("makeId")} required requiredLabel={dict.common.required}>
              <Select id="makeId" value={v.makeId} invalid={!!errors.makeId} onChange={(e) => set("makeId", e.target.value)} required>
                <option value="">{S.selectMake}</option>
                {makes.map((m) => <option key={m.id} value={m.id}>{name(m)}</option>)}
              </Select>
            </Field>
            <Field label={S.model} htmlFor="modelId" error={err("modelId")} required requiredLabel={dict.common.required}>
              <Select id="modelId" value={v.modelId} invalid={!!errors.modelId} disabled={!v.makeId} onChange={(e) => set("modelId", e.target.value)} required>
                <option value="">{v.makeId ? S.selectModel : S.selectMakeFirst}</option>
                {makeModels.map((m) => <option key={m.id} value={m.id}>{name(m)}</option>)}
                {v.makeId && <option value="other">{S.modelNotListed}</option>}
              </Select>
            </Field>
            {v.modelId === "other" && (
              <Field className="sm:col-span-2" label={S.modelOtherLabel} htmlFor="modelOther" hint={S.modelOtherHint} error={err("modelOther")} required requiredLabel={dict.common.required}>
                <Input id="modelOther" value={v.modelOther} maxLength={40} invalid={!!errors.modelOther} autoFocus onChange={(e) => set("modelOther", e.target.value)} required />
              </Field>
            )}
            <Field label={S.year} htmlFor="year" error={err("year")} required requiredLabel={dict.common.required}>
              <Select id="year" value={v.year} invalid={!!errors.year} onChange={(e) => set("year", e.target.value)} required>
                <option value="">—</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </Field>
            <Field label={S.trim} htmlFor="trim" hint={S.trimHint} error={err("trim")} optional optionalLabel={dict.common.optional}>
              <Input id="trim" value={v.trim} maxLength={60} invalid={!!errors.trim} onChange={(e) => set("trim", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={S.transmission} htmlFor="transmission" required requiredLabel={dict.common.required}>
              <Select id="transmission" value={v.transmission} onChange={(e) => set("transmission", e.target.value)} required>
                {TRANSMISSIONS.map((t) => <option key={t} value={t}>{dict.enums.transmission[t]}</option>)}
              </Select>
            </Field>
            <Field label={S.fuel} htmlFor="fuelType" required requiredLabel={dict.common.required}>
              <Select id="fuelType" value={v.fuelType} onChange={(e) => set("fuelType", e.target.value)} required>
                {FUELS.map((f) => <option key={f} value={f}>{dict.enums.fuel[f]}</option>)}
              </Select>
            </Field>
            <Field label={S.body} htmlFor="bodyType" optional optionalLabel={dict.common.optional}>
              <Select id="bodyType" value={v.bodyType} onChange={(e) => set("bodyType", e.target.value)}>
                <option value="">—</option>
                {BODIES.map((b) => <option key={b} value={b}>{dict.enums.body[b]}</option>)}
              </Select>
            </Field>
            <Field label={S.engineCc} htmlFor="engineCc" error={err("engineCc")} optional optionalLabel={dict.common.optional}>
              <Input id="engineCc" inputMode="numeric" className="tabular" value={v.engineCc} invalid={!!errors.engineCc} onChange={(e) => set("engineCc", e.target.value)} />
            </Field>
            <Field label={S.color} htmlFor="color" optional optionalLabel={dict.common.optional}>
              <Select id="color" value={colorOther ? "__other" : v.color} onChange={(e) => {
                if (e.target.value === "__other") { setColorOther(true); set("color", ""); }
                else { setColorOther(false); set("color", e.target.value); }
              }}>
                <option value="">—</option>
                {COLORS.map((c) => <option key={c} value={c}>{dict.enums.color[c]}</option>)}
                <option value="__other">{S.colorOther}</option>
              </Select>
            </Field>
            {colorOther && (
              <Field label={S.colorOtherLabel} htmlFor="colorOther" hint={v.color && initialColorWasLegacy ? S.colorLegacyHint : undefined} optional optionalLabel={dict.common.optional}>
                <Input id="colorOther" value={v.color} maxLength={30} dir="auto" onChange={(e) => set("color", e.target.value)} />
              </Field>
            )}
          </div>
        )}

        {step === USAGE_STEP && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={S.condition} htmlFor="condition" required requiredLabel={dict.common.required}>
              <Select id="condition" value={v.condition} onChange={(e) => set("condition", e.target.value)} required>
                {CONDITIONS.map((c) => <option key={c} value={c}>{dict.enums.condition[c]}</option>)}
              </Select>
            </Field>
            <Field label={S.mileage} htmlFor="mileageKm" error={err("mileageKm")} hint={S.mileageHint} required requiredLabel={dict.common.required}>
              <Input id="mileageKm" inputMode="numeric" className="tabular" value={v.mileageKm} invalid={!!errors.mileageKm} onChange={(e) => set("mileageKm", e.target.value)} required />
            </Field>
          </div>
        )}

        {step === PRICE_STEP && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={S.price} htmlFor="priceEgp" error={err("priceEgp")} required requiredLabel={dict.common.required}>
              <Input id="priceEgp" inputMode="numeric" className="tabular" value={v.priceEgp} invalid={!!errors.priceEgp} onChange={(e) => set("priceEgp", e.target.value)} required />
            </Field>
            <div className="flex items-end pb-3">
              <Checkbox label={S.negotiable} checked={v.negotiable} onChange={(e) => set("negotiable", e.target.checked)} />
            </div>
            <Field label={S.city} htmlFor="cityId" error={err("cityId")} required requiredLabel={dict.common.required}>
              <Select id="cityId" value={v.cityId} invalid={!!errors.cityId} onChange={(e) => set("cityId", e.target.value)} required>
                <option value="">—</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}
              </Select>
            </Field>
            <Field label={S.area} htmlFor="area" hint={S.areaHint} optional optionalLabel={dict.common.optional}>
              <Input id="area" value={v.area} maxLength={60} onChange={(e) => set("area", e.target.value)} />
            </Field>
            <fieldset className="rounded-[var(--radius-md)] border border-line bg-canvas p-4 sm:col-span-2">
              <legend className="px-1 text-sm font-semibold">{S.contactTitle}</legend>
              <p className="mb-3 text-sm text-ink-2">{S.messagingAlwaysOn}</p>
              <Checkbox label={S.showPhoneConsent} checked={v.showPhone} onChange={(e) => set("showPhone", e.target.checked)} />
              <p className="mt-2 text-xs leading-relaxed text-ink-3">{S.showPhonePrivacy}</p>
              {v.showPhone && (
                <Field className="mt-3" label={S.sellerPhone} htmlFor="sellerPhone" hint={S.sellerPhoneHint} error={err("sellerPhone")} required requiredLabel={dict.common.required}>
                  <Input id="sellerPhone" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" value={v.sellerPhone} invalid={!!errors.sellerPhone} onChange={(e) => set("sellerPhone", e.target.value)} />
                </Field>
              )}
            </fieldset>
          </div>
        )}

        {step === PHOTOS_STEP && (
          <div>
            <h2 className="text-lg font-semibold">{S.photosTitle} <span className="text-danger-600" aria-hidden>*</span></h2>
            <p className="mb-5 mt-1 text-sm text-ink-3">{S.photosHint}</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img, i) => (
                <li key={img.id} className="overflow-hidden rounded-[var(--radius-md)] border border-line">
                  <div className="relative aspect-[4/3] bg-canvas">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumbUrl} alt="" className="size-full object-cover" />
                    {i === 0 && <span className="absolute start-2 top-2 rounded bg-navy-900 px-2 py-0.5 text-xs font-semibold text-white">{S.cover}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-1 p-1">
                    <div className="flex">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={S.moveEarlier} className="grid size-10 place-items-center rounded text-ink-2 hover:bg-canvas disabled:opacity-30"><ArrowUp className="size-4" /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label={S.moveLater} className="grid size-10 place-items-center rounded text-ink-2 hover:bg-canvas disabled:opacity-30"><ArrowDown className="size-4" /></button>
                      {i > 0 && <button type="button" onClick={() => makeCover(i)} aria-label={S.makeCover} title={S.makeCover} className="grid size-10 place-items-center rounded text-ink-2 hover:bg-canvas"><Star className="size-4" /></button>}
                    </div>
                    <button type="button" onClick={() => remove(img.id)} aria-label={dict.common.remove} className="grid size-10 place-items-center rounded text-danger-700 hover:bg-danger-50"><Trash2 className="size-4" /></button>
                  </div>
                </li>
              ))}
              {images.length < 20 && (
                <li>
                  <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-line-strong text-sm font-medium text-ink-2 focus-within:border-brand-600 hover:border-brand-600 hover:text-brand-700">
                    <ImagePlus className="size-6" />
                    {uploading > 0 ? S.uploading : S.addPhotos}
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={uploading > 0} />
                  </label>
                </li>
              )}
            </ul>
            <p className="tabular mt-3 text-sm text-ink-3" aria-live="polite">{S.photoCount.replace("{n}", String(images.length))}</p>
          </div>
        )}

        {step === DETAILS_STEP && (
          <div className="grid gap-5">
            <Field label={S.listingTitle} htmlFor="title" hint={S.titleHint} error={err("title")} required requiredLabel={dict.common.required}>
              <Input id="title" value={v.title} maxLength={100} invalid={!!errors.title} onChange={(e) => { setTitleTouched(true); set("title", e.target.value); }} required />
            </Field>
            <Field label={S.description} htmlFor="description" hint={S.descriptionHint} error={err("description")} required requiredLabel={dict.common.required}>
              <Textarea id="description" value={v.description} maxLength={5000} rows={6} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label={S.knownDefects} htmlFor="knownDefects" hint={S.knownDefectsHint} error={err("knownDefects")} optional optionalLabel={dict.common.optional}>
              <Textarea id="knownDefects" value={v.knownDefects} maxLength={2000} rows={4} invalid={!!errors.knownDefects} onChange={(e) => set("knownDefects", e.target.value)} />
            </Field>
          </div>
        )}

        {step === REVIEW_STEP && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-2">{S.previewTitle}</p>
              {/* Preview built from the same fields buyers will see on the listing card. */}
              <div className="flex overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface sm:max-w-sm sm:flex-col">
                <div className="relative w-[42%] shrink-0 bg-canvas sm:aspect-[4/3] sm:w-auto">
                  {images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images[0].thumbUrl} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-ink-3"><ImagePlus className="size-7" aria-hidden /></div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-4">
                  <p className="line-clamp-2 font-semibold leading-snug">
                    {mk && name(mk)} {v.modelId === "other" ? v.modelOther : md && name(md)} <span className="tabular text-ink-2">{v.year}</span>
                  </p>
                  {v.trim && <p className="truncate text-sm text-ink-3"><bdi>{v.trim}</bdi></p>}
                  <p className="tabular text-lg font-bold text-navy-900">{v.priceEgp && formatPrice(Number(v.priceEgp.replace(/\D/g, "")), locale)}</p>
                  <p className="text-xs text-ink-2">
                    {[v.mileageKm && formatKm(Number(v.mileageKm.replace(/\D/g, "")), locale), dict.enums.transmission[v.transmission as keyof typeof dict.enums.transmission], dict.enums.fuel[v.fuelType as keyof typeof dict.enums.fuel], city && name(city)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium"><bdi>{v.title}</bdi></p>
            </div>
            <dl className="grid gap-x-6 gap-y-2 rounded-[var(--radius-md)] bg-canvas p-4 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3"><dt className="text-ink-3">{S.transmission}</dt><dd>{dict.enums.transmission[v.transmission as keyof typeof dict.enums.transmission]}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">{S.fuel}</dt><dd>{dict.enums.fuel[v.fuelType as keyof typeof dict.enums.fuel]}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">{S.condition}</dt><dd>{dict.enums.condition[v.condition as keyof typeof dict.enums.condition]}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">{S.photosTitle}</dt><dd className="tabular">{images.length}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">{S.contactTitle}</dt><dd>{v.showPhone ? S.phoneShown : S.phoneHiddenReview}</dd></div>
              <div className="flex justify-between gap-3 sm:col-span-2"><dt className="text-ink-3">{S.knownDefects}</dt><dd dir="auto" className="truncate">{v.knownDefects.trim() || "—"}</dd></div>
            </dl>
            {(() => {
              const gaps = [...new Set([...missing, ...(images.length < 3 ? (["photos"] as const) : []), ...(v.description.trim().length < 30 ? (["description"] as const) : [])])];
              return gaps.length > 0 ? (
                <Notice tone="warning">
                  <p className="font-semibold">{S.missingTitle}</p>
                  <ul className="mt-1 list-disc ps-5">
                    {gaps.map((g) => (
                      <li key={g}>
                        <button type="button" className="underline" onClick={() => setStep(g === "photos" ? PHOTOS_STEP : DETAILS_STEP)}>{S.missing[g]}</button>
                      </li>
                    ))}
                  </ul>
                </Notice>
              ) : null;
            })()}
            <p className="text-sm text-ink-3">{S.submitNote}</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            {dict.common.back}
          </Button>
          <div className="flex gap-2">
            {step >= PRICE_STEP && step !== REVIEW_STEP && (
              <Button type="button" variant="secondary" disabled={pending} onClick={() => localCheck([0, 1, USAGE_STEP, PRICE_STEP]) && persist("draft", () => toast(S.savedDraft))}>
                {S.saveDraft}
              </Button>
            )}
            {step < REVIEW_STEP ? (
              <Button type="button" onClick={next} loading={pending}>{dict.common.continue}</Button>
            ) : canSubmit ? (
              <Button
                type="button"
                loading={pending}
                onClick={() =>
                  persist("submit", (r) => {
                    if (r.status === "pending_review") {
                      toast(S.submitted);
                      router.push(`/${locale}/account/listings`);
                      router.refresh();
                    }
                  })
                }
              >
                {S.submitForReview}
              </Button>
            ) : (
              <Button type="button" loading={pending} onClick={() => persist("draft", () => { toast(S.savedDraft); router.refresh(); })}>
                {dict.common.save}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
