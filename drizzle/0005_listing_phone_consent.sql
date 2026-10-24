ALTER TABLE "listings" ADD COLUMN "show_phone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Keep any consent sellers already gave in their profile (opt-in only; default stays off).
UPDATE "listings" SET "show_phone" = true FROM "users" WHERE "users"."id" = "listings"."seller_id" AND "users"."show_phone" = true AND "users"."phone" IS NOT NULL;
