CREATE TYPE "public"."pos_checkout_attempt_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "pos_checkout_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"request_fingerprint" varchar(64) NOT NULL,
	"status" "pos_checkout_attempt_status" DEFAULT 'processing' NOT NULL,
	"sale_id" uuid,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"last_error_code" varchar(80),
	"last_error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_checkout_attempts_attempt_count_positive_ck" CHECK ("pos_checkout_attempts"."attempt_count" > 0),
	CONSTRAINT "pos_checkout_attempts_completed_state_ck" CHECK ("pos_checkout_attempts"."status" <> 'completed' or ("pos_checkout_attempts"."sale_id" is not null and "pos_checkout_attempts"."completed_at" is not null)),
	CONSTRAINT "pos_checkout_attempts_failed_state_ck" CHECK ("pos_checkout_attempts"."status" <> 'failed' or "pos_checkout_attempts"."failed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "checkout_fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_checkout_attempts_idempotency_uq" ON "pos_checkout_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "pos_checkout_attempts_org_cashier_idx" ON "pos_checkout_attempts" USING btree ("organization_id","cashier_id","created_at");--> statement-breakpoint
CREATE INDEX "pos_checkout_attempts_sale_idx" ON "pos_checkout_attempts" USING btree ("sale_id");