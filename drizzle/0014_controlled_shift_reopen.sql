ALTER TYPE "public"."telegram_report_type" ADD VALUE 'shift_reopened' BEFORE 'test';--> statement-breakpoint
ALTER TABLE "legacy_migration_verifications" DROP CONSTRAINT "legacy_migration_verifications_source_ck";--> statement-breakpoint
ALTER TABLE "legacy_migration_verifications" DROP CONSTRAINT "legacy_migration_verifications_photo_ck";--> statement-breakpoint
ALTER TABLE "legacy_migration_sold_records" DROP CONSTRAINT "legacy_migration_sold_records_link_ck";--> statement-breakpoint
ALTER TABLE "legacy_migration_sold_records" DROP CONSTRAINT "legacy_migration_sold_records_revert_ck";--> statement-breakpoint
DROP INDEX "finance_closing_snapshots_shift_uq";--> statement-breakpoint
DROP INDEX "finance_closing_snapshots_outlet_business_date_uq";--> statement-breakpoint
ALTER TABLE "legacy_migration_verifications" ALTER COLUMN "use_legacy_image" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "legacy_migration_verifications" ALTER COLUMN "revision" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD COLUMN "superseded_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD COLUMN "superseded_reason" text;--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD CONSTRAINT "finance_closing_snapshots_superseded_by_user_id_users_id_fk" FOREIGN KEY ("superseded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_closing_snapshots_shift_revision_uq" ON "finance_closing_snapshots" USING btree ("shift_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_closing_snapshots_outlet_date_revision_uq" ON "finance_closing_snapshots" USING btree ("outlet_id","business_date","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_closing_snapshots_current_shift_uq" ON "finance_closing_snapshots" USING btree ("shift_id") WHERE "finance_closing_snapshots"."superseded_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_closing_snapshots_current_outlet_date_uq" ON "finance_closing_snapshots" USING btree ("outlet_id","business_date") WHERE "finance_closing_snapshots"."superseded_at" is null;--> statement-breakpoint
ALTER TABLE "legacy_migration_verifications" ADD CONSTRAINT "legacy_migration_verifications_source_ck" CHECK ((
        "legacy_migration_verifications"."source" = 'legacy_match'
        and "legacy_migration_verifications"."legacy_row_id" is not null
      ) or (
        "legacy_migration_verifications"."source" = 'physical_unmatched'
        and "legacy_migration_verifications"."legacy_row_id" is null
      ));--> statement-breakpoint
ALTER TABLE "legacy_migration_verifications" ADD CONSTRAINT "legacy_migration_verifications_photo_ck" CHECK ((
        "legacy_migration_verifications"."use_legacy_image" = true
        and "legacy_migration_verifications"."legacy_image_url" is not null
        and "legacy_migration_verifications"."image_key" is null
      ) or (
        "legacy_migration_verifications"."use_legacy_image" = false
        and "legacy_migration_verifications"."image_key" is not null
      ));--> statement-breakpoint
ALTER TABLE "legacy_migration_sold_records" ADD CONSTRAINT "legacy_migration_sold_records_link_ck" CHECK ((
        "legacy_migration_sold_records"."verification_id" is null
        and "legacy_migration_sold_records"."product_item_id" is null
        and "legacy_migration_sold_records"."previous_verification_status" is null
        and "legacy_migration_sold_records"."previous_item_availability" is null
      ) or (
        "legacy_migration_sold_records"."verification_id" is not null
        and "legacy_migration_sold_records"."previous_verification_status" in (
          'submitted',
          'needs_review',
          'returned',
          'approved',
          'rejected'
        )
        and (
          ("legacy_migration_sold_records"."product_item_id" is null and "legacy_migration_sold_records"."previous_item_availability" is null)
          or (
            "legacy_migration_sold_records"."product_item_id" is not null
            and "legacy_migration_sold_records"."previous_item_availability" = 'migration_hold'
            and "legacy_migration_sold_records"."previous_verification_status" = 'approved'
          )
        )
      ));--> statement-breakpoint
ALTER TABLE "legacy_migration_sold_records" ADD CONSTRAINT "legacy_migration_sold_records_revert_ck" CHECK ((
        "legacy_migration_sold_records"."reverted_by" is null
        and "legacy_migration_sold_records"."reverted_at" is null
        and "legacy_migration_sold_records"."revert_reason" is null
      ) or (
        "legacy_migration_sold_records"."reverted_by" is not null
        and "legacy_migration_sold_records"."reverted_at" is not null
        and length(btrim("legacy_migration_sold_records"."revert_reason")) >= 5
      ));--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD CONSTRAINT "finance_closing_snapshots_revision_positive_ck" CHECK ("finance_closing_snapshots"."revision" > 0);--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD CONSTRAINT "finance_closing_snapshots_superseded_state_ck" CHECK ((
        "finance_closing_snapshots"."superseded_at" is null
        and "finance_closing_snapshots"."superseded_by_user_id" is null
        and "finance_closing_snapshots"."superseded_reason" is null
      ) or (
        "finance_closing_snapshots"."superseded_at" is not null
        and "finance_closing_snapshots"."superseded_by_user_id" is not null
        and length(btrim("finance_closing_snapshots"."superseded_reason")) >= 5
      ));

--> statement-breakpoint
INSERT INTO "permissions" ("id", "code", "name", "module", "description", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'shifts.reopen',
  'Membuka kembali shift yang sudah ditutup pada tanggal operasional yang sama',
  'operations',
  'Controlled reopen pada shift yang sama. Tidak membuat shift kedua dan wajib diaudit.',
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
WHERE role_record."code" IN ('system_admin', 'owner', 'manager')
  AND permission_record."code" = 'shifts.reopen'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
