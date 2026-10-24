"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-[var(--radius-sm)] border bg-surface px-3 text-ink placeholder:text-ink-3 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600/25 disabled:bg-canvas disabled:text-ink-3";
const controlState = (invalid?: boolean) =>
  invalid ? "border-danger-600 focus:border-danger-600" : "border-line-strong hover:border-ink-3 focus:border-brand-600";

export function Field({
  label,
  hint,
  error,
  optional,
  optionalLabel,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
  htmlFor: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {optional && <span className="ms-1.5 font-normal text-ink-3">({optionalLabel})</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ invalid, className, ...rest }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(control, controlState(invalid), "h-11", className)}
      aria-invalid={invalid || undefined}
      aria-describedby={rest.id ? `${rest.id}-${invalid ? "error" : "hint"}` : undefined}
      {...rest}
    />
  );
}

export function Select({ invalid, className, children, ...rest }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        control,
        controlState(invalid),
        "h-11 appearance-none bg-[length:16px] bg-no-repeat pe-9",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%23667085%22><path d=%22M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z%22/></svg>')]",
        "[background-position:right_0.75rem_center] rtl:[background-position:left_0.75rem_center]",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({ invalid, className, ...rest }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(control, controlState(invalid), "min-h-32 py-2.5 leading-relaxed", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Checkbox({ label, className, ...rest }: ComponentProps<"input"> & { label: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={rest.id ?? id} className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink", className)}>
      <input
        id={rest.id ?? id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-line-strong accent-brand-600"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}
