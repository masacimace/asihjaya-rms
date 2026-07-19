-- P1-C.1 reconciliation schema repair (corrected)
-- Safe for databases where the original repair stopped after dropping the
-- payments.settlement_status default.

ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_manual_noncash_verification_ck";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_cash_settlement_ck";
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.payment_reconciliations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "payment_reconciliations" DROP CONSTRAINT IF EXISTS "payment_reconciliations_actionable_status_ck"';
    EXECUTE 'ALTER TABLE "payment_reconciliations" DROP CONSTRAINT IF EXISTS "payment_reconciliations_reconciled_complete_ck"';
    EXECUTE 'ALTER TABLE "payment_reconciliations" DROP CONSTRAINT IF EXISTS "payment_reconciliations_mismatch_complete_ck"';
    EXECUTE 'ALTER TABLE "payment_reconciliations" DROP CONSTRAINT IF EXISTS "payment_reconciliations_not_found_notes_ck"';
    EXECUTE 'ALTER TABLE "payment_reconciliations" DROP CONSTRAINT IF EXISTS "payment_reconciliations_waived_resolution_ck"';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "settlement_status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "payments"
  ALTER COLUMN "settlement_status"
  SET DATA TYPE text
  USING "settlement_status"::text;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.payment_reconciliations') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE "payment_reconciliations"
      ALTER COLUMN "status"
      SET DATA TYPE text
      USING "status"::text
    ';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "payments"
SET "settlement_status" = CASE
  WHEN "settlement_status" = 'matched' THEN 'pending_settlement'
  WHEN "settlement_status" = 'settled' THEN 'reconciled'
  ELSE "settlement_status"
END;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.payment_reconciliations') IS NOT NULL THEN
    UPDATE "payment_reconciliations"
    SET "status" = CASE
      WHEN "status" = 'matched' THEN 'pending_settlement'
      WHEN "status" = 'settled' THEN 'reconciled'
      ELSE "status"
    END;
  END IF;
END $$;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."payment_settlement_status";
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
ALTER TABLE "payments"
  ALTER COLUMN "settlement_status"
  SET DATA TYPE "public"."payment_settlement_status"
  USING "settlement_status"::"public"."payment_settlement_status";
--> statement-breakpoint
ALTER TABLE "payments"
  ALTER COLUMN "settlement_status"
  SET DEFAULT 'not_applicable'::"public"."payment_settlement_status";
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.payment_reconciliations') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE "payment_reconciliations"
      ALTER COLUMN "status"
      SET DATA TYPE "public"."payment_settlement_status"
      USING "status"::"public"."payment_settlement_status"
    ';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_reconciliations" (
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
  CONSTRAINT "payment_reconciliations_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "payment_reconciliations_outlet_id_outlets_id_fk"
    FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "payment_reconciliations_payment_id_payments_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "payment_reconciliations_reconciled_by_users_id_fk"
    FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "payment_reconciliations_resolved_by_users_id_fk"
    FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action,
  CONSTRAINT "payment_reconciliations_actionable_status_ck"
    CHECK ("status" not in ('not_applicable', 'unreconciled')),
  CONSTRAINT "payment_reconciliations_expected_positive_ck"
    CHECK ("expected_amount" > 0),
  CONSTRAINT "payment_reconciliations_amounts_nonnegative_ck"
    CHECK (
      "fee_amount" >= 0
      and "tax_amount" >= 0
      and ("settlement_gross_amount" is null or "settlement_gross_amount" >= 0)
      and ("net_settlement_amount" is null or "net_settlement_amount" >= 0)
    ),
  CONSTRAINT "payment_reconciliations_net_formula_ck"
    CHECK (
      "settlement_gross_amount" is null
      or "net_settlement_amount" is null
      or "net_settlement_amount" = "settlement_gross_amount" - "fee_amount" - "tax_amount"
    ),
  CONSTRAINT "payment_reconciliations_difference_formula_ck"
    CHECK (
      "settlement_gross_amount" is null
      or "difference_amount" = "settlement_gross_amount" - "expected_amount"
    ),
  CONSTRAINT "payment_reconciliations_reconciled_complete_ck"
    CHECK (
      "status" <> 'reconciled'
      or (
        "settlement_gross_amount" = "expected_amount"
        and "difference_amount" = 0
        and "net_settlement_amount" is not null
        and "settlement_date" is not null
        and "settlement_reference" is not null
        and btrim("settlement_reference") <> ''
      )
    ),
  CONSTRAINT "payment_reconciliations_mismatch_complete_ck"
    CHECK (
      "status" <> 'mismatch'
      or (
        "settlement_gross_amount" is not null
        and "difference_amount" <> 0
      )
    ),
  CONSTRAINT "payment_reconciliations_not_found_notes_ck"
    CHECK (
      "status" <> 'not_found'
      or ("notes" is not null and length(btrim("notes")) >= 8)
    ),
  CONSTRAINT "payment_reconciliations_waived_resolution_ck"
    CHECK (
      "status" <> 'waived'
      or (
        "notes" is not null
        and length(btrim("notes")) >= 8
        and "resolved_by" is not null
        and "resolved_at" is not null
      )
    )
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_reconciliations_actionable_status_ck'
      AND conrelid = 'public.payment_reconciliations'::regclass
  ) THEN
    ALTER TABLE "payment_reconciliations"
      ADD CONSTRAINT "payment_reconciliations_actionable_status_ck"
      CHECK ("status" not in ('not_applicable', 'unreconciled'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_reconciliations_reconciled_complete_ck'
      AND conrelid = 'public.payment_reconciliations'::regclass
  ) THEN
    ALTER TABLE "payment_reconciliations"
      ADD CONSTRAINT "payment_reconciliations_reconciled_complete_ck"
      CHECK (
        "status" <> 'reconciled'
        or (
          "settlement_gross_amount" = "expected_amount"
          and "difference_amount" = 0
          and "net_settlement_amount" is not null
          and "settlement_date" is not null
          and "settlement_reference" is not null
          and btrim("settlement_reference") <> ''
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_reconciliations_mismatch_complete_ck'
      AND conrelid = 'public.payment_reconciliations'::regclass
  ) THEN
    ALTER TABLE "payment_reconciliations"
      ADD CONSTRAINT "payment_reconciliations_mismatch_complete_ck"
      CHECK (
        "status" <> 'mismatch'
        or (
          "settlement_gross_amount" is not null
          and "difference_amount" <> 0
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_reconciliations_not_found_notes_ck'
      AND conrelid = 'public.payment_reconciliations'::regclass
  ) THEN
    ALTER TABLE "payment_reconciliations"
      ADD CONSTRAINT "payment_reconciliations_not_found_notes_ck"
      CHECK (
        "status" <> 'not_found'
        or ("notes" is not null and length(btrim("notes")) >= 8)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_reconciliations_waived_resolution_ck'
      AND conrelid = 'public.payment_reconciliations'::regclass
  ) THEN
    ALTER TABLE "payment_reconciliations"
      ADD CONSTRAINT "payment_reconciliations_waived_resolution_ck"
      CHECK (
        "status" <> 'waived'
        or (
          "notes" is not null
          and length(btrim("notes")) >= 8
          and "resolved_by" is not null
          and "resolved_at" is not null
        )
      );
  END IF;
END $$;
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
CREATE UNIQUE INDEX IF NOT EXISTS "payment_reconciliations_payment_uq"
  ON "payment_reconciliations" USING btree ("payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliations_org_status_idx"
  ON "payment_reconciliations" USING btree ("organization_id", "status", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliations_outlet_status_idx"
  ON "payment_reconciliations" USING btree ("outlet_id", "status", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliations_settlement_date_idx"
  ON "payment_reconciliations" USING btree ("settlement_date");
--> statement-breakpoint
INSERT INTO "permissions" (
  "code", "name", "module", "description", "created_at", "updated_at"
)
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
--> statement-breakpoint
DO $$
DECLARE
  enum_value_count integer;
BEGIN
  SELECT count(*) INTO enum_value_count
  FROM pg_enum enum_row
  JOIN pg_type type_row ON type_row.oid = enum_row.enumtypid
  JOIN pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
  WHERE namespace_row.nspname = 'public'
    AND type_row.typname = 'payment_settlement_status'
    AND enum_row.enumlabel IN (
      'not_applicable', 'unreconciled', 'pending_settlement',
      'reconciled', 'mismatch', 'not_found', 'waived'
    );

  IF enum_value_count <> 7 THEN
    RAISE EXCEPTION 'P1-C.1 repair failed: payment settlement enum is incomplete.';
  END IF;

  IF to_regclass('public.payment_reconciliations') IS NULL THEN
    RAISE EXCEPTION 'P1-C.1 repair failed: payment_reconciliations is missing.';
  END IF;
END $$;
