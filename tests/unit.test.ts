import { describe, expect, it } from "vitest";
import { listingInputSchema, normalizeEgyptPhone, profileSchema, fieldErrors } from "@/lib/validation";
import { parseSearchParams, toQueryString } from "@/lib/search-params";
import { nextStatus, requiresReReview, isPubliclyVisible } from "@/lib/listing-state";
import { makeListingSlug } from "@/lib/slug";
import { safeNext } from "@/lib/safe-next";
import { formatPrice, formatCompactPrice } from "@/lib/format";

const valid = {
  makeId: "1", modelId: "2", year: "2020", mileageKm: "45,000", priceEgp: "٨٥٠٠٠٠",
  negotiable: "on", condition: "used", transmission: "automatic", fuelType: "petrol",
  cityId: "1", title: "Toyota Corolla 2020 Elegance", description: "",
};

describe("listing validation", () => {
  it("accepts valid input and normalizes numbers (commas, Arabic digits)", () => {
    const r = listingInputSchema.parse(valid);
    expect(r.mileageKm).toBe(45000);
    expect(r.priceEgp).toBe(850000);
    expect(r.negotiable).toBe(true);
    expect(r.engineCc).toBeUndefined();
  });
  it.each([
    [{ priceEgp: "500" }, "priceEgp", "price"],
    [{ priceEgp: "999999999" }, "priceEgp", "price"],
    [{ mileageKm: "-5" }, "mileageKm", "mileage"],
    [{ year: "1900" }, "year", "year"],
    [{ title: "short" }, "title", "titleLength"],
    [{ engineCc: "20" }, "engineCc", "engine"],
    [{ condition: "new", mileageKm: "5000" }, "mileageKm", "newUsedMileage"],
  ])("rejects %o", (patch, field, key) => {
    const r = listingInputSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)[field]).toBe(key);
  });
});

describe("phone", () => {
  it("normalizes Egyptian mobiles", () => {
    expect(normalizeEgyptPhone("+20 100 123 4567")).toBe("01001234567");
    expect(normalizeEgyptPhone("٠١١١٢٣٤٥٦٧٨")).toBe("01112345678");
    expect(normalizeEgyptPhone("0131234567")).toBeNull();
    expect(normalizeEgyptPhone("12345")).toBeNull();
  });
  it("profile schema flags invalid phone", () => {
    const r = profileSchema.safeParse({ name: "Ali", phone: "123", showPhone: "on", locale: "ar" });
    expect(r.success).toBe(false);
  });
});

describe("search params", () => {
  it("drops unsafe values and swaps inverted ranges", () => {
    const f = parseSearchParams({ make: "toyota'; drop", priceMin: "900000", priceMax: "100000", sort: "evil", page: "0", model: "corolla" });
    expect(f.make).toBeUndefined();
    expect(f.model).toBeUndefined(); // model requires make
    expect(f.priceMin).toBe(100000);
    expect(f.priceMax).toBe(900000);
    expect(f.sort).toBe("newest");
    expect(f.page).toBe(1);
  });
  it("round-trips to a query string without defaults", () => {
    expect(toQueryString(parseSearchParams({ make: "kia", sort: "newest", page: "1" }))).toBe("?make=kia");
  });
});

describe("listing state machine", () => {
  it("allows only valid transitions", () => {
    expect(nextStatus("draft", "submit")).toBe("pending_review");
    expect(nextStatus("pending_review", "approve")).toBe("published");
    expect(nextStatus("draft", "approve")).toBeNull();
    expect(nextStatus("published", "markSold")).toBe("sold");
    expect(nextStatus("sold", "submit")).toBeNull();
    expect(nextStatus("rejected", "submit")).toBe("pending_review");
    expect(nextStatus("published", "takeDown")).toBe("rejected");
  });
  it("price-only changes don't need re-review", () => {
    const before = { title: "A car title", priceEgp: 1, trim: null };
    expect(requiresReReview(before, { ...before, priceEgp: 2 })).toBe(false);
    expect(requiresReReview(before, { ...before, title: "Changed title" })).toBe(true);
    expect(requiresReReview({ trim: null }, { trim: undefined })).toBe(false);
  });
  it("visibility", () => {
    expect(isPubliclyVisible("published", null)).toBe(true);
    expect(isPubliclyVisible("pending_review", null)).toBe(false);
    expect(isPubliclyVisible("published", new Date())).toBe(false);
  });
});

describe("helpers", () => {
  it("slugs are url-safe and unique-ish", () => {
    const a = makeListingSlug(2020, "toyota", "corolla");
    expect(a).toMatch(/^2020-toyota-corolla-[a-z2-9]{6}$/);
    expect(makeListingSlug(2020, "toyota", "corolla")).not.toBe(a);
  });
  it("safeNext blocks open redirects", () => {
    expect(safeNext("/ar/sell", "/ar")).toBe("/ar/sell");
    expect(safeNext("//evil.com", "/ar")).toBe("/ar");
    expect(safeNext("https://evil.com", "/ar")).toBe("/ar");
    expect(safeNext("/\\evil.com", "/ar")).toBe("/ar");
  });
  it("formats EGP in both locales with Western digits", () => {
    expect(formatPrice(1150000, "en")).toBe("EGP 1,150,000");
    expect(formatPrice(1150000, "ar")).toBe("1,150,000 جنيه");
    expect(formatCompactPrice(1_500_000, "en")).toBe("1.5M");
  });
});
