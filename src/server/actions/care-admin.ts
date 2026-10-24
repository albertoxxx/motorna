"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { audit } from "@/server/audit";
import { fail, ok, type ActionResult } from "@/server/result";
import {
  ADMIN_CENTER_ACTIONS,
  CENTER_CRITERIA,
  actionNeedsReason,
  approvalBlockers,
  nextCenterStatus,
  reviewNoteSchema,
  type AdminCenterAction,
  type CenterCriterion,
} from "@/lib/care";

const { serviceCenters: C, centerCredentials: CR, centerApprovalChecks: CK, centerServices: SV } = schema;

async function requireAdminAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" as const };
  if (user.role !== "admin") return { error: "forbidden" as const };
  return { admin: user };
}

const noteSchema = z.string().trim().max(500);
const reasonSchema = z.string().trim().min(5).max(500);

const refresh = (slug: string) => {
  revalidatePath("/[lang]/admin", "layout");
  revalidatePath("/[lang]/care", "layout");
  revalidatePath(`/[lang]/center/${slug}`, "layout");
};

/** Records one checklist criterion. Admins can't tick checks on a center they staff. */
export async function setCenterCheck(centerId: string, criterion: string, passed: boolean, note?: string): Promise<ActionResult<null>> {
  const a = await requireAdminAction();
  if (a.error) return fail(a.error);
  if (!CENTER_CRITERIA.includes(criterion as CenterCriterion)) return fail("validation");
  const n = noteSchema.safeParse(note ?? "");
  if (!n.success) return fail("validation");
  const [c] = await db.select().from(C).where(eq(C.id, centerId));
  if (!c) return fail("notFound");
  if (await isStaff(a.admin.id, centerId)) return fail("conflictOfInterest");
  await db.transaction(async (tx) => {
    await tx
      .insert(CK)
      .values({ centerId, criterion, passed, note: n.data || null, checkedById: a.admin.id })
      .onConflictDoUpdate({
        target: [CK.centerId, CK.criterion],
        set: { passed, note: n.data || null, checkedById: a.admin.id, checkedAt: new Date() },
      });
    await audit(a.admin.id, "center.check", "service_center", centerId, { criterion, passed, note: n.data || null }, tx);
  });
  refresh(c.slug);
  return ok(null);
}

export async function reviewCredential(credentialId: string, decision: "accepted" | "rejected", note?: string): Promise<ActionResult<null>> {
  const a = await requireAdminAction();
  if (a.error) return fail(a.error);
  if (decision !== "accepted" && decision !== "rejected") return fail("validation");
  const n = (decision === "rejected" ? reasonSchema : noteSchema).safeParse(note ?? "");
  if (!n.success) return fail("validation", { note: "required" });
  const [doc] = await db.select().from(CR).where(eq(CR.id, credentialId));
  if (!doc) return fail("notFound");
  if (await isStaff(a.admin.id, doc.centerId)) return fail("conflictOfInterest");
  const [c] = await db.select({ slug: C.slug }).from(C).where(eq(C.id, doc.centerId));
  await db.transaction(async (tx) => {
    await tx
      .update(CR)
      .set({ reviewState: decision, reviewNote: n.data || null, reviewedById: a.admin.id, reviewedAt: new Date() })
      .where(eq(CR.id, credentialId));
    await audit(a.admin.id, `center.credential.${decision}`, "service_center", doc.centerId, { credentialId, kind: doc.kind, note: n.data || null }, tx);
  });
  refresh(c.slug);
  return ok(null);
}

/**
 * The only way a center's status changes (besides an owner resubmitting after rejection).
 * Approval requires every applicable checklist item and accepted, unexpired core documents.
 * Nothing here looks at subscriptions or payments.
 */
export async function changeCenterStatus(centerId: string, action: string, reason?: string): Promise<ActionResult<{ status: schema.CenterStatus }>> {
  const a = await requireAdminAction();
  if (a.error) return fail(a.error);
  if (!ADMIN_CENTER_ACTIONS.includes(action as AdminCenterAction)) return fail("validation");
  const act = action as AdminCenterAction;
  const [c] = await db.select().from(C).where(eq(C.id, centerId));
  if (!c) return fail("notFound");
  if (await isStaff(a.admin.id, centerId)) return fail("conflictOfInterest");
  const to = nextCenterStatus(c.status, act);
  if (!to) return fail("invalidTransition");
  let note: string | null = null;
  if (actionNeedsReason(act)) {
    const r = reasonSchema.safeParse(reason ?? "");
    if (!r.success) return fail("validation", { reason: "required" });
    note = r.data;
  }
  if (act === "approve") {
    const [checks, credentials, inspection] = await Promise.all([
      db.select().from(CK).where(eq(CK.centerId, centerId)),
      db.select().from(CR).where(eq(CR.centerId, centerId)),
      db
        .select({ id: SV.id })
        .from(SV)
        .where(and(eq(SV.centerId, centerId), eq(SV.category, "pre_purchase_inspection"), eq(SV.active, true)))
        .limit(1),
    ]);
    const blockers = approvalBlockers({
      checks: Object.fromEntries(checks.map((k) => [k.criterion, k.passed])),
      offersInspection: inspection.length > 0,
      credentials,
    });
    if (blockers.length) return fail("approvalBlocked");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(C)
      .set({
        status: to,
        statusReason: note,
        ...(act === "approve" ? { approvedAt: new Date(), approvedById: a.admin.id } : {}),
        ...(act === "approve" || act === "reinstate" ? { lastVerifiedAt: new Date() } : {}),
      })
      .where(and(eq(C.id, centerId), eq(C.status, c.status)));
    await audit(a.admin.id, `center.${act}`, "service_center", centerId, { from: c.status, to, reason: note }, tx);
  });
  refresh(c.slug);
  return ok({ status: to });
}

/** Internal reviewer note. Never shown to the center; there is no edit or delete path. */
export async function addReviewNote(centerId: string, body: string): Promise<ActionResult<null>> {
  const a = await requireAdminAction();
  if (a.error) return fail(a.error);
  const parsed = reviewNoteSchema.safeParse(body);
  if (!parsed.success) return fail("validation", { note: "required" });
  const [c] = await db.select({ slug: C.slug }).from(C).where(eq(C.id, centerId));
  if (!c) return fail("notFound");
  await db.transaction(async (tx) => {
    await tx.insert(schema.centerReviewNotes).values({ centerId, authorId: a.admin.id, body: parsed.data });
    await audit(a.admin.id, "center.note", "service_center", centerId, {}, tx);
  });
  refresh(c.slug);
  return ok(null);
}

async function isStaff(userId: string, centerId: string) {
  const [row] = await db
    .select({ u: schema.centerStaff.userId })
    .from(schema.centerStaff)
    .where(and(eq(schema.centerStaff.userId, userId), eq(schema.centerStaff.centerId, centerId)));
  return !!row;
}
