"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeListingStatus, deleteListing } from "@/server/actions/listings";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Dictionary } from "@/i18n/dictionaries/ar";

export function MyListingActions({
  id,
  status,
  editHref,
  dict,
}: {
  id: string;
  status: string;
  editHref: string;
  dict: Pick<Dictionary, "account" | "common" | "errors">;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const A = dict.account;
  const run = (fn: () => Promise<{ ok: boolean; error?: keyof Dictionary["errors"] }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(dict.errors[res.error ?? "generic"], "error");
      toast(success);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "sold" && <ButtonLink href={editHref} variant="secondary" size="sm">{dict.common.edit}</ButtonLink>}
      {status === "published" && (
        <Button size="sm" variant="dark" disabled={pending} onClick={() => run(() => changeListingStatus(id, "markSold"), A.markedSold)}>{A.markSold}</Button>
      )}
      {["published", "pending_review", "draft", "rejected"].includes(status) && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => changeListingStatus(id, "archive"), A.archived)}>{A.archive}</Button>
      )}
      {status === "archived" && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => changeListingStatus(id, "submit"), A.republish)}>{A.republish}</Button>
      )}
      <Button
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => confirm(A.deleteConfirm) && run(() => deleteListing(id), A.deleted)}
      >
        {dict.common.delete}
      </Button>
    </div>
  );
}
