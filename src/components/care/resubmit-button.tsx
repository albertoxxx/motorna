"use client";

import { resubmitCenter } from "@/server/actions/care";
import { Button } from "@/components/ui/button";
import { useAction, type CareDict } from "./shared";

export function ResubmitButton({ dict, centerId }: { dict: CareDict; centerId: string }) {
  const { pending, run } = useAction(dict);
  return (
    <Button size="sm" loading={pending} onClick={() => run(() => resubmitCenter(centerId), dict.care.dash.resubmitted)}>
      {dict.care.dash.resubmit}
    </Button>
  );
}
