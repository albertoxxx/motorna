import { z } from "zod";

/** Error messages are keys into dict.validation so they can be localized on the client. */
export type ValidationKey =
  | "required"
  | "year"
  | "mileage"
  | "price"
  | "engine"
  | "titleLength"
  | "descriptionLength"
  | "phone"
  | "modelMismatch"
  | "email"
  | "nameLength"
  | "messageLength"
  | "newUsedMileage"
  | "modelOther"
  | "knownDefectsLength"
  | "trimIsEngine"
  | "centerName"
  | "address"
  | "website"
  | "acceptTerms"
  | "serviceName"
  | "servicePrice"
  | "serviceDuration"
  | "hours"
  | "equipmentDetails"
  | "technicianName"
  | "technicianYears";

export const CONDITIONS = ["new", "used"] as const;
export const TRANSMISSIONS = ["automatic", "manual"] as const;
export const FUELS = ["petrol", "diesel", "hybrid", "electric", "natural_gas"] as const;
export const BODIES = ["sedan", "hatchback", "suv", "crossover", "pickup", "van", "coupe", "convertible", "wagon"] as const;
export const REPORT_REASONS = ["scam", "wrong_info", "duplicate", "sold", "offensive", "other"] as const;

export const MIN_PRICE = 10_000;
export const MAX_PRICE = 100_000_000;
export const MIN_YEAR = 1970;
export const maxYear = () => new Date().getFullYear() + 1;

/** Egyptian mobile: 010/011/012/015 + 8 digits. Accepts +20 / 0020 prefixes. */
export function normalizeEgyptPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, "").replace(/^(\+20|0020)/, "0");
  const western = digits.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return /^01[0125]\d{8}$/.test(western) ? western : null;
}

const toInt = (key: ValidationKey) =>
  z.preprocess(
    (v) => {
      if (typeof v === "string") {
        const s = v.replace(/[,\s٬]/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
        return s === "" ? undefined : Number(s);
      }
      return v;
    },
    z.number({ error: key }).int({ error: key }),
  );

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : v), z.string().max(max).optional());

/**
 * True when a "trim" value is only an engine size ("3000cc", "1.6", "2.0 L", "1600 سي سي").
 * Engine size has its own field; keeping it out of trim keeps cards and search accurate.
 */
export function looksLikeEngineSize(v: string) {
  const s = v.trim().toLowerCase().replace(/\s+/g, " ");
  return /^\d{3,5} ?(cc|c\.c\.?|سي ?سي|سى ?سى|cm3)?$/.test(s) || /^\d(?:[.,]\d)? ?(l|lt|liter|litre|لتر|t|turbo|تيربو)?$/.test(s);
}

export const listingInputSchema = z
  .object({
    makeId: toInt("required").pipe(z.number().positive({ error: "required" })),
    // A catalog model, or "other" with a seller-typed name in modelOther.
    modelId: z.preprocess(
      (v) => (v === "other" || v === "" || v == null ? undefined : v),
      toInt("required").pipe(z.number().positive({ error: "required" })).optional(),
    ),
    modelOther: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") || undefined : undefined),
      z.string().min(1, { error: "modelOther" }).max(40, { error: "modelOther" }).optional(),
    ),
    trim: optionalText(60).refine((v) => !v || !looksLikeEngineSize(v), { error: "trimIsEngine" }),
    year: toInt("year").pipe(z.number().min(MIN_YEAR, { error: "year" }).max(maxYear(), { error: "year" })),
    mileageKm: toInt("mileage").pipe(z.number().min(0, { error: "mileage" }).max(2_000_000, { error: "mileage" })),
    priceEgp: toInt("price").pipe(z.number().min(MIN_PRICE, { error: "price" }).max(MAX_PRICE, { error: "price" })),
    negotiable: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
    condition: z.enum(CONDITIONS, { error: "required" }),
    transmission: z.enum(TRANSMISSIONS, { error: "required" }),
    fuelType: z.enum(FUELS, { error: "required" }),
    bodyType: z.preprocess((v) => (v === "" ? undefined : v), z.enum(BODIES).optional()),
    color: optionalText(30),
    engineCc: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : v),
      toInt("engine").pipe(z.number().min(50, { error: "engine" }).max(10_000, { error: "engine" })).optional(),
    ),
    cityId: toInt("required").pipe(z.number().positive({ error: "required" })),
    area: optionalText(60),
    title: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ error: "titleLength" }).min(10, { error: "titleLength" }).max(100, { error: "titleLength" }),
    ),
    description: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : ""),
      z.string().max(5000, { error: "descriptionLength" }),
    ),
    knownDefects: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() || undefined : undefined),
      z.string().max(2000, { error: "knownDefectsLength" }).optional(),
    ),
    /** Explicit, optional consent; anything but a clear "yes" means no. */
    showPhone: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()).default(false),
    /** Seller's mobile, only needed (and saved to their profile) when showPhone is on. */
    sellerPhone: z.preprocess(
      (v) => (typeof v === "string" && v.trim() !== "" ? v : undefined),
      z
        .string()
        .transform((s, ctx) => {
          const n = normalizeEgyptPhone(s);
          if (!n) {
            ctx.addIssue({ code: "custom", message: "phone" });
            return z.NEVER;
          }
          return n;
        })
        .optional(),
    ),
  })
  .superRefine((v, ctx) => {
    if (!v.modelId && !v.modelOther) {
      ctx.addIssue({ code: "custom", path: [v.modelOther === undefined && v.modelId === undefined ? "modelId" : "modelOther"], message: "required" });
    }
    if (v.condition === "new" && v.mileageKm >= 1000) {
      ctx.addIssue({ code: "custom", path: ["mileageKm"], message: "newUsedMileage" });
    }
  });

export type ListingInput = z.infer<typeof listingInputSchema>;

export const MIN_DESCRIPTION_FOR_SUBMIT = 30;

export const profileSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string({ error: "nameLength" }).min(2, { error: "nameLength" }).max(60, { error: "nameLength" }),
  ),
  phone: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .transform((s, ctx) => {
        const n = normalizeEgyptPhone(s);
        if (!n) {
          ctx.addIssue({ code: "custom", message: "phone" });
          return z.NEVER;
        }
        return n;
      })
      .optional(),
  ),
  showPhone: z.preprocess((v) => v === true || v === "on", z.boolean()),
  cityId: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().positive().optional()),
  locale: z.enum(["ar", "en"]),
});

export const messageSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.string({ error: "messageLength" }).min(1, { error: "messageLength" }).max(2000, { error: "messageLength" }),
);

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS, { error: "required" }),
  details: optionalText(1000),
});

/** Flatten zod issues into { field: validationKey } (first issue per field). */
export function fieldErrors(error: z.ZodError): Record<string, ValidationKey> {
  const out: Record<string, ValidationKey> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "_form");
    if (!out[field]) out[field] = (issue.message as ValidationKey) || "required";
  }
  return out;
}
