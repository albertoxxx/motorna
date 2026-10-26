/** Seller verification rules (pure): phone status and vehicle licence badge. See docs/SELLER-VERIFICATION.md. */

export const PHONE_CODE_TTL_MIN = 10;
export const PHONE_CODE_MAX_ATTEMPTS = 5;
export const PHONE_CODE_RESEND_SEC = 60;
/** Licence files are deleted this many days after the admin's decision; the decision record stays. */
export const LICENCE_FILE_RETENTION_DAYS = 30;

/** The phone counts as verified only if the verified number is still the profile number. */
export function phoneVerified(u: { phone: string | null; phoneVerifiedAt: Date | null; phoneVerifiedNumber: string | null }): boolean {
  return !!u.phone && !!u.phoneVerifiedAt && u.phoneVerifiedNumber === u.phone;
}

export type LicenceCheck = {
  status: "pending" | "accepted" | "rejected";
  snapshotMakeId: number;
  snapshotModelId: number | null;
  snapshotYear: number;
  licenceExpiresAt: Date | null;
  reviewedAt: Date | null;
};

export type LicenceState = { state: "verified"; reviewedAt: Date } | { state: "pending" } | { state: "none" };

/**
 * Badge state for a listing from its licence checks (newest first). "verified" needs an accepted check
 * that hasn't expired and still matches the listing's make, model and year.
 */
export function licenceState(listing: { makeId: number; modelId: number | null; year: number }, checks: LicenceCheck[], now = new Date()): LicenceState {
  const valid = checks.find(
    (c) =>
      c.status === "accepted" &&
      (!c.licenceExpiresAt || c.licenceExpiresAt > now) &&
      c.snapshotMakeId === listing.makeId &&
      (c.snapshotModelId ?? null) === (listing.modelId ?? null) &&
      c.snapshotYear === listing.year,
  );
  if (valid) return { state: "verified", reviewedAt: valid.reviewedAt ?? now };
  if (checks.some((c) => c.status === "pending")) return { state: "pending" };
  return { state: "none" };
}

export const codeSchemaPattern = /^\d{6}$/;
