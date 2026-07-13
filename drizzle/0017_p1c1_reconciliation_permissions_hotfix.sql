-- P1-C.1 reconciliation permission repair
-- Forward-only, idempotent data migration for environments where the
-- reconciliation schema exists but the permission seed from 0016 was not applied.

INSERT INTO "permissions" (
  "code",
  "name",
  "module",
  "description",
  "created_at",
  "updated_at"
)
VALUES
  (
    'payments.reconciliation.view',
    'Melihat rekonsiliasi pembayaran',
    'payments',
    'Melihat payment, settlement, fee, dan mismatch rekonsiliasi.',
    now(),
    now()
  ),
  (
    'payments.reconciliation.manage',
    'Mencatat rekonsiliasi pembayaran',
    'payments',
    'Mencatat hasil pencocokan payment dengan settlement provider atau bank.',
    now(),
    now()
  ),
  (
    'payments.reconciliation.resolve',
    'Menyelesaikan mismatch rekonsiliasi',
    'payments',
    'Menyelesaikan mismatch, payment tidak ditemukan, atau pengecualian rekonsiliasi.',
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
  role_row."id",
  permission_row."id",
  NULL
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."code" IN ('system_admin', 'owner', 'manager', 'finance')
  AND permission_row."code" IN (
    'payments.reconciliation.view',
    'payments.reconciliation.manage',
    'payments.reconciliation.resolve'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
--> statement-breakpoint

DO $$
DECLARE
  permission_count integer;
BEGIN
  SELECT count(*)
  INTO permission_count
  FROM "permissions"
  WHERE "code" IN (
    'payments.reconciliation.view',
    'payments.reconciliation.manage',
    'payments.reconciliation.resolve'
  );

  IF permission_count <> 3 THEN
    RAISE EXCEPTION
      'P1-C.1 permission repair failed: expected 3 reconciliation permissions, found %',
      permission_count;
  END IF;
END $$;
