ALTER TYPE "public"."inventory_movement_type" ADD VALUE IF NOT EXISTS 'buyback';

CREATE TYPE "public"."buyback_status" AS ENUM ('completed', 'cancelled');
CREATE TYPE "public"."buyback_item_source" AS ENUM ('asihjaya', 'external');
CREATE TYPE "public"."buyback_payout_method" AS ENUM ('cash', 'bank_transfer', 'customer_deposit');

CREATE TABLE "buybacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "register_id" uuid NOT NULL,
  "shift_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "processed_by" uuid NOT NULL,
  "buyback_number" varchar(80) NOT NULL,
  "idempotency_key" varchar(120) NOT NULL,
  "status" "buyback_status" DEFAULT 'completed' NOT NULL,
  "total_amount" numeric(18, 0) NOT NULL,
  "notes" text,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "buybacks_total_positive_ck" CHECK ("total_amount" > 0),
  CONSTRAINT "buybacks_completed_timestamp_ck" CHECK ("status" <> 'completed' OR "completed_at" IS NOT NULL),
  CONSTRAINT "buybacks_cancelled_timestamp_ck" CHECK ("status" <> 'cancelled' OR "cancelled_at" IS NOT NULL)
);

ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "buybacks_org_number_uq" ON "buybacks" USING btree ("organization_id", "buyback_number");
CREATE UNIQUE INDEX "buybacks_org_idempotency_uq" ON "buybacks" USING btree ("organization_id", "idempotency_key");
CREATE INDEX "buybacks_outlet_created_idx" ON "buybacks" USING btree ("outlet_id", "created_at");
CREATE INDEX "buybacks_customer_created_idx" ON "buybacks" USING btree ("customer_id", "created_at");
CREATE INDEX "buybacks_shift_idx" ON "buybacks" USING btree ("shift_id");

CREATE TABLE "buyback_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "buyback_id" uuid NOT NULL,
  "product_item_id" uuid NOT NULL,
  "source" "buyback_item_source" NOT NULL,
  "line_number" integer NOT NULL,
  "weight_gram" numeric(12, 3) NOT NULL,
  "purity_percent" numeric(7, 3) NOT NULL,
  "exchange_purity_percent" numeric(7, 3) NOT NULL,
  "buyback_price_per_gram" numeric(18, 0) NOT NULL,
  "deduction_per_gram" numeric(18, 0) DEFAULT '0' NOT NULL,
  "base_amount" numeric(18, 0) NOT NULL,
  "deduction_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
  "final_amount" numeric(18, 0) NOT NULL,
  "snapshot" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "buyback_items_line_positive_ck" CHECK ("line_number" > 0),
  CONSTRAINT "buyback_items_weight_positive_ck" CHECK ("weight_gram" > 0),
  CONSTRAINT "buyback_items_purity_range_ck" CHECK ("purity_percent" > 0 AND "purity_percent" <= 100),
  CONSTRAINT "buyback_items_exchange_purity_range_ck" CHECK ("exchange_purity_percent" > 0 AND "exchange_purity_percent" <= 999.999),
  CONSTRAINT "buyback_items_price_positive_ck" CHECK ("buyback_price_per_gram" > 0),
  CONSTRAINT "buyback_items_deduction_nonnegative_ck" CHECK ("deduction_per_gram" >= 0 AND "deduction_amount" >= 0),
  CONSTRAINT "buyback_items_amount_formula_ck" CHECK ("final_amount" = "base_amount" - "deduction_amount"),
  CONSTRAINT "buyback_items_final_positive_ck" CHECK ("final_amount" > 0 AND "deduction_amount" < "base_amount")
);

ALTER TABLE "buyback_items" ADD CONSTRAINT "buyback_items_buyback_id_buybacks_id_fk" FOREIGN KEY ("buyback_id") REFERENCES "public"."buybacks"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "buyback_items" ADD CONSTRAINT "buyback_items_product_item_id_product_items_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."product_items"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "buyback_items_buyback_line_uq" ON "buyback_items" USING btree ("buyback_id", "line_number");
CREATE UNIQUE INDEX "buyback_items_buyback_product_uq" ON "buyback_items" USING btree ("buyback_id", "product_item_id");
CREATE INDEX "buyback_items_product_idx" ON "buyback_items" USING btree ("product_item_id");

CREATE TABLE "buyback_payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "buyback_id" uuid NOT NULL,
  "method" "buyback_payout_method" NOT NULL,
  "amount" numeric(18, 0) NOT NULL,
  "reference" varchar(160),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "buyback_payouts_amount_positive_ck" CHECK ("amount" > 0)
);

ALTER TABLE "buyback_payouts" ADD CONSTRAINT "buyback_payouts_buyback_id_buybacks_id_fk" FOREIGN KEY ("buyback_id") REFERENCES "public"."buybacks"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "buyback_payouts" ADD CONSTRAINT "buyback_payouts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "buyback_payouts_buyback_method_uq" ON "buyback_payouts" USING btree ("buyback_id", "method");
CREATE INDEX "buyback_payouts_buyback_idx" ON "buyback_payouts" USING btree ("buyback_id");

INSERT INTO "permissions" ("code", "name", "module")
VALUES
  ('buybacks.view', 'Melihat transaksi Buyback', 'buybacks'),
  ('buybacks.create', 'Membuat transaksi Buyback', 'buybacks')
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "module" = EXCLUDED."module", "updated_at" = now();

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" IN ('buybacks.view', 'buybacks.create')
WHERE r."code" IN ('system_admin', 'owner', 'manager', 'cashier')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" = 'buybacks.view'
WHERE r."code" = 'finance'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
