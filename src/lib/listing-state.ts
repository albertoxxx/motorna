import type { ListingStatus } from "@/db/schema";

export type ListingAction = "submit" | "approve" | "reject" | "markSold" | "archive" | "takeDown";

/** Allowed listing status transitions. Enforced server-side for every mutation. */
const transitions: Record<ListingAction, { from: ListingStatus[]; to: ListingStatus }> = {
  submit: { from: ["draft", "rejected", "archived"], to: "pending_review" },
  approve: { from: ["pending_review"], to: "published" },
  reject: { from: ["pending_review", "published"], to: "rejected" },
  markSold: { from: ["published"], to: "sold" },
  archive: { from: ["published", "draft", "rejected", "pending_review"], to: "archived" },
  takeDown: { from: ["published"], to: "rejected" },
};

export function nextStatus(current: ListingStatus, action: ListingAction): ListingStatus | null {
  const t = transitions[action];
  return t.from.includes(current) ? t.to : null;
}

/** Fields whose change on a published listing requires re-review. */
export const MATERIAL_FIELDS = [
  "makeId",
  "modelId",
  "trim",
  "year",
  "mileageKm",
  "condition",
  "transmission",
  "fuelType",
  "bodyType",
  "color",
  "engineCc",
  "cityId",
  "area",
  "title",
  "description",
] as const;

export function requiresReReview(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  return MATERIAL_FIELDS.some((f) => (before[f] ?? null) !== (after[f] ?? null));
}

export function isPubliclyVisible(status: ListingStatus, deletedAt: Date | null) {
  return !deletedAt && (status === "published" || status === "sold");
}
