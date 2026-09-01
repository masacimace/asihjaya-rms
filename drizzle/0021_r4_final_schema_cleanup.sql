-- R4 final schema cleanup.
-- Retires approval/payment reconciliation compatibility, obsolete physical migration workflow,
-- same-day shift permission alias, and the retired finance approval metric.

-- Retired permissions must be detached first because role_permissions uses RESTRICT semantics.
DELETE FROM "role_permissions"
WHERE "permission_id" IN (
  SELECT "id"
  FROM "permissions"
  WHERE "code" IN (
    'shifts.reopen',
    'migration.mapping.manage',
    'migration.session.manage',
    'migration.scan',
    'migration.verification.submit',
    'migration.verification.review',
    'migration.verification.approve',
    'migration.sold.manage',
    'migration.cutover.execute'
  )
);--> statement-breakpoint

DELETE FROM "permissions"
WHERE "code" IN (
  'shifts.reopen',
  'migration.mapping.manage',
  'migration.session.manage',
  'migration.scan',
  'migration.verification.submit',
  'migration.verification.review',
  'migration.verification.approve',
  'migration.sold.manage',
  'migration.cutover.execute'
);--> statement-breakpoint

-- Remove retained-domain foreign keys/columns that pointed at the retired approvals domain.
ALTER TABLE "customer_deposit_ledger" DROP COLUMN "approval_id";--> statement-breakpoint
ALTER TABLE "payment_refunds" DROP COLUMN "approval_id";--> statement-breakpoint
ALTER TABLE "sale_return_cases" DROP COLUMN "approval_id";--> statement-breakpoint

-- Payments keep only the final simple-payment contract.
ALTER TABLE "payments" DROP COLUMN "normalized_reference";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "external_order_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "verification_status";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "verification_source";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "provider_paid_at";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "verification_approval_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "co_verified_by";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "co_verified_at";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "evidence_key";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "settlement_status";--> statement-breakpoint

-- Retired payment/approval workflow tables. Keep manual_payment_profiles: it is still used by POS EDC/Transfer presets.
DROP TABLE "settlement_import_rows";--> statement-breakpoint
DROP TABLE "settlement_import_mappings";--> statement-breakpoint
DROP TABLE "settlement_import_batches";--> statement-breakpoint
DROP TABLE "payment_reconciliations";--> statement-breakpoint
DROP TABLE "payment_evidence_uploads";--> statement-breakpoint
DROP TABLE "manual_payment_policies";--> statement-breakpoint
DROP TABLE "approvals";--> statement-breakpoint

-- Retired physical migration/session workflow. Direct Legacy Import tables remain active.
DROP TABLE "legacy_migration_sold_records";--> statement-breakpoint
DROP TABLE "legacy_migration_cutover_runs";--> statement-breakpoint
DROP TABLE "legacy_migration_verifications";--> statement-breakpoint
DROP TABLE "legacy_migration_session_assignments";--> statement-breakpoint
DROP TABLE "legacy_migration_sessions";--> statement-breakpoint

-- Finance snapshots no longer carry the permanently-zero approval metric.
ALTER TABLE "finance_closing_snapshots"
  DROP CONSTRAINT "finance_closing_snapshots_counts_nonnegative_ck";--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots"
  DROP COLUMN "pending_approval_count";--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots"
  ADD CONSTRAINT "finance_closing_snapshots_counts_nonnegative_ck"
  CHECK (
    "finance_closing_snapshots"."transaction_count" >= 0
    and "finance_closing_snapshots"."items_sold_count" >= 0
    and "finance_closing_snapshots"."held_transaction_count" >= 0
  );--> statement-breakpoint

-- Enum types are dropped only after every table/column dependency above has been removed.
DROP TYPE "public"."approval_execution_status";--> statement-breakpoint
DROP TYPE "public"."approval_status";--> statement-breakpoint
DROP TYPE "public"."approval_type";--> statement-breakpoint
DROP TYPE "public"."manual_payment_verification_status";--> statement-breakpoint
DROP TYPE "public"."payment_settlement_status";--> statement-breakpoint
DROP TYPE "public"."settlement_import_status";--> statement-breakpoint
DROP TYPE "public"."settlement_import_row_status";--> statement-breakpoint
DROP TYPE "public"."legacy_migration_session_status";--> statement-breakpoint
DROP TYPE "public"."legacy_migration_assignment_role";--> statement-breakpoint
DROP TYPE "public"."legacy_migration_verification_source";--> statement-breakpoint
DROP TYPE "public"."legacy_migration_verification_status";
