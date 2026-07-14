-- P1-C.2 catch-up repair for databases where migration 0020 created the
-- settlement import schema but failed while inserting the permission because
-- the SQL referenced a non-existent permissions.is_system column.
-- Safe to run repeatedly.

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
