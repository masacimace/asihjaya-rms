CREATE UNIQUE INDEX "hardware_agents_one_active_per_register_uq" ON "hardware_agents" USING btree ("register_id") WHERE "hardware_agents"."is_active" = true;
--> statement-breakpoint
INSERT INTO "permissions" (
  "id",
  "code",
  "name",
  "module",
  "description",
  "created_at",
  "updated_at"
)
VALUES (
  gen_random_uuid(),
  'hardware.agents.manage',
  'Mengelola provisioning Hardware Agent',
  'operations',
  'Membuat, mengganti credential, mengaktifkan, dan menonaktifkan Hardware Agent.',
  now(),
  now()
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
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
FROM "roles" AS role_record
CROSS JOIN "permissions" AS permission_record
WHERE role_record."code" IN ('system_admin', 'owner')
  AND permission_record."code" = 'hardware.agents.manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;