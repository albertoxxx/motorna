import { z } from "zod";
import { normalizeEgyptPhone, type ValidationKey } from "@/lib/validation";

/* MOTORNA Care — pure rules shared by server actions, pages and tests. See docs/CARE.md. */

export const CENTER_STATUSES = ["applied", "under_review", "approved", "suspended", "revoked", "rejected"] as const;
export type CenterStatus = (typeof CENTER_STATUSES)[number];

export const CARE_CATEGORIES = [
  "pre_purchase_inspection",
  "oil_change",
  "routine_maintenance",
  "diagnostics",
  "brakes",
  "tires",
  "air_conditioning",
  "electrical",
  "bodywork",
  "other",
] as const;
export type CareCategory = (typeof CARE_CATEGORIES)[number];

export const VEHICLE_TYPES = ["passenger", "suv_4x4", "commercial", "electric_hybrid"] as const;
export const CREDENTIAL_KINDS = ["commercial_register", "tax_card", "brand_authorization", "other"] as const;
export const STAFF_ROLES = ["owner", "manager", "technician"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Admin checklist. Every applicable criterion must pass before approval. */
export const CENTER_CRITERIA = [
  "documents_valid",
  "address_confirmed",
  "technician_named",
  "inspection_equipment",
  "terms_accepted",
] as const;
export type CenterCriterion = (typeof CENTER_CRITERIA)[number];

/** Inspection equipment only matters for centers that offer pre-purchase inspection. */
export function applicableCriteria(offersInspection: boolean): CenterCriterion[] {
  return CENTER_CRITERIA.filter((c) => c !== "inspection_equipment" || offersInspection);
}

export type AdminCenterAction = "startReview" | "approve" | "reject" | "suspend" | "reinstate" | "revoke";

/** Admin-only status machine. Centers can only resubmit after a rejection (see ownerResubmit). */
const ADMIN_TRANSITIONS: Record<AdminCenterAction, { from: CenterStatus[]; to: CenterStatus; needsReason: boolean }> = {
  startReview: { from: ["applied"], to: "under_review", needsReason: false },
  approve: { from: ["under_review"], to: "approved", needsReason: false },
  reject: { from: ["applied", "under_review"], to: "rejected", needsReason: true },
  suspend: { from: ["approved"], to: "suspended", needsReason: true },
  reinstate: { from: ["suspended"], to: "approved", needsReason: false },
  revoke: { from: ["approved", "suspended"], to: "revoked", needsReason: true },
};

export function nextCenterStatus(from: CenterStatus, action: AdminCenterAction): CenterStatus | null {
  const t = ADMIN_TRANSITIONS[action];
  return t.from.includes(from) ? t.to : null;
}
export const actionNeedsReason = (a: AdminCenterAction) => ADMIN_TRANSITIONS[a].needsReason;
export const ADMIN_CENTER_ACTIONS = Object.keys(ADMIN_TRANSITIONS) as AdminCenterAction[];

/** What still blocks approval. Empty array = the admin may approve. */
export function approvalBlockers(input: {
  checks: Partial<Record<CenterCriterion, boolean>>;
  offersInspection: boolean;
  credentials: { kind: string; reviewState: string; expiresAt: Date | null }[];
  now?: Date;
}): string[] {
  const now = input.now ?? new Date();
  const blockers: string[] = [];
  for (const c of applicableCriteria(input.offersInspection)) if (input.checks[c] !== true) blockers.push(`check:${c}`);
  for (const kind of ["commercial_register", "tax_card"]) {
    const okDoc = input.credentials.some((d) => d.kind === kind && d.reviewState === "accepted" && (!d.expiresAt || d.expiresAt > now));
    if (!okDoc) blockers.push(`document:${kind}`);
  }
  return blockers;
}

/** Only approved centers are visible to the public or can take bookings. */
export const isPubliclyVisible = (s: CenterStatus) => s === "approved";
/** Identity fields are locked once a center has been approved; changing them needs an admin. */
export const identityLocked = (s: CenterStatus) => s === "approved" || s === "suspended" || s === "revoked";
/** A center profile is editable by its staff except after revocation. */
export const profileEditable = (s: CenterStatus) => s !== "revoked";

export function canManageCenter(role: StaffRole | null | undefined) {
  return role === "owner" || role === "manager";
}

/* ----------------------------- Validation ----------------------------- */

/** Egyptian mobile, landline (02/03/0XX) or 5-digit hotline (19xxx). */
export function normalizeCenterPhone(raw: string): string | null {
  const mobile = normalizeEgyptPhone(raw);
  if (mobile) return mobile;
  const d = raw.replace(/[\s\-()]/g, "").replace(/^(\+20|0020)/, "0").replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x)));
  if (/^0[2-9]\d{7,8}$/.test(d)) return d;
  if (/^1[69]\d{3}$/.test(d)) return d;
  return null;
}

const text = (min: number, max: number, key: ValidationKey) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""), z.string().min(min, { error: key }).max(max, { error: key }));
const optional = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string().max(max).optional());

export const centerProfileSchema = z.object({
  nameAr: text(2, 80, "centerName"),
  nameEn: text(2, 80, "centerName"),
  cityId: z.coerce.number({ error: "required" }).int().positive({ error: "required" }),
  area: optional(80),
  address: text(5, 200, "address"),
  phone: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string()).transform((v, ctx) => {
    const p = normalizeCenterPhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "phone" });
      return z.NEVER;
    }
    return p;
  }),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() || undefined : undefined), z.email({ error: "email" }).optional()),
  website: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || undefined : undefined),
    z.url({ protocol: /^https?$/, error: "website" }).max(200, { error: "website" }).optional(),
  ),
  description: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(3000, { error: "descriptionLength" })),
  vehicleTypes: z.array(z.enum(VEHICLE_TYPES)).max(VEHICLE_TYPES.length).default([]),
  quotationPolicy: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(1000, { error: "descriptionLength" })),
});
export type CenterProfileInput = z.infer<typeof centerProfileSchema>;

export const centerApplicationSchema = centerProfileSchema.extend({
  acceptTerms: z.literal(true, { error: "acceptTerms" }),
});

export const centerServiceSchema = z
  .object({
    category: z.enum(CARE_CATEGORIES, { error: "required" }),
    nameAr: text(2, 80, "serviceName"),
    nameEn: text(2, 80, "serviceName"),
    priceMode: z.enum(["fixed", "quote"], { error: "required" }),
    priceEgp: z.preprocess(
      (v) => (v === "" || v == null ? undefined : typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : v),
      z.number({ error: "servicePrice" }).int({ error: "servicePrice" }).min(1, { error: "servicePrice" }).max(1_000_000, { error: "servicePrice" }).optional(),
    ),
    durationMin: z.coerce.number({ error: "serviceDuration" }).int().min(10, { error: "serviceDuration" }).max(1440, { error: "serviceDuration" }),
  })
  .superRefine((v, ctx) => {
    if (v.priceMode === "fixed" && v.priceEgp == null) ctx.addIssue({ code: "custom", path: ["priceEgp"], message: "servicePrice" });
  })
  .transform((v) => ({ ...v, priceEgp: v.priceMode === "quote" ? null : v.priceEgp! }));

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const centerHoursSchema = z
  .array(z.object({ weekday: z.number().int().min(0).max(6), opens: z.string().regex(TIME), closes: z.string().regex(TIME) }))
  .max(7)
  .refine((rows) => rows.every((r) => r.opens < r.closes), { message: "hours" })
  .refine((rows) => new Set(rows.map((r) => r.weekday)).size === rows.length, { message: "hours" });
