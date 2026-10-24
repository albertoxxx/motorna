import { describe, expect, it } from "vitest";
import { listingInputSchema, looksLikeEngineSize } from "@/lib/validation";

describe("trim must not be an engine size", () => {
  it.each(["3000cc", "3000 CC", "1600", "1.6", "2.0 L", "1600 سي سي", "1.5T", "2,0"])("%s looks like an engine size", (v) => {
    expect(looksLikeEngineSize(v)).toBe(true);
  });
  it.each(["Highline", "M Sport", "1.6 Highline", "GLI", "هاي لاين", "320i", "X-Line 2"])("%s is a real trim", (v) => {
    expect(looksLikeEngineSize(v)).toBe(false);
  });
  it("server schema rejects an engine-only trim with a localized key", () => {
    const base = { makeId: "1", modelId: "1", year: "2020", mileageKm: "1000", priceEgp: "500000", condition: "used", transmission: "automatic", fuelType: "petrol", cityId: "1", title: "Test listing title", description: "" };
    const bad = listingInputSchema.safeParse({ ...base, trim: "3000cc" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.some((i) => i.message === "trimIsEngine")).toBe(true);
    expect(listingInputSchema.safeParse({ ...base, trim: "M Sport" }).success).toBe(true);
  });
});
