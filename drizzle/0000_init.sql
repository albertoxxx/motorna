CREATE TYPE "public"."body_type" AS ENUM('sedan', 'hatchback', 'suv', 'crossover', 'pickup', 'van', 'coupe', 'convertible', 'wagon');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel', 'hybrid', 'electric', 'natural_gas');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'published', 'rejected', 'sold', 'archived');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('scam', 'wrong_info', 'duplicate', 'sold', 'offensive', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'dealer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."vehicle_condition" AS ENUM('new', 'used');--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" smallint PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"is_launch" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 100 NOT NULL,
	CONSTRAINT "cities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_distinct_parties" CHECK ("conversations"."buyer_id" <> "conversations"."seller_id")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "listing_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"old_price_egp" bigint,
	"new_price_egp" bigint NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_body_length" CHECK (char_length("messages"."body") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "vehicle_makes" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_makes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	CONSTRAINT "vehicle_makes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vehicle_models" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_models_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"make_id" smallint NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"body_type" "body_type"
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_price_history" ADD CONSTRAINT "listing_price_history_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_listing_buyer_uq" ON "conversations" USING btree ("listing_id","buyer_id");--> statement-breakpoint
CREATE INDEX "conversations_buyer_idx" ON "conversations" USING btree ("buyer_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_seller_idx" ON "conversations" USING btree ("seller_id","last_message_at");--> statement-breakpoint
CREATE INDEX "favorites_listing_idx" ON "favorites" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_images_listing_idx" ON "listing_images" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listing_price_history_listing_idx" ON "listing_price_history" USING btree ("listing_id","changed_at");--> statement-breakpoint
CREATE INDEX "listings_status_published_idx" ON "listings" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "listings_make_model_idx" ON "listings" USING btree ("make_id","model_id");--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "listings" USING btree ("price_egp");--> statement-breakpoint
CREATE INDEX "listings_year_idx" ON "listings" USING btree ("year");--> statement-breakpoint
CREATE INDEX "listings_city_idx" ON "listings" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "listings_seller_idx" ON "listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_listing_idx" ON "reports" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_models_make_slug_uq" ON "vehicle_models" USING btree ("make_id","slug");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");