"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendHorizontal } from "lucide-react";
import { sendMessage } from "@/server/actions/engagement";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { Dictionary } from "@/i18n/dictionaries/ar";

export function Composer({ conversationId, labels, errors }: { conversationId: string; labels: { placeholder: string; send: string }; errors: Dictionary["errors"] }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!body.trim()) return;
    start(async () => {
      const res = await sendMessage(conversationId, body);
      if (!res.ok) return toast(errors[res.error], "error");
      setBody("");
      router.refresh();
    });
  }
  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label htmlFor="composer" className="sr-only">{labels.placeholder}</label>
      <Textarea
        id="composer"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={labels.placeholder}
        maxLength={2000}
        rows={2}
        className="min-h-12! flex-1 resize-none"
      />
      <Button type="submit" loading={pending} disabled={!body.trim()} aria-label={labels.send} className="h-12">
        <SendHorizontal className="size-4 rtl:rotate-180" />
        <span className="hidden sm:inline">{labels.send}</span>
      </Button>
    </form>
  );
}
