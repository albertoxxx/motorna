-- MOTORNA database update (generated 2026-10-24)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
BEGIN;

-- migration 0003_care_centers
DO $mig$ BEGIN
IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'e52bfd34ff77e71057125f4648f3aa9b85d21a95a7847ee17765dfbf11f83500') THEN
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
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('e52bfd34ff77e71057125f4648f3aa9b85d21a95a7847ee17765dfbf11f83500', 1792879526593);
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

SELECT (SELECT count(*) FROM drizzle.__drizzle_migrations) AS migrations_applied, (SELECT string_agg(table_name, ', ' ORDER BY table_name) FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE 'center%' OR table_name = 'service_centers')) AS care_tables, (SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'audit_logs_no_%') AS audit_guards, (SELECT count(*) FROM listings) AS listings_kept;
