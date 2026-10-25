CREATE TYPE "public"."provider_category" AS ENUM('authorized_service', 'independent_workshop', 'inspection_center');--> statement-breakpoint
ALTER TYPE "public"."credential_kind" ADD VALUE 'sample_report';--> statement-breakpoint
CREATE TABLE "center_makes" (
	"center_id" uuid NOT NULL,
	"make_id" smallint NOT NULL,
	CONSTRAINT "center_makes_center_id_make_id_pk" PRIMARY KEY("center_id","make_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "service_centers" ADD COLUMN "category" "provider_category" DEFAULT 'independent_workshop' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_centers" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "service_centers" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "center_makes" ADD CONSTRAINT "center_makes_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "center_makes" ADD CONSTRAINT "center_makes_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "center_photos" ADD CONSTRAINT "center_photos_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "center_photos" ADD CONSTRAINT "center_photos_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "center_makes_make_idx" ON "center_makes" USING btree ("make_id");--> statement-breakpoint
CREATE INDEX "center_photos_center_idx" ON "center_photos" USING btree ("center_id","position");--> statement-breakpoint
CREATE INDEX "service_centers_category_idx" ON "service_centers" USING btree ("category");--> statement-breakpoint
ALTER TABLE "service_centers" ADD CONSTRAINT "service_centers_coords" CHECK (("service_centers"."latitude" IS NULL AND "service_centers"."longitude" IS NULL) OR ("service_centers"."latitude" BETWEEN 21 AND 32 AND "service_centers"."longitude" BETWEEN 24 AND 37));--> statement-breakpoint
-- Existing centers that offer pre-purchase inspection become inspection providers; the rest stay independent workshops.
UPDATE "service_centers" SET "category" = 'inspection_center' WHERE EXISTS (SELECT 1 FROM "center_services" s WHERE s."center_id" = "service_centers"."id" AND s."category" = 'pre_purchase_inspection' AND s."active");
