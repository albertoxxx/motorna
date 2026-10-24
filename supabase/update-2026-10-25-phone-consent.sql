-- MOTORNA database update (generated 2026-10-24)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
BEGIN;

-- migration 0005_listing_phone_consent
DO $mig$ BEGIN
IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'dcf935a2b481a45983626ee3b72751ea5f47fb40f4232dacba6f7f9f8cb9de8f') THEN
ALTER TABLE "listings" ADD COLUMN "show_phone" boolean DEFAULT false NOT NULL;
-- Keep any consent sellers already gave in their profile (opt-in only; default stays off).
UPDATE "listings" SET "show_phone" = true FROM "users" WHERE "users"."id" = "listings"."seller_id" AND "users"."show_phone" = true AND "users"."phone" IS NOT NULL;
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('dcf935a2b481a45983626ee3b72751ea5f47fb40f4232dacba6f7f9f8cb9de8f', 1792884569832);
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

SELECT (SELECT count(*) FROM drizzle.__drizzle_migrations) AS migrations_applied, (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'show_phone') AS show_phone_column, (SELECT count(*) FROM listings WHERE show_phone) AS listings_showing_phone, (SELECT count(*) FROM listings) AS listings_kept;
