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
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'yaris', 'Yaris', 'ياريس', 'hatchback' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c-hr', 'C-HR', 'سي إتش آر', 'crossover' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rav4', 'RAV4', 'راف فور', 'suv' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'fortuner', 'Fortuner', 'فورتشنر', 'suv' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'hilux', 'Hilux', 'هايلكس', 'pickup' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'camry', 'Camry', 'كامري', 'sedan' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'land-cruiser', 'Land Cruiser', 'لاند كروزر', 'suv' FROM vehicle_makes WHERE slug = 'toyota' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('hyundai', 'Hyundai', 'هيونداي', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'elantra', 'Elantra', 'إلنترا', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'accent', 'Accent', 'أكسنت', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'verna', 'Verna', 'فيرنا', 'sedan' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'i10', 'i10', 'آي 10', 'hatchback' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tucson', 'Tucson', 'توسان', 'suv' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'creta', 'Creta', 'كريتا', 'crossover' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'bayon', 'Bayon', 'بايون', 'crossover' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'santa-fe', 'Santa Fe', 'سانتا في', 'suv' FROM vehicle_makes WHERE slug = 'hyundai' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('kia', 'Kia', 'كيا', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cerato', 'Cerato', 'سيراتو', 'sedan' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'pegas', 'Pegas', 'بيجاس', 'sedan' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'picanto', 'Picanto', 'بيكانتو', 'hatchback' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rio', 'Rio', 'ريو', 'hatchback' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sportage', 'Sportage', 'سبورتاج', 'suv' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'seltos', 'Seltos', 'سيلتوس', 'crossover' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sorento', 'Sorento', 'سورينتو', 'suv' FROM vehicle_makes WHERE slug = 'kia' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('nissan', 'Nissan', 'نيسان', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sunny', 'Sunny', 'صني', 'sedan' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sentra', 'Sentra', 'سنترا', 'sedan' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'qashqai', 'Qashqai', 'قاشقاي', 'crossover' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'juke', 'Juke', 'جوك', 'crossover' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x-trail', 'X-Trail', 'إكس تريل', 'suv' FROM vehicle_makes WHERE slug = 'nissan' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('chevrolet', 'Chevrolet', 'شيفروليه', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'optra', 'Optra', 'أوبترا', 'sedan' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'aveo', 'Aveo', 'أفيو', 'sedan' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'lanos', 'Lanos', 'لانوس', 'sedan' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cruze', 'Cruze', 'كروز', 'sedan' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'captiva', 'Captiva', 'كابتيفا', 'suv' FROM vehicle_makes WHERE slug = 'chevrolet' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('mg', 'MG', 'إم جي', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'zs', 'ZS', 'زد إس', 'crossover' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mg5', 'MG5', 'إم جي 5', 'sedan' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'mg6', 'MG6', 'إم جي 6', 'sedan' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'rx5', 'RX5', 'آر إكس 5', 'suv' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'hs', 'HS', 'إتش إس', 'suv' FROM vehicle_makes WHERE slug = 'mg' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('chery', 'Chery', 'شيري', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-4', 'Tiggo 4', 'تيجو 4', 'crossover' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-7', 'Tiggo 7', 'تيجو 7', 'suv' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiggo-8', 'Tiggo 8', 'تيجو 8', 'suv' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'arrizo-5', 'Arrizo 5', 'أريزو 5', 'sedan' FROM vehicle_makes WHERE slug = 'chery' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('renault', 'Renault', 'رينو', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'logan', 'Logan', 'لوجان', 'sedan' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'sandero', 'Sandero', 'سانديرو', 'hatchback' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'duster', 'Duster', 'داستر', 'suv' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'megane', 'Megane', 'ميجان', 'sedan' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'kadjar', 'Kadjar', 'كادجار', 'crossover' FROM vehicle_makes WHERE slug = 'renault' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('peugeot', 'Peugeot', 'بيجو', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '301', '301', '301', 'sedan' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '2008', '2008', '2008', 'crossover' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '3008', '3008', '3008', 'suv' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '5008', '5008', '5008', 'suv' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '508', '508', '508', 'sedan' FROM vehicle_makes WHERE slug = 'peugeot' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('skoda', 'Skoda', 'سكودا', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'octavia', 'Octavia', 'أوكتافيا', 'sedan' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'kamiq', 'Kamiq', 'كاميك', 'crossover' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'karoq', 'Karoq', 'كاروك', 'suv' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'kodiaq', 'Kodiaq', 'كودياك', 'suv' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'fabia', 'Fabia', 'فابيا', 'hatchback' FROM vehicle_makes WHERE slug = 'skoda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('mitsubishi', 'Mitsubishi', 'ميتسوبيشي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'lancer', 'Lancer', 'لانسر', 'sedan' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'attrage', 'Attrage', 'أتراج', 'sedan' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'eclipse-cross', 'Eclipse Cross', 'إكليبس كروس', 'crossover' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'pajero', 'Pajero', 'باجيرو', 'suv' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'xpander', 'Xpander', 'إكسباندر', 'van' FROM vehicle_makes WHERE slug = 'mitsubishi' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('suzuki', 'Suzuki', 'سوزوكي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'swift', 'Swift', 'سويفت', 'hatchback' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'dzire', 'Dzire', 'ديزاير', 'sedan' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ciaz', 'Ciaz', 'سياز', 'sedan' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'ertiga', 'Ertiga', 'إرتيجا', 'van' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'vitara', 'Vitara', 'فيتارا', 'suv' FROM vehicle_makes WHERE slug = 'suzuki' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('honda', 'Honda', 'هوندا', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'civic', 'Civic', 'سيفيك', 'sedan' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'city', 'City', 'سيتي', 'sedan' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'cr-v', 'CR-V', 'سي آر في', 'suv' FROM vehicle_makes WHERE slug = 'honda' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('mercedes-benz', 'Mercedes-Benz', 'مرسيدس بنز', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'a-class', 'A-Class', 'A-Class', 'sedan' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'c-class', 'C-Class', 'C-Class', 'sedan' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'e-class', 'E-Class', 'E-Class', 'sedan' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'glc', 'GLC', 'GLC', 'suv' FROM vehicle_makes WHERE slug = 'mercedes-benz' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('bmw', 'BMW', 'بي إم دبليو', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '3-series', '3 Series', 'الفئة الثالثة', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '5-series', '5 Series', 'الفئة الخامسة', 'sedan' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x3', 'X3', 'X3', 'suv' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'x5', 'X5', 'X5', 'suv' FROM vehicle_makes WHERE slug = 'bmw' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('volkswagen', 'Volkswagen', 'فولكس فاجن', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'passat', 'Passat', 'باسات', 'sedan' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'golf', 'Golf', 'جولف', 'hatchback' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tiguan', 'Tiguan', 'تيجوان', 'suv' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'polo', 'Polo', 'بولو', 'hatchback' FROM vehicle_makes WHERE slug = 'volkswagen' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('fiat', 'Fiat', 'فيات', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tipo', 'Tipo', 'تيبو', 'sedan' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '500', '500', '500', 'hatchback' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, '128', '128', '128', 'sedan' FROM vehicle_makes WHERE slug = 'fiat' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('byd', 'BYD', 'بي واي دي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'f3', 'F3', 'F3', 'sedan' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'song-plus', 'Song Plus', 'سونج بلس', 'suv' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'atto-3', 'Atto 3', 'أتو 3', 'crossover' FROM vehicle_makes WHERE slug = 'byd' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('geely', 'Geely', 'جيلي', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'emgrand', 'Emgrand', 'إمجراند', 'sedan' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'coolray', 'Coolray', 'كولراي', 'crossover' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'tugella', 'Tugella', 'توجيلا', 'suv' FROM vehicle_makes WHERE slug = 'geely' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_makes (slug, name_en, name_ar, is_popular) VALUES ('jeep', 'Jeep', 'جيب', false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'renegade', 'Renegade', 'رينيجيد', 'crossover' FROM vehicle_makes WHERE slug = 'jeep' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'compass', 'Compass', 'كومباس', 'suv' FROM vehicle_makes WHERE slug = 'jeep' ON CONFLICT (make_id, slug) DO NOTHING;
INSERT INTO vehicle_models (make_id, slug, name_en, name_ar, body_type) SELECT id, 'grand-cherokee', 'Grand Cherokee', 'جراند شيروكي', 'suv' FROM vehicle_makes WHERE slug = 'jeep' ON CONFLICT (make_id, slug) DO NOTHING;

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

COMMIT;

SELECT (SELECT count(*) FROM cities) AS governorates, (SELECT count(*) FROM vehicle_makes) AS makes, (SELECT count(*) FROM vehicle_models) AS models;
