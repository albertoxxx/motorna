import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "dark";
const tones: Record<Tone, string> = {
  neutral: "bg-navy-900/[0.05] text-ink-2",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  dark: "bg-navy-900 text-white",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export const statusTone = (s: string): Tone =>
  ({ published: "success", pending_review: "warning", rejected: "danger", sold: "dark", draft: "neutral", archived: "neutral" })[s] as Tone ?? "neutral";
