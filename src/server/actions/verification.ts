"use server";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";
import { fail, ok, type ActionResult } from "@/server/result";
import { createNotification } from "@/server/notifications";
import { sendSms, smsDeliveryAvailable } from "@/lib/sms";
import { privateStorage } from "@/lib/storage";
import { PHONE_CODE_MAX_ATTEMPTS, PHONE_CODE_RESEND_SEC, PHONE_CODE_TTL_MIN, codeSchemaPattern } from "@/lib/verification";

const { phoneVerifications: PV, users: U, listingLicenceChecks: LC, listings: L } = schema;
const UUID = z.uuid();

const hashCode = (userId: string, phone: string, code: string) =>
  createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "dev-secret").update(`${userId}:${phone}:${code}`).digest("hex");

/* ------------------------------- Phone ------------------------------- */

/** Sends a 6-digit code to the profile phone. Only offered when an SMS provider is configured. */
export async function requestPhoneCode(): Promise<ActionResult<{ expiresInMin: number }>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!smsDeliveryAvailable()) return fail("smsUnavailable");
  const [me] = await db.select({ phone: U.phone }).from(U).where(eq(U.id, user.id));
  if (!me?.phone) return fail("validation", { phone: "phone" });
  const [last] = await db.select({ createdAt: PV.createdAt }).from(PV).where(eq(PV.userId, user.id)).orderBy(desc(PV.createdAt)).limit(1);
  if (last && Date.now() - last.createdAt.getTime() < PHONE_CODE_RESEND_SEC * 1000) return fail("rateLimited");
  if (!(await rateLimit("phoneCode", user.id)) || !(await rateLimit("phoneCodeNumber", me.phone))) return fail("rateLimited");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Older codes stop working as soon as a new one is issued.
  await db.update(PV).set({ consumedAt: new Date() }).where(and(eq(PV.userId, user.id), isNull(PV.consumedAt)));
  const [row] = await db
    .insert(PV)
    .values({ userId: user.id, phone: me.phone, codeHash: hashCode(user.id, me.phone, code), expiresAt: new Date(Date.now() + PHONE_CODE_TTL_MIN * 60_000) })
    .returning({ id: PV.id });
  const sent = await sendSms(me.phone, `MOTORNA: كود التأكيد ${code} — Your code is ${code}. صالح ${PHONE_CODE_TTL_MIN} دقايق. ماتديهوش لحد.`);
  if (!sent.sent) {
    await db.update(PV).set({ consumedAt: new Date() }).where(eq(PV.id, row.id));
    return fail("smsUnavailable");
  }
  return ok({ expiresInMin: PHONE_CODE_TTL_MIN });
}

export async function confirmPhoneCode(raw: unknown): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const code = typeof raw === "string" ? raw.replace(/\s/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))) : "";
  if (!codeSchemaPattern.test(code)) return fail("validation", { code: "required" });
  const [me] = await db.select({ phone: U.phone }).from(U).where(eq(U.id, user.id));
  if (!me?.phone) return fail("validation", { phone: "phone" });
  const [row] = await db
    .select()
    .from(PV)
    .where(and(eq(PV.userId, user.id), eq(PV.phone, me.phone), isNull(PV.consumedAt), gt(PV.expiresAt, new Date())))
    .orderBy(desc(PV.createdAt))
    .limit(1);
  if (!row || row.attempts >= PHONE_CODE_MAX_ATTEMPTS) return fail("codeInvalid");
  const a = Buffer.from(row.codeHash, "hex");
  const b = Buffer.from(hashCode(user.id, me.phone, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(PV).set({ attempts: row.attempts + 1 }).where(eq(PV.id, row.id));
    return fail("codeInvalid");
  }
  await db.transaction(async (tx) => {
    const now = new Date();
    await tx.update(PV).set({ consumedAt: now }).where(eq(PV.id, row.id));
    await tx.update(U).set({ phoneVerifiedAt: now, phoneVerifiedNumber: me.phone }).where(eq(U.id, user.id));
    await audit(user.id, "user.phone.verified", "user", user.id, {}, tx);
  });
  revalidatePath("/[lang]", "layout");
  return ok(null);
}

/* ------------------------------- Vehicle licence ------------------------------- */

/** The seller withdraws a licence that is still waiting for review (its files are deleted). */
export async function withdrawLicence(checkId: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (!UUID.safeParse(checkId).success) return fail("notFound");
  const [row] = await db
    .select({ id: LC.id, frontKey: LC.frontKey, backKey: LC.backKey, sellerId: L.sellerId, listingId: L.id })
    .from(LC)
    .innerJoin(L, eq(L.id, LC.listingId))
    .where(and(eq(LC.id, checkId), eq(LC.status, "pending")));
  if (!row || row.sellerId !== user.id) return fail("notFound");
  for (const k of [row.frontKey, row.backKey]) if (k) await privateStorage().delete(k).catch(() => {});
  await db.transaction(async (tx) => {
    await tx.delete(LC).where(and(eq(LC.id, row.id), eq(LC.status, "pending")));
    await audit(user.id, "listing.licence.withdraw", "listing", row.listingId, { checkId }, tx);
  });
  revalidatePath("/[lang]/account/listings", "layout");
  return ok(null);
}

const reviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("accept"), note: z.string().trim().max(500).optional(), expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  z.object({ decision: z.literal("reject"), note: z.string().trim().min(5).max(500) }),
]);

/**
 * Admin decision on a licence. Accepting confirms the licence is readable, current, and matches the
 * listing's make, model and year at that moment. It is not a check of ownership with the traffic authority.
 */
export async function reviewLicence(checkId: string, raw: unknown): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  if (user.role !== "admin") return fail("forbidden");
  if (!UUID.safeParse(checkId).success) return fail("notFound");
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", { note: "required" });
  const v = parsed.data;
  const res = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: LC.id, status: LC.status, listingId: L.id, sellerId: L.sellerId, slug: L.slug, title: L.title })
      .from(LC)
      .innerJoin(L, eq(L.id, LC.listingId))
      .where(eq(LC.id, checkId))
      .for("update", { of: LC });
    if (!row || row.status !== "pending") return "notFound" as const;
    if (row.sellerId === user.id) return "conflictOfInterest" as const;
    const expiresAt = v.decision === "accept" && v.expiresAt ? new Date(`${v.expiresAt}T23:59:59Z`) : null;
    if (expiresAt && expiresAt <= new Date()) return "licenceExpired" as const;
    await tx
      .update(LC)
      .set({ status: v.decision === "accept" ? "accepted" : "rejected", reviewNote: v.note || null, licenceExpiresAt: expiresAt, reviewedById: user.id, reviewedAt: new Date() })
      .where(eq(LC.id, row.id));
    await audit(user.id, v.decision === "accept" ? "listing.licence.accept" : "listing.licence.reject", "listing", row.listingId, { checkId, note: v.note ?? null }, tx);
    await createNotification(
      row.sellerId,
      v.decision === "accept" ? "licence_accepted" : "licence_rejected",
      { title: row.title, reason: v.note ?? null },
      v.decision === "accept" ? `/cars/${row.slug}` : `/account/listings/${row.listingId}/licence`,
      `licence:${row.listingId}`,
      tx,
    );
    return null;
  });
  if (res) return fail(res);
  revalidatePath("/[lang]", "layout");
  return ok(null);
}
