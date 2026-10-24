"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const copy = {
  ar: { title: "حصلت مشكلة", body: "ماقدرناش نحمّل الصفحة. جرّب تاني بعد لحظات.", retry: "حاول مرة أخرى" },
  en: { title: "Something went wrong", body: "We couldn't load this page. Try again in a moment.", retry: "Try again" },
};

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const c = lang === "en" ? copy.en : copy.ar;
  return (
    <div className="container-page flex flex-col items-start gap-4 py-24">
      <h1 className="text-3xl font-bold">{c.title}</h1>
      <p className="text-ink-2">{c.body}</p>
      <Button variant="dark" onClick={reset}>{c.retry}</Button>
    </div>
  );
}
