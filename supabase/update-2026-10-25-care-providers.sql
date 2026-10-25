-- MOTORNA database update (generated 2026-10-25)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
BEGIN;

-- migration 0006_care_providers
DO $mig$ BEGIN
IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'ed6847f25fffdc4b68cfbd14be3dd8e4706063b48dfb609642d5e85c7ba3cbef') THEN
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
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('ed6847f25fffdc4b68cfbd14be3dd8e4706063b48dfb609642d5e85c7ba3cbef', 1792915369555);
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

SELECT (SELECT count(*) FROM drizzle.__drizzle_migrations) AS migrations_applied, (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_centers' AND column_name IN ('category','latitude','longitude')) AS new_columns, (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('center_makes','center_photos')) AS new_tables, (SELECT count(*) FROM service_centers) AS centers_kept, (SELECT count(*) FROM listings) AS listings_kept;
