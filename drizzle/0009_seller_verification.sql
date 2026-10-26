CREATE TYPE "public"."licence_check_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified_number" text;--> statement-breakpoint
ALTER TABLE "listing_licence_checks" ADD CONSTRAINT "listing_licence_checks_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_licence_checks" ADD CONSTRAINT "listing_licence_checks_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_licence_checks" ADD CONSTRAINT "listing_licence_checks_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_licence_checks_listing_idx" ON "listing_licence_checks" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "listing_licence_checks_status_idx" ON "listing_licence_checks" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_licence_checks_one_pending" ON "listing_licence_checks" USING btree ("listing_id") WHERE "listing_licence_checks"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "phone_verifications_user_idx" ON "phone_verifications" USING btree ("user_id","created_at");