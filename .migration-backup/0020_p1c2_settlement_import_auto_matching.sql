CREATE TYPE "public"."settlement_import_row_status" AS ENUM('pending', 'matched', 'ambiguous', 'mismatch', 'not_found', 'duplicate', 'ignored', 'applied', 'failed');--> statement-breakpoint
CREATE TYPE "public"."settlement_import_status" AS ENUM('uploaded', 'ready', 'processing', 'completed', 'completed_with_issues', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "settlement_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_key" text NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"status" "settlement_import_status" DEFAULT 'uploaded' NOT NULL,
	"delimiter" varchar(8) DEFAULT ',' NOT NULL,
	"headers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"valid_row_count" integer DEFAULT 0 NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"applied_count" integer DEFAULT 0 NOT NULL,
	"ambiguous_count" integer DEFAULT 0 NOT NULL,
	"mismatch_count" integer DEFAULT 0 NOT NULL,
	"not_found_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"ignored_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_import_batches_file_size_ck" CHECK ("settlement_import_batches"."file_size_bytes" between 1 and 5242880),
	CONSTRAINT "settlement_import_batches_counts_ck" CHECK ("settlement_import_batches"."row_count" >= 0
        and "settlement_import_batches"."valid_row_count" >= 0
        and "settlement_import_batches"."matched_count" >= 0
        and "settlement_import_batches"."applied_count" >= 0
        and "settlement_import_batches"."ambiguous_count" >= 0
        and "settlement_import_batches"."mismatch_count" >= 0
        and "settlement_import_batches"."not_found_count" >= 0
        and "settlement_import_batches"."duplicate_count" >= 0
        and "settlement_import_batches"."ignored_count" >= 0
        and "settlement_import_batches"."failed_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settlement_import_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"delimiter" varchar(8) DEFAULT ',' NOT NULL,
	"column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_import_mappings_delimiter_ck" CHECK (length("settlement_import_mappings"."delimiter") between 1 and 8)
);
--> statement-breakpoint
CREATE TABLE "settlement_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transaction_date" timestamp with time zone,
	"payment_reference" varchar(160),
	"normalized_reference" varchar(160),
	"gross_amount" numeric(18, 0),
	"fee_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"net_amount" numeric(18, 0),
	"settlement_reference" varchar(160),
	"provider_status" varchar(80),
	"status" "settlement_import_row_status" DEFAULT 'pending' NOT NULL,
	"matched_payment_id" uuid,
	"candidate_payment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"match_reason" text,
	"error_message" text,
	"review_notes" text,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_import_rows_row_number_ck" CHECK ("settlement_import_rows"."row_number" > 1),
	CONSTRAINT "settlement_import_rows_amounts_ck" CHECK (("settlement_import_rows"."gross_amount" is null or "settlement_import_rows"."gross_amount" >= 0)
        and "settlement_import_rows"."fee_amount" >= 0
        and "settlement_import_rows"."tax_amount" >= 0
        and ("settlement_import_rows"."net_amount" is null or "settlement_import_rows"."net_amount" >= 0)),
	CONSTRAINT "settlement_import_rows_applied_ck" CHECK ("settlement_import_rows"."status" <> 'applied' or (
        "settlement_import_rows"."matched_payment_id" is not null
        and "settlement_import_rows"."applied_at" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "settlement_import_batches" ADD CONSTRAINT "settlement_import_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_batches" ADD CONSTRAINT "settlement_import_batches_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_batches" ADD CONSTRAINT "settlement_import_batches_profile_id_manual_payment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."manual_payment_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_batches" ADD CONSTRAINT "settlement_import_batches_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_mappings" ADD CONSTRAINT "settlement_import_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_mappings" ADD CONSTRAINT "settlement_import_mappings_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_mappings" ADD CONSTRAINT "settlement_import_mappings_profile_id_manual_payment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."manual_payment_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_mappings" ADD CONSTRAINT "settlement_import_mappings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_rows" ADD CONSTRAINT "settlement_import_rows_batch_id_settlement_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."settlement_import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_rows" ADD CONSTRAINT "settlement_import_rows_matched_payment_id_payments_id_fk" FOREIGN KEY ("matched_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_import_batches_org_hash_uq" ON "settlement_import_batches" USING btree ("organization_id","file_hash");--> statement-breakpoint
CREATE INDEX "settlement_import_batches_org_status_idx" ON "settlement_import_batches" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "settlement_import_batches_outlet_profile_idx" ON "settlement_import_batches" USING btree ("outlet_id","profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_import_mappings_profile_uq" ON "settlement_import_mappings" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "settlement_import_mappings_org_outlet_idx" ON "settlement_import_mappings" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_import_rows_batch_row_uq" ON "settlement_import_rows" USING btree ("batch_id","row_number");--> statement-breakpoint
CREATE INDEX "settlement_import_rows_batch_status_idx" ON "settlement_import_rows" USING btree ("batch_id","status","row_number");--> statement-breakpoint
CREATE INDEX "settlement_import_rows_reference_idx" ON "settlement_import_rows" USING btree ("normalized_reference");--> statement-breakpoint
CREATE INDEX "settlement_import_rows_payment_idx" ON "settlement_import_rows" USING btree ("matched_payment_id");--> statement-breakpoint
INSERT INTO "permissions" (
  "id",
  "code",
  "name",
  "description",
  "module",
  "created_at",
  "updated_at"
)
VALUES (
  gen_random_uuid(),
  'payments.reconciliation.import',
  'Mengimpor settlement dan menjalankan auto-matching',
  'Upload CSV settlement, mapping kolom, auto-match, dan review hasil import.',
  'payments',
  now(),
  now()
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = excluded."name",
  "description" = excluded."description",
  "module" = excluded."module",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "role_permissions" (
  "id",
  "role_id",
  "permission_id",
  "constraints"
)
SELECT
  gen_random_uuid(),
  role_record."id",
  permission_record."id",
  NULL
FROM "roles" role_record
JOIN "permissions" permission_record
  ON permission_record."code" = 'payments.reconciliation.import'
WHERE role_record."code" IN (
  'system_admin',
  'owner',
  'manager',
  'finance'
)
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
