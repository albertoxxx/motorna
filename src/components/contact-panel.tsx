"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Phone } from "lucide-react";
import { contactSeller, revealPhone } from "@/server/actions/engagement";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { Dictionary } from "@/i18n/dictionaries/ar";

export function ContactPanel({
  listingId,
  locale,
  signedIn,
  sellerHasPhone,
  signInHref,
  dict,
}: {
  listingId: string;
  locale: string;
  signedIn: boolean;
  sellerHasPhone: boolean;
  signInHref: string;
  dict: Pick<Dictionary, "listing" | "errors" | "common" | "messages">;
}) {
  const [body, setBody] = useState(dict.listing.messagePlaceholder);
  const [phone, setPhone] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  if (!signedIn) {
    const signUpHref = signInHref.replace("/auth/sign-in", "/auth/sign-up");
    return (
      <div className="flex flex-col gap-2">
        <ButtonLink href={signUpHref} size="lg" className="h-auto! min-h-12 w-full py-2.5 text-center whitespace-normal!">
          <MessageSquare className="size-4" />
          {dict.listing.contactSignUp}
        </ButtonLink>
        <ButtonLink href={signInHref} size="lg" variant="secondary" className="h-auto! min-h-12 w-full py-2.5 text-center whitespace-normal!">
          {dict.listing.contactHaveAccount}
        </ButtonLink>
        <p className="text-xs leading-relaxed text-ink-3">{dict.listing.whyAccount}</p>
        {sellerHasPhone && (
          <p className="flex items-center gap-1.5 text-xs text-ink-2">
            <Phone className="size-3.5" aria-hidden />
            {dict.listing.phoneAfterSignIn}
          </p>
        )}
      </div>
    );
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await contactSeller(listingId, body);
      if (!res.ok) return toast(dict.errors[res.error], "error");
      setConversationId(res.data.conversationId);
      toast(dict.listing.messageSent);
      router.refresh();
    });
  }

  function showPhone() {
    start(async () => {
      const res = await revealPhone(listingId);
      if (!res.ok) return toast(dict.errors[res.error], "error");
      setPhone(res.data.phone);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {conversationId ? (
        <ButtonLink href={`/${locale}/account/messages/${conversationId}`} size="lg" variant="dark" className="w-full">
          <MessageSquare className="size-4" />
          {dict.listing.openConversation}
        </ButtonLink>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-2">
          <label htmlFor="contact-body" className="sr-only">{dict.listing.contactSeller}</label>
          <Textarea id="contact-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} className="min-h-24! text-sm" required />
          <Button type="submit" size="lg" loading={pending} className="w-full">
            <MessageSquare className="size-4" />
            {dict.listing.contactSeller}
          </Button>
        </form>
      )}
      {sellerHasPhone ? (
        phone ? (
          <a href={`tel:${phone}`} dir="ltr" className="tabular inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-line-strong bg-surface text-lg font-semibold text-navy-900">
            <Phone className="size-4" />
            {phone}
          </a>
        ) : (
          <Button variant="secondary" size="lg" onClick={showPhone} disabled={pending} className="w-full">
            <Phone className="size-4" />
            {dict.listing.showPhone}
          </Button>
        )
      ) : (
        <p className="text-center text-sm text-ink-3">{dict.listing.phoneHidden}</p>
      )}
      <p className="text-xs leading-relaxed text-ink-3">
        {dict.messages.scamWarning}
      </p>
    </div>
  );
}
