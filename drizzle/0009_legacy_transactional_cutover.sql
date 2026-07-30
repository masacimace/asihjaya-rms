ALTER TYPE "inventory_movement_type" ADD VALUE IF NOT EXISTS 'migration_opening';

CREATE TABLE "legacy_migration_cutover_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "item_count" integer NOT NULL,
  "executed_by" uuid NOT NULL,
  "executed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legacy_migration_cutover_runs_item_count_ck" CHECK ("item_count" >= 0)
);

ALTER TABLE "legacy_migration_cutover_runs"
  ADD CONSTRAINT "legacy_migration_cutover_runs_batch_id_legacy_product_import_batches_id_fk"
  FOREIGN KEY ("batch_id") REFERENCES "public"."legacy_product_import_batches"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "legacy_migration_cutover_runs"
  ADD CONSTRAINT "legacy_migration_cutover_runs_session_id_legacy_migration_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."legacy_migration_sessions"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "legacy_migration_cutover_runs"
  ADD CONSTRAINT "legacy_migration_cutover_runs_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "legacy_migration_cutover_runs"
  ADD CONSTRAINT "legacy_migration_cutover_runs_outlet_id_outlets_id_fk"
  FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "legacy_migration_cutover_runs"
  ADD CONSTRAINT "legacy_migration_cutover_runs_executed_by_users_id_fk"
  FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "legacy_migration_cutover_runs_session_uq"
  ON "legacy_migration_cutover_runs" USING btree ("session_id");

CREATE INDEX "legacy_migration_cutover_runs_batch_time_idx"
  ON "legacy_migration_cutover_runs" USING btree ("batch_id", "executed_at");

INSERT INTO "permissions" (
  "id", "code", "name", "module", "description", "created_at", "updated_at"
)
VALUES (
  gen_random_uuid(),
  'migration.cutover.execute',
  'Menjalankan aktivasi stok hasil migrasi',
  'migration',
  'Menjalankan preflight dan aktivasi transactional dari migration hold menjadi available per sesi migrasi.',
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
  AND permissions."code" = 'migration.cutover.execute'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
