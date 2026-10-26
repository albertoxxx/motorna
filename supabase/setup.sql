-- MOTORNA database setup (generated 2026-10-26)
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

-- 0002_known_defects.sql
ALTER TABLE "listings" ADD COLUMN "known_defects" text;
ALTER TABLE "listings" ADD CONSTRAINT "listings_known_defects_length" CHECK ("listings"."known_defects" IS NULL OR char_length("listings"."known_defects") <= 2000);

-- 0003_care_centers.sql
CREATE TYPE "public"."care_category" AS ENUM('pre_purchase_inspection', 'oil_change', 'routine_maintenance', 'diagnostics', 'brakes', 'tires', 'air_conditioning', 'electrical', 'bodywork', 'other');
CREATE TYPE "public"."center_staff_role" AS ENUM('owner', 'manager', 'technician');
CREATE TYPE "public"."center_status" AS ENUM('applied', 'under_review', 'approved', 'suspended', 'revoked', 'rejected');
CREATE TYPE "public"."credential_kind" AS ENUM('commercial_register', 'tax_card', 'brand_authorization', 'other');
CREATE TYPE "public"."price_mode" AS ENUM('fixed', 'quote');
CREATE TYPE "public"."review_state" AS ENUM('pending', 'accepted', 'rejected');
CREATE TABLE "center_approval_checks" (
	"center_id" uuid NOT NULL,
	"criterion" text NOT NULL,
	"passed" boolean NOT NULL,
	"note" text,
	"checked_by_id" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_approval_checks_center_id_criterion_pk" PRIMARY KEY("center_id","criterion")
);

CREATE TABLE "center_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"kind" "credential_kind" NOT NULL,
	"number" text,
	"file_key" text NOT NULL,
	"content_type" text NOT NULL,
	"expires_at" timestamp with time zone,
	"review_state" "review_state" DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"uploaded_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "center_hours" (
	"center_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"opens" text NOT NULL,
	"closes" text NOT NULL,
	CONSTRAINT "center_hours_center_id_weekday_pk" PRIMARY KEY("center_id","weekday"),
	CONSTRAINT "center_hours_weekday" CHECK ("center_hours"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "center_hours_format" CHECK ("center_hours"."opens" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "center_hours"."closes" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "center_hours"."opens" < "center_hours"."closes")
);

CREATE TABLE "center_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"category" "care_category" NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"price_mode" "price_mode" NOT NULL,
	"price_egp" integer,
	"duration_min" smallint DEFAULT 60 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_services_price" CHECK (("center_services"."price_mode" = 'quote' AND "center_services"."price_egp" IS NULL) OR ("center_services"."price_mode" = 'fixed' AND "center_services"."price_egp" BETWEEN 1 AND 1000000)),
	CONSTRAINT "center_services_duration" CHECK ("center_services"."duration_min" BETWEEN 10 AND 1440)
);

CREATE TABLE "center_staff" (
	"center_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "center_staff_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"added_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_staff_center_id_user_id_pk" PRIMARY KEY("center_id","user_id")
);

CREATE TABLE "service_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"city_id" smallint NOT NULL,
	"area" text,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"website" text,
	"description" text DEFAULT '' NOT NULL,
	"vehicle_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"quotation_policy" text DEFAULT '' NOT NULL,
	"status" "center_status" DEFAULT 'applied' NOT NULL,
	"status_reason" text,
	"approved_at" timestamp with time zone,
	"approved_by_id" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_centers_slug_unique" UNIQUE("slug"),
	CONSTRAINT "service_centers_description_length" CHECK (char_length("service_centers"."description") <= 3000)
);

ALTER TABLE "center_approval_checks" ADD CONSTRAINT "center_approval_checks_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_approval_checks" ADD CONSTRAINT "center_approval_checks_checked_by_id_users_id_fk" FOREIGN KEY ("checked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "center_credentials" ADD CONSTRAINT "center_credentials_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_credentials" ADD CONSTRAINT "center_credentials_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "center_credentials" ADD CONSTRAINT "center_credentials_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "center_hours" ADD CONSTRAINT "center_hours_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_services" ADD CONSTRAINT "center_services_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_staff" ADD CONSTRAINT "center_staff_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_staff" ADD CONSTRAINT "center_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_staff" ADD CONSTRAINT "center_staff_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "service_centers" ADD CONSTRAINT "service_centers_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "service_centers" ADD CONSTRAINT "service_centers_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "service_centers" ADD CONSTRAINT "service_centers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "center_credentials_center_idx" ON "center_credentials" USING btree ("center_id");
CREATE INDEX "center_services_center_idx" ON "center_services" USING btree ("center_id");
CREATE INDEX "center_staff_user_idx" ON "center_staff" USING btree ("user_id");
CREATE INDEX "service_centers_status_idx" ON "service_centers" USING btree ("status");
CREATE INDEX "service_centers_city_idx" ON "service_centers" USING btree ("city_id");
CREATE OR REPLACE FUNCTION "audit_logs_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- The only permitted change: actor_id set to NULL by the FK when a user account is deleted.
  IF TG_OP = 'UPDATE' AND NEW.actor_id IS NULL AND NEW.id = OLD.id AND NEW.action = OLD.action
     AND NEW.entity_type = OLD.entity_type AND NEW.entity_id = OLD.entity_id
     AND NEW.metadata = OLD.metadata AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;
DROP TRIGGER IF EXISTS "audit_logs_no_update_delete" ON "audit_logs";
CREATE TRIGGER "audit_logs_no_update_delete" BEFORE UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION "audit_logs_immutable"();

DROP TRIGGER IF EXISTS "audit_logs_no_truncate" ON "audit_logs";
CREATE TRIGGER "audit_logs_no_truncate" BEFORE TRUNCATE ON "audit_logs" FOR EACH STATEMENT EXECUTE FUNCTION "audit_logs_immutable"();


-- 0004_care_workflow.sql
CREATE TYPE "public"."equipment_kind" AS ENUM('obd_scanner', 'paint_thickness_gauge', 'lift', 'wheel_alignment', 'tire_changer', 'ac_service_station', 'battery_tester', 'brake_tester', 'emissions_analyzer', 'other');
ALTER TYPE "public"."center_status" ADD VALUE 'draft' BEFORE 'applied';
ALTER TYPE "public"."center_status" ADD VALUE 'changes_requested' BEFORE 'approved';
CREATE TABLE "center_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"kind" "equipment_kind" NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_equipment_details_length" CHECK ("center_equipment"."details" IS NULL OR char_length("center_equipment"."details") <= 200)
);

CREATE TABLE "center_review_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_review_notes_length" CHECK (char_length("center_review_notes"."body") BETWEEN 1 AND 2000)
);

CREATE TABLE "center_technicians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"specialty" text,
	"years_experience" smallint,
	"certifications" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_technicians_years" CHECK ("center_technicians"."years_experience" IS NULL OR "center_technicians"."years_experience" BETWEEN 0 AND 60)
);

ALTER TABLE "service_centers" ADD COLUMN "last_verified_at" timestamp with time zone;
ALTER TABLE "service_centers" ADD COLUMN "submitted_at" timestamp with time zone;
ALTER TABLE "center_equipment" ADD CONSTRAINT "center_equipment_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_review_notes" ADD CONSTRAINT "center_review_notes_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_review_notes" ADD CONSTRAINT "center_review_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "center_technicians" ADD CONSTRAINT "center_technicians_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "center_equipment_center_idx" ON "center_equipment" USING btree ("center_id");
CREATE INDEX "center_review_notes_center_idx" ON "center_review_notes" USING btree ("center_id");
CREATE INDEX "center_technicians_center_idx" ON "center_technicians" USING btree ("center_id");
UPDATE "service_centers" SET "last_verified_at" = "approved_at" WHERE "approved_at" IS NOT NULL AND "last_verified_at" IS NULL;


-- 0005_listing_phone_consent.sql
ALTER TABLE "listings" ADD COLUMN "show_phone" boolean DEFAULT false NOT NULL;
-- Keep any consent sellers already gave in their profile (opt-in only; default stays off).
UPDATE "listings" SET "show_phone" = true FROM "users" WHERE "users"."id" = "listings"."seller_id" AND "users"."show_phone" = true AND "users"."phone" IS NOT NULL;


-- 0006_care_providers.sql
CREATE TYPE "public"."provider_category" AS ENUM('authorized_service', 'independent_workshop', 'inspection_center');
ALTER TYPE "public"."credential_kind" ADD VALUE 'sample_report';
CREATE TABLE "center_makes" (
	"center_id" uuid NOT NULL,
	"make_id" smallint NOT NULL,
	CONSTRAINT "center_makes_center_id_make_id_pk" PRIMARY KEY("center_id","make_id")
);

CREATE TABLE "center_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"thumb_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"uploaded_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "service_centers" ADD COLUMN "category" "provider_category" DEFAULT 'independent_workshop' NOT NULL;
ALTER TABLE "service_centers" ADD COLUMN "latitude" double precision;
ALTER TABLE "service_centers" ADD COLUMN "longitude" double precision;
ALTER TABLE "center_makes" ADD CONSTRAINT "center_makes_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_makes" ADD CONSTRAINT "center_makes_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "center_photos" ADD CONSTRAINT "center_photos_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_photos" ADD CONSTRAINT "center_photos_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "center_makes_make_idx" ON "center_makes" USING btree ("make_id");
CREATE INDEX "center_photos_center_idx" ON "center_photos" USING btree ("center_id","position");
CREATE INDEX "service_centers_category_idx" ON "service_centers" USING btree ("category");
ALTER TABLE "service_centers" ADD CONSTRAINT "service_centers_coords" CHECK (("service_centers"."latitude" IS NULL AND "service_centers"."longitude" IS NULL) OR ("service_centers"."latitude" BETWEEN 21 AND 32 AND "service_centers"."longitude" BETWEEN 24 AND 37));
-- Existing centers that offer pre-purchase inspection become inspection providers; the rest stay independent workshops.
UPDATE "service_centers" SET "category" = 'inspection_center' WHERE EXISTS (SELECT 1 FROM "center_services" s WHERE s."center_id" = "service_centers"."id" AND s."category" = 'pre_purchase_inspection' AND s."active");


-- 0007_notifications.sql
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"href" text NOT NULL,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_href_local" CHECK ("notifications"."href" LIKE '/%' AND "notifications"."href" NOT LIKE '//%')
);

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");
CREATE UNIQUE INDEX "notifications_unread_dedupe_idx" ON "notifications" USING btree ("user_id","dedupe_key") WHERE "notifications"."read_at" IS NULL AND "notifications"."dedupe_key" IS NOT NULL;

-- 0008_care_booking.sql
CREATE TYPE "public"."agreement_status" AS ENUM('draft', 'active', 'ended');
CREATE TYPE "public"."booking_actor_role" AS ENUM('customer', 'provider', 'admin', 'system');
CREATE TYPE "public"."booking_mode" AS ENUM('slots', 'manual');
CREATE TYPE "public"."booking_status" AS ENUM('pending_provider', 'alternative_proposed', 'awaiting_customer', 'confirmed', 'checked_in', 'completed', 'declined', 'cancelled_customer', 'cancelled_provider', 'no_show', 'expired', 'disputed');
CREATE TYPE "public"."commission_basis" AS ENUM('percent', 'fixed');
CREATE TYPE "public"."dispute_kind" AS ENUM('no_show_dispute', 'late_cancellation', 'service_unavailable', 'completion_disagreement', 'price_disagreement', 'conduct', 'support', 'other');
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE "public"."ledger_status" AS ENUM('pending_verification', 'confirmed', 'disputed', 'payable', 'settled', 'waived');
CREATE TYPE "public"."settlement_schedule" AS ENUM('monthly', 'biweekly');
CREATE TYPE "public"."settlement_status" AS ENUM('open', 'issued', 'settled', 'void');
CREATE TYPE "public"."time_option_kind" AS ENUM('requested', 'proposed');
CREATE TYPE "public"."time_option_state" AS ENUM('open', 'accepted', 'declined', 'withdrawn');
ALTER TYPE "public"."price_mode" ADD VALUE IF NOT EXISTS 'estimate';
CREATE TABLE "booking_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"opened_by_id" text,
	"opened_by_role" "booking_actor_role" NOT NULL,
	"kind" "dispute_kind" NOT NULL,
	"description" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"prior_status" "booking_status",
	"outcome_status" "booking_status",
	"resolution" text,
	"resolved_by_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_disputes_desc_len" CHECK (char_length("booking_disputes"."description") BETWEEN 5 AND 2000)
);

CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"actor_id" text,
	"actor_role" "booking_actor_role" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "booking_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"author_id" text,
	"author_role" "booking_actor_role" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_messages_len" CHECK (char_length("booking_messages"."body") BETWEEN 1 AND 1000)
);

CREATE TABLE "booking_time_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" time_option_kind NOT NULL,
	"round" smallint DEFAULT 1 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"state" time_option_state DEFAULT 'open' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_time_options_range" CHECK ("booking_time_options"."ends_at" > "booking_time_options"."starts_at")
);

CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"center_id" uuid NOT NULL,
	"service_id" uuid,
	"customer_id" text NOT NULL,
	"vehicle_id" uuid,
	"status" "booking_status" DEFAULT 'pending_provider' NOT NULL,
	"mode" "booking_mode" NOT NULL,
	"service_name_ar" text NOT NULL,
	"service_name_en" text NOT NULL,
	"service_category" "care_category" NOT NULL,
	"price_mode" "price_mode" NOT NULL,
	"price_egp" integer,
	"price_max_egp" integer,
	"duration_min" smallint NOT NULL,
	"vehicle_make_id" smallint NOT NULL,
	"vehicle_model_id" integer,
	"vehicle_model_text" text,
	"vehicle_year" smallint NOT NULL,
	"vehicle_mileage_km" integer,
	"cancel_cutoff_hours" smallint NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"customer_note" text,
	"status_reason" text,
	"late_cancel" boolean DEFAULT false NOT NULL,
	"request_key" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"pre_dispute_status" "booking_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_unique" UNIQUE("reference"),
	CONSTRAINT "bookings_time_range" CHECK (("bookings"."starts_at" IS NULL AND "bookings"."ends_at" IS NULL) OR ("bookings"."ends_at" > "bookings"."starts_at")),
	CONSTRAINT "bookings_confirmed_has_time" CHECK ("bookings"."status"::text NOT IN ('confirmed', 'checked_in', 'completed', 'no_show') OR "bookings"."starts_at" IS NOT NULL),
	CONSTRAINT "bookings_note_len" CHECK ("bookings"."customer_note" IS NULL OR char_length("bookings"."customer_note") <= 1000),
	CONSTRAINT "bookings_reference_format" CHECK ("bookings"."reference" ~ '^MC-[A-Z0-9]{6,10}$')
);

CREATE TABLE "center_booking_settings" (
	"center_id" uuid PRIMARY KEY NOT NULL,
	"pilot_enabled" boolean DEFAULT false NOT NULL,
	"pilot_enabled_by_id" text,
	"pilot_enabled_at" timestamp with time zone,
	"accepting" boolean DEFAULT false NOT NULL,
	"mode" "booking_mode" DEFAULT 'manual' NOT NULL,
	"slot_interval_min" smallint DEFAULT 30 NOT NULL,
	"capacity" smallint DEFAULT 1 NOT NULL,
	"min_notice_hours" smallint DEFAULT 4 NOT NULL,
	"max_advance_days" smallint DEFAULT 30 NOT NULL,
	"cancel_cutoff_hours" smallint DEFAULT 12 NOT NULL,
	"policy_ar" text DEFAULT '' NOT NULL,
	"policy_en" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cbs_interval" CHECK ("center_booking_settings"."slot_interval_min" IN (15, 30, 60)),
	CONSTRAINT "cbs_capacity" CHECK ("center_booking_settings"."capacity" BETWEEN 1 AND 50),
	CONSTRAINT "cbs_notice" CHECK ("center_booking_settings"."min_notice_hours" BETWEEN 0 AND 168),
	CONSTRAINT "cbs_advance" CHECK ("center_booking_settings"."max_advance_days" BETWEEN 1 AND 90),
	CONSTRAINT "cbs_cutoff" CHECK ("center_booking_settings"."cancel_cutoff_hours" BETWEEN 0 AND 72),
	CONSTRAINT "cbs_policy_len" CHECK (char_length("center_booking_settings"."policy_ar") <= 1000 AND char_length("center_booking_settings"."policy_en") <= 1000)
);

CREATE TABLE "center_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_closures_range" CHECK ("center_closures"."ends_at" > "center_closures"."starts_at")
);

CREATE TABLE "center_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"center_id" uuid NOT NULL,
	"customer_id" text NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"hidden_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_reviews_bookingId_unique" UNIQUE("booking_id"),
	CONSTRAINT "center_reviews_rating" CHECK ("center_reviews"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "center_reviews_comment_len" CHECK ("center_reviews"."comment" IS NULL OR char_length("center_reviews"."comment") <= 1000)
);

CREATE TABLE "commission_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ledger_id" uuid NOT NULL,
	"delta_egp" integer NOT NULL,
	"reason" text NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_adjustments_delta" CHECK ("commission_adjustments"."delta_egp" <> 0 AND "commission_adjustments"."delta_egp" BETWEEN -1000000 AND 1000000),
	CONSTRAINT "commission_adjustments_reason_len" CHECK (char_length("commission_adjustments"."reason") BETWEEN 3 AND 500)
);

CREATE TABLE "commission_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"status" "agreement_status" DEFAULT 'draft' NOT NULL,
	"basis" "commission_basis" NOT NULL,
	"percent_bps" integer,
	"fixed_egp" integer,
	"categories" "care_category"[],
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"exceptions" text,
	"settlement_schedule" "settlement_schedule" DEFAULT 'monthly' NOT NULL,
	"contract_reference" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_agreements_terms" CHECK (("commission_agreements"."basis"::text = 'percent' AND "commission_agreements"."percent_bps" BETWEEN 1 AND 5000 AND "commission_agreements"."fixed_egp" IS NULL) OR ("commission_agreements"."basis"::text = 'fixed' AND "commission_agreements"."fixed_egp" BETWEEN 1 AND 100000 AND "commission_agreements"."percent_bps" IS NULL)),
	CONSTRAINT "commission_agreements_range" CHECK ("commission_agreements"."effective_to" IS NULL OR "commission_agreements"."effective_to" > "commission_agreements"."effective_from")
);

CREATE TABLE "commission_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"center_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"booking_reference" text NOT NULL,
	"source" text DEFAULT 'motorna_booking' NOT NULL,
	"agreed_price_egp" integer,
	"completed_amount_egp" integer NOT NULL,
	"basis" "commission_basis" NOT NULL,
	"percent_bps" integer,
	"fixed_egp" integer,
	"commission_egp" integer NOT NULL,
	"provider_confirmed_at" timestamp with time zone NOT NULL,
	"customer_confirmed_at" timestamp with time zone,
	"status" "ledger_status" DEFAULT 'pending_verification' NOT NULL,
	"settlement_id" uuid,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_ledger_bookingId_unique" UNIQUE("booking_id"),
	CONSTRAINT "commission_ledger_amounts" CHECK ("commission_ledger"."completed_amount_egp" >= 0 AND "commission_ledger"."commission_egp" BETWEEN 0 AND "commission_ledger"."completed_amount_egp")
);

CREATE TABLE "commission_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"total_egp" integer NOT NULL,
	"status" "settlement_status" DEFAULT 'issued' NOT NULL,
	"payment_note" text,
	"settled_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_settlements_reference_unique" UNIQUE("reference"),
	CONSTRAINT "commission_settlements_range" CHECK ("commission_settlements"."period_end" > "commission_settlements"."period_start")
);

CREATE TABLE "customer_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"make_id" smallint NOT NULL,
	"model_id" integer,
	"year" smallint NOT NULL,
	"mileage_km" integer,
	"nickname" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_vehicles_year" CHECK ("customer_vehicles"."year" BETWEEN 1950 AND 2100),
	CONSTRAINT "customer_vehicles_mileage" CHECK ("customer_vehicles"."mileage_km" IS NULL OR "customer_vehicles"."mileage_km" BETWEEN 0 AND 3000000)
);

CREATE TABLE "service_completions" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"attended" boolean NOT NULL,
	"service_completed" boolean NOT NULL,
	"final_amount_egp" integer,
	"work_summary" text,
	"mileage_km" integer,
	"recorded_by_id" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_confirmed_at" timestamp with time zone,
	"confirm_reminder_sent_at" timestamp with time zone,
	CONSTRAINT "service_completions_amount" CHECK ("service_completions"."final_amount_egp" IS NULL OR "service_completions"."final_amount_egp" BETWEEN 0 AND 5000000),
	CONSTRAINT "service_completions_summary_len" CHECK ("service_completions"."work_summary" IS NULL OR char_length("service_completions"."work_summary") <= 2000)
);

ALTER TABLE "center_services" DROP CONSTRAINT "center_services_price";
ALTER TABLE "center_services" ADD COLUMN "price_max_egp" integer;
ALTER TABLE "center_services" ADD COLUMN "bookable" boolean DEFAULT true NOT NULL;
ALTER TABLE "booking_disputes" ADD CONSTRAINT "booking_disputes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "booking_disputes" ADD CONSTRAINT "booking_disputes_opened_by_id_users_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "booking_disputes" ADD CONSTRAINT "booking_disputes_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "booking_time_options" ADD CONSTRAINT "booking_time_options_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "booking_time_options" ADD CONSTRAINT "booking_time_options_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_center_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."center_services"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_customer_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."customer_vehicles"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_make_id_vehicle_makes_id_fk" FOREIGN KEY ("vehicle_make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_model_id_vehicle_models_id_fk" FOREIGN KEY ("vehicle_model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "center_booking_settings" ADD CONSTRAINT "center_booking_settings_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_booking_settings" ADD CONSTRAINT "center_booking_settings_pilot_enabled_by_id_users_id_fk" FOREIGN KEY ("pilot_enabled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "center_closures" ADD CONSTRAINT "center_closures_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_closures" ADD CONSTRAINT "center_closures_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "center_reviews" ADD CONSTRAINT "center_reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_reviews" ADD CONSTRAINT "center_reviews_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_reviews" ADD CONSTRAINT "center_reviews_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "commission_adjustments" ADD CONSTRAINT "commission_adjustments_ledger_id_commission_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."commission_ledger"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "commission_adjustments" ADD CONSTRAINT "commission_adjustments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_agreement_id_commission_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."commission_agreements"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_settlement_id_commission_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."commission_settlements"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "commission_settlements" ADD CONSTRAINT "commission_settlements_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "commission_settlements" ADD CONSTRAINT "commission_settlements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "customer_vehicles" ADD CONSTRAINT "customer_vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "customer_vehicles" ADD CONSTRAINT "customer_vehicles_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "customer_vehicles" ADD CONSTRAINT "customer_vehicles_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "booking_disputes_booking_idx" ON "booking_disputes" USING btree ("booking_id");
CREATE INDEX "booking_disputes_status_idx" ON "booking_disputes" USING btree ("status","created_at");
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id","created_at");
CREATE INDEX "booking_messages_booking_idx" ON "booking_messages" USING btree ("booking_id","created_at");
CREATE INDEX "booking_time_options_booking_idx" ON "booking_time_options" USING btree ("booking_id");
CREATE UNIQUE INDEX "bookings_request_key_uq" ON "bookings" USING btree ("customer_id","request_key");
CREATE INDEX "bookings_center_idx" ON "bookings" USING btree ("center_id","status","starts_at");
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id","created_at");
CREATE INDEX "center_closures_center_idx" ON "center_closures" USING btree ("center_id","starts_at");
CREATE INDEX "center_reviews_center_idx" ON "center_reviews" USING btree ("center_id","created_at");
CREATE INDEX "commission_adjustments_ledger_idx" ON "commission_adjustments" USING btree ("ledger_id");
CREATE INDEX "commission_agreements_center_idx" ON "commission_agreements" USING btree ("center_id","status");
CREATE INDEX "commission_ledger_center_idx" ON "commission_ledger" USING btree ("center_id","completed_at");
CREATE INDEX "commission_ledger_status_idx" ON "commission_ledger" USING btree ("status");
CREATE INDEX "commission_settlements_center_idx" ON "commission_settlements" USING btree ("center_id","period_start");
CREATE INDEX "customer_vehicles_user_idx" ON "customer_vehicles" USING btree ("user_id");
ALTER TABLE "center_services" ADD CONSTRAINT "center_services_price_v2" CHECK (("center_services"."price_mode"::text = 'quote' AND "center_services"."price_egp" IS NULL AND "center_services"."price_max_egp" IS NULL) OR ("center_services"."price_mode"::text = 'fixed' AND "center_services"."price_egp" BETWEEN 1 AND 1000000 AND "center_services"."price_max_egp" IS NULL) OR ("center_services"."price_mode"::text = 'estimate' AND "center_services"."price_egp" BETWEEN 1 AND 1000000 AND ("center_services"."price_max_egp" IS NULL OR "center_services"."price_max_egp" BETWEEN "center_services"."price_egp" AND 1000000)));
CREATE OR REPLACE FUNCTION "booking_events_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Allowed: actor_id set to NULL when a user is deleted; rows removed only together with their booking.
  IF TG_OP = 'UPDATE' AND NEW.actor_id IS NULL AND NEW.id = OLD.id AND NEW.booking_id = OLD.booking_id
     AND NEW.action = OLD.action AND NEW.to_status = OLD.to_status
     AND NEW.from_status IS NOT DISTINCT FROM OLD.from_status AND NEW.note IS NOT DISTINCT FROM OLD.note
     AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "bookings" WHERE "id" = OLD.booking_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'booking_events is append-only';
END;
$$;
DROP TRIGGER IF EXISTS "booking_events_no_update_delete" ON "booking_events";
CREATE TRIGGER "booking_events_no_update_delete" BEFORE UPDATE OR DELETE ON "booking_events" FOR EACH ROW EXECUTE FUNCTION "booking_events_immutable"();
CREATE OR REPLACE FUNCTION "commission_adjustments_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.created_by_id IS NULL AND NEW.id = OLD.id AND NEW.ledger_id = OLD.ledger_id
     AND NEW.delta_egp = OLD.delta_egp AND NEW.reason = OLD.reason AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'commission_adjustments is append-only';
END;
$$;
DROP TRIGGER IF EXISTS "commission_adjustments_no_update_delete" ON "commission_adjustments";
CREATE TRIGGER "commission_adjustments_no_update_delete" BEFORE UPDATE OR DELETE ON "commission_adjustments" FOR EACH ROW EXECUTE FUNCTION "commission_adjustments_immutable"();
CREATE OR REPLACE FUNCTION "commission_ledger_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_ledger rows are never deleted (waive them instead)';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM "bookings" WHERE "id" = NEW.booking_id AND "status" = 'completed' AND "center_id" = NEW.center_id) THEN
      RAISE EXCEPTION 'commission is recorded only for a completed booking of the same center';
    END IF;
    IF NEW.status <> 'pending_verification' OR NEW.settlement_id IS NOT NULL THEN
      RAISE EXCEPTION 'a new commission record starts as pending_verification';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: the commercial facts are frozen; only status, settlement link and customer confirmation move.
  IF NEW.booking_id <> OLD.booking_id OR NEW.center_id <> OLD.center_id OR NEW.agreement_id <> OLD.agreement_id
     OR NEW.booking_reference <> OLD.booking_reference OR NEW.completed_amount_egp <> OLD.completed_amount_egp
     OR NEW.commission_egp <> OLD.commission_egp OR NEW.basis <> OLD.basis
     OR NEW.percent_bps IS DISTINCT FROM OLD.percent_bps OR NEW.fixed_egp IS DISTINCT FROM OLD.fixed_egp
     OR NEW.agreed_price_egp IS DISTINCT FROM OLD.agreed_price_egp OR NEW.provider_confirmed_at <> OLD.provider_confirmed_at
     OR NEW.completed_at <> OLD.completed_at OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'commission_ledger amounts are immutable (use commission_adjustments)';
  END IF;
  IF OLD.status IN ('settled', 'waived') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'settled or waived commission records are final';
  END IF;
  IF NEW.status = 'settled' AND OLD.status <> 'payable' THEN
    RAISE EXCEPTION 'only a payable commission (in an issued settlement) can be settled';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "commission_ledger_guard_trg" ON "commission_ledger";
CREATE TRIGGER "commission_ledger_guard_trg" BEFORE INSERT OR UPDATE OR DELETE ON "commission_ledger" FOR EACH ROW EXECUTE FUNCTION "commission_ledger_guard"();
CREATE OR REPLACE FUNCTION "commission_agreements_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'only draft agreements can be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND (NEW.center_id <> OLD.center_id OR NEW.basis <> OLD.basis
     OR NEW.percent_bps IS DISTINCT FROM OLD.percent_bps OR NEW.fixed_egp IS DISTINCT FROM OLD.fixed_egp
     OR NEW.categories IS DISTINCT FROM OLD.categories OR NEW.effective_from <> OLD.effective_from
     OR NEW.settlement_schedule <> OLD.settlement_schedule OR NEW.exceptions IS DISTINCT FROM OLD.exceptions
     OR NEW.contract_reference IS DISTINCT FROM OLD.contract_reference) THEN
    RAISE EXCEPTION 'active or ended agreements are immutable (end it and create a new one)';
  END IF;
  IF OLD.status = 'ended' AND NEW.status <> 'ended' THEN RAISE EXCEPTION 'an ended agreement cannot be reopened'; END IF;
  IF OLD.status = 'active' AND NEW.status = 'draft' THEN RAISE EXCEPTION 'an active agreement cannot return to draft'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "commission_agreements_guard_trg" ON "commission_agreements";
CREATE TRIGGER "commission_agreements_guard_trg" BEFORE UPDATE OR DELETE ON "commission_agreements" FOR EACH ROW EXECUTE FUNCTION "commission_agreements_guard"();


-- 0009_seller_verification.sql
CREATE TYPE "public"."licence_check_status" AS ENUM('pending', 'accepted', 'rejected');
CREATE TABLE "listing_licence_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"front_key" text,
	"back_key" text,
	"front_type" text,
	"back_type" text,
	"status" "licence_check_status" DEFAULT 'pending' NOT NULL,
	"snapshot_make_id" smallint NOT NULL,
	"snapshot_model_id" integer,
	"snapshot_year" smallint NOT NULL,
	"licence_expires_at" timestamp with time zone,
	"review_note" text,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"submitted_by_id" text NOT NULL,
	"files_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_licence_checks_note_len" CHECK ("listing_licence_checks"."review_note" IS NULL OR char_length("listing_licence_checks"."review_note") <= 500)
);

CREATE TABLE "phone_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_verifications_attempts" CHECK ("phone_verifications"."attempts" BETWEEN 0 AND 10)
);

ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "phone_verified_number" text;
ALTER TABLE "listing_licence_checks" ADD CONSTRAINT "listing_licence_checks_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "listing_licence_checks" ADD CONSTRAINT "listing_licence_checks_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "listing_licence_checks" ADD CONSTRAINT "listing_licence_checks_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "listing_licence_checks_listing_idx" ON "listing_licence_checks" USING btree ("listing_id","created_at");
CREATE INDEX "listing_licence_checks_status_idx" ON "listing_licence_checks" USING btree ("status","created_at");
CREATE UNIQUE INDEX "listing_licence_checks_one_pending" ON "listing_licence_checks" USING btree ("listing_id") WHERE "listing_licence_checks"."status" = 'pending';
CREATE INDEX "phone_verifications_user_idx" ON "phone_verifications" USING btree ("user_id","created_at");

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
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('c76ea95a47a93caee5552f6ba2c81e5014d0be46ec3a3caa7b767bb69cf0a687', 1792872332753);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('e52bfd34ff77e71057125f4648f3aa9b85d21a95a7847ee17765dfbf11f83500', 1792879526593);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('e08864dca6141d2eedd1d0e4d2ebd5117fb1fe8b2b3b2985eecb4892c7244087', 1792881482945);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('dcf935a2b481a45983626ee3b72751ea5f47fb40f4232dacba6f7f9f8cb9de8f', 1792884569832);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('ed6847f25fffdc4b68cfbd14be3dd8e4706063b48dfb609642d5e85c7ba3cbef', 1792915369555);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('67c63f5fb637a5e5cdd7ed2b91efe9ad7d9eaf16cbe3d84e459cf7fc1af57e98', 1792916603683);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('405141f61e000f3436fa141375ff2808427904623f95f7f1818d1a86be63c41f', 1792924459218);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('eae86f13473485d46aae9921f4258014d2acc96697f83464fff90d7df142653c', 1793024763988);

COMMIT;

SELECT (SELECT count(*) FROM cities) AS governorates, (SELECT count(*) FROM vehicle_makes) AS makes, (SELECT count(*) FROM vehicle_models) AS models;
