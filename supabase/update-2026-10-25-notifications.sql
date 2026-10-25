-- MOTORNA database update (generated 2026-10-25)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
BEGIN;

-- migration 0007_notifications
DO $mig$ BEGIN
IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '67c63f5fb637a5e5cdd7ed2b91efe9ad7d9eaf16cbe3d84e459cf7fc1af57e98') THEN
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
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('67c63f5fb637a5e5cdd7ed2b91efe9ad7d9eaf16cbe3d84e459cf7fc1af57e98', 1792916603683);
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

SELECT (SELECT count(*) FROM drizzle.__drizzle_migrations) AS migrations_applied, (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') AS notifications_table, (SELECT count(*) FROM listings) AS listings_kept;
