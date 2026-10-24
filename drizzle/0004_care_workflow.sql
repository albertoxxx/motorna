CREATE TYPE "public"."equipment_kind" AS ENUM('obd_scanner', 'paint_thickness_gauge', 'lift', 'wheel_alignment', 'tire_changer', 'ac_service_station', 'battery_tester', 'brake_tester', 'emissions_analyzer', 'other');--> statement-breakpoint
ALTER TYPE "public"."center_status" ADD VALUE 'draft' BEFORE 'applied';--> statement-breakpoint
ALTER TYPE "public"."center_status" ADD VALUE 'changes_requested' BEFORE 'approved';--> statement-breakpoint
CREATE TABLE "center_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"kind" "equipment_kind" NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_equipment_details_length" CHECK ("center_equipment"."details" IS NULL OR char_length("center_equipment"."details") <= 200)
);
--> statement-breakpoint
CREATE TABLE "center_review_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_review_notes_length" CHECK (char_length("center_review_notes"."body") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "service_centers" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_centers" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "center_equipment" ADD CONSTRAINT "center_equipment_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "center_review_notes" ADD CONSTRAINT "center_review_notes_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "center_review_notes" ADD CONSTRAINT "center_review_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "center_technicians" ADD CONSTRAINT "center_technicians_center_id_service_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."service_centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "center_equipment_center_idx" ON "center_equipment" USING btree ("center_id");--> statement-breakpoint
CREATE INDEX "center_review_notes_center_idx" ON "center_review_notes" USING btree ("center_id");--> statement-breakpoint
CREATE INDEX "center_technicians_center_idx" ON "center_technicians" USING btree ("center_id");--> statement-breakpoint
UPDATE "service_centers" SET "last_verified_at" = "approved_at" WHERE "approved_at" IS NOT NULL AND "last_verified_at" IS NULL;
