CREATE TYPE "public"."cash_movement_type" AS ENUM('opening_balance', 'cash_sale', 'cash_refund', 'cash_in', 'cash_out', 'closing_adjustment');--> statement-breakpoint
CREATE TYPE "public"."item_availability" AS ENUM('draft', 'available', 'reserved', 'sold');--> statement-breakpoint
CREATE TYPE "public"."item_condition" AS ENUM('good', 'damaged', 'lost', 'returned');--> statement-breakpoint
CREATE TYPE "public"."item_location_state" AS ENUM('outlet', 'warehouse', 'in_transit', 'customer', 'repair');--> statement-breakpoint
CREATE TYPE "public"."master_status" AS ENUM('draft', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('goods_receipt', 'sale', 'sale_return', 'transfer_out', 'transfer_in', 'reservation', 'reservation_release', 'adjustment', 'damaged', 'lost', 'repair_out', 'repair_in', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'debit_card', 'credit_card', 'bank_transfer', 'qris_manual', 'qris_gateway', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'expired', 'cancelled', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('draft', 'awaiting_payment', 'completed', 'cancelled', 'voided', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('open', 'closing', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE SEQUENCE "public"."product_item_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid,
	"actor_user_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(120) NOT NULL,
	"entity_id" varchar(160),
	"before_data" jsonb,
	"after_data" jsonb,
	"reason" text,
	"request_id" varchar(120),
	"ip_address" varchar(64),
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"type" "cash_movement_type" NOT NULL,
	"amount" numeric(18, 0) NOT NULL,
	"reference_type" varchar(80),
	"reference_id" uuid,
	"reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_code" varchar(64),
	"full_name" varchar(180) NOT NULL,
	"phone" varchar(32),
	"email" varchar(254),
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"movement_type" "inventory_movement_type" NOT NULL,
	"from_outlet_id" uuid,
	"to_outlet_id" uuid,
	"reference_type" varchar(80),
	"reference_id" uuid,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"performed_by" uuid NOT NULL,
	"approved_by" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metal_price_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metal_purity_id" uuid NOT NULL,
	"rate_per_gram" numeric(18, 0) NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metal_price_rates_positive_ck" CHECK ("metal_price_rates"."rate_per_gram" > 0),
	CONSTRAINT "metal_price_rates_range_ck" CHECK ("metal_price_rates"."effective_until" is null or "metal_price_rates"."effective_until" > "metal_price_rates"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "metal_purities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metal_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"display_name" varchar(80) NOT NULL,
	"purity_percentage" numeric(7, 4) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metal_purities_percentage_ck" CHECK ("metal_purities"."purity_percentage" > 0 and "metal_purities"."purity_percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "metals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(80) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(24) NOT NULL,
	"name" varchar(160) NOT NULL,
	"address" text,
	"phone" varchar(32),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider" varchar(80) DEFAULT 'manual' NOT NULL,
	"amount" numeric(18, 0) NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider_reference" varchar(160),
	"external_order_id" varchar(160),
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"module" varchar(80) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_category_id" uuid,
	"code" varchar(48) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"attribute_schema" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_categories_no_self_parent_ck" CHECK ("product_categories"."parent_category_id" is null or "product_categories"."parent_category_id" <> "product_categories"."id")
);
--> statement-breakpoint
CREATE TABLE "product_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_master_id" uuid NOT NULL,
	"current_outlet_id" uuid,
	"sku" varchar(80) NOT NULL,
	"barcode" varchar(120) NOT NULL,
	"qr_value" varchar(220),
	"serial_number" varchar(120),
	"legacy_id" varchar(120),
	"legacy_url" text,
	"weight_gram" numeric(12, 3),
	"purity_percent" numeric(7, 3),
	"exchange_purity_percent" numeric(7, 3),
	"size" varchar(64),
	"color" varchar(64),
	"gemstone" varchar(160),
	"cost_amount" numeric(18, 0),
	"selling_amount" numeric(18, 0),
	"price_per_gram" numeric(18, 0),
	"deduction_per_gram" numeric(18, 0),
	"availability" "item_availability" DEFAULT 'draft' NOT NULL,
	"condition" "item_condition" DEFAULT 'good' NOT NULL,
	"location_state" "item_location_state" DEFAULT 'outlet' NOT NULL,
	"location_code" varchar(80),
	"image_key" text,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"internal_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_items_weight_positive_ck" CHECK ("product_items"."weight_gram" is null or "product_items"."weight_gram" > 0),
	CONSTRAINT "product_items_cost_nonnegative_ck" CHECK ("product_items"."cost_amount" is null or "product_items"."cost_amount" >= 0),
	CONSTRAINT "product_items_selling_positive_ck" CHECK ("product_items"."selling_amount" is null or "product_items"."selling_amount" > 0),
	CONSTRAINT "product_items_price_per_gram_nonnegative_ck" CHECK ("product_items"."price_per_gram" is null or "product_items"."price_per_gram" >= 0),
	CONSTRAINT "product_items_deduction_nonnegative_ck" CHECK ("product_items"."deduction_per_gram" is null or "product_items"."deduction_per_gram" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_masters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(200) NOT NULL,
	"brand" varchar(120),
	"material" varchar(80),
	"collection" varchar(120),
	"description" text,
	"image_key" text,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"status" "master_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_hardware_hub" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"constraints" jsonb
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_item_id" uuid NOT NULL,
	"line_number" bigint NOT NULL,
	"list_price_amount" numeric(18, 0) NOT NULL,
	"discount_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"final_price_amount" numeric(18, 0) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"customer_id" uuid,
	"cashier_id" uuid NOT NULL,
	"invoice_number" varchar(80) NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"status" "sale_status" DEFAULT 'draft' NOT NULL,
	"subtotal_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"additional_fee_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"closed_by" uuid,
	"status" "shift_status" DEFAULT 'open' NOT NULL,
	"opening_cash" numeric(18, 0) DEFAULT '0' NOT NULL,
	"expected_cash" numeric(18, 0),
	"actual_cash" numeric(18, 0),
	"cash_variance" numeric(18, 0),
	"variance_reason" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(254) NOT NULL,
	"username" varchar(80) NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"phone" varchar(32),
	"password_hash" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_product_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."product_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_from_outlet_id_outlets_id_fk" FOREIGN KEY ("from_outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_to_outlet_id_outlets_id_fk" FOREIGN KEY ("to_outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metal_price_rates" ADD CONSTRAINT "metal_price_rates_metal_purity_id_metal_purities_id_fk" FOREIGN KEY ("metal_purity_id") REFERENCES "public"."metal_purities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metal_price_rates" ADD CONSTRAINT "metal_price_rates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metal_purities" ADD CONSTRAINT "metal_purities_metal_id_metals_id_fk" FOREIGN KEY ("metal_id") REFERENCES "public"."metals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metals" ADD CONSTRAINT "metals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_category_id_product_categories_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_product_master_id_product_masters_id_fk" FOREIGN KEY ("product_master_id") REFERENCES "public"."product_masters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_items" ADD CONSTRAINT "product_items_current_outlet_id_outlets_id_fk" FOREIGN KEY ("current_outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_masters" ADD CONSTRAINT "product_masters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_masters" ADD CONSTRAINT "product_masters_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registers" ADD CONSTRAINT "registers_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_item_id_product_items_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."product_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_outlets" ADD CONSTRAINT "user_outlets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_outlets" ADD CONSTRAINT "user_outlets_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_org_time_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "cash_movements_shift_time_idx" ON "cash_movements" USING btree ("shift_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_org_code_uq" ON "customers" USING btree ("organization_id","customer_code");--> statement-breakpoint
CREATE INDEX "customers_org_phone_idx" ON "customers" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE INDEX "inventory_movements_item_time_idx" ON "inventory_movements" USING btree ("item_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_reference_idx" ON "inventory_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metal_price_rates_purity_effective_uq" ON "metal_price_rates" USING btree ("metal_purity_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "metal_purities_metal_code_uq" ON "metal_purities" USING btree ("metal_id","code");--> statement-breakpoint
CREATE INDEX "metal_purities_metal_active_idx" ON "metal_purities" USING btree ("metal_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "metals_org_code_uq" ON "metals" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "metals_org_active_idx" ON "metals" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uq" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_org_code_uq" ON "outlets" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "outlets_org_idx" ON "outlets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_sale_status_idx" ON "payments" USING btree ("sale_id","status");--> statement-breakpoint
CREATE INDEX "payments_provider_reference_idx" ON "payments" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_code_uq" ON "permissions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_org_code_uq" ON "product_categories" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "product_categories_org_parent_idx" ON "product_categories" USING btree ("organization_id","parent_category_id");--> statement-breakpoint
CREATE INDEX "product_categories_org_active_order_idx" ON "product_categories" USING btree ("organization_id","is_active","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_items_org_sku_uq" ON "product_items" USING btree ("organization_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "product_items_org_barcode_uq" ON "product_items" USING btree ("organization_id","barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "product_items_org_serial_uq" ON "product_items" USING btree ("organization_id","serial_number");--> statement-breakpoint
CREATE INDEX "product_items_master_idx" ON "product_items" USING btree ("product_master_id");--> statement-breakpoint
CREATE INDEX "product_items_outlet_availability_idx" ON "product_items" USING btree ("current_outlet_id","availability");--> statement-breakpoint
CREATE UNIQUE INDEX "product_masters_org_code_uq" ON "product_masters" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "product_masters_category_idx" ON "product_masters" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_masters_org_status_idx" ON "product_masters" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "registers_outlet_code_uq" ON "registers" USING btree ("outlet_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "registers_one_hardware_hub_per_outlet_uq" ON "registers" USING btree ("outlet_id") WHERE "registers"."is_hardware_hub" = true;--> statement-breakpoint
CREATE INDEX "registers_outlet_idx" ON "registers" USING btree ("outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_permission_uq" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_org_code_uq" ON "roles" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_items_sale_item_uq" ON "sale_items" USING btree ("sale_id","product_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_items_sale_line_uq" ON "sale_items" USING btree ("sale_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_org_invoice_uq" ON "sales" USING btree ("organization_id","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_idempotency_uq" ON "sales" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "sales_outlet_created_idx" ON "sales" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_shift_idx" ON "sales" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shifts_register_status_idx" ON "shifts" USING btree ("register_id","status");--> statement-breakpoint
CREATE INDEX "shifts_outlet_opened_idx" ON "shifts" USING btree ("outlet_id","opened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_outlets_user_outlet_uq" ON "user_outlets" USING btree ("user_id","outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_role_uq" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_hash_uq" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_expires_idx" ON "user_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_org_email_uq" ON "users" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_org_username_uq" ON "users" USING btree ("organization_id","username");--> statement-breakpoint
CREATE INDEX "users_org_status_idx" ON "users" USING btree ("organization_id","status");