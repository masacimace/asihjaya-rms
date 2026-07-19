CREATE TYPE "public"."pos_held_cart_status" AS ENUM('active', 'resumed', 'canceled');--> statement-breakpoint
CREATE TABLE "pos_held_cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"held_cart_id" uuid NOT NULL,
	"product_item_id" uuid NOT NULL,
	"line_number" bigint NOT NULL,
	"list_price_amount" numeric(18, 0) NOT NULL,
	"discount_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"final_price_amount" numeric(18, 0) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_held_cart_items_list_price_nonnegative_ck" CHECK ("pos_held_cart_items"."list_price_amount" >= 0),
	CONSTRAINT "pos_held_cart_items_discount_nonnegative_ck" CHECK ("pos_held_cart_items"."discount_amount" >= 0),
	CONSTRAINT "pos_held_cart_items_final_price_nonnegative_ck" CHECK ("pos_held_cart_items"."final_price_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pos_held_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"customer_id" uuid,
	"held_by_user_id" uuid NOT NULL,
	"hold_number" varchar(80) NOT NULL,
	"title" varchar(160),
	"note" text,
	"status" "pos_held_cart_status" DEFAULT 'active' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"subtotal_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"resumed_at" timestamp with time zone,
	"resumed_by_user_id" uuid,
	"canceled_at" timestamp with time zone,
	"canceled_by_user_id" uuid,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_held_carts_item_count_nonnegative_ck" CHECK ("pos_held_carts"."item_count" >= 0),
	CONSTRAINT "pos_held_carts_subtotal_nonnegative_ck" CHECK ("pos_held_carts"."subtotal_amount" >= 0),
	CONSTRAINT "pos_held_carts_discount_nonnegative_ck" CHECK ("pos_held_carts"."discount_amount" >= 0),
	CONSTRAINT "pos_held_carts_total_nonnegative_ck" CHECK ("pos_held_carts"."total_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pos_held_cart_items" ADD CONSTRAINT "pos_held_cart_items_held_cart_id_pos_held_carts_id_fk" FOREIGN KEY ("held_cart_id") REFERENCES "public"."pos_held_carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_held_cart_items" ADD CONSTRAINT "pos_held_cart_items_product_item_id_product_items_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."product_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_held_by_user_id_users_id_fk" FOREIGN KEY ("held_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_resumed_by_user_id_users_id_fk" FOREIGN KEY ("resumed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_canceled_by_user_id_users_id_fk" FOREIGN KEY ("canceled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_held_cart_items_cart_item_uq" ON "pos_held_cart_items" USING btree ("held_cart_id","product_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_held_cart_items_cart_line_uq" ON "pos_held_cart_items" USING btree ("held_cart_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_held_cart_items_active_item_uq" ON "pos_held_cart_items" USING btree ("product_item_id") WHERE "pos_held_cart_items"."is_active" = true;--> statement-breakpoint
CREATE INDEX "pos_held_cart_items_cart_active_idx" ON "pos_held_cart_items" USING btree ("held_cart_id","is_active");--> statement-breakpoint
CREATE INDEX "pos_held_cart_items_product_idx" ON "pos_held_cart_items" USING btree ("product_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_held_carts_org_hold_number_uq" ON "pos_held_carts" USING btree ("organization_id","hold_number");--> statement-breakpoint
CREATE INDEX "pos_held_carts_outlet_status_created_idx" ON "pos_held_carts" USING btree ("outlet_id","status","created_at");--> statement-breakpoint
CREATE INDEX "pos_held_carts_register_status_idx" ON "pos_held_carts" USING btree ("register_id","status");--> statement-breakpoint
CREATE INDEX "pos_held_carts_shift_status_idx" ON "pos_held_carts" USING btree ("shift_id","status");--> statement-breakpoint
CREATE INDEX "pos_held_carts_customer_idx" ON "pos_held_carts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "pos_held_carts_held_by_idx" ON "pos_held_carts" USING btree ("held_by_user_id");