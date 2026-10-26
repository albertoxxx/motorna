-- MOTORNA database update (generated 2026-10-26)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
BEGIN;

-- migration 0009_seller_verification
DO $mig$ BEGIN
IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'eae86f13473485d46aae9921f4258014d2acc96697f83464fff90d7df142653c') THEN
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
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('eae86f13473485d46aae9921f4258014d2acc96697f83464fff90d7df142653c', 1793024763988);
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
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('phone_verifications','listing_licence_checks')) AS verification_tables,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name IN ('phone_verified_at','phone_verified_number')) AS user_columns,
  (SELECT count(*) FROM users WHERE phone_verified_at IS NOT NULL) AS phones_verified,
  (SELECT count(*) FROM listings) AS listings_kept;
