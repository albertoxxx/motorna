-- MOTORNA database update (generated 2026-10-24)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
BEGIN;

-- migration 0002_known_defects
DO $mig$ BEGIN
IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'c76ea95a47a93caee5552f6ba2c81e5014d0be46ec3a3caa7b767bb69cf0a687') THEN
ALTER TABLE "listings" ADD COLUMN "known_defects" text;
ALTER TABLE "listings" ADD CONSTRAINT "listings_known_defects_length" CHECK ("listings"."known_defects" IS NULL OR char_length("listings"."known_defects") <= 2000);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('c76ea95a47a93caee5552f6ba2c81e5014d0be46ec3a3caa7b767bb69cf0a687', 1792872332753);
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

SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'known_defects';
