import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { conversationList } from "@/server/queries";
import { EmptyState } from "@/components/ui/states";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { robots: { index: false } };

export default async function MessagesPage({ params }: PageProps<"/[lang]/account/messages">) {
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale);
  const convs = await conversationList(user.id);
  const M = dict.messages;
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{M.title}</h1>
      {convs.length === 0 ? (
        <EmptyState icon={<MessageSquare className="size-8" />} title={M.emptyTitle} body={M.emptyBody} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
          {convs.map((c) => (
            <li key={c.id}>
              <Link href={`/${locale}/account/messages/${c.id}`} className="flex items-center gap-4 p-4 hover:bg-canvas">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.coverUrl && <img src={c.coverUrl} alt="" className="size-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={cn("truncate", c.unread > 0 ? "font-bold" : "font-semibold")}>{c.otherName}</p>
                    <span className="shrink-0 text-xs text-ink-3">{formatRelative(c.lastMessageAt, locale)}</span>
                  </div>
                  <p className="truncate text-sm text-ink-3">
                    {c.isBuyer ? M.sellerLabel : M.buyer} — {c.listingTitle}
                  </p>
                  <p className={cn("truncate text-sm", c.unread > 0 ? "text-ink" : "text-ink-2")}>{c.lastMsg}</p>
                </div>
                {c.unread > 0 && <span className="tabular rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">{c.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
