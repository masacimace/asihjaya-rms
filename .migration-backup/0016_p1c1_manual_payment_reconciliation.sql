-- P1-C.1 Manual Payment Reconciliation
-- Replace the settlement enum transaction-safely and preserve legacy values.
-- The P1-A checks depend on settlement_status, so they must be removed before
-- temporarily converting the enum column to text and restored afterwards.
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_manual_noncash_verification_ck";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_cash_settlement_ck";
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "settlement_status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "settlement_status" SET DATA TYPE text USING "settlement_status"::text;
--> statement-breakpoint
UPDATE "payments"
SET "settlement_status" = CASE
  WHEN "settlement_status" = 'matched' THEN 'pending_settlement'
  WHEN "settlement_status" = 'settled' THEN 'reconciled'
  ELSE "settlement_status"
END;
--> statement-breakpoint
DROP TYPE "public"."payment_settlement_status";
--> statement-breakpoint
CREATE TYPE "public"."payment_settlement_status" AS ENUM(
  'not_applicable',
  'unreconciled',
  'pending_settlement',
  'reconciled',
  'mismatch',
  'not_found',
  'waived'
);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "settlement_status" SET DATA TYPE "public"."payment_settlement_status" USING "settlement_status"::"public"."payment_settlement_status";
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "settlement_status" SET DEFAULT 'not_applicable'::"public"."payment_settlement_status";
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_manual_noncash_verification_ck" CHECK (
  "payments"."method" not in ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer') or (
    btrim("payments"."provider") <> ''
    and lower(btrim("payments"."provider")) <> 'manual'
    and "payments"."provider_reference" is not null
    and btrim("payments"."provider_reference") <> ''
    and "payments"."normalized_reference" is not null
    and length("payments"."normalized_reference") >= 4
    and "payments"."verification_source" in ('merchant_app', 'edc_terminal', 'bank_app', 'bank_statement')
    and "payments"."provider_paid_at" is not null
    and "payments"."settlement_status" <> 'not_applicable'
  )
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cash_settlement_ck" CHECK (
  "payments"."method" <> 'cash' or (
    "payments"."settlement_status" = 'not_applicable'
    and "payments"."verification_source" is null
    and "payments"."provider_paid_at" is null
    and "payments"."verification_approval_id" is null
    and "payments"."co_verified_by" is null
    and "payments"."co_verified_at" is null
    and "payments"."evidence_key" is null
  )
);
--> statement-breakpoint
CREATE TABLE "payment_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"status" "payment_settlement_status" NOT NULL,
	"expected_amount" numeric(18, 0) NOT NULL,
	"settlement_gross_amount" numeric(18, 0),
	"fee_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"net_settlement_amount" numeric(18, 0),
	"difference_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"settlement_date" timestamp with time zone,
	"settlement_reference" varchar(160),
	"evidence_key" text,
	"notes" text,
	"reconciled_by" uuid NOT NULL,
	"reconciled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reconciliations_actionable_status_ck" CHECK ("payment_reconciliations"."status" not in ('not_applicable', 'unreconciled')),
	CONSTRAINT "payment_reconciliations_expected_positive_ck" CHECK ("payment_reconciliations"."expected_amount" > 0),
	CONSTRAINT "payment_reconciliations_amounts_nonnegative_ck" CHECK ("payment_reconciliations"."fee_amount" >= 0 and "payment_reconciliations"."tax_amount" >= 0 and ("payment_reconciliations"."settlement_gross_amount" is null or "payment_reconciliations"."settlement_gross_amount" >= 0) and ("payment_reconciliations"."net_settlement_amount" is null or "payment_reconciliations"."net_settlement_amount" >= 0)),
	CONSTRAINT "payment_reconciliations_net_formula_ck" CHECK ("payment_reconciliations"."settlement_gross_amount" is null or "payment_reconciliations"."net_settlement_amount" is null or "payment_reconciliations"."net_settlement_amount" = "payment_reconciliations"."settlement_gross_amount" - "payment_reconciliations"."fee_amount" - "payment_reconciliations"."tax_amount"),
	CONSTRAINT "payment_reconciliations_difference_formula_ck" CHECK ("payment_reconciliations"."settlement_gross_amount" is null or "payment_reconciliations"."difference_amount" = "payment_reconciliations"."settlement_gross_amount" - "payment_reconciliations"."expected_amount"),
	CONSTRAINT "payment_reconciliations_reconciled_complete_ck" CHECK ("payment_reconciliations"."status" <> 'reconciled' or (
        "payment_reconciliations"."settlement_gross_amount" = "payment_reconciliations"."expected_amount"
        and "payment_reconciliations"."difference_amount" = 0
        and "payment_reconciliations"."net_settlement_amount" is not null
        and "payment_reconciliations"."settlement_date" is not null
        and "payment_reconciliations"."settlement_reference" is not null
        and btrim("payment_reconciliations"."settlement_reference") <> ''
      )),
	CONSTRAINT "payment_reconciliations_mismatch_complete_ck" CHECK ("payment_reconciliations"."status" <> 'mismatch' or (
        "payment_reconciliations"."settlement_gross_amount" is not null
        and "payment_reconciliations"."difference_amount" <> 0
      )),
	CONSTRAINT "payment_reconciliations_not_found_notes_ck" CHECK ("payment_reconciliations"."status" <> 'not_found' or ("payment_reconciliations"."notes" is not null and length(btrim("payment_reconciliations"."notes")) >= 8)),
	CONSTRAINT "payment_reconciliations_waived_resolution_ck" CHECK ("payment_reconciliations"."status" <> 'waived' or (
        "payment_reconciliations"."notes" is not null
        and length(btrim("payment_reconciliations"."notes")) >= 8
        and "payment_reconciliations"."resolved_by" is not null
        and "payment_reconciliations"."resolved_at" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reconciliations_payment_uq" ON "payment_reconciliations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_reconciliations_org_status_idx" ON "payment_reconciliations" USING btree ("organization_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "payment_reconciliations_outlet_status_idx" ON "payment_reconciliations" USING btree ("outlet_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "payment_reconciliations_settlement_date_idx" ON "payment_reconciliations" USING btree ("settlement_date");
--> statement-breakpoint
INSERT INTO "permissions" ("code", "name", "module", "description", "created_at", "updated_at")
VALUES
  ('payments.reconciliation.view', 'Melihat rekonsiliasi pembayaran', 'payments', 'Melihat payment, settlement, fee, dan mismatch rekonsiliasi.', now(), now()),
  ('payments.reconciliation.manage', 'Mencatat rekonsiliasi pembayaran', 'payments', 'Mencatat hasil pencocokan payment dengan settlement provider atau bank.', now(), now()),
  ('payments.reconciliation.resolve', 'Menyelesaikan mismatch rekonsiliasi', 'payments', 'Menyelesaikan mismatch, payment tidak ditemukan, atau pengecualian rekonsiliasi.', now(), now())
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "constraints")
SELECT gen_random_uuid(), role_row."id", permission_row."id", NULL
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."code" IN ('system_admin', 'owner', 'manager', 'finance')
  AND permission_row."code" IN (
    'payments.reconciliation.view',
    'payments.reconciliation.manage',
    'payments.reconciliation.resolve'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
