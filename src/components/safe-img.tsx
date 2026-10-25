"use client";

import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

/** An <img> that swaps to a fallback if the file fails to load (deleted, blocked, offline). */
export function SafeImg({ fallback, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed || !props.src) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} onError={() => setFailed(true)} />;
}
