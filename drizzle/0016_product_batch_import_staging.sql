CREATE TYPE "public"."product_batch_import_status" AS ENUM('uploaded', 'validating', 'invalid', 'ready', 'committing', 'completed', 'failed', 'cancelled', 'expired');
--> statement-breakpoint
CREATE TYPE "public"."product_batch_import_row_validation_status" AS ENUM('pending', 'valid', 'warning', 'invalid');
--> statement-breakpoint
CREATE TYPE "public"."product_batch_import_media_entity_kind" AS ENUM('master', 'item');
--> statement-breakpoint
CREATE TYPE "public"."product_batch_import_media_status" AS ENUM('staged', 'validated', 'promoted', 'failed', 'deleted');
--> statement-breakpoint
CREATE SEQUENCE "public"."product_master_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;
--> statement-breakpoint
CREATE TABLE "product_batch_import_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "file_sha256" varchar(64) NOT NULL,
  "file_size_bytes" integer NOT NULL,
  "template_version" integer NOT NULL,
  "status" "product_batch_import_status" DEFAULT 'uploaded' NOT NULL,
  "storage_key" text NOT NULL,
  "total_master_rows" integer DEFAULT 0 NOT NULL,
  "total_item_rows" integer DEFAULT 0 NOT NULL,
  "valid_master_rows" integer DEFAULT 0 NOT NULL,
  "valid_item_rows" integer DEFAULT 0 NOT NULL,
  "invalid_rows" integer DEFAULT 0 NOT NULL,
  "warning_count" integer DEFAULT 0 NOT NULL,
  "committed_master_count" integer DEFAULT 0 NOT NULL,
  "committed_item_count" integer DEFAULT 0 NOT NULL,
  "failure_code" varchar(120),
  "failure_message" text,
  "validated_at" timestamp with time zone,
  "committed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_batch_import_sessions_file_sha256_ck" CHECK ("product_batch_import_sessions"."file_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "product_batch_import_sessions_file_size_ck" CHECK ("product_batch_import_sessions"."file_size_bytes" between 1 and 104857600),
  CONSTRAINT "product_batch_import_sessions_template_version_ck" CHECK ("product_batch_import_sessions"."template_version" > 0),
  CONSTRAINT "product_batch_import_sessions_counts_nonnegative_ck" CHECK ("product_batch_import_sessions"."total_master_rows" >= 0
        and "product_batch_import_sessions"."total_item_rows" >= 0
        and "product_batch_import_sessions"."valid_master_rows" >= 0
        and "product_batch_import_sessions"."valid_item_rows" >= 0
        and "product_batch_import_sessions"."invalid_rows" >= 0
        and "product_batch_import_sessions"."warning_count" >= 0
        and "product_batch_import_sessions"."committed_master_count" >= 0
        and "product_batch_import_sessions"."committed_item_count" >= 0),
  CONSTRAINT "product_batch_import_sessions_counts_bounds_ck" CHECK ("product_batch_import_sessions"."valid_master_rows" <= "product_batch_import_sessions"."total_master_rows"
        and "product_batch_import_sessions"."valid_item_rows" <= "product_batch_import_sessions"."total_item_rows"
        and "product_batch_import_sessions"."invalid_rows" <= ("product_batch_import_sessions"."total_master_rows" + "product_batch_import_sessions"."total_item_rows")
        and "product_batch_import_sessions"."committed_master_count" <= "product_batch_import_sessions"."total_master_rows"
        and "product_batch_import_sessions"."committed_item_count" <= "product_batch_import_sessions"."total_item_rows")
);
--> statement-breakpoint
CREATE TABLE "product_batch_import_master_rows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "row_number" integer NOT NULL,
  "master_key" varchar(120) NOT NULL,
  "raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "normalized_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "validation_status" "product_batch_import_row_validation_status" DEFAULT 'pending' NOT NULL,
  "validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "validation_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "resolved_category_id" uuid,
  "planned_product_master_id" uuid,
  "committed_product_master_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_batch_import_master_rows_row_number_ck" CHECK ("product_batch_import_master_rows"."row_number" >= 2)
);
--> statement-breakpoint
CREATE TABLE "product_batch_import_item_rows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "row_number" integer NOT NULL,
  "row_key" varchar(120) NOT NULL,
  "master_key" varchar(120) NOT NULL,
  "raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "normalized_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "validation_status" "product_batch_import_row_validation_status" DEFAULT 'pending' NOT NULL,
  "validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "validation_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "resolved_outlet_id" uuid,
  "planned_product_item_id" uuid,
  "committed_product_item_id" uuid,
  "generated_sku" varchar(80),
  "generated_barcode" varchar(120),
  "generated_qr_value" varchar(220),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_batch_import_item_rows_row_number_ck" CHECK ("product_batch_import_item_rows"."row_number" >= 2)
);
--> statement-breakpoint
CREATE TABLE "product_batch_import_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "archive_path" text NOT NULL,
  "entity_kind" "product_batch_import_media_entity_kind" NOT NULL,
  "master_key" varchar(120),
  "row_key" varchar(120),
  "sha256" varchar(64) NOT NULL,
  "content_type" varchar(100) NOT NULL,
  "byte_size" integer NOT NULL,
  "width" integer,
  "height" integer,
  "staging_key" text NOT NULL,
  "final_key" text,
  "status" "product_batch_import_media_status" DEFAULT 'staged' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_batch_import_media_sha256_ck" CHECK ("product_batch_import_media"."sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "product_batch_import_media_byte_size_ck" CHECK ("product_batch_import_media"."byte_size" between 1 and 5242880),
  CONSTRAINT "product_batch_import_media_dimensions_ck" CHECK (("product_batch_import_media"."width" is null or "product_batch_import_media"."width" > 0)
        and ("product_batch_import_media"."height" is null or "product_batch_import_media"."height" > 0)),
  CONSTRAINT "product_batch_import_media_target_ck" CHECK ((
        "product_batch_import_media"."entity_kind" = 'master'
        and "product_batch_import_media"."master_key" is not null
        and "product_batch_import_media"."row_key" is null
      ) or (
        "product_batch_import_media"."entity_kind" = 'item'
        and "product_batch_import_media"."master_key" is null
        and "product_batch_import_media"."row_key" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "product_batch_import_sessions" ADD CONSTRAINT "product_batch_import_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_batch_import_sessions" ADD CONSTRAINT "product_batch_import_sessions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_batch_import_master_rows" ADD CONSTRAINT "product_batch_import_master_rows_session_id_product_batch_import_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."product_batch_import_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_batch_import_master_rows" ADD CONSTRAINT "product_batch_import_master_rows_resolved_category_id_product_categories_id_fk" FOREIGN KEY ("resolved_category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_batch_import_master_rows" ADD CONSTRAINT "product_batch_import_master_rows_committed_product_master_id_product_masters_id_fk" FOREIGN KEY ("committed_product_master_id") REFERENCES "public"."product_masters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_batch_import_item_rows" ADD CONSTRAINT "product_batch_import_item_rows_session_id_product_batch_import_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."product_batch_import_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_batch_import_item_rows" ADD CONSTRAINT "product_batch_import_item_rows_resolved_outlet_id_outlets_id_fk" FOREIGN KEY ("resolved_outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_batch_import_item_rows" ADD CONSTRAINT "product_batch_import_item_rows_committed_product_item_id_product_items_id_fk" FOREIGN KEY ("committed_product_item_id") REFERENCES "public"."product_items"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_batch_import_media" ADD CONSTRAINT "product_batch_import_media_session_id_product_batch_import_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."product_batch_import_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "product_batch_import_sessions_org_hash_active_uq" ON "product_batch_import_sessions" USING btree ("organization_id", "file_sha256") WHERE "product_batch_import_sessions"."status" in ('uploaded', 'validating', 'ready', 'committing', 'completed');
--> statement-breakpoint
CREATE INDEX "product_batch_import_sessions_org_status_created_idx" ON "product_batch_import_sessions" USING btree ("organization_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX "product_batch_import_sessions_expires_idx" ON "product_batch_import_sessions" USING btree ("expires_at", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_batch_import_master_rows_session_key_uq" ON "product_batch_import_master_rows" USING btree ("session_id", "master_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_batch_import_master_rows_session_row_uq" ON "product_batch_import_master_rows" USING btree ("session_id", "row_number");
--> statement-breakpoint
CREATE INDEX "product_batch_import_master_rows_session_validation_idx" ON "product_batch_import_master_rows" USING btree ("session_id", "validation_status", "row_number");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_batch_import_item_rows_session_key_uq" ON "product_batch_import_item_rows" USING btree ("session_id", "row_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_batch_import_item_rows_session_row_uq" ON "product_batch_import_item_rows" USING btree ("session_id", "row_number");
--> statement-breakpoint
CREATE INDEX "product_batch_import_item_rows_session_master_idx" ON "product_batch_import_item_rows" USING btree ("session_id", "master_key", "row_number");
--> statement-breakpoint
CREATE INDEX "product_batch_import_item_rows_session_validation_idx" ON "product_batch_import_item_rows" USING btree ("session_id", "validation_status", "row_number");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_batch_import_media_session_archive_path_uq" ON "product_batch_import_media" USING btree ("session_id", "archive_path");
--> statement-breakpoint
CREATE INDEX "product_batch_import_media_session_target_idx" ON "product_batch_import_media" USING btree ("session_id", "entity_kind", "status");
--> statement-breakpoint
INSERT INTO "permissions" ("id", "code", "name", "module", "description", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'products.batch_import',
  'Mengimpor Product Master dan item fisik secara batch',
  'products',
  'Mengunggah, mereview, dan meng-commit Product Batch Import create-only.',
  now(),
  now()
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "constraints")
SELECT
  gen_random_uuid(),
  role_record."id",
  permission_record."id",
  NULL
FROM "roles" AS role_record
CROSS JOIN "permissions" AS permission_record
WHERE role_record."code" IN ('system_admin', 'owner', 'manager', 'stock_admin')
  AND permission_record."code" = 'products.batch_import'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
