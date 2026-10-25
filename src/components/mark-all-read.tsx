"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/server/actions/notifications";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Dictionary } from "@/i18n/dictionaries/ar";

export function MarkAllRead({ label, done, errors }: { label: string; done: string; errors: Dictionary["errors"] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await markAllNotificationsRead();
          if (!r.ok) return toast(errors[r.error], "error");
          toast(done);
          router.refresh();
        })
      }
    >
      {label}
    </Button>
  );
}
