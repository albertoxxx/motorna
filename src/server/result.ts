import type { ValidationKey } from "@/lib/validation";
import type { Dictionary } from "@/i18n/dictionaries/ar";

export type ErrorKey = keyof Dictionary["errors"];

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorKey; fields?: Record<string, ValidationKey> };

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: ErrorKey, fields?: Record<string, ValidationKey>): ActionResult<never> => ({
  ok: false,
  error,
  fields,
});
