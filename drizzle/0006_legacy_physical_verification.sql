CREATE TYPE "public"."legacy_migration_verification_source" AS ENUM('legacy_match', 'physical_unmatched');
CREATE TYPE "public"."legacy_migration_verification_status" AS ENUM(
  'submitted',
  'needs_review',
  'returned',
  'approved',
  'rejected',
  'sold_during_migration',
  'activated'
);

CREATE TABLE "legacy_migration_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "batch_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "barcode_value" varchar(120) NOT NULL,
  "legacy_row_id" uuid,
  "source" "legacy_migration_verification_source" NOT NULL,
  "status" "legacy_migration_verification_status" DEFAULT 'submitted' NOT NULL,
  "target_product_master_id" uuid NOT NULL,
  "verified_item_name" varchar(240) NOT NULL,
  "verified_weight_gram" numeric(12, 3) NOT NULL,
  "verified_purity" numeric(10, 3) NOT NULL,
  "verified_exchange_purity" numeric(10, 3),
  "verified_color" varchar(120),
  "condition" "item_condition" DEFAULT 'good' NOT NULL,
  "use_legacy_image" boolean DEFAULT false NOT NULL,
  "legacy_image_url" text,
  "image_key" text,
  "staff_notes" text,
  "review_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "submission_fingerprint" varchar(64) NOT NULL,
  "submitted_by" uuid NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "review_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legacy_migration_verifications_source_ck" CHECK (
    (
      "source" = 'legacy_match'
      AND "legacy_row_id" IS NOT NULL
    ) OR (
      "source" = 'physical_unmatched'
      AND "legacy_row_id" IS NULL
    )
  ),
  CONSTRAINT "legacy_migration_verifications_weight_ck" CHECK (
    "verified_weight_gram" > 0
  ),
  CONSTRAINT "legacy_migration_verifications_purity_ck" CHECK (
    "verified_purity" > 0
  ),
  CONSTRAINT "legacy_migration_verifications_photo_ck" CHECK (
    (
      "use_legacy_image" = true
      AND "legacy_image_url" IS NOT NULL
      AND "image_key" IS NULL
    ) OR (
      "use_legacy_image" = false
      AND "image_key" IS NOT NULL
    )
  )
);

ALTER TABLE "legacy_migration_verifications"
  ADD CONSTRAINT "legacy_migration_verifications_session_id_legacy_migration_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."legacy_migration_sessions"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "legacy_migration_verifications"
  ADD CONSTRAINT "legacy_migration_verifications_batch_id_legacy_product_import_batches_id_fk"
  FOREIGN KEY ("batch_id") REFERENCES "public"."legacy_product_import_batches"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "legacy_migration_verifications"
  ADD CONSTRAINT "legacy_migration_verifications_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_migration_verifications"
  ADD CONSTRAINT "legacy_migration_verifications_outlet_id_outlets_id_fk"
  FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_migration_verifications"
  ADD CONSTRAINT "legacy_migration_verifications_legacy_row_id_legacy_product_rows_id_fk"
  FOREIGN KEY ("legacy_row_id") REFERENCES "public"."legacy_product_rows"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "legacy_migration_verifications"
  ADD CONSTRAINT "legacy_migration_verifications_target_product_master_id_product_masters_id_fk"
  FOREIGN KEY ("target_product_master_id") REFERENCES "public"."product_masters"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_migration_verifications"
  ADD CONSTRAINT "legacy_migration_verifications_submitted_by_users_id_fk"
  FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_migration_verifications"
  ADD CONSTRAINT "legacy_migration_verifications_reviewed_by_users_id_fk"
  FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "legacy_migration_verifications_org_barcode_uq"
  ON "legacy_migration_verifications" USING btree ("organization_id", "barcode_value");
CREATE UNIQUE INDEX "legacy_migration_verifications_legacy_row_uq"
  ON "legacy_migration_verifications" USING btree ("legacy_row_id")
  WHERE "legacy_row_id" IS NOT NULL;
CREATE INDEX "legacy_migration_verifications_session_status_idx"
  ON "legacy_migration_verifications" USING btree ("session_id", "status", "submitted_at");
CREATE INDEX "legacy_migration_verifications_batch_status_idx"
  ON "legacy_migration_verifications" USING btree ("batch_id", "status", "submitted_at");

INSERT INTO "permissions" (
  "id", "code", "name", "module", "description", "created_at", "updated_at"
)
VALUES
  (
    gen_random_uuid(),
    'migration.scan',
    'Memindai barcode migrasi fisik',
    'migration',
    'Membuka mobile scanner hanya pada sesi migrasi yang ditugaskan dan aktif.',
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'migration.verification.submit',
    'Mengirim verifikasi barang fisik',
    'migration',
    'Mengirim hasil verifikasi fisik ke antrean manager tanpa mengaktifkan stok.',
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
WHERE roles."code" IN ('system_admin', 'owner', 'manager', 'stock_admin', 'cashier')
  AND permissions."code" IN ('migration.scan', 'migration.verification.submit')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
