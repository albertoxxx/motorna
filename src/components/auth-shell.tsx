import type { ReactNode } from "react";

export function AuthShell({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-12 sm:py-16">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-line bg-surface p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {body && <p className="mb-6 mt-1.5 text-ink-2">{body}</p>}
        {children}
      </div>
    </div>
  );
}
