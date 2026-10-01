INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" = 'pricing.manage'
WHERE r."code" = 'cashier'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
