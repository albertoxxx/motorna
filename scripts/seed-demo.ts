/**
 * DEVELOPMENT ONLY. Creates demo accounts, listings and placeholder images so
 * the UI can be exercised locally. Refuses to run against production.
 *
 *   npm run db:seed:demo
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { eq, inArray, like } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, pool, schema } from "./db";

const url = process.env.DATABASE_URL ?? "";
if (process.env.NODE_ENV === "production" || !/localhost|127\.0\.0\.1/.test(url)) {
  console.error("Refusing to seed demo data outside a local database.");
  process.exit(1);
}

const STORAGE_DIR = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage/uploads");
const DEMO_PASSWORD = "motorna-demo-2026";

const DEMO_USERS = [
  { email: "admin@example.com", name: "Admin MOTORNA", role: "admin" as const },
  { email: "karim@example.com", name: "كريم عادل", role: "user" as const, phone: "01001234567", showPhone: true },
  { email: "nour@example.com", name: "نور حسن", role: "user" as const, phone: "01112345678", showPhone: false },
  { email: "omar@example.com", name: "Omar Farouk", role: "user" as const },
];

type Demo = {
  make: string; model: string; year: number; km: number; price: number; trans: "automatic" | "manual";
  fuel?: "petrol" | "diesel" | "hybrid" | "electric" | "natural_gas"; city: number; area?: string; trim?: string;
  color: string; hex: string; cc?: number; seller: number; status?: "published" | "pending_review" | "draft" | "sold";
  condition?: "new" | "used";
};

const DEMO: Demo[] = [
  { make: "toyota", model: "corolla", year: 2021, km: 48000, price: 1_150_000, trans: "automatic", city: 1, area: "سموحة", trim: "Elegance", color: "فضي", hex: "#B8BEC6", cc: 1600, seller: 1 },
  { make: "hyundai", model: "elantra", year: 2022, km: 31000, price: 1_080_000, trans: "automatic", city: 1, area: "سيدي بشر", trim: "CN7", color: "أبيض", hex: "#F1F2F4", cc: 1600, seller: 2 },
  { make: "kia", model: "cerato", year: 2019, km: 92000, price: 760_000, trans: "automatic", city: 1, area: "ميامي", color: "رمادي", hex: "#6B7280", cc: 1600, seller: 1 },
  { make: "nissan", model: "sunny", year: 2020, km: 75000, price: 560_000, trans: "automatic", city: 1, area: "العجمي", color: "أسود", hex: "#1F2937", cc: 1500, seller: 3 },
  { make: "chevrolet", model: "optra", year: 2018, km: 130000, price: 455_000, trans: "manual", city: 4, area: "دمنهور", color: "نبيتي", hex: "#7F1D1D", cc: 1500, seller: 3 },
  { make: "mg", model: "zs", year: 2023, km: 15000, price: 1_020_000, trans: "automatic", city: 2, area: "مدينة نصر", trim: "Luxury", color: "أزرق", hex: "#1E3A8A", cc: 1500, seller: 2 },
  { make: "chery", model: "tiggo-7", year: 2024, km: 9000, price: 1_390_000, trans: "automatic", city: 2, area: "التجمع الخامس", trim: "Pro", color: "أبيض", hex: "#EEF0F2", cc: 1500, seller: 1 },
  { make: "renault", model: "logan", year: 2017, km: 145000, price: 380_000, trans: "manual", city: 1, area: "محرم بك", color: "بيج", hex: "#D6CCB8", cc: 1600, seller: 3 },
  { make: "peugeot", model: "3008", year: 2021, km: 56000, price: 1_650_000, trans: "automatic", city: 3, area: "الشيخ زايد", trim: "Allure", color: "رمادي غامق", hex: "#374151", cc: 1600, seller: 2 },
  { make: "skoda", model: "octavia", year: 2020, km: 68000, price: 1_120_000, trans: "automatic", city: 1, area: "كفر عبده", trim: "A8", color: "أبيض", hex: "#F3F4F6", cc: 1400, seller: 1 },
  { make: "toyota", model: "yaris", year: 2016, km: 110000, price: 520_000, trans: "automatic", city: 1, area: "لوران", color: "أحمر", hex: "#B91C1C", cc: 1300, seller: 3 },
  { make: "hyundai", model: "tucson", year: 2023, km: 22000, price: 2_050_000, trans: "automatic", city: 2, area: "المعادي", trim: "Turbo", color: "أسود", hex: "#111827", cc: 1600, seller: 2 },
  { make: "kia", model: "picanto", year: 2022, km: 28000, price: 610_000, trans: "automatic", city: 1, area: "جليم", color: "فيروزي", hex: "#0E7490", cc: 1200, seller: 1 },
  { make: "mitsubishi", model: "lancer", year: 2015, km: 160000, price: 470_000, trans: "automatic", city: 6, area: "طنطا", color: "فضي", hex: "#A3A9B1", cc: 1600, seller: 3 },
  { make: "suzuki", model: "swift", year: 2021, km: 39000, price: 640_000, trans: "manual", city: 1, area: "المندرة", color: "أزرق فاتح", hex: "#3B82F6", cc: 1200, seller: 2 },
  { make: "toyota", model: "fortuner", year: 2020, km: 88000, price: 2_400_000, trans: "automatic", fuel: "diesel", city: 2, area: "الشروق", color: "أبيض لؤلؤي", hex: "#F8FAFC", cc: 2700, seller: 1 },
  { make: "byd", model: "atto-3", year: 2025, km: 0, price: 1_900_000, trans: "automatic", fuel: "electric", city: 2, area: "القاهرة الجديدة", color: "رمادي", hex: "#64748B", seller: 2, condition: "new" },
  { make: "nissan", model: "qashqai", year: 2019, km: 84000, price: 1_050_000, trans: "automatic", city: 1, area: "سموحة", color: "بني", hex: "#78350F", cc: 1200, seller: 1 },
  // Not public: exercise the moderation queue and owner views.
  { make: "hyundai", model: "accent", year: 2018, km: 99000, price: 520_000, trans: "automatic", city: 1, area: "الإبراهيمية", color: "فضي", hex: "#9CA3AF", cc: 1600, seller: 3, status: "pending_review" },
  { make: "kia", model: "sportage", year: 2021, km: 61000, price: 1_480_000, trans: "automatic", city: 1, area: "رشدي", color: "أبيض", hex: "#F9FAFB", cc: 1600, seller: 2, status: "pending_review" },
  { make: "chevrolet", model: "lanos", year: 2012, km: 210000, price: 240_000, trans: "manual", city: 1, area: "العصافرة", color: "أبيض", hex: "#E5E7EB", cc: 1500, seller: 1, status: "sold" },
];

function carSvg(hex: string, body: string | null, variant: number) {
  const tall = body === "suv" || body === "pickup" || body === "crossover" || body === "van";
  const hatch = body === "hatchback";
  const roof = tall
    ? "M330 330 L420 228 Q440 210 470 208 L770 208 Q800 208 815 228 L880 330 Z"
    : hatch
      ? "M330 345 L430 250 Q450 232 480 232 L760 232 Q800 236 830 270 L880 345 Z"
      : "M300 350 L420 252 Q440 236 470 234 L720 234 Q760 236 790 262 L900 350 Z";
  const top = tall ? 320 : 340;
  const bg = ["#EEF2F6", "#F1F3F5", "#EDF1F7"][variant % 3];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="${bg}"/>
  <rect y="560" width="1200" height="240" fill="#E2E8F0"/>
  <ellipse cx="600" cy="585" rx="430" ry="28" fill="#0F172A" opacity="0.18"/>
  <g transform="translate(${variant === 2 ? 20 : 0},0)">
    <path d="M170 ${top + 60} Q175 ${top} 260 ${top - 6} L940 ${top - 6} Q1030 ${top} 1040 ${top + 60} L1040 520 Q1040 540 1020 540 L180 540 Q160 540 160 520 Z" fill="${hex}" stroke="#0F172A" stroke-opacity="0.25" stroke-width="3"/>
    <path d="${roof}" fill="${hex}" stroke="#0F172A" stroke-opacity="0.25" stroke-width="3"/>
    <path d="${roof}" fill="#0F172A" opacity="0.55" transform="translate(600 ${top}) scale(0.86) translate(-600 -${top}) translate(0 12)"/>
    <line x1="600" y1="${tall ? 222 : 246}" x2="600" y2="${top - 4}" stroke="${hex}" stroke-width="12"/>
    <rect x="170" y="${top + 70}" width="870" height="10" fill="#0F172A" opacity="0.12"/>
    <rect x="1005" y="${top + 40}" width="34" height="22" rx="6" fill="#FDE68A"/>
    <rect x="162" y="${top + 40}" width="26" height="22" rx="6" fill="#DC2626" opacity="0.85"/>
    <circle cx="340" cy="540" r="74" fill="#111827"/><circle cx="340" cy="540" r="38" fill="#9CA3AF"/>
    <circle cx="870" cy="540" r="74" fill="#111827"/><circle cx="870" cy="540" r="38" fill="#9CA3AF"/>
  </g>
  <text x="1170" y="770" text-anchor="end" font-family="sans-serif" font-size="22" fill="#64748B">Demo image · صورة تجريبية</text>
</svg>`;
}

async function writeImage(listingId: string, idx: number, hex: string, body: string | null) {
  const svg = Buffer.from(carSvg(hex, body, idx));
  const id = crypto.randomUUID();
  const storageKey = `listings/${listingId}/${id}.webp`;
  const thumbKey = `listings/${listingId}/${id}_t.webp`;
  const full = await sharp(svg).resize(1200, 800).webp({ quality: 80 }).toBuffer();
  const thumb = await sharp(svg).resize(640, 480, { fit: "cover" }).webp({ quality: 74 }).toBuffer();
  await fs.mkdir(path.join(STORAGE_DIR, "listings", listingId), { recursive: true });
  await fs.writeFile(path.join(STORAGE_DIR, storageKey), full);
  await fs.writeFile(path.join(STORAGE_DIR, thumbKey), thumb);
  return { id, listingId, storageKey, thumbKey, width: 1200, height: 800, bytes: full.byteLength, position: idx };
}

async function main() {
  // Clean previous demo data (cascade removes listings, images, messages…).
  const old = await db.select({ id: schema.users.id }).from(schema.users).where(like(schema.users.email, "%@example.com"));
  if (old.length) {
    await db.delete(schema.users).where(inArray(schema.users.id, old.map((u) => u.id)));
  }

  const hash = await hashPassword(DEMO_PASSWORD);
  const userIds: string[] = [];
  for (const u of DEMO_USERS) {
    const id = crypto.randomUUID();
    await db.insert(schema.users).values({
      id,
      name: u.name,
      email: u.email,
      emailVerified: true,
      role: u.role,
      phone: "phone" in u ? u.phone : null,
      showPhone: "showPhone" in u ? (u.showPhone ?? false) : false,
      cityId: 1,
    });
    await db.insert(schema.accounts).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: hash,
    });
    userIds.push(id);
  }

  const makes = await db.select().from(schema.vehicleMakes);
  const models = await db.select().from(schema.vehicleModels);
  const now = Date.now();
  let n = 0;
  for (const [i, d] of DEMO.entries()) {
    const make = makes.find((m) => m.slug === d.make)!;
    const model = models.find((m) => m.makeId === make.id && m.slug === d.model)!;
    const status = d.status ?? "published";
    const publishedAt = status === "published" || status === "sold" ? new Date(now - i * 7 * 3600_000) : null;
    const title = `${make.nameEn} ${model.nameEn} ${d.year}${d.trim ? ` ${d.trim}` : ""}`;
    const [l] = await db
      .insert(schema.listings)
      .values({
        slug: `${d.year}-${make.slug}-${model.slug}-demo${i}`,
        sellerId: userIds[d.seller],
        makeId: make.id,
        modelId: model.id,
        trim: d.trim ?? null,
        year: d.year,
        mileageKm: d.km,
        priceEgp: d.price,
        negotiable: i % 3 !== 0,
        condition: d.condition ?? "used",
        transmission: d.trans,
        fuelType: d.fuel ?? "petrol",
        bodyType: model.bodyType,
        color: d.color,
        engineCc: d.cc ?? null,
        title,
        description:
          "إعلان تجريبي لأغراض التطوير فقط — ليس عربية حقيقية للبيع.\nDemo listing for development only — not a real car for sale.\n\nصيانة دورية في التوكيل، الفحص متاح في أي مركز يختاره المشتري.",
        cityId: d.city,
        area: d.area ?? null,
        status,
        submittedAt: new Date(now - i * 8 * 3600_000),
        publishedAt,
        soldAt: status === "sold" ? new Date(now - 3600_000) : null,
      })
      .returning({ id: schema.listings.id });
    const imgs = [];
    for (let k = 0; k < 3; k++) imgs.push(await writeImage(l.id, k, d.hex, model.bodyType));
    await db.insert(schema.listingImages).values(imgs);
    await db.insert(schema.listingPriceHistory).values({ listingId: l.id, newPriceEgp: d.price });
    n++;
  }

  // A sample conversation and report for the admin and inbox views.
  const [first] = await db.select().from(schema.listings).where(eq(schema.listings.sellerId, userIds[1])).limit(1);
  const [conv] = await db
    .insert(schema.conversations)
    .values({ listingId: first.id, buyerId: userIds[3], sellerId: userIds[1] })
    .returning();
  await db.insert(schema.messages).values([
    { conversationId: conv.id, senderId: userIds[3], body: "Hi, is the car still available? Can I see it Saturday?" },
    { conversationId: conv.id, senderId: userIds[1], body: "أيوه متاحة. السبت الساعة ٥ في سموحة مناسب؟" },
  ]);
  await db.insert(schema.reports).values({
    reporterId: userIds[3],
    listingId: first.id,
    reportedUserId: userIds[1],
    reason: "wrong_info",
    details: "Demo report: mileage in photos looks different.",
  });

  console.log(`Demo data: ${DEMO_USERS.length} users, ${n} listings.`);
  console.log(`Sign in with any of: ${DEMO_USERS.map((u) => u.email).join(", ")} — password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
