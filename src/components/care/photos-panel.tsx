"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { deleteCenterPhoto, makeCenterPhotoCover } from "@/server/actions/care";
import { useToast } from "@/components/ui/toast";
import { useAction, type CareDict } from "./shared";

type Photo = { id: string; thumbUrl: string };

export function PhotosPanel({ dict, centerId, photos, editable }: { dict: CareDict; centerId: string; photos: Photo[]; editable: boolean }) {
  const D = dict.care.dash;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const router = useRouter();
  const toast = useToast();
  const { pending, run } = useAction(dict);

  async function upload(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).slice(0, Math.max(0, 12 - photos.length));
    setUploading(list.length);
    for (const f of list) {
      const fd = new FormData();
      fd.append("file", f);
      try {
        const res = await fetch(`/api/care/centers/${centerId}/photos`, { method: "POST", body: fd });
        const json = await res.json().catch(() => ({ ok: false, error: "generic" }));
        if (!json.ok) toast(dict.errors[json.error as keyof typeof dict.errors] ?? dict.errors.generic, "error");
      } catch {
        toast(dict.errors.generic, "error");
      }
      setUploading((n) => n - 1);
    }
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-3">{D.photosHint}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.id} className="relative overflow-hidden rounded-[var(--radius-md)] border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" />
            {i === 0 && <span className="absolute start-2 top-2 rounded bg-navy-900 px-2 py-0.5 text-xs font-semibold text-white">{D.cover}</span>}
            {editable && (
              <div className="flex justify-between gap-1 p-1">
                {i > 0 ? (
                  <button type="button" disabled={pending} onClick={() => run(() => makeCenterPhotoCover(centerId, p.id), D.saved)} className="inline-flex h-10 items-center gap-1 rounded px-2 text-xs hover:bg-canvas" aria-label={D.makeCover}>
                    <Star className="size-4" aria-hidden />{D.makeCover}
                  </button>
                ) : <span />}
                <button type="button" disabled={pending} onClick={() => run(() => deleteCenterPhoto(centerId, p.id), D.removed)} className="grid size-10 place-items-center rounded text-danger-700 hover:bg-danger-50" aria-label={D.remove}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            )}
          </li>
        ))}
        {editable && photos.length < 12 && (
          <li>
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-line-strong text-sm text-ink-2 hover:border-brand-600">
              <ImagePlus className="size-6" aria-hidden />
              {uploading > 0 ? `… ${uploading}` : D.addPhotos}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={uploading > 0} />
            </label>
          </li>
        )}
      </ul>
      {photos.length === 0 && !editable && <p className="text-sm text-ink-3">{D.noPhotos}</p>}
    </div>
  );
}
