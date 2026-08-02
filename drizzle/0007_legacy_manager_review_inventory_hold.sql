ALTER TYPE "public"."item_availability"
  ADD VALUE IF NOT EXISTS 'migration_hold' AFTER 'draft';

ALTER TABLE "legacy_migration_verifications"
  ADD COLUMN "product_item_id" uuid,
  ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;

ALTER TABLE "legacy_migration_verifications"
  ADD CONSTRAINT "legacy_migration_verifications_product_item_id_product_items_id_fk"
  FOREIGN KEY ("product_item_id") REFERENCES "public"."product_items"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "legacy_migration_verifications"
  ADD CONSTRAINT "legacy_migration_verifications_revision_ck"
  CHECK ("revision" > 0);

CREATE UNIQUE INDEX "legacy_migration_verifications_product_item_uq"
  ON "legacy_migration_verifications" USING btree ("product_item_id")
  WHERE "product_item_id" IS NOT NULL;

INSERT INTO "permissions" (
  "id", "code", "name", "module", "description", "created_at", "updated_at"
)
VALUES
  (
    gen_random_uuid(),
    'migration.verification.review',
    'Mereview verifikasi migrasi fisik',
    'migration',
    'Membuka antrean review, mengembalikan verification ke staff, dan menolak data bermasalah.',
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'migration.verification.approve',
    'Menyetujui verifikasi migrasi fisik',
    'migration',
    'Membuat Product Item migration hold dan alias barcode legacy secara transactional.',
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
  AND permissions."code" IN (
    'migration.verification.review',
    'migration.verification.approve'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
