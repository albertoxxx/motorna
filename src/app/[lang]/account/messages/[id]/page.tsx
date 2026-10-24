import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { resolveLocale } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { conversationThread } from "@/server/queries";
import { Composer } from "@/components/composer";
import { Notice } from "@/components/ui/states";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { robots: { index: false } };

export default async function ThreadPage({ params }: PageProps<"/[lang]/account/messages/[id]">) {
  const { id } = await params;
  const { locale, dict } = await resolveLocale(params);
  const user = await requireUser(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const thread = await conversationThread(user.id, id);
  if (!thread) notFound();
  const { conversation: c, other, messages, isBuyer } = thread;
  const M = dict.messages;
  const available = !c.listingDeletedAt && ["published", "sold"].includes(c.listingStatus);
  const canSend = !isBuyer || available;
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/${locale}/account/messages`} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {M.title}
      </Link>
      <div className="rounded-[var(--radius-lg)] border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h1 className="font-bold"><bdi>{other?.name}</bdi></h1>
            <p className="text-sm text-ink-3">
              {M.about}{" "}
              {available ? (
                <Link href={`/${locale}/cars/${c.listingSlug}`} className="text-brand-700 hover:underline">{c.listingTitle}</Link>
              ) : (
                c.listingTitle
              )}{" "}
              — <span className="tabular">{formatPrice(c.priceEgp, locale)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-warning-50 px-5 py-2.5 text-xs text-warning-700">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          {M.scamWarning}
        </div>
        <ol className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto px-5 py-5" aria-live="polite">
          {messages.map((m) => {
            const mine = m.senderId === user.id;
            return (
              <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                <div dir="auto" className={cn("max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed", mine ? "rounded-ee-sm bg-navy-900 text-white" : "rounded-es-sm bg-canvas text-ink ring-1 ring-line")}>
                  {m.body}
                </div>
                <span className="text-[11px] text-ink-3">
                  {mine ? M.you : <bdi>{other?.name}</bdi>} — {formatDate(m.createdAt, locale, { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="border-t border-line p-4">
          {canSend ? (
            <Composer conversationId={c.id} labels={{ placeholder: M.placeholder, send: M.send }} errors={dict.errors} />
          ) : (
            <Notice>{M.listingUnavailable}</Notice>
          )}
        </div>
      </div>
    </div>
  );
}
