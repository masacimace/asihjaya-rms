CREATE TYPE "public"."buyback_processing_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TYPE "public"."buyback_processing_type" AS ENUM('cleaning', 'recondition');--> statement-breakpoint
ALTER TYPE "public"."item_availability" ADD VALUE 'processing' BEFORE 'available';--> statement-breakpoint
CREATE TABLE "buyback_item_processings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyback_item_id" uuid NOT NULL,
	"processing_type" "buyback_processing_type" NOT NULL,
	"status" "buyback_processing_status" DEFAULT 'pending' NOT NULL,
	"result_product_item_id" uuid,
	"result_snapshot" jsonb,
	"processed_by" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buyback_item_processings_completion_ck" CHECK ((
        "buyback_item_processings"."status" = 'pending'
        and "buyback_item_processings"."result_product_item_id" is null
        and "buyback_item_processings"."result_snapshot" is null
        and "buyback_item_processings"."processed_by" is null
        and "buyback_item_processings"."processed_at" is null
      ) or (
        "buyback_item_processings"."status" = 'completed'
        and "buyback_item_processings"."result_product_item_id" is not null
        and "buyback_item_processings"."result_snapshot" is not null
        and "buyback_item_processings"."processed_by" is not null
        and "buyback_item_processings"."processed_at" is not null
      )),
	CONSTRAINT "buyback_item_processings_processed_time_ck" CHECK ("buyback_item_processings"."processed_at" is null or "buyback_item_processings"."processed_at" >= "buyback_item_processings"."created_at")
);
--> statement-breakpoint
ALTER TABLE "buyback_item_processings" ADD CONSTRAINT "buyback_item_processings_buyback_item_id_buyback_items_id_fk" FOREIGN KEY ("buyback_item_id") REFERENCES "public"."buyback_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyback_item_processings" ADD CONSTRAINT "buyback_item_processings_result_product_item_id_product_items_id_fk" FOREIGN KEY ("result_product_item_id") REFERENCES "public"."product_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyback_item_processings" ADD CONSTRAINT "buyback_item_processings_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "buyback_item_processings_buyback_item_uq" ON "buyback_item_processings" USING btree ("buyback_item_id");--> statement-breakpoint
CREATE INDEX "buyback_item_processings_status_type_created_idx" ON "buyback_item_processings" USING btree ("status","processing_type","created_at");--> statement-breakpoint
CREATE INDEX "buyback_item_processings_result_item_idx" ON "buyback_item_processings" USING btree ("result_product_item_id");