-- MOTORNA database setup (generated 2026-10-24)
-- Paste into Supabase → SQL Editor → Run. Safe to run once on an empty project.
BEGIN;

-- 0000_init.sql
CREATE TYPE "public"."body_type" AS ENUM('sedan', 'hatchback', 'suv', 'crossover', 'pickup', 'van', 'coupe', 'convertible', 'wagon');
CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel', 'hybrid', 'electric', 'natural_gas');
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'published', 'rejected', 'sold', 'archived');
CREATE TYPE "public"."report_reason" AS ENUM('scam', 'wrong_info', 'duplicate', 'sold', 'offensive', 'other');
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE "public"."transmission" AS ENUM('automatic', 'manual');
CREATE TYPE "public"."user_role" AS ENUM('user', 'dealer', 'admin');
CREATE TYPE "public"."vehicle_condition" AS ENUM('new', 'used');
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "auth_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);

CREATE TABLE "cities" (
	"id" smallint PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"is_launch" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 100 NOT NULL,
	CONSTRAINT "cities_slug_unique" UNIQUE("slug")
);

CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_distinct_parties" CHECK ("conversations"."buyer_id" <> "conversations"."seller_id")
);

CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);

CREATE TABLE "listing_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"thumb_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "listing_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"old_price_egp" bigint,
	"new_price_egp" bigint NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"seller_id" text NOT NULL,
	"make_id" smallint NOT NULL,
	"model_id" integer NOT NULL,
	"trim" text,
	"year" smallint NOT NULL,
	"mileage_km" integer NOT NULL,
	"price_egp" bigint NOT NULL,
	"negotiable" boolean DEFAULT true NOT NULL,
	"condition" "vehicle_condition" DEFAULT 'used' NOT NULL,
	"transmission" "transmission" NOT NULL,
	"fuel_type" "fuel_type" NOT NULL,
	"body_type" "body_type",
	"color" text,
	"engine_cc" integer,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"city_id" smallint NOT NULL,
	"area" text,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_slug_unique" UNIQUE("slug"),
	CONSTRAINT "listings_price_range" CHECK ("listings"."price_egp" > 0 AND "listings"."price_egp" <= 1000000000),
	CONSTRAINT "listings_mileage_range" CHECK ("listings"."mileage_km" >= 0 AND "listings"."mileage_km" <= 2000000),
	CONSTRAINT "listings_year_range" CHECK ("listings"."year" >= 1950 AND "listings"."year" <= 2100),
	CONSTRAINT "listings_engine_range" CHECK ("listings"."engine_cc" IS NULL OR ("listings"."engine_cc" >= 50 AND "listings"."engine_cc" <= 10000))
);

CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_body_length" CHECK (char_length("messages"."body") BETWEEN 1 AND 2000)
);

CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);

CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" text NOT NULL,
	"listing_id" uuid,
	"reported_user_id" text,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by_id" text,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_has_target" CHECK ("reports"."listing_id" IS NOT NULL OR "reports"."reported_user_id" IS NOT NULL)
);

CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);

CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"phone" text,
	"show_phone" boolean DEFAULT false NOT NULL,
	"city_id" smallint,
	"locale" text DEFAULT 'ar' NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "vehicle_makes" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_makes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	CONSTRAINT "vehicle_makes_slug_unique" UNIQUE("slug")
);

CREATE TABLE "vehicle_models" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_models_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"make_id" smallint NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"body_type" "body_type"
);

CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "listing_price_history" ADD CONSTRAINT "listing_price_history_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "listings" ADD CONSTRAINT "listings_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "listings" ADD CONSTRAINT "listings_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "listings" ADD CONSTRAINT "listings_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE restrict ON UPDATE no action;
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");
CREATE UNIQUE INDEX "conversations_listing_buyer_uq" ON "conversations" USING btree ("listing_id","buyer_id");
CREATE INDEX "conversations_buyer_idx" ON "conversations" USING btree ("buyer_id","last_message_at");
CREATE INDEX "conversations_seller_idx" ON "conversations" USING btree ("seller_id","last_message_at");
CREATE INDEX "favorites_listing_idx" ON "favorites" USING btree ("listing_id");
CREATE INDEX "listing_images_listing_idx" ON "listing_images" USING btree ("listing_id","position");
CREATE INDEX "listing_price_history_listing_idx" ON "listing_price_history" USING btree ("listing_id","changed_at");
CREATE INDEX "listings_status_published_idx" ON "listings" USING btree ("status","published_at");
CREATE INDEX "listings_make_model_idx" ON "listings" USING btree ("make_id","model_id");
CREATE INDEX "listings_price_idx" ON "listings" USING btree ("price_egp");
CREATE INDEX "listings_year_idx" ON "listings" USING btree ("year");
CREATE INDEX "listings_city_idx" ON "listings" USING btree ("city_id");
CREATE INDEX "listings_seller_idx" ON "listings" USING btree ("seller_id");
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");
CREATE INDEX "reports_listing_idx" ON "reports" USING btree ("listing_id");
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
CREATE UNIQUE INDEX "vehicle_models_make_slug_uq" ON "vehicle_models" USING btree ("make_id","slug");
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");

-- 0001_seller_models.sql
ALTER TABLE "vehicle_models" ADD COLUMN "is_verified" boolean DEFAULT true NOT NULL;
ALTER TABLE "vehicle_models" ADD COLUMN "created_by_id" text;

-- Reference data: governorates
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (1, 'alexandria', 'Alexandria', 'الإسكندرية', true, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (2, 'cairo', 'Cairo', 'القاهرة', false, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (3, 'giza', 'Giza', 'الجيزة', false, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (4, 'beheira', 'Beheira', 'البحيرة', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (5, 'matrouh', 'Matrouh', 'مطروح', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (6, 'gharbia', 'Gharbia', 'الغربية', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (7, 'kafr-el-sheikh', 'Kafr El Sheikh', 'كفر الشيخ', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (8, 'dakahlia', 'Dakahlia', 'الدقهلية', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (9, 'damietta', 'Damietta', 'دمياط', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (10, 'sharqia', 'Sharqia', 'الشرقية', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (11, 'qalyubia', 'Qalyubia', 'القليوبية', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (12, 'monufia', 'Monufia', 'المنوفية', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (13, 'port-said', 'Port Said', 'بورسعيد', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (14, 'ismailia', 'Ismailia', 'الإسماعيلية', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (15, 'suez', 'Suez', 'السويس', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (16, 'faiyum', 'Faiyum', 'الفيوم', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (17, 'beni-suef', 'Beni Suef', 'بني سويف', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (18, 'minya', 'Minya', 'المنيا', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (19, 'asyut', 'Asyut', 'أسيوط', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (20, 'sohag', 'Sohag', 'سوهاج', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (21, 'qena', 'Qena', 'قنا', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (22, 'luxor', 'Luxor', 'الأقصر', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (23, 'aswan', 'Aswan', 'أسوان', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (24, 'red-sea', 'Red Sea', 'البحر الأحمر', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (25, 'new-valley', 'New Valley', 'الوادي الجديد', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (26, 'north-sinai', 'North Sinai', 'شمال سيناء', false, 10) ON CONFLICT (id) DO NOTHING;
INSERT INTO cities (id, slug, name_en, name_ar, is_launch, sort_order) VALUES (27, 'south-sinai', 'South Sinai', 'جنوب سيناء', false, 10) ON CONFLICT (id) DO NOTHING;

-- Reference data: makes and models
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('toyota', 'Toyota', 'تويوتا', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'corolla', 'Corolla', 'كورولا', 'sedan' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'corolla-cross', 'Corolla Cross', 'كورولا كروس', 'crossover' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'yaris', 'Yaris', 'ياريس', 'hatchback' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'yaris-sedan', 'Yaris Sedan', 'ياريس سيدان', 'sedan' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'belta', 'Belta', 'بلتا', 'sedan' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rumion', 'Rumion', 'روميون', 'van' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'avanza', 'Avanza', 'أفانزا', 'van' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'veloz', 'Veloz', 'فيلوز', 'van' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rush', 'Rush', 'راش', 'suv' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'raize', 'Raize', 'رايز', 'crossover' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c-hr', 'C-HR', 'سي إتش آر', 'crossover' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rav4', 'RAV4', 'راف فور', 'suv' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'fortuner', 'Fortuner', 'فورتشنر', 'suv' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'hilux', 'Hilux', 'هايلكس', 'pickup' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'camry', 'Camry', 'كامري', 'sedan' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'prado', 'Land Cruiser Prado', 'برادو', 'suv' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'land-cruiser', 'Land Cruiser', 'لاند كروزر', 'suv' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'hiace', 'Hiace', 'هاي إس', 'van' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'chr-hybrid', 'C-HR Hybrid', 'C-HR Hybrid', 'crossover' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'prius', 'Prius', 'بريوس', 'hatchback' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'auris', 'Auris', 'أوريس', 'hatchback' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'echo', 'Echo', 'إيكو', 'sedan' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('hyundai', 'Hyundai', 'هيونداي', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'elantra', 'Elantra', 'إلنترا', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'elantra-hd', 'Elantra HD', 'إلنترا HD', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'elantra-ad', 'Elantra AD', 'إلنترا AD', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'elantra-cn7', 'Elantra CN7', 'إلنترا CN7', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'accent', 'Accent', 'أكسنت', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'accent-rb', 'Accent RB', 'أكسنت RB', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'verna', 'Verna', 'فيرنا', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'i10', 'i10', 'آي 10', 'hatchback' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'grand-i10', 'Grand i10', 'جراند آي 10', 'hatchback' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'i20', 'i20', 'آي 20', 'hatchback' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'i30', 'i30', 'آي 30', 'hatchback' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'matrix', 'Matrix', 'ماتريكس', 'van' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'getz', 'Getz', 'جيتز', 'hatchback' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tucson', 'Tucson', 'توسان', 'suv' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'creta', 'Creta', 'كريتا', 'crossover' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'bayon', 'Bayon', 'بايون', 'crossover' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'venue', 'Venue', 'فينيو', 'crossover' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'kona', 'Kona', 'كونا', 'crossover' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'santa-fe', 'Santa Fe', 'سانتا في', 'suv' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sonata', 'Sonata', 'سوناتا', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'azera', 'Azera', 'أزيرا', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'staria', 'Staria', 'ستاريا', 'van' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'h1', 'H-1', 'H1', 'van' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ioniq-5', 'Ioniq 5', 'أيونيك 5', 'crossover' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('kia', 'Kia', 'كيا', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cerato', 'Cerato', 'سيراتو', 'sedan' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'k3', 'K3', 'K3', 'sedan' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'k5', 'K5', 'K5', 'sedan' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'pegas', 'Pegas', 'بيجاس', 'sedan' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'picanto', 'Picanto', 'بيكانتو', 'hatchback' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rio', 'Rio', 'ريو', 'hatchback' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'soul', 'Soul', 'سول', 'crossover' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sportage', 'Sportage', 'سبورتاج', 'suv' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'seltos', 'Seltos', 'سيلتوس', 'crossover' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sonet', 'Sonet', 'سونيت', 'crossover' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xceed', 'XCeed', 'إكسيد', 'crossover' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sorento', 'Sorento', 'سورينتو', 'suv' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'carens', 'Carens', 'كارينز', 'van' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'carnival', 'Carnival', 'كرنفال', 'van' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'optima', 'Optima', 'أوبتيما', 'sedan' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'spectra', 'Spectra', 'سبكترا', 'sedan' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ev6', 'EV6', 'EV6', 'crossover' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('nissan', 'Nissan', 'نيسان', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sunny', 'Sunny', 'صني', 'sedan' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sentra', 'Sentra', 'سنترا', 'sedan' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiida', 'Tiida', 'تيدا', 'hatchback' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'micra', 'Micra', 'ميكرا', 'hatchback' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'qashqai', 'Qashqai', 'قاشقاي', 'crossover' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'juke', 'Juke', 'جوك', 'crossover' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'kicks', 'Kicks', 'كيكس', 'crossover' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x-trail', 'X-Trail', 'إكس تريل', 'suv' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'patrol', 'Patrol', 'باترول', 'suv' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'navara', 'Navara', 'نافارا', 'pickup' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'pickup', 'Pick-up', 'بيك أب', 'pickup' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'altima', 'Altima', 'ألتيما', 'sedan' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'maxima', 'Maxima', 'ماكسيما', 'sedan' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'urvan', 'Urvan', 'أورفان', 'van' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('chevrolet', 'Chevrolet', 'شيفروليه', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'optra', 'Optra', 'أوبترا', 'sedan' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'aveo', 'Aveo', 'أفيو', 'sedan' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'lanos', 'Lanos', 'لانوس', 'sedan' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cruze', 'Cruze', 'كروز', 'sedan' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'spark', 'Spark', 'سبارك', 'hatchback' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'captiva', 'Captiva', 'كابتيفا', 'suv' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'groove', 'Groove', 'جروف', 'crossover' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'trax', 'Trax', 'تراكس', 'crossover' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'malibu', 'Malibu', 'ماليبو', 'sedan' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tahoe', 'Tahoe', 'تاهو', 'suv' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'n300', 'N300', 'N300', 'van' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 't-series', 'T-Series', 'T-Series', 'pickup' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'dmax', 'D-Max', 'دي ماكس', 'pickup' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('mg', 'MG', 'إم جي', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'zs', 'ZS', 'زد إس', 'crossover' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'zs-ev', 'ZS EV', 'ZS EV', 'crossover' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mg3', 'MG3', 'إم جي 3', 'hatchback' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mg4', 'MG4', 'إم جي 4', 'hatchback' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mg5', 'MG5', 'إم جي 5', 'sedan' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mg6', 'MG6', 'إم جي 6', 'sedan' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mg7', 'MG7', 'إم جي 7', 'sedan' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gt', 'GT', 'GT', 'sedan' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rx5', 'RX5', 'آر إكس 5', 'suv' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rx8', 'RX8', 'آر إكس 8', 'suv' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'hs', 'HS', 'إتش إس', 'suv' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'one', 'One', 'وان', 'crossover' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'whale', 'Whale', 'Whale', 'crossover' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('chery', 'Chery', 'شيري', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-2', 'Tiggo 2', 'تيجو 2', 'crossover' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-3', 'Tiggo 3', 'تيجو 3', 'crossover' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-4', 'Tiggo 4', 'تيجو 4', 'crossover' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-4-pro', 'Tiggo 4 Pro', 'تيجو 4 برو', 'crossover' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-7', 'Tiggo 7', 'تيجو 7', 'suv' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-7-pro', 'Tiggo 7 Pro', 'تيجو 7 برو', 'suv' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-8', 'Tiggo 8', 'تيجو 8', 'suv' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-8-pro', 'Tiggo 8 Pro', 'تيجو 8 برو', 'suv' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'arrizo-5', 'Arrizo 5', 'أريزو 5', 'sedan' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'arrizo-6', 'Arrizo 6', 'أريزو 6', 'sedan' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'envy', 'Envy', 'إنفي', 'sedan' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a11', 'A11', 'A11', 'sedan' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a15', 'A15', 'A15', 'sedan' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('renault', 'Renault', 'رينو', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'logan', 'Logan', 'لوجان', 'sedan' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sandero', 'Sandero', 'سانديرو', 'hatchback' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sandero-stepway', 'Sandero Stepway', 'سانديرو ستيب واي', 'hatchback' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'duster', 'Duster', 'داستر', 'suv' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'megane', 'Megane', 'ميجان', 'sedan' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'fluence', 'Fluence', 'فلوانس', 'sedan' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'kadjar', 'Kadjar', 'كادجار', 'crossover' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'austral', 'Austral', 'أوسترال', 'crossover' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'captur', 'Captur', 'كابتشر', 'crossover' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'clio', 'Clio', 'كليو', 'hatchback' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'taliant', 'Taliant', 'تاليانت', 'sedan' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'koleos', 'Koleos', 'كوليوس', 'suv' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('peugeot', 'Peugeot', 'بيجو', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '208', '208', '208', 'hatchback' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '301', '301', '301', 'sedan' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '308', '308', '308', 'hatchback' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '408', '408', '408', 'sedan' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '508', '508', '508', 'sedan' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '2008', '2008', '2008', 'crossover' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '3008', '3008', '3008', 'suv' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '5008', '5008', '5008', 'suv' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '405', '405', '405', 'sedan' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '406', '406', '406', 'sedan' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '206', '206', '206', 'hatchback' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '207', '207', '207', 'hatchback' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'partner', 'Partner', 'بارتنر', 'van' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('skoda', 'Skoda', 'سكودا', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'octavia', 'Octavia', 'أوكتافيا', 'sedan' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'fabia', 'Fabia', 'فابيا', 'hatchback' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rapid', 'Rapid', 'رابيد', 'sedan' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'scala', 'Scala', 'سكالا', 'hatchback' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'superb', 'Superb', 'سوبيرب', 'sedan' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'kamiq', 'Kamiq', 'كاميك', 'crossover' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'karoq', 'Karoq', 'كاروك', 'suv' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'kodiaq', 'Kodiaq', 'كودياك', 'suv' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'roomster', 'Roomster', 'رومستر', 'van' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('mitsubishi', 'Mitsubishi', 'ميتسوبيشي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'lancer', 'Lancer', 'لانسر', 'sedan' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'lancer-shark', 'Lancer Shark', 'لانسر شارك', 'sedan' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'attrage', 'Attrage', 'أتراج', 'sedan' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mirage', 'Mirage', 'ميراج', 'hatchback' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'eclipse-cross', 'Eclipse Cross', 'إكليبس كروس', 'crossover' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'asx', 'ASX', 'ASX', 'crossover' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'outlander', 'Outlander', 'أوتلاندر', 'suv' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'pajero', 'Pajero', 'باجيرو', 'suv' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'pajero-sport', 'Pajero Sport', 'باجيرو سبورت', 'suv' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xpander', 'Xpander', 'إكسباندر', 'van' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'l200', 'L200', 'L200', 'pickup' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('suzuki', 'Suzuki', 'سوزوكي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'swift', 'Swift', 'سويفت', 'hatchback' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'dzire', 'Dzire', 'ديزاير', 'sedan' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ciaz', 'Ciaz', 'سياز', 'sedan' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'alto', 'Alto', 'ألتو', 'hatchback' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'celerio', 'Celerio', 'سيليريو', 'hatchback' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'baleno', 'Baleno', 'بالينو', 'hatchback' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ertiga', 'Ertiga', 'إرتيجا', 'van' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xl7', 'XL7', 'XL7', 'van' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'vitara', 'Vitara', 'فيتارا', 'suv' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'grand-vitara', 'Grand Vitara', 'جراند فيتارا', 'suv' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's-presso', 'S-Presso', 'إس بريسو', 'hatchback' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'jimny', 'Jimny', 'جيمني', 'suv' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'fronx', 'Fronx', 'فرونكس', 'crossover' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'apv', 'APV', 'APV', 'van' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('honda', 'Honda', 'هوندا', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'civic', 'Civic', 'سيفيك', 'sedan' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'city', 'City', 'سيتي', 'sedan' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'accord', 'Accord', 'أكورد', 'sedan' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'jazz', 'Jazz', 'جاز', 'hatchback' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'hr-v', 'HR-V', 'HR-V', 'crossover' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cr-v', 'CR-V', 'سي آر في', 'suv' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'zr-v', 'ZR-V', 'ZR-V', 'crossover' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'pilot', 'Pilot', 'بايلوت', 'suv' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('mercedes-benz', 'Mercedes-Benz', 'مرسيدس بنز', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a-class', 'A-Class', 'A-Class', 'hatchback' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c-class', 'C-Class', 'C-Class', 'sedan' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'e-class', 'E-Class', 'E-Class', 'sedan' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's-class', 'S-Class', 'S-Class', 'sedan' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cla', 'CLA', 'CLA', 'sedan' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cls', 'CLS', 'CLS', 'sedan' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gla', 'GLA', 'GLA', 'crossover' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'glb', 'GLB', 'GLB', 'suv' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'glc', 'GLC', 'GLC', 'suv' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'glc-coupe', 'GLC Coupe', 'GLC Coupe', 'suv' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gle', 'GLE', 'GLE', 'suv' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gls', 'GLS', 'GLS', 'suv' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'g-class', 'G-Class', 'G-Class', 'suv' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'eqa', 'EQA', 'EQA', 'crossover' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'eqb', 'EQB', 'EQB', 'suv' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'eqe', 'EQE', 'EQE', 'sedan' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'eqs', 'EQS', 'EQS', 'sedan' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'v-class', 'V-Class', 'V-Class', 'van' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'vito', 'Vito', 'Vito', 'van' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sprinter', 'Sprinter', 'Sprinter', 'van' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('bmw', 'BMW', 'بي إم دبليو', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '1-series', '1 Series', 'الفئة الأولى', 'hatchback' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '2-series', '2 Series', 'الفئة الثانية', 'coupe' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '2-series-gran-coupe', '2 Series Gran Coupe', '2 Series Gran Coupe', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '3-series', '3 Series', 'الفئة الثالثة', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '4-series', '4 Series', 'الفئة الرابعة', 'coupe' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '5-series', '5 Series', 'الفئة الخامسة', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '6-series', '6 Series', 'الفئة السادسة', 'coupe' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '7-series', '7 Series', 'الفئة السابعة', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '8-series', '8 Series', 'الفئة الثامنة', 'coupe' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x1', 'X1', 'X1', 'crossover' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x2', 'X2', 'X2', 'crossover' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x3', 'X3', 'X3', 'suv' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x4', 'X4', 'X4', 'suv' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x5', 'X5', 'X5', 'suv' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x6', 'X6', 'X6', 'suv' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x7', 'X7', 'X7', 'suv' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xm', 'XM', 'XM', 'suv' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'z4', 'Z4', 'Z4', 'convertible' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'i3', 'i3', 'i3', 'hatchback' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'i4', 'i4', 'i4', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'i5', 'i5', 'i5', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'i7', 'i7', 'i7', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ix', 'iX', 'iX', 'suv' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ix1', 'iX1', 'iX1', 'crossover' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ix3', 'iX3', 'iX3', 'suv' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'm2', 'M2', 'M2', 'coupe' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'm3', 'M3', 'M3', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'm4', 'M4', 'M4', 'coupe' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'm5', 'M5', 'M5', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('audi', 'Audi', 'أودي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a1', 'A1', 'A1', 'hatchback' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a3', 'A3', 'A3', 'sedan' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a4', 'A4', 'A4', 'sedan' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a5', 'A5', 'A5', 'coupe' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a6', 'A6', 'A6', 'sedan' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a7', 'A7', 'A7', 'sedan' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a8', 'A8', 'A8', 'sedan' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'q2', 'Q2', 'Q2', 'crossover' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'q3', 'Q3', 'Q3', 'suv' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'q5', 'Q5', 'Q5', 'suv' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'q7', 'Q7', 'Q7', 'suv' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'q8', 'Q8', 'Q8', 'suv' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'e-tron', 'e-tron', 'e-tron', 'suv' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'q4-e-tron', 'Q4 e-tron', 'Q4 e-tron', 'suv' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tt', 'TT', 'TT', 'coupe' FROM vehicle_makes WHERE slug = 'audi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('volkswagen', 'Volkswagen', 'فولكس فاجن', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'passat', 'Passat', 'باسات', 'sedan' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'golf', 'Golf', 'جولف', 'hatchback' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'polo', 'Polo', 'بولو', 'hatchback' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'jetta', 'Jetta', 'جيتا', 'sedan' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiguan', 'Tiguan', 'تيجوان', 'suv' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 't-roc', 'T-Roc', 'تي روك', 'crossover' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 't-cross', 'T-Cross', 'تي كروس', 'crossover' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'touareg', 'Touareg', 'طوارق', 'suv' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'teramont', 'Teramont', 'تيرامونت', 'suv' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'id4', 'ID.4', 'ID.4', 'crossover' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'id6', 'ID.6', 'ID.6', 'suv' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'caddy', 'Caddy', 'كادي', 'van' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'transporter', 'Transporter', 'Transporter', 'van' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('fiat', 'Fiat', 'فيات', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tipo', 'Tipo', 'تيبو', 'sedan' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '500', '500', '500', 'hatchback' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '500x', '500X', '500X', 'crossover' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '128', '128', '128', 'sedan' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '127', '127', '127', 'hatchback' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'punto', 'Punto', 'بونتو', 'hatchback' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'linea', 'Linea', 'لينيا', 'sedan' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'shahin', 'Shahin (Şahin)', 'شاهين', 'sedan' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'uno', 'Uno', 'أونو', 'hatchback' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'siena', 'Siena', 'سيينا', 'sedan' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'doblo', 'Doblo', 'دوبلو', 'van' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ducato', 'Ducato', 'دوكاتو', 'van' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('byd', 'BYD', 'بي واي دي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'f3', 'F3', 'F3', 'sedan' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'f0', 'F0', 'F0', 'hatchback' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'l3', 'L3', 'L3', 'sedan' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'seal', 'Seal', 'سيل', 'sedan' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'seagull', 'Seagull', 'سيجال', 'hatchback' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'dolphin', 'Dolphin', 'دولفين', 'hatchback' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'song-plus', 'Song Plus', 'سونج بلس', 'suv' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'song-l', 'Song L', 'Song L', 'suv' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'atto-3', 'Atto 3', 'أتو 3', 'crossover' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'qin-plus', 'Qin Plus', 'تشين بلس', 'sedan' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'han', 'Han', 'هان', 'sedan' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tang', 'Tang', 'تانج', 'suv' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'yuan-plus', 'Yuan Plus', 'Yuan Plus', 'crossover' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('geely', 'Geely', 'جيلي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'emgrand', 'Emgrand', 'إمجراند', 'sedan' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'emgrand-7', 'Emgrand 7', 'إمجراند 7', 'sedan' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'pandino', 'Pandino', 'باندينو', 'hatchback' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'coolray', 'Coolray', 'كولراي', 'crossover' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tugella', 'Tugella', 'توجيلا', 'suv' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'okavango', 'Okavango', 'أوكافانجو', 'suv' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'monjaro', 'Monjaro', 'مونجارو', 'suv' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'geometry-c', 'Geometry C', 'Geometry C', 'hatchback' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gx3', 'GX3', 'GX3', 'crossover' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('jeep', 'Jeep', 'جيب', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'renegade', 'Renegade', 'رينيجيد', 'crossover' FROM vehicle_makes WHERE slug = 'jeep' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'compass', 'Compass', 'كومباس', 'suv' FROM vehicle_makes WHERE slug = 'jeep' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cherokee', 'Cherokee', 'شيروكي', 'suv' FROM vehicle_makes WHERE slug = 'jeep' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'grand-cherokee', 'Grand Cherokee', 'جراند شيروكي', 'suv' FROM vehicle_makes WHERE slug = 'jeep' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'wrangler', 'Wrangler', 'رانجلر', 'suv' FROM vehicle_makes WHERE slug = 'jeep' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gladiator', 'Gladiator', 'جلاديتور', 'pickup' FROM vehicle_makes WHERE slug = 'jeep' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('opel', 'Opel', 'أوبل', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'astra', 'Astra', 'أسترا', 'hatchback' FROM vehicle_makes WHERE slug = 'opel' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'corsa', 'Corsa', 'كورسا', 'hatchback' FROM vehicle_makes WHERE slug = 'opel' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'insignia', 'Insignia', 'إنسيجنيا', 'sedan' FROM vehicle_makes WHERE slug = 'opel' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'vectra', 'Vectra', 'فيكترا', 'sedan' FROM vehicle_makes WHERE slug = 'opel' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mokka', 'Mokka', 'موكا', 'crossover' FROM vehicle_makes WHERE slug = 'opel' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'crossland', 'Crossland', 'كروس لاند', 'crossover' FROM vehicle_makes WHERE slug = 'opel' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'grandland', 'Grandland', 'جراند لاند', 'suv' FROM vehicle_makes WHERE slug = 'opel' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'combo', 'Combo', 'كومبو', 'van' FROM vehicle_makes WHERE slug = 'opel' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('seat', 'Seat', 'سيات', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ibiza', 'Ibiza', 'إبيزا', 'hatchback' FROM vehicle_makes WHERE slug = 'seat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'leon', 'Leon', 'ليون', 'hatchback' FROM vehicle_makes WHERE slug = 'seat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'toledo', 'Toledo', 'توليدو', 'sedan' FROM vehicle_makes WHERE slug = 'seat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'arona', 'Arona', 'أرونا', 'crossover' FROM vehicle_makes WHERE slug = 'seat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ateca', 'Ateca', 'أتيكا', 'suv' FROM vehicle_makes WHERE slug = 'seat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tarraco', 'Tarraco', 'تاراكو', 'suv' FROM vehicle_makes WHERE slug = 'seat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('cupra', 'Cupra', 'كوبرا', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'formentor', 'Formentor', 'فورمنتور', 'crossover' FROM vehicle_makes WHERE slug = 'cupra' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'leon', 'Leon', 'ليون', 'hatchback' FROM vehicle_makes WHERE slug = 'cupra' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'born', 'Born', 'Born', 'hatchback' FROM vehicle_makes WHERE slug = 'cupra' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ateca', 'Ateca', 'Ateca', 'suv' FROM vehicle_makes WHERE slug = 'cupra' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('citroen', 'Citroën', 'ستروين', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c3', 'C3', 'C3', 'hatchback' FROM vehicle_makes WHERE slug = 'citroen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c4', 'C4', 'C4', 'hatchback' FROM vehicle_makes WHERE slug = 'citroen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c-elysee', 'C-Elysée', 'سي إليزيه', 'sedan' FROM vehicle_makes WHERE slug = 'citroen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c3-aircross', 'C3 Aircross', 'C3 Aircross', 'crossover' FROM vehicle_makes WHERE slug = 'citroen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c4-x', 'C4 X', 'C4 X', 'sedan' FROM vehicle_makes WHERE slug = 'citroen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c5-aircross', 'C5 Aircross', 'C5 Aircross', 'suv' FROM vehicle_makes WHERE slug = 'citroen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'berlingo', 'Berlingo', 'برلينجو', 'van' FROM vehicle_makes WHERE slug = 'citroen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('ford', 'Ford', 'فورد', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'focus', 'Focus', 'فوكس', 'hatchback' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'fiesta', 'Fiesta', 'فييستا', 'hatchback' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'fusion', 'Fusion', 'فيوجن', 'sedan' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mondeo', 'Mondeo', 'مونديو', 'sedan' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ecosport', 'EcoSport', 'إيكو سبورت', 'crossover' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'kuga', 'Kuga', 'كوجا', 'suv' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'territory', 'Territory', 'تيريتوري', 'suv' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'explorer', 'Explorer', 'إكسبلورر', 'suv' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'everest', 'Everest', 'إيفرست', 'suv' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ranger', 'Ranger', 'رينجر', 'pickup' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mustang', 'Mustang', 'موستانج', 'coupe' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'transit', 'Transit', 'ترانزيت', 'van' FROM vehicle_makes WHERE slug = 'ford' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('mazda', 'Mazda', 'مازدا', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '2', 'Mazda2', 'Mazda2', 'hatchback' FROM vehicle_makes WHERE slug = 'mazda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '3', 'Mazda3', 'Mazda3', 'sedan' FROM vehicle_makes WHERE slug = 'mazda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '6', 'Mazda6', 'Mazda6', 'sedan' FROM vehicle_makes WHERE slug = 'mazda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cx-3', 'CX-3', 'CX-3', 'crossover' FROM vehicle_makes WHERE slug = 'mazda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cx-30', 'CX-30', 'CX-30', 'crossover' FROM vehicle_makes WHERE slug = 'mazda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cx-5', 'CX-5', 'CX-5', 'suv' FROM vehicle_makes WHERE slug = 'mazda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cx-9', 'CX-9', 'CX-9', 'suv' FROM vehicle_makes WHERE slug = 'mazda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('subaru', 'Subaru', 'سوبارو', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'impreza', 'Impreza', 'إمبريزا', 'sedan' FROM vehicle_makes WHERE slug = 'subaru' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xv', 'XV', 'XV', 'crossover' FROM vehicle_makes WHERE slug = 'subaru' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'forester', 'Forester', 'فورستر', 'suv' FROM vehicle_makes WHERE slug = 'subaru' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'outback', 'Outback', 'أوتباك', 'wagon' FROM vehicle_makes WHERE slug = 'subaru' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'legacy', 'Legacy', 'ليجاسي', 'sedan' FROM vehicle_makes WHERE slug = 'subaru' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('lexus', 'Lexus', 'لكزس', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'is', 'IS', 'IS', 'sedan' FROM vehicle_makes WHERE slug = 'lexus' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'es', 'ES', 'ES', 'sedan' FROM vehicle_makes WHERE slug = 'lexus' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ls', 'LS', 'LS', 'sedan' FROM vehicle_makes WHERE slug = 'lexus' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ux', 'UX', 'UX', 'crossover' FROM vehicle_makes WHERE slug = 'lexus' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'nx', 'NX', 'NX', 'suv' FROM vehicle_makes WHERE slug = 'lexus' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rx', 'RX', 'RX', 'suv' FROM vehicle_makes WHERE slug = 'lexus' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'lx', 'LX', 'LX', 'suv' FROM vehicle_makes WHERE slug = 'lexus' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gx', 'GX', 'GX', 'suv' FROM vehicle_makes WHERE slug = 'lexus' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('land-rover', 'Land Rover', 'لاند روفر', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'range-rover', 'Range Rover', 'رينج روفر', 'suv' FROM vehicle_makes WHERE slug = 'land-rover' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'range-rover-sport', 'Range Rover Sport', 'رينج روفر سبورت', 'suv' FROM vehicle_makes WHERE slug = 'land-rover' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'range-rover-velar', 'Range Rover Velar', 'رينج روفر فيلار', 'suv' FROM vehicle_makes WHERE slug = 'land-rover' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'range-rover-evoque', 'Range Rover Evoque', 'رينج روفر إيفوك', 'suv' FROM vehicle_makes WHERE slug = 'land-rover' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'discovery', 'Discovery', 'ديسكفري', 'suv' FROM vehicle_makes WHERE slug = 'land-rover' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'discovery-sport', 'Discovery Sport', 'ديسكفري سبورت', 'suv' FROM vehicle_makes WHERE slug = 'land-rover' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'defender', 'Defender', 'ديفندر', 'suv' FROM vehicle_makes WHERE slug = 'land-rover' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('porsche', 'Porsche', 'بورش', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '911', '911', '911', 'coupe' FROM vehicle_makes WHERE slug = 'porsche' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cayenne', 'Cayenne', 'كايين', 'suv' FROM vehicle_makes WHERE slug = 'porsche' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cayenne-coupe', 'Cayenne Coupe', 'Cayenne Coupe', 'suv' FROM vehicle_makes WHERE slug = 'porsche' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'macan', 'Macan', 'ماكان', 'suv' FROM vehicle_makes WHERE slug = 'porsche' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'panamera', 'Panamera', 'باناميرا', 'sedan' FROM vehicle_makes WHERE slug = 'porsche' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'taycan', 'Taycan', 'تايكان', 'sedan' FROM vehicle_makes WHERE slug = 'porsche' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '718', '718 Cayman / Boxster', '718 Cayman / Boxster', 'coupe' FROM vehicle_makes WHERE slug = 'porsche' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('volvo', 'Volvo', 'فولفو', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's60', 'S60', 'S60', 'sedan' FROM vehicle_makes WHERE slug = 'volvo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's90', 'S90', 'S90', 'sedan' FROM vehicle_makes WHERE slug = 'volvo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xc40', 'XC40', 'XC40', 'crossover' FROM vehicle_makes WHERE slug = 'volvo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xc60', 'XC60', 'XC60', 'suv' FROM vehicle_makes WHERE slug = 'volvo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xc90', 'XC90', 'XC90', 'suv' FROM vehicle_makes WHERE slug = 'volvo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ex30', 'EX30', 'EX30', 'crossover' FROM vehicle_makes WHERE slug = 'volvo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c40', 'C40', 'C40', 'crossover' FROM vehicle_makes WHERE slug = 'volvo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('mini', 'Mini', 'ميني', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cooper', 'Cooper', 'كوبر', 'hatchback' FROM vehicle_makes WHERE slug = 'mini' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cooper-s', 'Cooper S', 'Cooper S', 'hatchback' FROM vehicle_makes WHERE slug = 'mini' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'countryman', 'Countryman', 'كانتري مان', 'crossover' FROM vehicle_makes WHERE slug = 'mini' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'clubman', 'Clubman', 'Clubman', 'wagon' FROM vehicle_makes WHERE slug = 'mini' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'convertible', 'Convertible', 'Convertible', 'convertible' FROM vehicle_makes WHERE slug = 'mini' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('jaguar', 'Jaguar', 'جاكوار', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xe', 'XE', 'XE', 'sedan' FROM vehicle_makes WHERE slug = 'jaguar' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xf', 'XF', 'XF', 'sedan' FROM vehicle_makes WHERE slug = 'jaguar' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xj', 'XJ', 'XJ', 'sedan' FROM vehicle_makes WHERE slug = 'jaguar' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'e-pace', 'E-Pace', 'E-Pace', 'crossover' FROM vehicle_makes WHERE slug = 'jaguar' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'f-pace', 'F-Pace', 'F-Pace', 'suv' FROM vehicle_makes WHERE slug = 'jaguar' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'i-pace', 'I-Pace', 'I-Pace', 'suv' FROM vehicle_makes WHERE slug = 'jaguar' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('infiniti', 'Infiniti', 'إنفينيتي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'q50', 'Q50', 'Q50', 'sedan' FROM vehicle_makes WHERE slug = 'infiniti' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'qx50', 'QX50', 'QX50', 'suv' FROM vehicle_makes WHERE slug = 'infiniti' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'qx55', 'QX55', 'QX55', 'suv' FROM vehicle_makes WHERE slug = 'infiniti' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'qx60', 'QX60', 'QX60', 'suv' FROM vehicle_makes WHERE slug = 'infiniti' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'qx80', 'QX80', 'QX80', 'suv' FROM vehicle_makes WHERE slug = 'infiniti' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('tesla', 'Tesla', 'تسلا', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'model-3', 'Model 3', 'Model 3', 'sedan' FROM vehicle_makes WHERE slug = 'tesla' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'model-y', 'Model Y', 'Model Y', 'crossover' FROM vehicle_makes WHERE slug = 'tesla' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'model-s', 'Model S', 'Model S', 'sedan' FROM vehicle_makes WHERE slug = 'tesla' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'model-x', 'Model X', 'Model X', 'suv' FROM vehicle_makes WHERE slug = 'tesla' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('haval', 'Haval', 'هافال', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'h6', 'H6', 'H6', 'suv' FROM vehicle_makes WHERE slug = 'haval' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'jolion', 'Jolion', 'جوليون', 'crossover' FROM vehicle_makes WHERE slug = 'haval' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'h9', 'H9', 'H9', 'suv' FROM vehicle_makes WHERE slug = 'haval' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'dargo', 'Dargo', 'دارجو', 'suv' FROM vehicle_makes WHERE slug = 'haval' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'h2', 'H2', 'H2', 'crossover' FROM vehicle_makes WHERE slug = 'haval' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('great-wall', 'Great Wall', 'جريت وول', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'wingle', 'Wingle', 'وينجل', 'pickup' FROM vehicle_makes WHERE slug = 'great-wall' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'poer', 'Poer', 'باور', 'pickup' FROM vehicle_makes WHERE slug = 'great-wall' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c30', 'C30', 'C30', 'sedan' FROM vehicle_makes WHERE slug = 'great-wall' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('jetour', 'Jetour', 'جيتور', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x70', 'X70', 'X70', 'suv' FROM vehicle_makes WHERE slug = 'jetour' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x70-plus', 'X70 Plus', 'X70 Plus', 'suv' FROM vehicle_makes WHERE slug = 'jetour' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x90', 'X90', 'X90', 'suv' FROM vehicle_makes WHERE slug = 'jetour' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'dashing', 'Dashing', 'داشينج', 'suv' FROM vehicle_makes WHERE slug = 'jetour' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 't2', 'T2', 'T2', 'suv' FROM vehicle_makes WHERE slug = 'jetour' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('changan', 'Changan', 'شانجان', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'alsvin', 'Alsvin', 'ألسفين', 'sedan' FROM vehicle_makes WHERE slug = 'changan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'eado', 'Eado', 'إيدو', 'sedan' FROM vehicle_makes WHERE slug = 'changan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cs15', 'CS15', 'CS15', 'crossover' FROM vehicle_makes WHERE slug = 'changan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cs35-plus', 'CS35 Plus', 'CS35 Plus', 'crossover' FROM vehicle_makes WHERE slug = 'changan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cs55-plus', 'CS55 Plus', 'CS55 Plus', 'suv' FROM vehicle_makes WHERE slug = 'changan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cs75', 'CS75', 'CS75', 'suv' FROM vehicle_makes WHERE slug = 'changan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'uni-k', 'UNI-K', 'UNI-K', 'suv' FROM vehicle_makes WHERE slug = 'changan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'uni-t', 'UNI-T', 'UNI-T', 'crossover' FROM vehicle_makes WHERE slug = 'changan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('baic', 'BAIC', 'بايك', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x3', 'X3', 'X3', 'crossover' FROM vehicle_makes WHERE slug = 'baic' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x35', 'X35', 'X35', 'crossover' FROM vehicle_makes WHERE slug = 'baic' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x7', 'X7', 'X7', 'suv' FROM vehicle_makes WHERE slug = 'baic' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'beijing-x7', 'Beijing X7', 'Beijing X7', 'suv' FROM vehicle_makes WHERE slug = 'baic' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'u5-plus', 'U5 Plus', 'U5 Plus', 'sedan' FROM vehicle_makes WHERE slug = 'baic' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'bj40', 'BJ40', 'BJ40', 'suv' FROM vehicle_makes WHERE slug = 'baic' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('proton', 'Proton', 'بروتون', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'saga', 'Saga', 'ساجا', 'sedan' FROM vehicle_makes WHERE slug = 'proton' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'persona', 'Persona', 'بيرسونا', 'sedan' FROM vehicle_makes WHERE slug = 'proton' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gen-2', 'Gen-2', 'Gen-2', 'hatchback' FROM vehicle_makes WHERE slug = 'proton' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'preve', 'Preve', 'Preve', 'sedan' FROM vehicle_makes WHERE slug = 'proton' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x50', 'X50', 'X50', 'crossover' FROM vehicle_makes WHERE slug = 'proton' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x70', 'X70', 'X70', 'suv' FROM vehicle_makes WHERE slug = 'proton' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('speranza', 'Speranza', 'سبرانزا', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a113', 'A113', 'A113', 'hatchback' FROM vehicle_makes WHERE slug = 'speranza' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a213', 'A213', 'A213', 'sedan' FROM vehicle_makes WHERE slug = 'speranza' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a516', 'A516', 'A516', 'sedan' FROM vehicle_makes WHERE slug = 'speranza' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a620', 'A620', 'A620', 'sedan' FROM vehicle_makes WHERE slug = 'speranza' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo', 'Tiggo', 'Tiggo', 'suv' FROM vehicle_makes WHERE slug = 'speranza' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'envy', 'Envy', 'Envy', 'hatchback' FROM vehicle_makes WHERE slug = 'speranza' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('dongfeng', 'Dongfeng', 'دونج فينج', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'aeolus-a30', 'Aeolus A30', 'Aeolus A30', 'sedan' FROM vehicle_makes WHERE slug = 'dongfeng' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'aeolus-shine', 'Aeolus Shine', 'Aeolus Shine', 'sedan' FROM vehicle_makes WHERE slug = 'dongfeng' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ax7', 'AX7', 'AX7', 'suv' FROM vehicle_makes WHERE slug = 'dongfeng' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'glory-580', 'Glory 580', 'Glory 580', 'suv' FROM vehicle_makes WHERE slug = 'dongfeng' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mage', 'Mage', 'Mage', 'crossover' FROM vehicle_makes WHERE slug = 'dongfeng' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('dfsk', 'DFSK', 'دي إف إس كيه', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'glory-500', 'Glory 500', 'Glory 500', 'suv' FROM vehicle_makes WHERE slug = 'dfsk' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'glory-580', 'Glory 580', 'Glory 580', 'suv' FROM vehicle_makes WHERE slug = 'dfsk' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mini-truck', 'Mini Truck', 'Mini Truck', 'pickup' FROM vehicle_makes WHERE slug = 'dfsk' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mini-van', 'Mini Van', 'Mini Van', 'van' FROM vehicle_makes WHERE slug = 'dfsk' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('exeed', 'Exeed', 'إكسيد', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'lx', 'LX', 'LX', 'crossover' FROM vehicle_makes WHERE slug = 'exeed' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'txl', 'TXL', 'TXL', 'suv' FROM vehicle_makes WHERE slug = 'exeed' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'vx', 'VX', 'VX', 'suv' FROM vehicle_makes WHERE slug = 'exeed' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rx', 'RX', 'RX', 'suv' FROM vehicle_makes WHERE slug = 'exeed' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('gac', 'GAC', 'جي إيه سي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gs3', 'GS3', 'GS3', 'crossover' FROM vehicle_makes WHERE slug = 'gac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gs4', 'GS4', 'GS4', 'suv' FROM vehicle_makes WHERE slug = 'gac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gs8', 'GS8', 'GS8', 'suv' FROM vehicle_makes WHERE slug = 'gac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ga4', 'GA4', 'GA4', 'sedan' FROM vehicle_makes WHERE slug = 'gac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ga6', 'GA6', 'GA6', 'sedan' FROM vehicle_makes WHERE slug = 'gac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'emkoo', 'Emkoo', 'Emkoo', 'suv' FROM vehicle_makes WHERE slug = 'gac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'empow', 'Empow', 'Empow', 'sedan' FROM vehicle_makes WHERE slug = 'gac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('hongqi', 'Hongqi', 'هونشي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'h5', 'H5', 'H5', 'sedan' FROM vehicle_makes WHERE slug = 'hongqi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'h9', 'H9', 'H9', 'sedan' FROM vehicle_makes WHERE slug = 'hongqi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'hs3', 'HS3', 'HS3', 'suv' FROM vehicle_makes WHERE slug = 'hongqi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'hs5', 'HS5', 'HS5', 'suv' FROM vehicle_makes WHERE slug = 'hongqi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'e-hs9', 'E-HS9', 'E-HS9', 'suv' FROM vehicle_makes WHERE slug = 'hongqi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('jac', 'JAC', 'جاك', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'j7', 'J7', 'J7', 'sedan' FROM vehicle_makes WHERE slug = 'jac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's2', 'S2', 'S2', 'crossover' FROM vehicle_makes WHERE slug = 'jac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's3', 'S3', 'S3', 'crossover' FROM vehicle_makes WHERE slug = 'jac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's4', 'S4', 'S4', 'suv' FROM vehicle_makes WHERE slug = 'jac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'js4', 'JS4', 'JS4', 'suv' FROM vehicle_makes WHERE slug = 'jac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 't8', 'T8', 'T8', 'pickup' FROM vehicle_makes WHERE slug = 'jac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('kaiyi', 'Kaiyi', 'كايي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x3', 'X3', 'X3', 'crossover' FROM vehicle_makes WHERE slug = 'kaiyi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x3-pro', 'X3 Pro', 'X3 Pro', 'crossover' FROM vehicle_makes WHERE slug = 'kaiyi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'e5', 'E5', 'E5', 'sedan' FROM vehicle_makes WHERE slug = 'kaiyi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('bestune', 'Bestune', 'بستيون', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 't33', 'T33', 'T33', 'crossover' FROM vehicle_makes WHERE slug = 'bestune' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 't55', 'T55', 'T55', 'suv' FROM vehicle_makes WHERE slug = 'bestune' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 't77', 'T77', 'T77', 'suv' FROM vehicle_makes WHERE slug = 'bestune' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'b70', 'B70', 'B70', 'sedan' FROM vehicle_makes WHERE slug = 'bestune' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('lada', 'Lada', 'لادا', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'granta', 'Granta', 'جرانتا', 'sedan' FROM vehicle_makes WHERE slug = 'lada' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'vesta', 'Vesta', 'فيستا', 'sedan' FROM vehicle_makes WHERE slug = 'lada' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'niva', 'Niva', 'نيفا', 'suv' FROM vehicle_makes WHERE slug = 'lada' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '2107', '2107', '2107', 'sedan' FROM vehicle_makes WHERE slug = 'lada' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('daewoo', 'Daewoo', 'دايو', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'lanos', 'Lanos', 'لانوس', 'sedan' FROM vehicle_makes WHERE slug = 'daewoo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'nubira', 'Nubira', 'نوبيرا', 'sedan' FROM vehicle_makes WHERE slug = 'daewoo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'matiz', 'Matiz', 'ماتيز', 'hatchback' FROM vehicle_makes WHERE slug = 'daewoo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cielo', 'Cielo', 'سيلو', 'sedan' FROM vehicle_makes WHERE slug = 'daewoo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('isuzu', 'Isuzu', 'إيسوزو', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'd-max', 'D-Max', 'دي ماكس', 'pickup' FROM vehicle_makes WHERE slug = 'isuzu' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mu-x', 'MU-X', 'MU-X', 'suv' FROM vehicle_makes WHERE slug = 'isuzu' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('zeekr', 'Zeekr', 'زيكر', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '001', '001', '001', 'wagon' FROM vehicle_makes WHERE slug = 'zeekr' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '007', '007', '007', 'sedan' FROM vehicle_makes WHERE slug = 'zeekr' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x', 'X', 'X', 'crossover' FROM vehicle_makes WHERE slug = 'zeekr' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '7x', '7X', '7X', 'suv' FROM vehicle_makes WHERE slug = 'zeekr' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('lynk-co', 'Lynk & Co', 'لينك آند كو', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '01', '01', '01', 'suv' FROM vehicle_makes WHERE slug = 'lynk-co' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '03', '03', '03', 'sedan' FROM vehicle_makes WHERE slug = 'lynk-co' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '05', '05', '05', 'suv' FROM vehicle_makes WHERE slug = 'lynk-co' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '06', '06', '06', 'crossover' FROM vehicle_makes WHERE slug = 'lynk-co' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('avatr', 'Avatr', 'أفاتر', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '11', '11', '11', 'suv' FROM vehicle_makes WHERE slug = 'avatr' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '12', '12', '12', 'sedan' FROM vehicle_makes WHERE slug = 'avatr' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('seres', 'Seres', 'سيريس', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '3', '3', '3', 'crossover' FROM vehicle_makes WHERE slug = 'seres' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '5', '5', '5', 'suv' FROM vehicle_makes WHERE slug = 'seres' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('alfa-romeo', 'Alfa Romeo', 'ألفا روميو', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'giulia', 'Giulia', 'جوليا', 'sedan' FROM vehicle_makes WHERE slug = 'alfa-romeo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'giulietta', 'Giulietta', 'جولييتا', 'hatchback' FROM vehicle_makes WHERE slug = 'alfa-romeo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'stelvio', 'Stelvio', 'ستلفيو', 'suv' FROM vehicle_makes WHERE slug = 'alfa-romeo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tonale', 'Tonale', 'تونالي', 'crossover' FROM vehicle_makes WHERE slug = 'alfa-romeo' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('dodge', 'Dodge', 'دودج', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'charger', 'Charger', 'تشارجر', 'sedan' FROM vehicle_makes WHERE slug = 'dodge' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'challenger', 'Challenger', 'تشالنجر', 'coupe' FROM vehicle_makes WHERE slug = 'dodge' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'durango', 'Durango', 'دورانجو', 'suv' FROM vehicle_makes WHERE slug = 'dodge' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ram', 'Ram', 'رام', 'pickup' FROM vehicle_makes WHERE slug = 'dodge' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('cadillac', 'Cadillac', 'كاديلاك', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'escalade', 'Escalade', 'إسكاليد', 'suv' FROM vehicle_makes WHERE slug = 'cadillac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ct4', 'CT4', 'CT4', 'sedan' FROM vehicle_makes WHERE slug = 'cadillac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ct5', 'CT5', 'CT5', 'sedan' FROM vehicle_makes WHERE slug = 'cadillac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xt4', 'XT4', 'XT4', 'crossover' FROM vehicle_makes WHERE slug = 'cadillac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xt5', 'XT5', 'XT5', 'suv' FROM vehicle_makes WHERE slug = 'cadillac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xt6', 'XT6', 'XT6', 'suv' FROM vehicle_makes WHERE slug = 'cadillac' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('maserati', 'Maserati', 'مازيراتي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ghibli', 'Ghibli', 'Ghibli', 'sedan' FROM vehicle_makes WHERE slug = 'maserati' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'quattroporte', 'Quattroporte', 'Quattroporte', 'sedan' FROM vehicle_makes WHERE slug = 'maserati' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'levante', 'Levante', 'Levante', 'suv' FROM vehicle_makes WHERE slug = 'maserati' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'grecale', 'Grecale', 'Grecale', 'suv' FROM vehicle_makes WHERE slug = 'maserati' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('genesis', 'Genesis', 'جينيسيس', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'g70', 'G70', 'G70', 'sedan' FROM vehicle_makes WHERE slug = 'genesis' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'g80', 'G80', 'G80', 'sedan' FROM vehicle_makes WHERE slug = 'genesis' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'g90', 'G90', 'G90', 'sedan' FROM vehicle_makes WHERE slug = 'genesis' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gv70', 'GV70', 'GV70', 'suv' FROM vehicle_makes WHERE slug = 'genesis' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gv80', 'GV80', 'GV80', 'suv' FROM vehicle_makes WHERE slug = 'genesis' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('brilliance', 'Brilliance', 'بريليانس', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'v5', 'V5', 'V5', 'suv' FROM vehicle_makes WHERE slug = 'brilliance' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'fsv', 'FSV', 'FSV', 'sedan' FROM vehicle_makes WHERE slug = 'brilliance' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'frv', 'FRV', 'FRV', 'hatchback' FROM vehicle_makes WHERE slug = 'brilliance' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'galena', 'Galena', 'جالينا', 'sedan' FROM vehicle_makes WHERE slug = 'brilliance' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'splendor', 'Splendor', 'Splendor', 'sedan' FROM vehicle_makes WHERE slug = 'brilliance' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'h320', 'H320', 'H320', 'hatchback' FROM vehicle_makes WHERE slug = 'brilliance' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'h330', 'H330', 'H330', 'sedan' FROM vehicle_makes WHERE slug = 'brilliance' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'v6', 'V6', 'V6', 'suv' FROM vehicle_makes WHERE slug = 'brilliance' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('senova', 'Senova', 'سينوفا', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'd20', 'D20', 'D20', 'sedan' FROM vehicle_makes WHERE slug = 'senova' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x25', 'X25', 'X25', 'crossover' FROM vehicle_makes WHERE slug = 'senova' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x35', 'X35', 'X35', 'crossover' FROM vehicle_makes WHERE slug = 'senova' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x55', 'X55', 'X55', 'suv' FROM vehicle_makes WHERE slug = 'senova' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('soueast', 'Soueast', 'ساوايست', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's06', 'S06', 'S06', 'crossover' FROM vehicle_makes WHERE slug = 'soueast' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's07', 'S07', 'S07', 'suv' FROM vehicle_makes WHERE slug = 'soueast' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's09', 'S09', 'S09', 'suv' FROM vehicle_makes WHERE slug = 'soueast' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'dx3', 'DX3', 'DX3', 'crossover' FROM vehicle_makes WHERE slug = 'soueast' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'dx7', 'DX7', 'DX7', 'suv' FROM vehicle_makes WHERE slug = 'soueast' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('foton', 'Foton', 'فوتون', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tunland', 'Tunland', 'تونلاند', 'pickup' FROM vehicle_makes WHERE slug = 'foton' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'view', 'View', 'View', 'van' FROM vehicle_makes WHERE slug = 'foton' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sauvana', 'Sauvana', 'Sauvana', 'suv' FROM vehicle_makes WHERE slug = 'foton' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('forthing', 'Forthing', 'فورثينج', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 't5-evo', 'T5 EVO', 'T5 EVO', 'suv' FROM vehicle_makes WHERE slug = 'forthing' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'friday', 'Friday', 'Friday', 'crossover' FROM vehicle_makes WHERE slug = 'forthing' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'u-tour', 'U-Tour', 'U-Tour', 'van' FROM vehicle_makes WHERE slug = 'forthing' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('rox', 'Rox', 'روكس', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '01', '01', '01', 'suv' FROM vehicle_makes WHERE slug = 'rox' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('deepal', 'Deepal', 'ديبال', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's07', 'S07', 'S07', 'suv' FROM vehicle_makes WHERE slug = 'deepal' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'l07', 'L07', 'L07', 'sedan' FROM vehicle_makes WHERE slug = 'deepal' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'g318', 'G318', 'G318', 'suv' FROM vehicle_makes WHERE slug = 'deepal' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('leapmotor', 'Leapmotor', 'ليب موتور', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 't03', 'T03', 'T03', 'hatchback' FROM vehicle_makes WHERE slug = 'leapmotor' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c10', 'C10', 'C10', 'suv' FROM vehicle_makes WHERE slug = 'leapmotor' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c11', 'C11', 'C11', 'suv' FROM vehicle_makes WHERE slug = 'leapmotor' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'b10', 'B10', 'B10', 'crossover' FROM vehicle_makes WHERE slug = 'leapmotor' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('xpeng', 'Xpeng', 'إكسبنج', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'g6', 'G6', 'G6', 'suv' FROM vehicle_makes WHERE slug = 'xpeng' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'g9', 'G9', 'G9', 'suv' FROM vehicle_makes WHERE slug = 'xpeng' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'p7', 'P7', 'P7', 'sedan' FROM vehicle_makes WHERE slug = 'xpeng' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('neta', 'Neta', 'نيتا', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'v', 'V', 'V', 'crossover' FROM vehicle_makes WHERE slug = 'neta' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'u', 'U', 'U', 'suv' FROM vehicle_makes WHERE slug = 'neta' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 's', 'S', 'S', 'sedan' FROM vehicle_makes WHERE slug = 'neta' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x', 'X', 'X', 'suv' FROM vehicle_makes WHERE slug = 'neta' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('voyah', 'Voyah', 'فوياه', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'free', 'Free', 'Free', 'suv' FROM vehicle_makes WHERE slug = 'voyah' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'dreamer', 'Dreamer', 'Dreamer', 'van' FROM vehicle_makes WHERE slug = 'voyah' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'courage', 'Courage', 'Courage', 'suv' FROM vehicle_makes WHERE slug = 'voyah' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('polestar', 'Polestar', 'بولستار', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '2', 'Polestar 2', 'Polestar 2', 'sedan' FROM vehicle_makes WHERE slug = 'polestar' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '3', 'Polestar 3', 'Polestar 3', 'suv' FROM vehicle_makes WHERE slug = 'polestar' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '4', 'Polestar 4', 'Polestar 4', 'suv' FROM vehicle_makes WHERE slug = 'polestar' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('smart', 'Smart', 'سمارت', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'fortwo', 'ForTwo', 'ForTwo', 'hatchback' FROM vehicle_makes WHERE slug = 'smart' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'forfour', 'ForFour', 'ForFour', 'hatchback' FROM vehicle_makes WHERE slug = 'smart' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '1', '#1', '#1', 'crossover' FROM vehicle_makes WHERE slug = 'smart' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '3', '#3', '#3', 'crossover' FROM vehicle_makes WHERE slug = 'smart' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('daihatsu', 'Daihatsu', 'دايهاتسو', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'terios', 'Terios', 'تيريوس', 'suv' FROM vehicle_makes WHERE slug = 'daihatsu' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gran-max', 'Gran Max', 'جران ماكس', 'van' FROM vehicle_makes WHERE slug = 'daihatsu' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sirion', 'Sirion', 'سيريون', 'hatchback' FROM vehicle_makes WHERE slug = 'daihatsu' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'charade', 'Charade', 'Charade', 'hatchback' FROM vehicle_makes WHERE slug = 'daihatsu' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('tata', 'Tata', 'تاتا', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'indica', 'Indica', 'إنديكا', 'hatchback' FROM vehicle_makes WHERE slug = 'tata' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'indigo', 'Indigo', 'إنديجو', 'sedan' FROM vehicle_makes WHERE slug = 'tata' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xenon', 'Xenon', 'Xenon', 'pickup' FROM vehicle_makes WHERE slug = 'tata' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('chrysler', 'Chrysler', 'كرايسلر', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '300c', '300C', '300C', 'sedan' FROM vehicle_makes WHERE slug = 'chrysler' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'pacifica', 'Pacifica', 'Pacifica', 'van' FROM vehicle_makes WHERE slug = 'chrysler' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('gmc', 'GMC', 'جي إم سي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'yukon', 'Yukon', 'يوكن', 'suv' FROM vehicle_makes WHERE slug = 'gmc' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sierra', 'Sierra', 'Sierra', 'pickup' FROM vehicle_makes WHERE slug = 'gmc' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'terrain', 'Terrain', 'Terrain', 'suv' FROM vehicle_makes WHERE slug = 'gmc' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'acadia', 'Acadia', 'Acadia', 'suv' FROM vehicle_makes WHERE slug = 'gmc' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('lincoln', 'Lincoln', 'لينكولن', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'navigator', 'Navigator', 'Navigator', 'suv' FROM vehicle_makes WHERE slug = 'lincoln' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'aviator', 'Aviator', 'Aviator', 'suv' FROM vehicle_makes WHERE slug = 'lincoln' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'corsair', 'Corsair', 'Corsair', 'suv' FROM vehicle_makes WHERE slug = 'lincoln' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('bentley', 'Bentley', 'بنتلي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'bentayga', 'Bentayga', 'Bentayga', 'suv' FROM vehicle_makes WHERE slug = 'bentley' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'continental-gt', 'Continental GT', 'Continental GT', 'coupe' FROM vehicle_makes WHERE slug = 'bentley' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'flying-spur', 'Flying Spur', 'Flying Spur', 'sedan' FROM vehicle_makes WHERE slug = 'bentley' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('rolls-royce', 'Rolls-Royce', 'رولز رويس', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cullinan', 'Cullinan', 'Cullinan', 'suv' FROM vehicle_makes WHERE slug = 'rolls-royce' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ghost', 'Ghost', 'Ghost', 'sedan' FROM vehicle_makes WHERE slug = 'rolls-royce' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'phantom', 'Phantom', 'Phantom', 'sedan' FROM vehicle_makes WHERE slug = 'rolls-royce' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'wraith', 'Wraith', 'Wraith', 'coupe' FROM vehicle_makes WHERE slug = 'rolls-royce' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'spectre', 'Spectre', 'Spectre', 'coupe' FROM vehicle_makes WHERE slug = 'rolls-royce' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('ferrari', 'Ferrari', 'فيراري', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'roma', 'Roma', 'Roma', 'coupe' FROM vehicle_makes WHERE slug = 'ferrari' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'portofino', 'Portofino', 'Portofino', 'convertible' FROM vehicle_makes WHERE slug = 'ferrari' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '296', '296', '296', 'coupe' FROM vehicle_makes WHERE slug = 'ferrari' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'f8', 'F8', 'F8', 'coupe' FROM vehicle_makes WHERE slug = 'ferrari' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sf90', 'SF90', 'SF90', 'coupe' FROM vehicle_makes WHERE slug = 'ferrari' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'purosangue', 'Purosangue', 'Purosangue', 'suv' FROM vehicle_makes WHERE slug = 'ferrari' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('lamborghini', 'Lamborghini', 'لامبورجيني', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'urus', 'Urus', 'Urus', 'suv' FROM vehicle_makes WHERE slug = 'lamborghini' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'huracan', 'Huracán', 'Huracán', 'coupe' FROM vehicle_makes WHERE slug = 'lamborghini' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'revuelto', 'Revuelto', 'Revuelto', 'coupe' FROM vehicle_makes WHERE slug = 'lamborghini' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('aston-martin', 'Aston Martin', 'أستون مارتن', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'dbx', 'DBX', 'DBX', 'suv' FROM vehicle_makes WHERE slug = 'aston-martin' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'db12', 'DB12', 'DB12', 'coupe' FROM vehicle_makes WHERE slug = 'aston-martin' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'vantage', 'Vantage', 'Vantage', 'coupe' FROM vehicle_makes WHERE slug = 'aston-martin' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('mclaren', 'McLaren', 'ماكلارين', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'gt', 'GT', 'GT', 'coupe' FROM vehicle_makes WHERE slug = 'mclaren' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'artura', 'Artura', 'Artura', 'coupe' FROM vehicle_makes WHERE slug = 'mclaren' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '720s', '720S', '720S', 'coupe' FROM vehicle_makes WHERE slug = 'mclaren' ON CONFLICT (make_id, slug) DO NOTHING;

-- Lock down the public API: the app talks to Postgres directly from the server,
-- so Supabase's anon/authenticated API roles get no access to any table.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END $$;

-- Record the migration so future migrations continue from here.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('6870c4f47269d6c12aa952ef16ac5cc67eeb42aaa78a1c3f3b167e9a52c0373b', 1792860094589);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('8819b5613e91dbb278abf50eda98b2a83c3eb97ac9ac472242320c7e88c09958', 1792866478440);

COMMIT;

SELECT (SELECT count(*) FROM cities) AS governorates, (SELECT count(*) FROM vehicle_makes) AS makes, (SELECT count(*) FROM vehicle_models) AS models;
