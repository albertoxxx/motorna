"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/session";
import { fail, ok, type ActionResult } from "@/server/result";
import { fieldErrors, profileSchema } from "@/lib/validation";

export async function updateProfile(raw: Record<string, unknown>): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const v = parsed.data;
  if (v.cityId) {
    const [c] = await db.select({ id: schema.cities.id }).from(schema.cities).where(eq(schema.cities.id, v.cityId));
    if (!c) return fail("validation", { cityId: "required" });
  }
  await db
    .update(schema.users)
    .set({
      name: v.name,
      phone: v.phone ?? null,
      // Can't show a number that doesn't exist.
      showPhone: v.phone ? v.showPhone : false,
      cityId: v.cityId ?? null,
      locale: v.locale,
      // A verified phone stays verified only while it is still the profile number.
      phoneVerifiedAt: sql`CASE WHEN ${schema.users.phoneVerifiedNumber} = ${v.phone ?? null} THEN ${schema.users.phoneVerifiedAt} ELSE NULL END`,
      phoneVerifiedNumber: sql`CASE WHEN ${schema.users.phoneVerifiedNumber} = ${v.phone ?? null} THEN ${schema.users.phoneVerifiedNumber} ELSE NULL END`,
    })
    .where(eq(schema.users.id, user.id));
  revalidatePath("/[lang]/account/profile", "page");
  return ok(null);
}
