CREATE TYPE "public"."manual_payment_verification_status" AS ENUM('self_verified', 'co_verification_required', 'co_verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payment_settlement_status" AS ENUM('not_applicable', 'unreconciled', 'matched', 'mismatch', 'settled');--> statement-breakpoint
CREATE TYPE "public"."approval_type_p1a" AS ENUM('discount', 'void_receipt', 'refund_transaction', 'manual_payment_verification', 'stock_adjustment', 'other');--> statement-breakpoint
ALTER TABLE "approvals" ALTER COLUMN "type" TYPE "public"."approval_type_p1a" USING "type"::text::"public"."approval_type_p1a";--> statement-breakpoint
DROP TYPE "public"."approval_type";--> statement-breakpoint
ALTER TYPE "public"."approval_type_p1a" RENAME TO "approval_type";--> statement-breakpoint

CREATE TABLE "manual_payment_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "method" "payment_method" NOT NULL,
  "co_verification_threshold" numeric(18, 0) DEFAULT '0' NOT NULL,
  "evidence_threshold" numeric(18, 0) DEFAULT '0' NOT NULL,
  "duplicate_lookback_days" integer DEFAULT 30 NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "manual_payment_policies_method_ck" CHECK ("manual_payment_policies"."method" in ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer')),
  CONSTRAINT "manual_payment_policies_thresholds_ck" CHECK ("manual_payment_policies"."co_verification_threshold" >= 0 and "manual_payment_policies"."evidence_threshold" >= 0),
  CONSTRAINT "manual_payment_policies_lookback_ck" CHECK ("manual_payment_policies"."duplicate_lookback_days" between 1 and 3650)
);--> statement-breakpoint

CREATE TABLE "payment_evidence_uploads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "storage_key" text NOT NULL,
  "original_filename" varchar(255),
  "size_bytes" integer NOT NULL,
  "sale_id" uuid,
  "attached_at" timestamp with time zone,
  "expires_at" timestamp with time zone DEFAULT now() + interval '7 days',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_evidence_uploads_size_ck" CHECK ("payment_evidence_uploads"."size_bytes" > 0),
  CONSTRAINT "payment_evidence_uploads_attachment_ck" CHECK (("payment_evidence_uploads"."sale_id" is null and "payment_evidence_uploads"."attached_at" is null) or ("payment_evidence_uploads"."sale_id" is not null and "payment_evidence_uploads"."attached_at" is not null and "payment_evidence_uploads"."expires_at" is null))
);--> statement-breakpoint

ALTER TABLE "payments" ADD COLUMN "normalized_reference" varchar(160);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "verification_status" "manual_payment_verification_status" DEFAULT 'self_verified' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "verification_source" varchar(40);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "verification_approval_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "co_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "co_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "evidence_key" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "settlement_status" "payment_settlement_status" DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint

ALTER TABLE "manual_payment_policies" ADD CONSTRAINT "manual_payment_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence_uploads" ADD CONSTRAINT "payment_evidence_uploads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence_uploads" ADD CONSTRAINT "payment_evidence_uploads_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence_uploads" ADD CONSTRAINT "payment_evidence_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence_uploads" ADD CONSTRAINT "payment_evidence_uploads_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verification_approval_id_approvals_id_fk" FOREIGN KEY ("verification_approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_co_verified_by_users_id_fk" FOREIGN KEY ("co_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "manual_payment_policies_org_method_uq" ON "manual_payment_policies" USING btree ("organization_id", "method");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_evidence_uploads_storage_key_uq" ON "payment_evidence_uploads" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "payment_evidence_uploads_org_outlet_idx" ON "payment_evidence_uploads" USING btree ("organization_id", "outlet_id", "created_at");--> statement-breakpoint
CREATE INDEX "payment_evidence_uploads_expiry_idx" ON "payment_evidence_uploads" USING btree ("sale_id", "expires_at");--> statement-breakpoint
CREATE INDEX "payment_evidence_uploads_uploader_idx" ON "payment_evidence_uploads" USING btree ("uploaded_by", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_manual_payment_fingerprint_uq" ON "approvals" USING btree ("organization_id", "outlet_id", "requested_by", ("request_data"->>'verificationFingerprint')) WHERE "approvals"."type" = 'manual_payment_verification';--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payments
    WHERE method IN ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer')
      AND (
        provider_reference IS NULL
        OR btrim(provider_reference) = ''
        OR length(upper(regexp_replace(provider_reference, '[^A-Za-z0-9]', '', 'g'))) < 4
        OR btrim(provider) = ''
        OR lower(btrim(provider)) = 'manual'
      )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'P1-A migration blocked: legacy manual non-cash payments have missing/placeholder provider or invalid reference.',
      HINT = 'Run npm run db:preflight:p1a and clean the listed rows before retrying migration.';
  END IF;
END
$$;--> statement-breakpoint

UPDATE payments
SET
  normalized_reference = upper(regexp_replace(provider_reference, '[^A-Za-z0-9]', '', 'g')),
  verification_status = 'self_verified',
  verification_source = CASE method
    WHEN 'qris_manual' THEN 'merchant_app'
    WHEN 'debit_card' THEN 'edc_terminal'
    WHEN 'credit_card' THEN 'edc_terminal'
    WHEN 'bank_transfer' THEN 'bank_statement'
  END,
  provider_paid_at = coalesce(paid_at, verified_at, created_at),
  settlement_status = 'unreconciled',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'manualVerificationMigration', 'p1a_legacy_backfill',
    'legacyVerificationAssumption', true
  ),
  updated_at = now()
WHERE method IN ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer');--> statement-breakpoint

INSERT INTO "manual_payment_policies" (
  "id",
  "organization_id",
  "method",
  "co_verification_threshold",
  "evidence_threshold",
  "duplicate_lookback_days",
  "is_enabled",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  organization.id,
  policy.method::payment_method,
  policy.co_verification_threshold,
  policy.evidence_threshold,
  policy.duplicate_lookback_days,
  true,
  now(),
  now()
FROM organizations organization
CROSS JOIN (
  VALUES
    ('qris_manual', 5000000::numeric, 5000000::numeric, 90),
    ('debit_card', 10000000::numeric, 10000000::numeric, 7),
    ('credit_card', 10000000::numeric, 10000000::numeric, 7),
    ('bank_transfer', 10000000::numeric, 10000000::numeric, 180)
) AS policy(method, co_verification_threshold, evidence_threshold, duplicate_lookback_days)
ON CONFLICT ("organization_id", "method") DO NOTHING;--> statement-breakpoint

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
  'payments.verify.manual',
  'Memverifikasi pembayaran manual berisiko tinggi',
  'payments',
  'Menyetujui atau menolak co-verification QRIS manual, transfer, dan EDC.',
  now(),
  now()
)
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description",
  "updated_at" = now();--> statement-breakpoint

WITH role_permission_matrix("role_code", "permission_code") AS (
  VALUES
    ('system_admin', 'payments.verify.manual'),
    ('owner', 'payments.verify.manual'),
    ('manager', 'payments.verify.manual'),
    ('finance', 'payments.verify.manual')
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
ON CONFLICT ("role_id", "permission_id") DO NOTHING;--> statement-breakpoint

CREATE INDEX "payments_normalized_reference_idx" ON "payments" USING btree ("method", "provider", "normalized_reference");--> statement-breakpoint
CREATE INDEX "payments_verification_status_idx" ON "payments" USING btree ("verification_status", "created_at");--> statement-breakpoint
CREATE INDEX "payments_settlement_status_idx" ON "payments" USING btree ("settlement_status", "created_at");--> statement-breakpoint

ALTER TABLE "payments" ADD CONSTRAINT "payments_manual_noncash_verification_ck" CHECK ("payments"."method" not in ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer') or (
  btrim("payments"."provider") <> ''
  and lower(btrim("payments"."provider")) <> 'manual'
  and "payments"."provider_reference" is not null
  and btrim("payments"."provider_reference") <> ''
  and "payments"."normalized_reference" is not null
  and length("payments"."normalized_reference") >= 4
  and "payments"."verification_source" in ('merchant_app', 'edc_terminal', 'bank_app', 'bank_statement')
  and "payments"."provider_paid_at" is not null
  and "payments"."settlement_status" <> 'not_applicable'
));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_co_verified_state_ck" CHECK ("payments"."verification_status" <> 'co_verified' or (
  "payments"."verification_approval_id" is not null
  and "payments"."co_verified_by" is not null
  and "payments"."co_verified_at" is not null
));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cash_settlement_ck" CHECK ("payments"."method" <> 'cash' or (
  "payments"."settlement_status" = 'not_applicable'
  and "payments"."verification_source" is null
  and "payments"."provider_paid_at" is null
  and "payments"."verification_approval_id" is null
  and "payments"."co_verified_by" is null
  and "payments"."co_verified_at" is null
  and "payments"."evidence_key" is null
));
