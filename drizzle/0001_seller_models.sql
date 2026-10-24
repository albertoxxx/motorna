ALTER TABLE "vehicle_models" ADD COLUMN "is_verified" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD COLUMN "created_by_id" text;