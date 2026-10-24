import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  uuid,
  smallint,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", ["user", "dealer", "admin"]);
export const listingStatus = pgEnum("listing_status", [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "sold",
  "archived",
]);
export const vehicleCondition = pgEnum("vehicle_condition", ["new", "used"]);
export const transmission = pgEnum("transmission", ["automatic", "manual"]);
export const fuelType = pgEnum("fuel_type", ["petrol", "diesel", "hybrid", "electric", "natural_gas"]);
export const bodyType = pgEnum("body_type", [
  "sedan",
  "hatchback",
  "suv",
  "crossover",
  "pickup",
  "van",
  "coupe",
  "convertible",
  "wagon",
]);
export const reportReason = pgEnum("report_reason", [
  "scam",
  "wrong_info",
  "duplicate",
  "sold",
  "offensive",
  "other",
]);
export const reportStatus = pgEnum("report_status", ["open", "reviewing", "resolved", "dismissed"]);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export const cities = pgTable("cities", {
  id: smallint().primaryKey(),
  slug: text().notNull().unique(),
  nameEn: text().notNull(),
  nameAr: text().notNull(),
  isLaunch: boolean().notNull().default(false),
  sortOrder: smallint().notNull().default(100),
});

export const vehicleMakes = pgTable("vehicle_makes", {
  id: smallint().primaryKey().generatedAlwaysAsIdentity(),
  slug: text().notNull().unique(),
  nameEn: text().notNull(),
  nameAr: text().notNull(),
  isPopular: boolean().notNull().default(false),
});

export const vehicleModels = pgTable(
  "vehicle_models",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    makeId: smallint()
      .notNull()
      .references(() => vehicleMakes.id, { onDelete: "restrict" }),
    slug: text().notNull(),
    nameEn: text().notNull(),
    nameAr: text().notNull(),
    bodyType: bodyType(),
    /** false = entered by a seller ("model not listed"); verified when an admin approves the listing. */
    isVerified: boolean().notNull().default(true),
    createdById: text(),
  },
  (t) => [uniqueIndex("vehicle_models_make_slug_uq").on(t.makeId, t.slug)],
);

/* ------------------------------------------------------------------ */
/* Auth (Better Auth core tables) + profile fields                     */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    role: userRole().notNull().default("user"),
    phone: text(),
    showPhone: boolean().notNull().default(false),
    cityId: smallint().references(() => cities.id),
    locale: text().notNull().default("ar"),
    suspendedAt: timestamp({ withTimezone: true }),
    suspensionReason: text(),
    ...timestamps,
  },
  (t) => [index("users_role_idx").on(t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const authRateLimits = pgTable("auth_rate_limits", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
});

/* ------------------------------------------------------------------ */
/* Listings                                                            */
/* ------------------------------------------------------------------ */

export const listings = pgTable(
  "listings",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    sellerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    makeId: smallint()
      .notNull()
      .references(() => vehicleMakes.id),
    modelId: integer()
      .notNull()
      .references(() => vehicleModels.id),
    trim: text(),
    year: smallint().notNull(),
    mileageKm: integer().notNull(),
    priceEgp: bigint({ mode: "number" }).notNull(),
    negotiable: boolean().notNull().default(true),
    condition: vehicleCondition().notNull().default("used"),
    transmission: transmission().notNull(),
    fuelType: fuelType().notNull(),
    bodyType: bodyType(),
    color: text(),
    engineCc: integer(),
    title: text().notNull(),
    description: text().notNull().default(""),
    cityId: smallint()
      .notNull()
      .references(() => cities.id),
    area: text(),
    status: listingStatus().notNull().default("draft"),
    rejectionReason: text(),
    submittedAt: timestamp({ withTimezone: true }),
    publishedAt: timestamp({ withTimezone: true }),
    soldAt: timestamp({ withTimezone: true }),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("listings_price_range", sql`${t.priceEgp} > 0 AND ${t.priceEgp} <= 1000000000`),
    check("listings_mileage_range", sql`${t.mileageKm} >= 0 AND ${t.mileageKm} <= 2000000`),
    check("listings_year_range", sql`${t.year} >= 1950 AND ${t.year} <= 2100`),
    check("listings_engine_range", sql`${t.engineCc} IS NULL OR (${t.engineCc} >= 50 AND ${t.engineCc} <= 10000)`),
    index("listings_status_published_idx").on(t.status, t.publishedAt),
    index("listings_make_model_idx").on(t.makeId, t.modelId),
    index("listings_price_idx").on(t.priceEgp),
    index("listings_year_idx").on(t.year),
    index("listings_city_idx").on(t.cityId),
    index("listings_seller_idx").on(t.sellerId),
  ],
);

export const listingImages = pgTable(
  "listing_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    storageKey: text().notNull(),
    thumbKey: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    bytes: integer().notNull(),
    position: smallint().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("listing_images_listing_idx").on(t.listingId, t.position)],
);

export const listingPriceHistory = pgTable(
  "listing_price_history",
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    oldPriceEgp: bigint({ mode: "number" }),
    newPriceEgp: bigint({ mode: "number" }).notNull(),
    changedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("listing_price_history_listing_idx").on(t.listingId, t.changedAt)],
);

/* ------------------------------------------------------------------ */
/* Engagement                                                          */
/* ------------------------------------------------------------------ */

export const favorites = pgTable(
  "favorites",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] }), index("favorites_listing_idx").on(t.listingId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conversations_listing_buyer_uq").on(t.listingId, t.buyerId),
    index("conversations_buyer_idx").on(t.buyerId, t.lastMessageAt),
    index("conversations_seller_idx").on(t.sellerId, t.lastMessageAt),
    check("conversations_distinct_parties", sql`${t.buyerId} <> ${t.sellerId}`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text().notNull(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId, t.createdAt),
    check("messages_body_length", sql`char_length(${t.body}) BETWEEN 1 AND 2000`),
  ],
);

/* ------------------------------------------------------------------ */
/* Trust & operations                                                  */
/* ------------------------------------------------------------------ */

export const reports = pgTable(
  "reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    reporterId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid().references(() => listings.id, { onDelete: "set null" }),
    reportedUserId: text().references(() => users.id, { onDelete: "set null" }),
    reason: reportReason().notNull(),
    details: text(),
    status: reportStatus().notNull().default("open"),
    resolvedById: text().references(() => users.id, { onDelete: "set null" }),
    resolutionNote: text(),
    resolvedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("reports_status_idx").on(t.status, t.createdAt),
    index("reports_listing_idx").on(t.listingId),
    check("reports_has_target", sql`${t.listingId} IS NOT NULL OR ${t.reportedUserId} IS NOT NULL`),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: text().references(() => users.id, { onDelete: "set null" }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text().primaryKey(),
  windowStart: timestamp({ withTimezone: true }).notNull(),
  count: integer().notNull(),
});

/* ------------------------------------------------------------------ */
/* Relations (for the relational query API)                            */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ one, many }) => ({
  city: one(cities, { fields: [users.cityId], references: [cities.id] }),
  listings: many(listings),
}));

export const makesRelations = relations(vehicleMakes, ({ many }) => ({ models: many(vehicleModels) }));
export const modelsRelations = relations(vehicleModels, ({ one }) => ({
  make: one(vehicleMakes, { fields: [vehicleModels.makeId], references: [vehicleMakes.id] }),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
  make: one(vehicleMakes, { fields: [listings.makeId], references: [vehicleMakes.id] }),
  model: one(vehicleModels, { fields: [listings.modelId], references: [vehicleModels.id] }),
  city: one(cities, { fields: [listings.cityId], references: [cities.id] }),
  images: many(listingImages),
  priceHistory: many(listingPriceHistory),
}));

export const listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(listings, { fields: [listingImages.listingId], references: [listings.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  listing: one(listings, { fields: [conversations.listingId], references: [listings.id] }),
  buyer: one(users, { fields: [conversations.buyerId], references: [users.id], relationName: "buyer" }),
  seller: one(users, { fields: [conversations.sellerId], references: [users.id], relationName: "seller" }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id], relationName: "reporter" }),
  listing: one(listings, { fields: [reports.listingId], references: [listings.id] }),
  reportedUser: one(users, { fields: [reports.reportedUserId], references: [users.id], relationName: "reportedUser" }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

export type Listing = typeof listings.$inferSelect;
export type ListingStatus = (typeof listingStatus.enumValues)[number];
export type UserRole = (typeof userRole.enumValues)[number];
