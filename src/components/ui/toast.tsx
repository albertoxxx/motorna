"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Toast = { id: number; message: string; tone: "success" | "error" };
const ToastCtx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children, closeLabel }: { children: ReactNode; closeLabel: string }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message: string, tone: Toast["tone"] = "success") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3500);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-md)] px-4 py-3 text-sm text-white shadow-lg [animation:toast-in_.18s_ease-out]",
              t.tone === "error" ? "bg-danger-700" : "bg-navy-900",
            )}
          >
            {t.tone === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label={closeLabel} className="opacity-70 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
