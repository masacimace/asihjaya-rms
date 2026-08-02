CREATE TABLE "legacy_migration_sold_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "barcode_value" varchar(120) NOT NULL,
  "verification_id" uuid,
  "product_item_id" uuid,
  "previous_verification_status" "legacy_migration_verification_status",
  "previous_item_availability" "item_availability",
  "sold_at" timestamp with time zone NOT NULL,
  "legacy_reference" varchar(160),
  "notes" text,
  "reported_by" uuid NOT NULL,
  "reported_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reverted_by" uuid,
  "reverted_at" timestamp with time zone,
  "revert_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legacy_migration_sold_records_link_ck" CHECK (
    (
      "verification_id" IS NULL
      AND "product_item_id" IS NULL
      AND "previous_verification_status" IS NULL
      AND "previous_item_availability" IS NULL
    ) OR (
      "verification_id" IS NOT NULL
      AND "previous_verification_status" IN (
        'submitted',
        'needs_review',
        'returned',
        'approved',
        'rejected'
      )
      AND (
        ("product_item_id" IS NULL AND "previous_item_availability" IS NULL)
        OR (
          "product_item_id" IS NOT NULL
          AND "previous_item_availability" = 'migration_hold'
          AND "previous_verification_status" = 'approved'
        )
      )
    )
  ),
  CONSTRAINT "legacy_migration_sold_records_revert_ck" CHECK (
    (
      "reverted_by" IS NULL
      AND "reverted_at" IS NULL
      AND "revert_reason" IS NULL
    ) OR (
      "reverted_by" IS NOT NULL
      AND "reverted_at" IS NOT NULL
      AND length(btrim("revert_reason")) >= 5
    )
  )
);

ALTER TABLE "legacy_migration_sold_records"
  ADD CONSTRAINT "legacy_migration_sold_records_batch_id_legacy_product_import_batches_id_fk"
  FOREIGN KEY ("batch_id") REFERENCES "public"."legacy_product_import_batches"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "legacy_migration_sold_records"
  ADD CONSTRAINT "legacy_migration_sold_records_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "legacy_migration_sold_records"
  ADD CONSTRAINT "legacy_migration_sold_records_outlet_id_outlets_id_fk"
  FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "legacy_migration_sold_records"
  ADD CONSTRAINT "legacy_migration_sold_records_verification_id_legacy_migration_verifications_id_fk"
  FOREIGN KEY ("verification_id") REFERENCES "public"."legacy_migration_verifications"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "legacy_migration_sold_records"
  ADD CONSTRAINT "legacy_migration_sold_records_product_item_id_product_items_id_fk"
  FOREIGN KEY ("product_item_id") REFERENCES "public"."product_items"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "legacy_migration_sold_records"
  ADD CONSTRAINT "legacy_migration_sold_records_reported_by_users_id_fk"
  FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "legacy_migration_sold_records"
  ADD CONSTRAINT "legacy_migration_sold_records_reverted_by_users_id_fk"
  FOREIGN KEY ("reverted_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "legacy_migration_sold_records_org_barcode_active_uq"
  ON "legacy_migration_sold_records" USING btree ("organization_id", "barcode_value")
  WHERE "reverted_at" IS NULL;

CREATE INDEX "legacy_migration_sold_records_batch_sold_at_idx"
  ON "legacy_migration_sold_records" USING btree ("batch_id", "sold_at");

CREATE INDEX "legacy_migration_sold_records_verification_idx"
  ON "legacy_migration_sold_records" USING btree ("verification_id");

INSERT INTO "permissions" (
  "id", "code", "name", "module", "description", "created_at", "updated_at"
)
VALUES (
  gen_random_uuid(),
  'migration.sold.manage',
  'Menandai barang terjual selama migrasi legacy',
  'migration',
  'Menandai dan membatalkan barcode yang terjual pada sistem lama agar dikecualikan dari scan, approval, dan cutover.',
  now(),
  now()
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "updated_at" = now();

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "constraints")
SELECT gen_random_uuid(), roles."id", permissions."id", NULL
FROM "roles"
CROSS JOIN "permissions"
WHERE roles."code" IN ('system_admin', 'owner', 'manager', 'stock_admin')
  AND permissions."code" = 'migration.sold.manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
