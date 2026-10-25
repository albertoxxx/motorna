/** Admin user directory: search (with LIKE wildcards escaped), suspended filter, dashboard counts. */
import { describe, expect, it } from "vitest";

const { db, schema } = await import("@/db");
const { adminUsers, adminStats } = await import("@/server/queries");

describe("admin user directory", () => {
  it("searches by name or email, escapes wildcards, filters suspended", async () => {
    const tag = crypto.randomUUID().slice(0, 6);
    const a = { id: crypto.randomUUID(), name: `Zed ${tag}`, email: `zed-${tag}@admin.test` };
    const b = { id: crypto.randomUUID(), name: `Yara ${tag}`, email: `yara_${tag}@admin.test`, suspendedAt: new Date(), suspensionReason: "Spam listings" };
    await db.insert(schema.users).values([a, b]);
    expect((await adminUsers(tag)).map((u) => u.id).sort()).toEqual([a.id, b.id].sort());
    expect((await adminUsers(`zed-${tag}`)).map((u) => u.id)).toEqual([a.id]);
    // "_" and "%" are literal, not wildcards.
    expect((await adminUsers(`yara_${tag}`)).map((u) => u.id)).toEqual([b.id]);
    expect(await adminUsers(`%${tag}%zz`)).toEqual([]);
    const suspended = await adminUsers(tag, true);
    expect(suspended.map((u) => u.id)).toEqual([b.id]);
    expect(suspended[0]).toMatchObject({ listings: 0, centers: 0, suspensionReason: "Spam listings" });
  });

  it("dashboard stats include Care and booking queues", async () => {
    const s = await adminStats();
    for (const k of ["pending", "published", "reports", "users", "centersQueue", "disputes", "bookingsWaiting"] as const) expect(typeof s[k]).toBe("number");
  });
});
