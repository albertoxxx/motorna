-- MOTORNA database update (generated 2026-10-24)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
BEGIN;

-- migration 0004_care_workflow
DO $mig$ BEGIN
IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'e08864dca6141d2eedd1d0e4d2ebd5117fb1fe8b2b3b2985eecb4892c7244087') THEN
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
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('e08864dca6141d2eedd1d0e4d2ebd5117fb1fe8b2b3b2985eecb4892c7244087', 1792881482945);
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

SELECT (SELECT count(*) FROM drizzle.__drizzle_migrations) AS migrations_applied, (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE 'center%' OR table_name = 'service_centers')) AS care_tables, (SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'center_status') AS center_statuses, (SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'audit_logs_no_%') AS audit_guards, (SELECT count(*) FROM listings) AS listings_kept;
