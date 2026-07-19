-- Hardware Job Protocol v2 secure producer permission.
-- Idempotent data migration for existing organizations and built-in roles.

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
  'inventory.print_label',
  'Mencetak label barcode inventaris',
  'Membuat Hardware Job Protocol v2 untuk label barcode dari data item canonical di server.',
  'inventory',
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
  ON permission_record."code" = 'inventory.print_label'
WHERE role_record."code" IN (
  'system_admin',
  'owner',
  'manager',
  'stock_admin'
)
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
--> statement-breakpoint

-- Preserve compatibility for custom roles that previously had the legacy
-- inventory.manage aggregate permission.
INSERT INTO "role_permissions" (
  "id",
  "role_id",
  "permission_id",
  "constraints"
)
SELECT
  gen_random_uuid(),
  legacy_assignment."role_id",
  print_permission."id",
  legacy_assignment."constraints"
FROM "role_permissions" legacy_assignment
JOIN "permissions" legacy_permission
  ON legacy_permission."id" = legacy_assignment."permission_id"
  AND legacy_permission."code" = 'inventory.manage'
JOIN "permissions" print_permission
  ON print_permission."code" = 'inventory.print_label'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
