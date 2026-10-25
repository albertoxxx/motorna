import type { Metadata } from "next";
import { Bell, BadgeCheck, MessageSquare, Wrench, XCircle } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { listNotifications } from "@/server/notifications";
import { openNotification } from "@/server/actions/notifications";
import { MarkAllRead } from "@/components/mark-all-read";
import { EmptyState } from "@/components/ui/states";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Dictionary } from "@/i18n/dictionaries/ar";

export const metadata: Metadata = { robots: { index: false } };

function render(n: { kind: string; data: Record<string, string | null> }, T: Dictionary["notifications"], locale: string) {
  const fill = (tpl: string, vars: Record<string, string | null | undefined>) =>
    tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "").replace(/:\s*$/, "");
  if (n.kind === "center_status") {
    const tpl = T.center[(n.data.action ?? "approve") as keyof typeof T.center] ?? T.center.approve;
    return fill(tpl, { center: locale === "ar" ? n.data.centerAr : n.data.centerEn, reason: n.data.reason });
  }
  const tpl = T.kinds[n.kind as keyof typeof T.kinds];
  return tpl ? fill(tpl, n.data) : "";
}

const ICONS: Record<string, typeof Bell> = { listing_approved: BadgeCheck, listing_rejected: XCircle, listing_taken_down: XCircle, message: MessageSquare, center_status: Wrench };

export default async function NotificationsPage({ params }: PageProps<"/[lang]/account/notifications">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale, `/${locale}/account/notifications`);
  const items = await listNotifications(user.id);
  const T = dict.notifications;
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{T.title}</h1>
          {unread > 0 && <p className="mt-1 text-sm text-ink-3">{T.unread.replace("{n}", String(unread))}</p>}
        </div>
        {unread > 0 && <MarkAllRead label={T.markAll} done={T.markedAll} errors={dict.errors} />}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="size-8" aria-hidden />} title={T.empty} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
          {items.map((n) => {
            const Icon = ICONS[n.kind] ?? Bell;
            return (
              <li key={n.id}>
                <form action={openNotification}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <button type="submit" className={cn("flex w-full items-start gap-3 p-4 text-start hover:bg-canvas", !n.readAt && "bg-brand-50/60")}>
                    <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", n.kind === "listing_approved" ? "bg-success-50 text-success-700" : n.kind.endsWith("rejected") || n.kind.endsWith("taken_down") ? "bg-danger-50 text-danger-700" : "bg-navy-900/[0.06] text-ink-2")}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span dir="auto" className={cn("block text-sm leading-relaxed", !n.readAt ? "font-semibold text-ink" : "text-ink-2")}>{render(n, T, locale)}</span>
                      <span className="mt-0.5 block text-xs text-ink-3">{formatRelative(n.createdAt, locale)}</span>
                    </span>
                    {!n.readAt && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-brand-600" aria-hidden />}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
