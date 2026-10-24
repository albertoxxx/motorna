import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-[var(--radius-md)] transition-colors disabled:opacity-50 disabled:pointer-events-none select-none";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700",
  dark: "bg-navy-900 text-white hover:bg-navy-800",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-canvas hover:border-ink-3",
  ghost: "text-ink-2 hover:bg-navy-900/5 hover:text-ink",
  danger: "bg-surface text-danger-700 border border-danger-600/40 hover:bg-danger-50",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  children,
  disabled,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
