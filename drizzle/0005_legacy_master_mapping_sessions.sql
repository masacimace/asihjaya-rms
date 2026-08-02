CREATE TYPE "public"."legacy_master_mapping_status" AS ENUM('pending', 'mapped', 'ignored');
CREATE TYPE "public"."legacy_master_mapping_source" AS ENUM('existing', 'created');
CREATE TYPE "public"."legacy_migration_session_status" AS ENUM('draft', 'active', 'locked', 'completed', 'cancelled');
CREATE TYPE "public"."legacy_migration_assignment_role" AS ENUM('operator', 'lead');

CREATE TABLE "legacy_product_master_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "legacy_master_code" varchar(120) NOT NULL,
  "legacy_master_name" varchar(220) NOT NULL,
  "legacy_category" varchar(160),
  "normalized_category_name" varchar(160),
  "item_count" integer DEFAULT 0 NOT NULL,
  "status" "legacy_master_mapping_status" DEFAULT 'pending' NOT NULL,
  "mapping_source" "legacy_master_mapping_source",
  "target_category_id" uuid,
  "target_product_master_id" uuid,
  "review_notes" text,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legacy_product_master_mappings_item_count_ck" CHECK ("item_count" >= 0),
  CONSTRAINT "legacy_product_master_mappings_resolution_ck" CHECK (
    (
      "status" = 'pending'
      AND "target_category_id" IS NULL
      AND "target_product_master_id" IS NULL
      AND "mapping_source" IS NULL
      AND "reviewed_by" IS NULL
      AND "reviewed_at" IS NULL
    ) OR (
      "status" = 'mapped'
      AND "target_category_id" IS NOT NULL
      AND "target_product_master_id" IS NOT NULL
      AND "mapping_source" IS NOT NULL
      AND "reviewed_by" IS NOT NULL
      AND "reviewed_at" IS NOT NULL
    ) OR (
      "status" = 'ignored'
      AND "target_category_id" IS NULL
      AND "target_product_master_id" IS NULL
      AND "mapping_source" IS NULL
      AND "reviewed_by" IS NOT NULL
      AND "reviewed_at" IS NOT NULL
      AND nullif(btrim("review_notes"), '') IS NOT NULL
    )
  )
);

CREATE TABLE "legacy_migration_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "location_code" varchar(80),
  "expected_item_count" integer,
  "notes" text,
  "status" "legacy_migration_session_status" DEFAULT 'draft' NOT NULL,
  "created_by" uuid NOT NULL,
  "started_at" timestamp with time zone,
  "locked_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legacy_migration_sessions_expected_count_ck" CHECK (
    "expected_item_count" IS NULL OR "expected_item_count" > 0
  )
);

CREATE TABLE "legacy_migration_session_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "assignment_role" "legacy_migration_assignment_role" DEFAULT 'operator' NOT NULL,
  "assigned_by" uuid NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "legacy_product_master_mappings"
  ADD CONSTRAINT "legacy_product_master_mappings_batch_id_legacy_product_import_batches_id_fk"
  FOREIGN KEY ("batch_id") REFERENCES "public"."legacy_product_import_batches"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "legacy_product_master_mappings"
  ADD CONSTRAINT "legacy_product_master_mappings_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_product_master_mappings"
  ADD CONSTRAINT "legacy_product_master_mappings_outlet_id_outlets_id_fk"
  FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_product_master_mappings"
  ADD CONSTRAINT "legacy_product_master_mappings_target_category_id_product_categories_id_fk"
  FOREIGN KEY ("target_category_id") REFERENCES "public"."product_categories"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_product_master_mappings"
  ADD CONSTRAINT "legacy_product_master_mappings_target_product_master_id_product_masters_id_fk"
  FOREIGN KEY ("target_product_master_id") REFERENCES "public"."product_masters"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_product_master_mappings"
  ADD CONSTRAINT "legacy_product_master_mappings_reviewed_by_users_id_fk"
  FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "legacy_migration_sessions"
  ADD CONSTRAINT "legacy_migration_sessions_batch_id_legacy_product_import_batches_id_fk"
  FOREIGN KEY ("batch_id") REFERENCES "public"."legacy_product_import_batches"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "legacy_migration_sessions"
  ADD CONSTRAINT "legacy_migration_sessions_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_migration_sessions"
  ADD CONSTRAINT "legacy_migration_sessions_outlet_id_outlets_id_fk"
  FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_migration_sessions"
  ADD CONSTRAINT "legacy_migration_sessions_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "legacy_migration_session_assignments"
  ADD CONSTRAINT "legacy_migration_session_assignments_session_id_legacy_migration_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."legacy_migration_sessions"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "legacy_migration_session_assignments"
  ADD CONSTRAINT "legacy_migration_session_assignments_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "legacy_migration_session_assignments"
  ADD CONSTRAINT "legacy_migration_session_assignments_assigned_by_users_id_fk"
  FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "legacy_product_master_mappings_batch_code_uq"
  ON "legacy_product_master_mappings" USING btree ("batch_id", "legacy_master_code");
CREATE INDEX "legacy_product_master_mappings_batch_status_idx"
  ON "legacy_product_master_mappings" USING btree ("batch_id", "status", "legacy_master_code");
CREATE INDEX "legacy_product_master_mappings_target_idx"
  ON "legacy_product_master_mappings" USING btree ("organization_id", "target_product_master_id");

CREATE UNIQUE INDEX "legacy_migration_sessions_batch_name_uq"
  ON "legacy_migration_sessions" USING btree ("batch_id", "name");
CREATE INDEX "legacy_migration_sessions_batch_status_idx"
  ON "legacy_migration_sessions" USING btree ("batch_id", "status", "created_at");
CREATE INDEX "legacy_migration_sessions_outlet_status_idx"
  ON "legacy_migration_sessions" USING btree ("outlet_id", "status");

CREATE UNIQUE INDEX "legacy_migration_session_assignments_session_user_uq"
  ON "legacy_migration_session_assignments" USING btree ("session_id", "user_id");
CREATE INDEX "legacy_migration_session_assignments_user_idx"
  ON "legacy_migration_session_assignments" USING btree ("user_id", "assigned_at");

INSERT INTO "permissions" ("id", "code", "name", "module", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'migration.mapping.manage', 'Memetakan master produk legacy ke katalog baru', 'migration', 'Membuat draft dan memetakan master legacy ke Product Master sistem baru.', now(), now()),
  (gen_random_uuid(), 'migration.session.manage', 'Mengelola sesi migrasi dan penugasan staff', 'migration', 'Membuat sesi per etalase, menugaskan operator/lead, dan mengatur status sesi.', now(), now())
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
  AND permissions."code" IN ('migration.mapping.manage', 'migration.session.manage')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "legacy_product_master_mappings" (
  "batch_id",
  "organization_id",
  "outlet_id",
  "legacy_master_code",
  "legacy_master_name",
  "legacy_category",
  "normalized_category_name",
  "item_count"
)
SELECT
  rows."batch_id",
  rows."organization_id",
  rows."outlet_id",
  btrim(rows."legacy_master_code"),
  max(coalesce(nullif(btrim(rows."legacy_master_name"), ''), btrim(rows."legacy_master_code"))),
  max(nullif(btrim(rows."legacy_category"), '')),
  max(nullif(initcap(lower(btrim(rows."legacy_category"))), '')),
  count(*)::integer
FROM "legacy_product_rows" rows
WHERE nullif(btrim(rows."legacy_master_code"), '') IS NOT NULL
GROUP BY
  rows."batch_id",
  rows."organization_id",
  rows."outlet_id",
  btrim(rows."legacy_master_code")
ON CONFLICT ("batch_id", "legacy_master_code") DO NOTHING;
