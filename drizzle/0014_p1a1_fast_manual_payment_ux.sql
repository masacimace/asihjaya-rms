CREATE TABLE "manual_payment_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"register_id" uuid,
	"profile_type" varchar(24) NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"provider" varchar(80) NOT NULL,
	"verification_source" varchar(40) NOT NULL,
	"merchant_id" varchar(80),
	"terminal_id" varchar(80),
	"destination_account" varchar(120),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_payment_profiles_type_ck" CHECK ("manual_payment_profiles"."profile_type" in ('qris', 'edc', 'bank_account')),
	CONSTRAINT "manual_payment_profiles_source_ck" CHECK ("manual_payment_profiles"."verification_source" in ('merchant_app', 'edc_terminal', 'bank_app', 'bank_statement')),
	CONSTRAINT "manual_payment_profiles_fields_ck" CHECK ((
        ("manual_payment_profiles"."profile_type" = 'qris'
          and "manual_payment_profiles"."verification_source" in ('merchant_app', 'bank_app')
          and "manual_payment_profiles"."merchant_id" is not null
          and btrim("manual_payment_profiles"."merchant_id") <> '')
        or
        ("manual_payment_profiles"."profile_type" = 'edc'
          and "manual_payment_profiles"."verification_source" = 'edc_terminal'
          and "manual_payment_profiles"."terminal_id" is not null
          and btrim("manual_payment_profiles"."terminal_id") <> '')
        or
        ("manual_payment_profiles"."profile_type" = 'bank_account'
          and "manual_payment_profiles"."verification_source" in ('bank_app', 'bank_statement')
          and "manual_payment_profiles"."destination_account" is not null
          and btrim("manual_payment_profiles"."destination_account") <> '')
      )),
	CONSTRAINT "manual_payment_profiles_display_order_ck" CHECK ("manual_payment_profiles"."display_order" between 0 and 9999)
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "manual_payment_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "manual_payment_profiles" ADD CONSTRAINT "manual_payment_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_profiles" ADD CONSTRAINT "manual_payment_profiles_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_profiles" ADD CONSTRAINT "manual_payment_profiles_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_payment_profiles_org_outlet_code_uq" ON "manual_payment_profiles" USING btree ("organization_id","outlet_id","code");--> statement-breakpoint
CREATE INDEX "manual_payment_profiles_outlet_type_idx" ON "manual_payment_profiles" USING btree ("outlet_id","profile_type","is_active","display_order");--> statement-breakpoint
CREATE INDEX "manual_payment_profiles_register_idx" ON "manual_payment_profiles" USING btree ("register_id","is_active");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_manual_payment_profile_id_manual_payment_profiles_id_fk" FOREIGN KEY ("manual_payment_profile_id") REFERENCES "public"."manual_payment_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_manual_profile_idx" ON "payments" USING btree ("manual_payment_profile_id","created_at");
--> statement-breakpoint
-- Raise only untouched P1-A defaults. Customized policies remain unchanged.
UPDATE "manual_payment_policies"
SET
  "evidence_threshold" = 7500000,
  "co_verification_threshold" = 9000000,
  "updated_at" = now()
WHERE "method" = 'qris_manual'
  AND "evidence_threshold" = 5000000
  AND "co_verification_threshold" = 5000000;
--> statement-breakpoint
UPDATE "manual_payment_policies"
SET
  "evidence_threshold" = 20000000,
  "co_verification_threshold" = 30000000,
  "updated_at" = now()
WHERE "method" IN ('debit_card', 'credit_card')
  AND "evidence_threshold" = 10000000
  AND "co_verification_threshold" = 10000000;
--> statement-breakpoint
UPDATE "manual_payment_policies"
SET
  "evidence_threshold" = 25000000,
  "co_verification_threshold" = 40000000,
  "updated_at" = now()
WHERE "method" = 'bank_transfer'
  AND "evidence_threshold" = 10000000
  AND "co_verification_threshold" = 10000000;
