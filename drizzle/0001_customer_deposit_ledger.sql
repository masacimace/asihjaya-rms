CREATE TYPE "public"."customer_deposit_ledger_direction" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."customer_deposit_ledger_entry_type" AS ENUM('deposit_in', 'deposit_used', 'deposit_withdrawal', 'adjustment');--> statement-breakpoint
ALTER TYPE "public"."approval_type" ADD VALUE IF NOT EXISTS 'customer_deposit_withdrawal';--> statement-breakpoint
CREATE TABLE "customer_deposit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"sale_id" uuid,
	"payment_id" uuid,
	"cash_movement_id" uuid,
	"approval_id" uuid,
	"entry_type" "customer_deposit_ledger_entry_type" NOT NULL,
	"direction" "customer_deposit_ledger_direction" NOT NULL,
	"amount" numeric(18, 0) NOT NULL,
	"balance_after" numeric(18, 0) DEFAULT '0' NOT NULL,
	"idempotency_key" varchar(160),
	"reference_type" varchar(80),
	"reference_id" uuid,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_deposit_ledger_amount_positive_ck" CHECK ("customer_deposit_ledger"."amount" > 0),
	CONSTRAINT "customer_deposit_ledger_balance_nonnegative_ck" CHECK ("customer_deposit_ledger"."balance_after" >= 0),
	CONSTRAINT "customer_deposit_ledger_direction_ck" CHECK ((
        ("customer_deposit_ledger"."entry_type" = 'deposit_in' and "customer_deposit_ledger"."direction" = 'credit')
        or ("customer_deposit_ledger"."entry_type" in ('deposit_used', 'deposit_withdrawal') and "customer_deposit_ledger"."direction" = 'debit')
        or ("customer_deposit_ledger"."entry_type" = 'adjustment' and "customer_deposit_ledger"."direction" in ('credit', 'debit'))
      )),
	CONSTRAINT "customer_deposit_ledger_reference_pair_ck" CHECK (("customer_deposit_ledger"."reference_type" is null and "customer_deposit_ledger"."reference_id" is null)
        or ("customer_deposit_ledger"."reference_type" is not null and "customer_deposit_ledger"."reference_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "customer_deposit_ledger" ADD CONSTRAINT "customer_deposit_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_deposit_ledger" ADD CONSTRAINT "customer_deposit_ledger_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_deposit_ledger" ADD CONSTRAINT "customer_deposit_ledger_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_deposit_ledger" ADD CONSTRAINT "customer_deposit_ledger_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_deposit_ledger" ADD CONSTRAINT "customer_deposit_ledger_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_deposit_ledger" ADD CONSTRAINT "customer_deposit_ledger_cash_movement_id_cash_movements_id_fk" FOREIGN KEY ("cash_movement_id") REFERENCES "public"."cash_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_deposit_ledger" ADD CONSTRAINT "customer_deposit_ledger_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_deposit_ledger" ADD CONSTRAINT "customer_deposit_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_deposit_ledger_scope_time_idx" ON "customer_deposit_ledger" USING btree ("organization_id","outlet_id","customer_id","occurred_at");--> statement-breakpoint
CREATE INDEX "customer_deposit_ledger_sale_idx" ON "customer_deposit_ledger" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "customer_deposit_ledger_reference_idx" ON "customer_deposit_ledger" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_deposit_ledger_idempotency_uq" ON "customer_deposit_ledger" USING btree ("organization_id","idempotency_key") WHERE "customer_deposit_ledger"."idempotency_key" is not null;--> statement-breakpoint
