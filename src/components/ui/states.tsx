import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface px-6 py-10 sm:items-center sm:text-center", className)}>
      {icon && <div className="text-ink-3">{icon}</div>}
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {body && <p className="max-w-md text-ink-2">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-[var(--radius-sm)]", className)} aria-hidden />;
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode; className?: string }) {
  const tones = {
    info: "border-brand-600/25 bg-brand-50 text-navy-800",
    warning: "border-warning-600/30 bg-warning-50 text-warning-700",
    danger: "border-danger-600/30 bg-danger-50 text-danger-700",
    success: "border-success-700/25 bg-success-50 text-success-700",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-[var(--radius-md)] border px-4 py-3 text-sm leading-relaxed", tones[tone], className)}>
      {children}
    </div>
  );
}
