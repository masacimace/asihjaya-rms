CREATE TYPE "public"."legacy_product_import_status" AS ENUM('processing', 'ready', 'failed', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."legacy_product_row_validation_status" AS ENUM('valid', 'warning', 'invalid');
--> statement-breakpoint
CREATE TYPE "public"."item_barcode_source" AS ENUM('legacy_import', 'legacy_physical_label', 'system_generated', 'replacement', 'manual');
--> statement-breakpoint
CREATE TABLE "legacy_product_import_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "file_hash" varchar(64) NOT NULL,
  "file_size_bytes" integer NOT NULL,
  "worksheet_name" varchar(160) NOT NULL,
  "barcode_length" integer DEFAULT 6 NOT NULL,
  "status" "legacy_product_import_status" DEFAULT 'processing' NOT NULL,
  "total_rows" integer DEFAULT 0 NOT NULL,
  "valid_rows" integer DEFAULT 0 NOT NULL,
  "warning_rows" integer DEFAULT 0 NOT NULL,
  "invalid_rows" integer DEFAULT 0 NOT NULL,
  "unique_master_count" integer DEFAULT 0 NOT NULL,
  "duplicate_barcode_count" integer DEFAULT 0 NOT NULL,
  "leading_zero_barcode_count" integer DEFAULT 0 NOT NULL,
  "image_url_count" integer DEFAULT 0 NOT NULL,
  "headers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "validation_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_message" text,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legacy_product_import_batches_file_size_ck" CHECK ("legacy_product_import_batches"."file_size_bytes" between 1 and 10485760),
  CONSTRAINT "legacy_product_import_batches_barcode_length_ck" CHECK ("legacy_product_import_batches"."barcode_length" between 1 and 120),
  CONSTRAINT "legacy_product_import_batches_counts_ck" CHECK ("legacy_product_import_batches"."total_rows" >= 0
    and "legacy_product_import_batches"."valid_rows" >= 0
    and "legacy_product_import_batches"."warning_rows" >= 0
    and "legacy_product_import_batches"."invalid_rows" >= 0
    and "legacy_product_import_batches"."unique_master_count" >= 0
    and "legacy_product_import_batches"."duplicate_barcode_count" >= 0
    and "legacy_product_import_batches"."leading_zero_barcode_count" >= 0
    and "legacy_product_import_batches"."image_url_count" >= 0
    and "legacy_product_import_batches"."valid_rows" + "legacy_product_import_batches"."warning_rows" + "legacy_product_import_batches"."invalid_rows" = "legacy_product_import_batches"."total_rows")
);
--> statement-breakpoint
CREATE TABLE "legacy_product_rows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "row_number" integer NOT NULL,
  "source_sequence" integer,
  "legacy_barcode" varchar(120),
  "normalized_barcode" varchar(120),
  "legacy_category" varchar(160),
  "legacy_master_code" varchar(120),
  "legacy_master_name" varchar(220),
  "legacy_item_name" varchar(240),
  "legacy_purity" numeric(10, 3),
  "legacy_exchange_purity" numeric(10, 3),
  "legacy_price_per_gram" numeric(18, 0),
  "legacy_deduction_per_gram" numeric(18, 0),
  "legacy_weight_gram" numeric(12, 3),
  "legacy_color" varchar(120),
  "legacy_image_url" text,
  "validation_status" "legacy_product_row_validation_status" DEFAULT 'valid' NOT NULL,
  "validation_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "row_fingerprint" varchar(64) NOT NULL,
  "raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legacy_product_rows_row_number_ck" CHECK ("legacy_product_rows"."row_number" > 1)
);
--> statement-breakpoint
CREATE TABLE "item_barcodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "barcode_value" varchar(120) NOT NULL,
  "barcode_format" varchar(48),
  "source" "item_barcode_source" NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legacy_product_import_batches" ADD CONSTRAINT "legacy_product_import_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_product_import_batches" ADD CONSTRAINT "legacy_product_import_batches_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_product_import_batches" ADD CONSTRAINT "legacy_product_import_batches_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_product_rows" ADD CONSTRAINT "legacy_product_rows_batch_id_legacy_product_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."legacy_product_import_batches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_product_rows" ADD CONSTRAINT "legacy_product_rows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "legacy_product_rows" ADD CONSTRAINT "legacy_product_rows_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_barcodes" ADD CONSTRAINT "item_barcodes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_barcodes" ADD CONSTRAINT "item_barcodes_item_id_product_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."product_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_barcodes" ADD CONSTRAINT "item_barcodes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_product_import_batches_org_outlet_hash_uq" ON "legacy_product_import_batches" USING btree ("organization_id", "outlet_id", "file_hash");
--> statement-breakpoint
CREATE INDEX "legacy_product_import_batches_org_status_idx" ON "legacy_product_import_batches" USING btree ("organization_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX "legacy_product_import_batches_outlet_time_idx" ON "legacy_product_import_batches" USING btree ("outlet_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_product_rows_batch_row_uq" ON "legacy_product_rows" USING btree ("batch_id", "row_number");
--> statement-breakpoint
CREATE INDEX "legacy_product_rows_batch_status_idx" ON "legacy_product_rows" USING btree ("batch_id", "validation_status", "row_number");
--> statement-breakpoint
CREATE INDEX "legacy_product_rows_batch_barcode_idx" ON "legacy_product_rows" USING btree ("batch_id", "normalized_barcode");
--> statement-breakpoint
CREATE INDEX "legacy_product_rows_org_outlet_barcode_idx" ON "legacy_product_rows" USING btree ("organization_id", "outlet_id", "normalized_barcode");
--> statement-breakpoint
CREATE INDEX "legacy_product_rows_batch_master_idx" ON "legacy_product_rows" USING btree ("batch_id", "legacy_master_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "item_barcodes_item_value_uq" ON "item_barcodes" USING btree ("item_id", "barcode_value");
--> statement-breakpoint
CREATE UNIQUE INDEX "item_barcodes_org_active_value_uq" ON "item_barcodes" USING btree ("organization_id", "barcode_value") WHERE "item_barcodes"."is_active" = true;
--> statement-breakpoint
CREATE UNIQUE INDEX "item_barcodes_item_active_primary_uq" ON "item_barcodes" USING btree ("item_id") WHERE "item_barcodes"."is_active" = true and "item_barcodes"."is_primary" = true;
--> statement-breakpoint
CREATE INDEX "item_barcodes_item_primary_idx" ON "item_barcodes" USING btree ("item_id", "is_primary", "is_active");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "code", "name", "module", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'migration.view', 'Melihat staging migrasi produk legacy', 'migration', 'Melihat batch dan baris staging migrasi produk legacy.', now(), now()),
  (gen_random_uuid(), 'migration.import', 'Mengimpor workbook produk legacy ke staging', 'migration', 'Mengunggah dan menganalisis workbook XLSX legacy tanpa mengaktifkan inventaris.', now(), now())
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "constraints")
SELECT gen_random_uuid(), roles."id", permissions."id", NULL
FROM "roles"
CROSS JOIN "permissions"
WHERE roles."code" IN ('system_admin', 'owner', 'manager', 'stock_admin')
  AND permissions."code" IN ('migration.view', 'migration.import')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
