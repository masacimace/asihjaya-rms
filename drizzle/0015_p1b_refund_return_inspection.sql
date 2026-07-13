CREATE TYPE "public"."return_inspection_decision" AS ENUM('restock', 'repair', 'damaged', 'reject');--> statement-breakpoint
CREATE TYPE "public"."sale_return_case_status" AS ENUM('awaiting_receipt', 'pending_inspection', 'partially_inspected', 'completed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sale_return_item_status" AS ENUM('awaiting_receipt', 'pending_inspection', 'restocked', 'repair', 'damaged', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."item_availability" ADD VALUE 'inspection' BEFORE 'sold';--> statement-breakpoint
CREATE TABLE "sale_return_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"approval_id" uuid,
	"status" "sale_return_case_status" DEFAULT 'awaiting_receipt' NOT NULL,
	"expected_item_count" integer NOT NULL,
	"received_item_count" integer DEFAULT 0 NOT NULL,
	"inspected_item_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_return_cases_counts_ck" CHECK ("sale_return_cases"."expected_item_count" > 0
        and "sale_return_cases"."received_item_count" >= 0
        and "sale_return_cases"."inspected_item_count" >= 0
        and "sale_return_cases"."received_item_count" <= "sale_return_cases"."expected_item_count"
        and "sale_return_cases"."inspected_item_count" <= "sale_return_cases"."received_item_count"),
	CONSTRAINT "sale_return_cases_completed_state_ck" CHECK ("sale_return_cases"."status" not in ('completed', 'rejected') or "sale_return_cases"."completed_at" is not null),
	CONSTRAINT "sale_return_cases_cancelled_state_ck" CHECK ("sale_return_cases"."status" <> 'cancelled' or "sale_return_cases"."cancelled_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "sale_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"return_case_id" uuid NOT NULL,
	"sale_item_id" uuid NOT NULL,
	"product_item_id" uuid NOT NULL,
	"status" "sale_return_item_status" DEFAULT 'awaiting_receipt' NOT NULL,
	"expected_sku" varchar(80) NOT NULL,
	"expected_barcode" varchar(120) NOT NULL,
	"expected_serial_number" varchar(120),
	"expected_weight_gram" numeric(12, 3),
	"received_code" varchar(160),
	"actual_weight_gram" numeric(12, 3),
	"identity_confirmed" boolean,
	"certificate_complete" boolean,
	"packaging_complete" boolean,
	"condition_good" boolean,
	"decision" "return_inspection_decision",
	"inspection_notes" text,
	"photo_key" text,
	"received_by" uuid,
	"received_at" timestamp with time zone,
	"inspected_by" uuid,
	"inspected_at" timestamp with time zone,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_return_items_weight_positive_ck" CHECK ("sale_return_items"."actual_weight_gram" is null or "sale_return_items"."actual_weight_gram" > 0),
	CONSTRAINT "sale_return_items_received_state_ck" CHECK ("sale_return_items"."status" = 'awaiting_receipt' or ("sale_return_items"."received_by" is not null and "sale_return_items"."received_at" is not null)),
	CONSTRAINT "sale_return_items_inspected_state_ck" CHECK ("sale_return_items"."status" in ('awaiting_receipt', 'pending_inspection') or (
        "sale_return_items"."inspected_by" is not null
        and "sale_return_items"."inspected_at" is not null
        and "sale_return_items"."decided_by" is not null
        and "sale_return_items"."decided_at" is not null
        and "sale_return_items"."decision" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "sale_return_cases" ADD CONSTRAINT "sale_return_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_cases" ADD CONSTRAINT "sale_return_cases_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_cases" ADD CONSTRAINT "sale_return_cases_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_cases" ADD CONSTRAINT "sale_return_cases_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_cases" ADD CONSTRAINT "sale_return_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_return_case_id_sale_return_cases_id_fk" FOREIGN KEY ("return_case_id") REFERENCES "public"."sale_return_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_product_item_id_product_items_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."product_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_inspected_by_users_id_fk" FOREIGN KEY ("inspected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_return_cases_sale_uq" ON "sale_return_cases" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_return_cases_approval_uq" ON "sale_return_cases" USING btree ("approval_id") WHERE "sale_return_cases"."approval_id" is not null;--> statement-breakpoint
CREATE INDEX "sale_return_cases_outlet_status_idx" ON "sale_return_cases" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_return_items_case_sale_item_uq" ON "sale_return_items" USING btree ("return_case_id","sale_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_return_items_case_product_item_uq" ON "sale_return_items" USING btree ("return_case_id","product_item_id");--> statement-breakpoint
CREATE INDEX "sale_return_items_case_status_idx" ON "sale_return_items" USING btree ("return_case_id","status");--> statement-breakpoint
CREATE INDEX "sale_return_items_product_status_idx" ON "sale_return_items" USING btree ("product_item_id","status");--> statement-breakpoint
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
  (gen_random_uuid(), 'returns.view', 'Melihat workflow retur dan pemeriksaan barang', 'inventory', NULL, now(), now()),
  (gen_random_uuid(), 'returns.receive', 'Menerima barang retur dari customer', 'inventory', NULL, now(), now()),
  (gen_random_uuid(), 'returns.inspect', 'Memeriksa dan menentukan status barang retur', 'inventory', NULL, now(), now())
ON CONFLICT ("code") DO UPDATE
SET
  "name" = excluded."name",
  "module" = excluded."module",
  "updated_at" = now();
--> statement-breakpoint
WITH default_role_permissions(role_code, permission_code) AS (
  VALUES
    ('system_admin', 'returns.view'),
    ('system_admin', 'returns.receive'),
    ('system_admin', 'returns.inspect'),
    ('owner', 'returns.view'),
    ('owner', 'returns.receive'),
    ('owner', 'returns.inspect'),
    ('manager', 'returns.view'),
    ('manager', 'returns.receive'),
    ('manager', 'returns.inspect'),
    ('cashier', 'returns.view'),
    ('cashier', 'returns.receive'),
    ('stock_admin', 'returns.view'),
    ('stock_admin', 'returns.receive'),
    ('stock_admin', 'returns.inspect'),
    ('finance', 'returns.view')
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
FROM default_role_permissions mapping
INNER JOIN "roles" role
  ON role."code" = mapping.role_code
  AND role."is_active" = true
INNER JOIN "permissions" permission
  ON permission."code" = mapping.permission_code
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "sale_return_cases" (
  "id",
  "organization_id",
  "outlet_id",
  "sale_id",
  "approval_id",
  "status",
  "expected_item_count",
  "received_item_count",
  "inspected_item_count",
  "notes",
  "created_by",
  "completed_at",
  "metadata",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  sale."organization_id",
  sale."outlet_id",
  sale."id",
  NULL,
  'completed'::"sale_return_case_status",
  item_count."total_items"::integer,
  item_count."total_items"::integer,
  item_count."total_items"::integer,
  'Backfill refund sebelum P1-B; inventory sudah diproses oleh alur legacy.',
  sale."cashier_id",
  COALESCE(sale."cancelled_at", sale."updated_at", now()),
  jsonb_build_object(
    'legacyBackfill', true,
    'source', 'migration.p1b',
    'previousWorkflow', 'refund_direct_restock'
  ),
  COALESCE(sale."cancelled_at", sale."updated_at", now()),
  now()
FROM "sales" sale
INNER JOIN LATERAL (
  SELECT count(*) AS total_items
  FROM "sale_items" sale_item
  WHERE sale_item."sale_id" = sale."id"
) item_count ON item_count."total_items" > 0
WHERE sale."status" = 'refunded'
ON CONFLICT ("sale_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "sale_return_items" (
  "id",
  "organization_id",
  "outlet_id",
  "return_case_id",
  "sale_item_id",
  "product_item_id",
  "status",
  "expected_sku",
  "expected_barcode",
  "expected_serial_number",
  "expected_weight_gram",
  "received_code",
  "actual_weight_gram",
  "identity_confirmed",
  "certificate_complete",
  "packaging_complete",
  "condition_good",
  "decision",
  "inspection_notes",
  "received_by",
  "received_at",
  "inspected_by",
  "inspected_at",
  "decided_by",
  "decided_at",
  "metadata",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  return_case."organization_id",
  return_case."outlet_id",
  return_case."id",
  sale_item."id",
  sale_item."product_item_id",
  'restocked'::"sale_return_item_status",
  product_item."sku",
  product_item."barcode",
  product_item."serial_number",
  product_item."weight_gram",
  product_item."barcode",
  product_item."weight_gram",
  true,
  true,
  true,
  true,
  'restock'::"return_inspection_decision",
  'Backfill refund sebelum P1-B; dianggap selesai mengikuti state inventory legacy.',
  return_case."created_by",
  return_case."completed_at",
  return_case."created_by",
  return_case."completed_at",
  return_case."created_by",
  return_case."completed_at",
  jsonb_build_object(
    'legacyBackfill', true,
    'source', 'migration.p1b'
  ),
  return_case."completed_at",
  now()
FROM "sale_return_cases" return_case
INNER JOIN "sale_items" sale_item
  ON sale_item."sale_id" = return_case."sale_id"
INNER JOIN "product_items" product_item
  ON product_item."id" = sale_item."product_item_id"
WHERE return_case."metadata"->>'legacyBackfill' = 'true'
ON CONFLICT ("return_case_id", "sale_item_id") DO NOTHING;
