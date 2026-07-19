INSERT INTO "permissions" (
  "id",
  "code",
  "name",
  "module",
  "description",
  "created_at",
  "updated_at"
)
VALUES
  (gen_random_uuid(), 'sales.void.request', 'Mengajukan void transaksi', 'sales', NULL, now(), now()),
  (gen_random_uuid(), 'sales.void.approve', 'Menyetujui atau menolak void transaksi', 'sales', NULL, now(), now()),
  (gen_random_uuid(), 'sales.void.execute', 'Mengeksekusi void transaksi yang disetujui', 'sales', NULL, now(), now()),
  (gen_random_uuid(), 'payments.refund.request', 'Mengajukan refund pembayaran', 'payments', NULL, now(), now()),
  (gen_random_uuid(), 'payments.refund.approve', 'Menyetujui atau menolak refund pembayaran', 'payments', NULL, now(), now()),
  (gen_random_uuid(), 'payments.refund.execute', 'Mengeksekusi refund pembayaran yang disetujui', 'payments', NULL, now(), now())
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "updated_at" = now();

WITH role_permission_matrix("role_code", "permission_code") AS (
  VALUES
    ('system_admin', 'sales.void.request'),
    ('system_admin', 'sales.void.approve'),
    ('system_admin', 'sales.void.execute'),
    ('system_admin', 'payments.refund.request'),
    ('system_admin', 'payments.refund.approve'),
    ('system_admin', 'payments.refund.execute'),
    ('owner', 'sales.void.request'),
    ('owner', 'sales.void.approve'),
    ('owner', 'sales.void.execute'),
    ('owner', 'payments.refund.request'),
    ('owner', 'payments.refund.approve'),
    ('owner', 'payments.refund.execute'),
    ('manager', 'sales.void.request'),
    ('manager', 'sales.void.approve'),
    ('manager', 'sales.void.execute'),
    ('manager', 'payments.refund.request'),
    ('manager', 'payments.refund.approve'),
    ('manager', 'payments.refund.execute'),
    ('cashier', 'sales.void.request'),
    ('cashier', 'payments.refund.request'),
    ('finance', 'payments.refund.approve'),
    ('finance', 'payments.refund.execute')
)
INSERT INTO "role_permissions" (
  "id",
  "role_id",
  "permission_id",
  "constraints"
)
SELECT
  gen_random_uuid(),
  role."id",
  permission."id",
  NULL
FROM role_permission_matrix matrix
INNER JOIN "roles" role
  ON role."code" = matrix."role_code"
  AND role."is_active" = true
INNER JOIN "permissions" permission
  ON permission."code" = matrix."permission_code"
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
