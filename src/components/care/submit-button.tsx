"use client";

import { submitCenter } from "@/server/actions/care";
import { Button } from "@/components/ui/button";
import { useAction, type CareDict } from "./shared";

export function SubmitApplicationButton({ dict, centerId, disabled }: { dict: CareDict; centerId: string; disabled?: boolean }) {
  const { pending, run } = useAction(dict);
  return (
    <Button loading={pending} disabled={disabled} onClick={() => run(() => submitCenter(centerId), dict.care.dash.submitted)}>
      {dict.care.dash.submit}
    </Button>
  );
}
