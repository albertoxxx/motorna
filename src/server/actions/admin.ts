"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { audit } from "@/server/audit";
import { fail, ok, type ActionResult } from "@/server/result";
import { nextStatus } from "@/lib/listing-state";

const { listings: L, reports: R, users: U, sessions: S } = schema;

async function requireAdminAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "unauthorized" as const };
  if (user.role !== "admin") return { error: "forbidden" as const };
  return { admin: user };
}

const reasonSchema = z.string().trim().min(5).max(500);

export async function moderateListing(
  listingId: string,
  decision: "approve" | "reject" | "takeDown",
  reason?: string,
): Promise<ActionResult<{ status: schema.ListingStatus }>> {
  const a = await requireAdminAction();
  if (a.error) return fail(a.error);
  const [l] = await db.select().from(L).where(and(eq(L.id, listingId), isNull(L.deletedAt)));
  if (!l) return fail("notFound");
  const to = nextStatus(l.status, decision);
  if (!to) return fail("invalidTransition");
  let note: string | null = null;
  if (decision !== "approve") {
    const r = reasonSchema.safeParse(reason ?? "");
    if (!r.success) return fail("validation", { reason: "required" });
    note = r.data;
  }
  await db.transaction(async (tx) => {
    await tx
      .update(L)
      .set({
        status: to,
        rejectionReason: note,
        publishedAt: to === "published" ? (l.publishedAt ?? new Date()) : l.publishedAt,
      })
      .where(eq(L.id, l.id));
    await audit(a.admin.id, `listing.${decision}`, "listing", l.id, { from: l.status, to, reason: note }, tx);
    if (decision === "approve") {
      // Approving a listing also approves a seller-entered model it uses.
      const verified = await tx
        .update(schema.vehicleModels)
        .set({ isVerified: true })
        .where(and(eq(schema.vehicleModels.id, l.modelId), eq(schema.vehicleModels.isVerified, false)))
        .returning({ id: schema.vehicleModels.id, name: schema.vehicleModels.nameEn });
      if (verified.length) await audit(a.admin.id, "model.verify", "vehicle_model", String(verified[0].id), { name: verified[0].name }, tx);
    }
  });
  revalidatePath("/[lang]/admin", "layout");
  revalidatePath(`/[lang]/cars/${l.slug}`, "page");
  return ok({ status: to });
}

const reportUpdateSchema = z.object({
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  note: z.string().trim().max(1000).optional(),
});

export async function updateReport(
  reportId: string,
  raw: { status: string; note?: string },
): Promise<ActionResult<null>> {
  const a = await requireAdminAction();
  if (a.error) return fail(a.error);
  const parsed = reportUpdateSchema.safeParse(raw);
  if (!parsed.success) return fail("validation");
  const [r] = await db.select().from(R).where(eq(R.id, reportId));
  if (!r) return fail("notFound");
  const closing = parsed.data.status !== "reviewing";
  await db.transaction(async (tx) => {
    await tx
      .update(R)
      .set({
        status: parsed.data.status,
        resolutionNote: parsed.data.note || r.resolutionNote,
        resolvedById: closing ? a.admin.id : r.resolvedById,
        resolvedAt: closing ? new Date() : null,
      })
      .where(eq(R.id, r.id));
    await audit(a.admin.id, `report.${parsed.data.status}`, "report", r.id, { note: parsed.data.note ?? null }, tx);
  });
  revalidatePath("/[lang]/admin", "layout");
  return ok(null);
}

export async function setUserSuspension(
  userId: string,
  suspend: boolean,
  reason?: string,
): Promise<ActionResult<null>> {
  const a = await requireAdminAction();
  if (a.error) return fail(a.error);
  if (userId === a.admin.id) return fail("forbidden");
  const [target] = await db.select({ id: U.id, role: U.role }).from(U).where(eq(U.id, userId));
  if (!target) return fail("notFound");
  if (target.role === "admin") return fail("forbidden");
  let note: string | null = null;
  if (suspend) {
    const r = reasonSchema.safeParse(reason ?? "");
    if (!r.success) return fail("validation", { reason: "required" });
    note = r.data;
  }
  await db.transaction(async (tx) => {
    await tx
      .update(U)
      .set({ suspendedAt: suspend ? new Date() : null, suspensionReason: note })
      .where(eq(U.id, userId));
    if (suspend) {
      await tx.delete(S).where(eq(S.userId, userId));
      // Hide the user's live listings while suspended.
      await tx
        .update(L)
        .set({ status: "archived" })
        .where(and(eq(L.sellerId, userId), eq(L.status, "published")));
    }
    await audit(a.admin.id, suspend ? "user.suspend" : "user.unsuspend", "user", userId, { reason: note }, tx);
  });
  revalidatePath("/[lang]/admin", "layout");
  return ok(null);
}
