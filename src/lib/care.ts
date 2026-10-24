import { z } from "zod";
import { normalizeEgyptPhone, type ValidationKey } from "@/lib/validation";

/* MOTORNA Care — pure rules shared by server actions, pages and tests. See docs/CARE.md. */

export const CENTER_STATUSES = ["draft", "applied", "under_review", "changes_requested", "approved", "suspended", "revoked", "rejected"] as const;
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
export const EQUIPMENT_KINDS = [
  "obd_scanner",
  "paint_thickness_gauge",
  "lift",
  "wheel_alignment",
  "tire_changer",
  "ac_service_station",
  "battery_tester",
  "brake_tester",
  "emissions_analyzer",
  "other",
] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];
/** Equipment a pre-purchase inspection center must declare before submitting. */
export const INSPECTION_EQUIPMENT: EquipmentKind[] = ["obd_scanner", "paint_thickness_gauge", "lift"];

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

export type AdminCenterAction = "startReview" | "requestChanges" | "approve" | "reject" | "suspend" | "reinstate" | "revoke";

/**
 * Admin-only status machine. "applied" is shown to people as "Submitted".
 * Centers move themselves only from draft / changes_requested / rejected to submitted (see submitTransition).
 */
const ADMIN_TRANSITIONS: Record<AdminCenterAction, { from: CenterStatus[]; to: CenterStatus; needsReason: boolean }> = {
  startReview: { from: ["applied"], to: "under_review", needsReason: false },
  requestChanges: { from: ["applied", "under_review"], to: "changes_requested", needsReason: true },
  approve: { from: ["under_review"], to: "approved", needsReason: false },
  reject: { from: ["applied", "under_review", "changes_requested"], to: "rejected", needsReason: true },
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

/** Statuses from which the center's owner may (re)submit the application. */
export const SUBMITTABLE: CenterStatus[] = ["draft", "changes_requested", "rejected"];
/** An application that is still open (one per owner at a time). */
export const OPEN_APPLICATION: CenterStatus[] = ["draft", "applied", "under_review", "changes_requested"];
/** Waiting for an admin. */
export const IN_QUEUE: CenterStatus[] = ["applied", "under_review"];

export type SubmissionGap = "services" | "equipment" | "technicians" | "documents";

/** What the applicant still has to add before submitting. Empty array = ready to submit. */
export function submissionGaps(input: {
  services: { category: string; active: boolean }[];
  equipment: { kind: string }[];
  technicians: { active: boolean }[];
  credentials: { kind: string; reviewState: string }[];
}): SubmissionGap[] {
  const gaps: SubmissionGap[] = [];
  const active = input.services.filter((s) => s.active);
  if (active.length === 0) gaps.push("services");
  if (active.some((s) => s.category === "pre_purchase_inspection") && !INSPECTION_EQUIPMENT.every((k) => input.equipment.some((e) => e.kind === k))) {
    gaps.push("equipment");
  }
  if (!input.technicians.some((t) => t.active)) gaps.push("technicians");
  const has = (k: string) => input.credentials.some((c) => c.kind === k && c.reviewState !== "rejected");
  if (!has("commercial_register") || !has("tax_card")) gaps.push("documents");
  return gaps;
}

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

/* ----------------------------- Directory ----------------------------- */

export const DIRECTORY_SORTS = ["name", "recent"] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];
export const DIRECTORY_PAGE_SIZE = 12;

/** Today's opening hours in Cairo, for directory cards. weekday: 0 = Sunday. */
export function cairoWeekday(now = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

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

export const equipmentSchema = z.object({
  kind: z.enum(EQUIPMENT_KINDS, { error: "required" }),
  details: z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : undefined), z.string().max(200, { error: "equipmentDetails" }).optional()),
});

export const technicianSchema = z.object({
  fullName: text(3, 80, "technicianName"),
  specialty: optional(80),
  yearsExperience: z.preprocess(
    (v) => (v === "" || v == null ? undefined : typeof v === "string" ? Number(v) : v),
    z.number({ error: "technicianYears" }).int({ error: "technicianYears" }).min(0, { error: "technicianYears" }).max(60, { error: "technicianYears" }).optional(),
  ),
  certifications: optional(300),
});

export const reviewNoteSchema = z.string().trim().min(1).max(2000);
