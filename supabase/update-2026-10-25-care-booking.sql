-- MOTORNA database update (generated 2026-10-25)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
BEGIN;

-- migration 0008_care_booking
DO $mig$ BEGIN
IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '405141f61e000f3436fa141375ff2808427904623f95f7f1818d1a86be63c41f') THEN
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
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('405141f61e000f3436fa141375ff2808427904623f95f7f1818d1a86be63c41f', 1792924459218);
END IF;
END $mig$;

-- Keep new tables/columns closed to Supabase's public API.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END $$;

COMMIT;

SELECT
  (SELECT count(*) FROM drizzle.__drizzle_migrations) AS migrations_applied,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('center_booking_settings','center_closures','customer_vehicles','bookings','booking_time_options','booking_events','booking_messages','service_completions','center_reviews','booking_disputes','commission_agreements','commission_ledger','commission_adjustments','commission_settlements')) AS booking_tables,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('booking_events_no_update_delete','commission_adjustments_no_update_delete','commission_ledger_guard_trg','commission_agreements_guard_trg')) AS integrity_guards,
  (SELECT count(*) FROM center_booking_settings WHERE pilot_enabled) AS pilots_enabled,
  (SELECT count(*) FROM listings) AS listings_kept,
  (SELECT count(*) FROM service_centers) AS centers_kept;
