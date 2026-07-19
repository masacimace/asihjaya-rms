CREATE TYPE "public"."approval_execution_status" AS ENUM('not_started', 'executing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_refund_status" AS ENUM('requested', 'approved', 'processing', 'confirmed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "payment_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"approval_id" uuid,
	"original_shift_id" uuid NOT NULL,
	"refund_shift_id" uuid,
	"amount" numeric(18, 0) NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider" varchar(80) DEFAULT 'manual' NOT NULL,
	"provider_reference" varchar(160),
	"destination_masked" varchar(160),
	"evidence_key" text,
	"reason" text NOT NULL,
	"status" "payment_refund_status" DEFAULT 'requested' NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"requested_by" uuid NOT NULL,
	"approved_by" uuid,
	"executed_by" uuid,
	"confirmed_by" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"failure_code" varchar(120),
	"failure_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_refunds_amount_positive_ck" CHECK ("payment_refunds"."amount" > 0),
	CONSTRAINT "payment_refunds_confirmed_state_ck" CHECK ("payment_refunds"."status" <> 'confirmed' or "payment_refunds"."confirmed_at" is not null),
	CONSTRAINT "payment_refunds_cash_shift_ck" CHECK (not ("payment_refunds"."method" = 'cash' and "payment_refunds"."status" = 'confirmed')
        or "payment_refunds"."refund_shift_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "execution_status" "approval_execution_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "execution_idempotency_key" varchar(160);--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "execution_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "executed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "executed_by" uuid;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "execution_error" text;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_original_shift_id_shifts_id_fk" FOREIGN KEY ("original_shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_refund_shift_id_shifts_id_fk" FOREIGN KEY ("refund_shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_org_idempotency_uq" ON "payment_refunds" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_approval_payment_uq" ON "payment_refunds" USING btree ("approval_id","payment_id") WHERE "payment_refunds"."approval_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_refunds_sale_status_idx" ON "payment_refunds" USING btree ("sale_id","status");--> statement-breakpoint
CREATE INDEX "payment_refunds_payment_status_idx" ON "payment_refunds" USING btree ("payment_id","status");--> statement-breakpoint
CREATE INDEX "payment_refunds_refund_shift_idx" ON "payment_refunds" USING btree ("refund_shift_id");--> statement-breakpoint
CREATE INDEX "payment_refunds_provider_reference_idx" ON "payment_refunds" USING btree ("provider","provider_reference");--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DO $$
DECLARE
  conflict_count integer;
BEGIN
  SELECT count(*) INTO conflict_count
  FROM (
    SELECT register_id
    FROM shifts
    WHERE status IN ('open', 'closing')
    GROUP BY register_id
    HAVING count(*) > 1
  ) conflicts;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      'P0-A migration blocked: % register memiliki lebih dari satu shift open/closing. Jalankan npm run db:preflight:p0a untuk melihat detail.',
      conflict_count;
  END IF;

  SELECT count(*) INTO conflict_count
  FROM (
    SELECT type, reference_type, reference_id
    FROM cash_movements
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL
    GROUP BY type, reference_type, reference_id
    HAVING count(*) > 1
  ) conflicts;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      'P0-A migration blocked: % duplicate cash movement reference ditemukan. Jalankan npm run db:preflight:p0a untuk melihat detail.',
      conflict_count;
  END IF;

  SELECT count(*) INTO conflict_count
  FROM (
    SELECT item_id, movement_type, reference_type, reference_id
    FROM inventory_movements
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL
    GROUP BY item_id, movement_type, reference_type, reference_id
    HAVING count(*) > 1
  ) conflicts;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      'P0-A migration blocked: % duplicate inventory movement reference ditemukan. Jalankan npm run db:preflight:p0a untuk melihat detail.',
      conflict_count;
  END IF;

  SELECT count(*) INTO conflict_count
  FROM approvals
  WHERE request_data ->> 'executionStatus' IN ('void_executed', 'refund_executed')
    AND NOT EXISTS (
      SELECT 1
      FROM users executor
      WHERE executor.id = approvals.approved_by
        OR (
          request_data ->> 'executedBy' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND executor.id = (request_data ->> 'executedBy')::uuid
        )
    );

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      'P0-A migration blocked: % approval lama sudah dieksekusi tetapi tidak memiliki executor untuk backfill.',
      conflict_count;
  END IF;
END $$;--> statement-breakpoint
UPDATE approvals
SET
  execution_status = 'completed',
  execution_idempotency_key = coalesce(
    execution_idempotency_key,
    'legacy-approval-execution:' || id::text
  ),
  execution_started_at = coalesce(execution_started_at, resolved_at, created_at),
  executed_at = coalesce(executed_at, resolved_at, created_at),
  executed_by = coalesce(
    executed_by,
    (
      SELECT executor.id
      FROM users executor
      WHERE request_data ->> 'executedBy' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND executor.id = (request_data ->> 'executedBy')::uuid
      LIMIT 1
    ),
    approved_by
  )
WHERE request_data ->> 'executionStatus' IN ('void_executed', 'refund_executed');--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_execution_idempotency_uq" ON "approvals" USING btree ("organization_id","execution_idempotency_key") WHERE "approvals"."execution_idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "approvals_execution_status_idx" ON "approvals" USING btree ("organization_id","execution_status");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movements_reference_guard_uq" ON "cash_movements" USING btree ("type","reference_type","reference_id") WHERE "cash_movements"."reference_type" is not null and "cash_movements"."reference_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_reference_guard_uq" ON "inventory_movements" USING btree ("item_id","movement_type","reference_type","reference_id") WHERE "inventory_movements"."reference_type" is not null and "inventory_movements"."reference_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_one_active_per_register_uq" ON "shifts" USING btree ("register_id") WHERE "shifts"."status" in ('open', 'closing');--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_executing_state_ck" CHECK ("approvals"."execution_status" <> 'executing' or "approvals"."execution_started_at" is not null);--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_completed_state_ck" CHECK ("approvals"."execution_status" <> 'completed' or (
        "approvals"."executed_at" is not null and "approvals"."executed_by" is not null
      ));--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_amount_ck" CHECK ((
        "cash_movements"."type" = 'opening_balance' and "cash_movements"."amount" >= 0
      ) or (
        "cash_movements"."type" <> 'opening_balance' and "cash_movements"."amount" > 0
      ));--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_system_reference_ck" CHECK ("cash_movements"."type" not in ('opening_balance', 'cash_sale', 'cash_refund')
        or ("cash_movements"."reference_type" is not null and "cash_movements"."reference_id" is not null));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive_ck" CHECK ("payments"."amount" > 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_paid_state_complete_ck" CHECK ("payments"."status" <> 'paid' or (
        "payments"."verified_by" is not null
        and "payments"."verified_at" is not null
        and "payments"."paid_at" is not null
      ));--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_list_price_positive_ck" CHECK ("sale_items"."list_price_amount" > 0);--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_discount_nonnegative_ck" CHECK ("sale_items"."discount_amount" >= 0);--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_discount_not_above_list_ck" CHECK ("sale_items"."discount_amount" <= "sale_items"."list_price_amount");--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_final_price_formula_ck" CHECK ("sale_items"."final_price_amount" = "sale_items"."list_price_amount" - "sale_items"."discount_amount");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_subtotal_nonnegative_ck" CHECK ("sales"."subtotal_amount" >= 0);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_discount_nonnegative_ck" CHECK ("sales"."discount_amount" >= 0);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_additional_fee_nonnegative_ck" CHECK ("sales"."additional_fee_amount" >= 0);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_total_nonnegative_ck" CHECK ("sales"."total_amount" >= 0);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_discount_not_above_subtotal_ck" CHECK ("sales"."discount_amount" <= "sales"."subtotal_amount");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_total_formula_ck" CHECK ("sales"."total_amount" = "sales"."subtotal_amount" - "sales"."discount_amount" + "sales"."additional_fee_amount");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_completed_timestamp_ck" CHECK ("sales"."status" <> 'completed' or "sales"."completed_at" is not null);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelled_timestamp_ck" CHECK ("sales"."status" not in ('cancelled', 'voided', 'refunded') or "sales"."cancelled_at" is not null);--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_opening_cash_nonnegative_ck" CHECK ("shifts"."opening_cash" >= 0);--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_actual_cash_nonnegative_ck" CHECK ("shifts"."actual_cash" is null or "shifts"."actual_cash" >= 0);--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closed_state_complete_ck" CHECK ("shifts"."status" <> 'closed' or (
        "shifts"."closed_by" is not null
        and "shifts"."expected_cash" is not null
        and "shifts"."actual_cash" is not null
        and "shifts"."cash_variance" is not null
        and "shifts"."closed_at" is not null
      ));