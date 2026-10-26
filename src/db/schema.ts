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
  doublePrecision,
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
    /** Set only after an SMS code sent to `phoneVerifiedNumber` was entered. Changing the phone voids it. */
    phoneVerifiedAt: timestamp({ withTimezone: true }),
    phoneVerifiedNumber: text(),
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
    /** Seller-declared known defects. NULL = seller didn't state any (not "no defects"). */
    knownDefects: text(),
    /** Seller's explicit consent to show their phone to signed-in buyers on this listing. Off by default. */
    showPhone: boolean().notNull().default(false),
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
    check("listings_known_defects_length", sql`${t.knownDefects} IS NULL OR char_length(${t.knownDefects}) <= 2000`),
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

/* ------------------------------------------------------------------ */
/* MOTORNA Care — Stage 1: service centers and approval               */
/* See docs/CARE.md. Status changes are admin-only and always audited. */
/* ------------------------------------------------------------------ */

export const centerStatus = pgEnum("center_status", ["draft", "applied", "under_review", "changes_requested", "approved", "suspended", "revoked", "rejected"]);
export const centerStaffRole = pgEnum("center_staff_role", ["owner", "manager", "technician"]);
export const careCategory = pgEnum("care_category", [
  "pre_purchase_inspection",
  "oil_change",
  "routine_maintenance",
  "diagnostics",
  "brakes",
  "tires",
  "air_conditioning",
  "electrical",
  "bodywork",
  "other",
]);
/** fixed = exact price; estimate = "from" price (optional upper bound); quote = priced after inspection. */
export const priceMode = pgEnum("price_mode", ["fixed", "quote", "estimate"]);
export const credentialKind = pgEnum("credential_kind", ["commercial_register", "tax_card", "brand_authorization", "other", "sample_report"]);
export const reviewState = pgEnum("review_state", ["pending", "accepted", "rejected"]);
/** What kind of provider this is; decides which verification criteria apply. */
export const providerCategory = pgEnum("provider_category", ["authorized_service", "independent_workshop", "inspection_center"]);

export const serviceCenters = pgTable(
  "service_centers",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    nameAr: text().notNull(),
    nameEn: text().notNull(),
    cityId: smallint()
      .notNull()
      .references(() => cities.id),
    area: text(),
    address: text().notNull(),
    phone: text().notNull(),
    email: text(),
    website: text(),
    description: text().notNull().default(""),
    vehicleTypes: text().array().notNull().default(sql`'{}'::text[]`),
    quotationPolicy: text().notNull().default(""),
    category: providerCategory().notNull().default("independent_workshop"),
    /** Optional map pin, parsed from a Google Maps link the center pastes. */
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    status: centerStatus().notNull().default("applied"),
    statusReason: text(),
    approvedAt: timestamp({ withTimezone: true }),
    approvedById: text().references(() => users.id, { onDelete: "set null" }),
    /** Last time an admin approved or reinstated the center after review. */
    lastVerifiedAt: timestamp({ withTimezone: true }),
    submittedAt: timestamp({ withTimezone: true }),
    createdById: text()
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("service_centers_status_idx").on(t.status),
    index("service_centers_city_idx").on(t.cityId),
    index("service_centers_category_idx").on(t.category),
    check("service_centers_coords", sql`(${t.latitude} IS NULL AND ${t.longitude} IS NULL) OR (${t.latitude} BETWEEN 21 AND 32 AND ${t.longitude} BETWEEN 24 AND 37)`),
    check("service_centers_description_length", sql`char_length(${t.description}) <= 3000`),
  ],
);

export const centerStaff = pgTable(
  "center_staff",
  {
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: centerStaffRole().notNull(),
    active: boolean().notNull().default(true),
    addedById: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.centerId, t.userId] }), index("center_staff_user_idx").on(t.userId)],
);

/** Files live in private storage and are only served through an auth-checked route. */
export const centerCredentials = pgTable(
  "center_credentials",
  {
    id: uuid().primaryKey().defaultRandom(),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    kind: credentialKind().notNull(),
    number: text(),
    fileKey: text().notNull(),
    contentType: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    reviewState: reviewState().notNull().default("pending"),
    reviewedById: text().references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp({ withTimezone: true }),
    reviewNote: text(),
    uploadedById: text()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("center_credentials_center_idx").on(t.centerId)],
);

/** The admin's approval checklist: one row per criterion, last write wins (history is in audit_logs). */
export const centerApprovalChecks = pgTable(
  "center_approval_checks",
  {
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    criterion: text().notNull(),
    passed: boolean().notNull(),
    note: text(),
    checkedById: text()
      .notNull()
      .references(() => users.id),
    checkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.centerId, t.criterion] })],
);

export const centerServices = pgTable(
  "center_services",
  {
    id: uuid().primaryKey().defaultRandom(),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    category: careCategory().notNull(),
    nameAr: text().notNull(),
    nameEn: text().notNull(),
    priceMode: priceMode().notNull(),
    priceEgp: integer(),
    /** Upper bound for an estimate (optional). */
    priceMaxEgp: integer(),
    durationMin: smallint().notNull().default(60),
    active: boolean().notNull().default(true),
    /** Whether customers can book this service online (when the center accepts bookings). */
    bookable: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("center_services_center_idx").on(t.centerId),
    check(
      "center_services_price_v2",
      sql`(${t.priceMode}::text = 'quote' AND ${t.priceEgp} IS NULL AND ${t.priceMaxEgp} IS NULL) OR (${t.priceMode}::text = 'fixed' AND ${t.priceEgp} BETWEEN 1 AND 1000000 AND ${t.priceMaxEgp} IS NULL) OR (${t.priceMode}::text = 'estimate' AND ${t.priceEgp} BETWEEN 1 AND 1000000 AND (${t.priceMaxEgp} IS NULL OR ${t.priceMaxEgp} BETWEEN ${t.priceEgp} AND 1000000))`,
    ),
    check("center_services_duration", sql`${t.durationMin} BETWEEN 10 AND 1440`),
  ],
);

export const centerHours = pgTable(
  "center_hours",
  {
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    weekday: smallint().notNull(), // 0 = Sunday … 6 = Saturday
    opens: text().notNull(), // "09:00"
    closes: text().notNull(), // "18:00"
  },
  (t) => [
    primaryKey({ columns: [t.centerId, t.weekday] }),
    check("center_hours_weekday", sql`${t.weekday} BETWEEN 0 AND 6`),
    check("center_hours_format", sql`${t.opens} ~ '^[0-2][0-9]:[0-5][0-9]$' AND ${t.closes} ~ '^[0-2][0-9]:[0-5][0-9]$' AND ${t.opens} < ${t.closes}`),
  ],
);

export const equipmentKind = pgEnum("equipment_kind", [
  "obd_scanner",
  "paint_thickness_gauge",
  "lift",
  "wheel_alignment",
  "tire_changer",
  "ac_service_station",
  "battery_tester",
  "brake_tester",
  "emissions_analyzer",
  "other",
]);

/** Equipment the center declares. Only the admin checklist confirms it (criterion inspection_equipment). */
export const centerEquipment = pgTable(
  "center_equipment",
  {
    id: uuid().primaryKey().defaultRandom(),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    kind: equipmentKind().notNull(),
    details: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("center_equipment_center_idx").on(t.centerId), check("center_equipment_details_length", sql`${t.details} IS NULL OR char_length(${t.details}) <= 200`)],
);

/** Responsible technicians named by the center (may or may not have a MOTORNA account). */
export const centerTechnicians = pgTable(
  "center_technicians",
  {
    id: uuid().primaryKey().defaultRandom(),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    fullName: text().notNull(),
    specialty: text(),
    yearsExperience: smallint(),
    certifications: text(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("center_technicians_center_idx").on(t.centerId),
    check("center_technicians_years", sql`${t.yearsExperience} IS NULL OR ${t.yearsExperience} BETWEEN 0 AND 60`),
  ],
);

/** Internal reviewer notes. Never shown to the center. Append-only by convention (no update/delete path). */
export const centerReviewNotes = pgTable(
  "center_review_notes",
  {
    id: uuid().primaryKey().defaultRandom(),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    authorId: text().references(() => users.id, { onDelete: "set null" }),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("center_review_notes_center_idx").on(t.centerId), check("center_review_notes_length", sql`char_length(${t.body}) BETWEEN 1 AND 2000`)],
);

/** Vehicle makes a center works on (for authorized centers: the makes it is authorized for). */
export const centerMakes = pgTable(
  "center_makes",
  {
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    makeId: smallint()
      .notNull()
      .references(() => vehicleMakes.id),
  },
  (t) => [primaryKey({ columns: [t.centerId, t.makeId] }), index("center_makes_make_idx").on(t.makeId)],
);

/** Real photos uploaded by the center (public bucket, re-encoded, EXIF stripped). */
export const centerPhotos = pgTable(
  "center_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    storageKey: text().notNull(),
    thumbKey: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    position: smallint().notNull().default(0),
    uploadedById: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("center_photos_center_idx").on(t.centerId, t.position)],
);

/**
 * In-app notifications. Text is rendered from `kind` + `data` in the reader's language at display
 * time; `href` is locale-less ("/account/listings/…"). `dedupeKey` collapses repeats while unread
 * (e.g. several messages in one conversation).
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    data: jsonb().$type<Record<string, string | null>>().notNull().default({}),
    href: text().notNull(),
    dedupeKey: text(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("notifications_unread_dedupe_idx").on(t.userId, t.dedupeKey).where(sql`${t.readAt} IS NULL AND ${t.dedupeKey} IS NOT NULL`),
    check("notifications_href_local", sql`${t.href} LIKE '/%' AND ${t.href} NOT LIKE '//%'`),
  ],
);

export type ServiceCenter = typeof serviceCenters.$inferSelect;
export type CenterStatus = (typeof centerStatus.enumValues)[number];
export type CenterStaffRole = (typeof centerStaffRole.enumValues)[number];
export type CareCategory = (typeof careCategory.enumValues)[number];
export type CredentialKind = (typeof credentialKind.enumValues)[number];
export type ProviderCategory = (typeof providerCategory.enumValues)[number];

/* ------------------------------------------------------------------ */
/* MOTORNA Care — bookings and commission (docs/CARE-BOOKING.md)       */
/* Status changes go through src/lib/booking.ts and are always logged. */
/* ------------------------------------------------------------------ */

export const bookingStatus = pgEnum("booking_status", [
  "pending_provider",
  "alternative_proposed",
  "awaiting_customer",
  "confirmed",
  "checked_in",
  "completed",
  "declined",
  "cancelled_customer",
  "cancelled_provider",
  "no_show",
  "expired",
  "disputed",
]);
export const bookingMode = pgEnum("booking_mode", ["slots", "manual"]);
export const timeOptionKind = pgEnum("time_option_kind", ["requested", "proposed"]);
export const timeOptionState = pgEnum("time_option_state", ["open", "accepted", "declined", "withdrawn"]);
export const bookingActorRole = pgEnum("booking_actor_role", ["customer", "provider", "admin", "system"]);
export const disputeKind = pgEnum("dispute_kind", [
  "no_show_dispute",
  "late_cancellation",
  "service_unavailable",
  "completion_disagreement",
  "price_disagreement",
  "conduct",
  "support",
  "other",
]);
export const disputeStatus = pgEnum("dispute_status", ["open", "reviewing", "resolved", "dismissed"]);
export const commissionBasis = pgEnum("commission_basis", ["percent", "fixed"]);
export const agreementStatus = pgEnum("agreement_status", ["draft", "active", "ended"]);
export const ledgerStatus = pgEnum("ledger_status", ["pending_verification", "confirmed", "disputed", "payable", "settled", "waived"]);
export const settlementStatus = pgEnum("settlement_status", ["open", "issued", "settled", "void"]);
export const settlementSchedule = pgEnum("settlement_schedule", ["monthly", "biweekly"]);

/** One row per center. The admin turns the pilot on; the provider decides whether it is accepting. */
export const centerBookingSettings = pgTable(
  "center_booking_settings",
  {
    centerId: uuid()
      .primaryKey()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    pilotEnabled: boolean().notNull().default(false),
    pilotEnabledById: text().references(() => users.id, { onDelete: "set null" }),
    pilotEnabledAt: timestamp({ withTimezone: true }),
    accepting: boolean().notNull().default(false),
    mode: bookingMode().notNull().default("manual"),
    slotIntervalMin: smallint().notNull().default(30),
    capacity: smallint().notNull().default(1),
    minNoticeHours: smallint().notNull().default(4),
    maxAdvanceDays: smallint().notNull().default(30),
    cancelCutoffHours: smallint().notNull().default(12),
    policyAr: text().notNull().default(""),
    policyEn: text().notNull().default(""),
    ...timestamps,
  },
  (t) => [
    check("cbs_interval", sql`${t.slotIntervalMin} IN (15, 30, 60)`),
    check("cbs_capacity", sql`${t.capacity} BETWEEN 1 AND 50`),
    check("cbs_notice", sql`${t.minNoticeHours} BETWEEN 0 AND 168`),
    check("cbs_advance", sql`${t.maxAdvanceDays} BETWEEN 1 AND 90`),
    check("cbs_cutoff", sql`${t.cancelCutoffHours} BETWEEN 0 AND 72`),
    check("cbs_policy_len", sql`char_length(${t.policyAr}) <= 1000 AND char_length(${t.policyEn}) <= 1000`),
  ],
);

/** Blackout periods (holidays, maintenance) during which no time can be booked. */
export const centerClosures = pgTable(
  "center_closures",
  {
    id: uuid().primaryKey().defaultRandom(),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    reason: text(),
    createdById: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("center_closures_center_idx").on(t.centerId, t.startsAt), check("center_closures_range", sql`${t.endsAt} > ${t.startsAt}`)],
);

/** A customer's own vehicles. Private to the owner; providers only see the snapshot on a booking. */
export const customerVehicles = pgTable(
  "customer_vehicles",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    makeId: smallint()
      .notNull()
      .references(() => vehicleMakes.id),
    modelId: integer().references(() => vehicleModels.id),
    year: smallint().notNull(),
    mileageKm: integer(),
    nickname: text(),
    ...timestamps,
  },
  (t) => [
    index("customer_vehicles_user_idx").on(t.userId),
    check("customer_vehicles_year", sql`${t.year} BETWEEN 1950 AND 2100`),
    check("customer_vehicles_mileage", sql`${t.mileageKm} IS NULL OR ${t.mileageKm} BETWEEN 0 AND 3000000`),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid().primaryKey().defaultRandom(),
    reference: text().notNull().unique(),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id),
    serviceId: uuid().references(() => centerServices.id, { onDelete: "set null" }),
    customerId: text()
      .notNull()
      .references(() => users.id),
    vehicleId: uuid().references(() => customerVehicles.id, { onDelete: "set null" }),
    status: bookingStatus().notNull().default("pending_provider"),
    mode: bookingMode().notNull(),
    // Snapshots: what the customer agreed to, even if the provider later edits the service.
    serviceNameAr: text().notNull(),
    serviceNameEn: text().notNull(),
    serviceCategory: careCategory().notNull(),
    priceMode: priceMode().notNull(),
    priceEgp: integer(),
    priceMaxEgp: integer(),
    durationMin: smallint().notNull(),
    vehicleMakeId: smallint()
      .notNull()
      .references(() => vehicleMakes.id),
    vehicleModelId: integer().references(() => vehicleModels.id),
    vehicleModelText: text(),
    vehicleYear: smallint().notNull(),
    vehicleMileageKm: integer(),
    cancelCutoffHours: smallint().notNull(),
    /** Only set once the provider (or the customer accepting a proposal) confirms a time. */
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    contactName: text().notNull(),
    contactPhone: text().notNull(),
    customerNote: text(),
    statusReason: text(),
    lateCancel: boolean().notNull().default(false),
    /** Generated by the booking form; blocks double submission. */
    requestKey: text().notNull(),
    confirmedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    reminderSentAt: timestamp({ withTimezone: true }),
    /** Status to restore if a dispute is dismissed. */
    preDisputeStatus: bookingStatus(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bookings_request_key_uq").on(t.customerId, t.requestKey),
    index("bookings_center_idx").on(t.centerId, t.status, t.startsAt),
    index("bookings_customer_idx").on(t.customerId, t.createdAt),
    check("bookings_time_range", sql`(${t.startsAt} IS NULL AND ${t.endsAt} IS NULL) OR (${t.endsAt} > ${t.startsAt})`),
    check(
      "bookings_confirmed_has_time",
      sql`${t.status}::text NOT IN ('confirmed', 'checked_in', 'completed', 'no_show') OR ${t.startsAt} IS NOT NULL`,
    ),
    check("bookings_note_len", sql`${t.customerNote} IS NULL OR char_length(${t.customerNote}) <= 1000`),
    check("bookings_reference_format", sql`${t.reference} ~ '^MC-[A-Z0-9]{6,10}$'`),
  ],
);

/** Requested (by the customer) and proposed (by the provider) times. Never a confirmed time by itself. */
export const bookingTimeOptions = pgTable(
  "booking_time_options",
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    kind: timeOptionKind().notNull(),
    round: smallint().notNull().default(1),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    state: timeOptionState().notNull().default("open"),
    createdById: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_time_options_booking_idx").on(t.bookingId), check("booking_time_options_range", sql`${t.endsAt} > ${t.startsAt}`)],
);

/** Append-only status history (a trigger blocks UPDATE/DELETE). */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    action: text().notNull(),
    fromStatus: bookingStatus(),
    toStatus: bookingStatus().notNull(),
    actorId: text().references(() => users.id, { onDelete: "set null" }),
    actorRole: bookingActorRole().notNull(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_events_booking_idx").on(t.bookingId, t.createdAt)],
);

/** Questions and replies tied to one booking (provider "ask", customer "reply"). */
export const bookingMessages = pgTable(
  "booking_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    authorId: text().references(() => users.id, { onDelete: "set null" }),
    authorRole: bookingActorRole().notNull(),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_messages_booking_idx").on(t.bookingId, t.createdAt), check("booking_messages_len", sql`char_length(${t.body}) BETWEEN 1 AND 1000`)],
);

/** What the provider recorded after the appointment; also the customer's maintenance record. */
export const serviceCompletions = pgTable(
  "service_completions",
  {
    bookingId: uuid()
      .primaryKey()
      .references(() => bookings.id, { onDelete: "cascade" }),
    attended: boolean().notNull(),
    serviceCompleted: boolean().notNull(),
    finalAmountEgp: integer(),
    workSummary: text(),
    mileageKm: integer(),
    recordedById: text().references(() => users.id, { onDelete: "set null" }),
    recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    customerConfirmedAt: timestamp({ withTimezone: true }),
    /** When the "confirm or report within N days" reminder was sent (once). */
    confirmReminderSentAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check("service_completions_amount", sql`${t.finalAmountEgp} IS NULL OR ${t.finalAmountEgp} BETWEEN 0 AND 5000000`),
    check("service_completions_summary_len", sql`${t.workSummary} IS NULL OR char_length(${t.workSummary}) <= 2000`),
  ],
);

/** One review per completed booking. Ratings are kept separate from verification. */
export const centerReviews = pgTable(
  "center_reviews",
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "cascade" }),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id, { onDelete: "cascade" }),
    customerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: smallint().notNull(),
    comment: text(),
    hidden: boolean().notNull().default(false),
    hiddenReason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("center_reviews_center_idx").on(t.centerId, t.createdAt),
    check("center_reviews_rating", sql`${t.rating} BETWEEN 1 AND 5`),
    check("center_reviews_comment_len", sql`${t.comment} IS NULL OR char_length(${t.comment}) <= 1000`),
  ],
);

export const bookingDisputes = pgTable(
  "booking_disputes",
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    openedById: text().references(() => users.id, { onDelete: "set null" }),
    openedByRole: bookingActorRole().notNull(),
    kind: disputeKind().notNull(),
    description: text().notNull(),
    status: disputeStatus().notNull().default("open"),
    /** Booking status before the dispute; support requests don't change the booking status. */
    priorStatus: bookingStatus(),
    outcomeStatus: bookingStatus(),
    resolution: text(),
    resolvedById: text().references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_disputes_booking_idx").on(t.bookingId),
    index("booking_disputes_status_idx").on(t.status, t.createdAt),
    check("booking_disputes_desc_len", sql`char_length(${t.description}) BETWEEN 5 AND 2000`),
  ],
);

/** Commercial terms per provider. Active agreements are never edited: end one, start the next. */
export const commissionAgreements = pgTable(
  "commission_agreements",
  {
    id: uuid().primaryKey().defaultRandom(),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id),
    status: agreementStatus().notNull().default("draft"),
    basis: commissionBasis().notNull(),
    percentBps: integer(),
    fixedEgp: integer(),
    /** null = every service category. */
    categories: careCategory().array(),
    effectiveFrom: timestamp({ withTimezone: true }).notNull(),
    effectiveTo: timestamp({ withTimezone: true }),
    exceptions: text(),
    settlementSchedule: settlementSchedule().notNull().default("monthly"),
    contractReference: text(),
    createdById: text().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("commission_agreements_center_idx").on(t.centerId, t.status),
    check(
      "commission_agreements_terms",
      sql`(${t.basis}::text = 'percent' AND ${t.percentBps} BETWEEN 1 AND 5000 AND ${t.fixedEgp} IS NULL) OR (${t.basis}::text = 'fixed' AND ${t.fixedEgp} BETWEEN 1 AND 100000 AND ${t.percentBps} IS NULL)`,
    ),
    check("commission_agreements_range", sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
  ],
);

export const commissionSettlements = pgTable(
  "commission_settlements",
  {
    id: uuid().primaryKey().defaultRandom(),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id),
    reference: text().notNull().unique(),
    periodStart: timestamp({ withTimezone: true }).notNull(),
    periodEnd: timestamp({ withTimezone: true }).notNull(),
    totalEgp: integer().notNull(),
    status: settlementStatus().notNull().default("issued"),
    paymentNote: text(),
    settledAt: timestamp({ withTimezone: true }),
    createdById: text().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("commission_settlements_center_idx").on(t.centerId, t.periodStart), check("commission_settlements_range", sql`${t.periodEnd} > ${t.periodStart}`)],
);

/** One row per completed booking (unique). Created only by the completion path; a trigger checks the booking is completed. */
export const commissionLedger = pgTable(
  "commission_ledger",
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .unique()
      .references(() => bookings.id),
    centerId: uuid()
      .notNull()
      .references(() => serviceCenters.id),
    agreementId: uuid()
      .notNull()
      .references(() => commissionAgreements.id),
    bookingReference: text().notNull(),
    source: text().notNull().default("motorna_booking"),
    agreedPriceEgp: integer(),
    completedAmountEgp: integer().notNull(),
    basis: commissionBasis().notNull(),
    percentBps: integer(),
    fixedEgp: integer(),
    commissionEgp: integer().notNull(),
    providerConfirmedAt: timestamp({ withTimezone: true }).notNull(),
    customerConfirmedAt: timestamp({ withTimezone: true }),
    status: ledgerStatus().notNull().default("pending_verification"),
    settlementId: uuid().references(() => commissionSettlements.id),
    completedAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("commission_ledger_center_idx").on(t.centerId, t.completedAt),
    index("commission_ledger_status_idx").on(t.status),
    check("commission_ledger_amounts", sql`${t.completedAmountEgp} >= 0 AND ${t.commissionEgp} BETWEEN 0 AND ${t.completedAmountEgp}`),
  ],
);

/** Append-only corrections to a ledger row (a trigger blocks UPDATE/DELETE). */
export const commissionAdjustments = pgTable(
  "commission_adjustments",
  {
    id: uuid().primaryKey().defaultRandom(),
    ledgerId: uuid()
      .notNull()
      .references(() => commissionLedger.id),
    deltaEgp: integer().notNull(),
    reason: text().notNull(),
    createdById: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("commission_adjustments_ledger_idx").on(t.ledgerId),
    check("commission_adjustments_delta", sql`${t.deltaEgp} <> 0 AND ${t.deltaEgp} BETWEEN -1000000 AND 1000000`),
    check("commission_adjustments_reason_len", sql`char_length(${t.reason}) BETWEEN 3 AND 500`),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type BookingStatusDb = (typeof bookingStatus.enumValues)[number];
export type DisputeKind = (typeof disputeKind.enumValues)[number];
export type LedgerStatus = (typeof ledgerStatus.enumValues)[number];

/* ------------------------------------------------------------------ */
/* Seller verification: phone (SMS code) and vehicle licence review    */
/* ------------------------------------------------------------------ */

/** One-time SMS codes. Only a hash of the code is stored. */
export const phoneVerifications = pgTable(
  "phone_verifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phone: text().notNull(),
    codeHash: text().notNull(),
    attempts: smallint().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("phone_verifications_user_idx").on(t.userId, t.createdAt), check("phone_verifications_attempts", sql`${t.attempts} BETWEEN 0 AND 10`)],
);

export const licenceCheckStatus = pgEnum("licence_check_status", ["pending", "accepted", "rejected"]);

/**
 * A seller's vehicle licence (رخصة العربية) submitted for one listing. Files live in private storage,
 * are visible only to the seller and admins, and are deleted 30 days after the decision.
 * The badge holds only while the listing still matches the make/model/year snapshot.
 */
export const listingLicenceChecks = pgTable(
  "listing_licence_checks",
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    frontKey: text(),
    backKey: text(),
    frontType: text(),
    backType: text(),
    status: licenceCheckStatus().notNull().default("pending"),
    snapshotMakeId: smallint().notNull(),
    snapshotModelId: integer(),
    snapshotYear: smallint().notNull(),
    licenceExpiresAt: timestamp({ withTimezone: true }),
    reviewNote: text(),
    reviewedById: text().references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp({ withTimezone: true }),
    submittedById: text()
      .notNull()
      .references(() => users.id),
    filesPurgedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("listing_licence_checks_listing_idx").on(t.listingId, t.createdAt),
    index("listing_licence_checks_status_idx").on(t.status, t.createdAt),
    uniqueIndex("listing_licence_checks_one_pending").on(t.listingId).where(sql`${t.status} = 'pending'`),
    check("listing_licence_checks_note_len", sql`${t.reviewNote} IS NULL OR char_length(${t.reviewNote}) <= 500`),
  ],
);
