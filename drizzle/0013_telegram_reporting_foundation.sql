CREATE TYPE "public"."telegram_destination_type" AS ENUM('private_group');--> statement-breakpoint
CREATE TYPE "public"."telegram_report_type" AS ENUM('opening', 'closing_daily', 'weekly', 'monthly', 'test');--> statement-breakpoint
CREATE TYPE "public"."telegram_delivery_status" AS ENUM('pending', 'processing', 'retry', 'sent', 'failed', 'cancelled');--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "business_date" date;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "cost_amount_snapshot" numeric(18, 0);--> statement-breakpoint
CREATE TABLE "finance_closing_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shift_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "business_date" date NOT NULL,
  "gross_sales" numeric(18, 0) DEFAULT '0' NOT NULL,
  "discount_total" numeric(18, 0) DEFAULT '0' NOT NULL,
  "net_sales" numeric(18, 0) DEFAULT '0' NOT NULL,
  "cost_snapshot_complete" boolean DEFAULT false NOT NULL,
  "cost_of_goods" numeric(18, 0),
  "gross_margin" numeric(18, 0),
  "gross_margin_rate" numeric(9, 4),
  "cash_total" numeric(18, 0) DEFAULT '0' NOT NULL,
  "bank_transfer_total" numeric(18, 0) DEFAULT '0' NOT NULL,
  "debit_card_total" numeric(18, 0) DEFAULT '0' NOT NULL,
  "credit_card_total" numeric(18, 0) DEFAULT '0' NOT NULL,
  "customer_deposit_opening_balance" numeric(18, 0) DEFAULT '0' NOT NULL,
  "customer_deposit_in" numeric(18, 0) DEFAULT '0' NOT NULL,
  "customer_deposit_used" numeric(18, 0) DEFAULT '0' NOT NULL,
  "customer_deposit_withdrawal" numeric(18, 0) DEFAULT '0' NOT NULL,
  "customer_deposit_adjustment_in" numeric(18, 0) DEFAULT '0' NOT NULL,
  "customer_deposit_adjustment_out" numeric(18, 0) DEFAULT '0' NOT NULL,
  "customer_deposit_closing_balance" numeric(18, 0) DEFAULT '0' NOT NULL,
  "expected_cash" numeric(18, 0) NOT NULL,
  "actual_cash" numeric(18, 0) NOT NULL,
  "cash_variance" numeric(18, 0) NOT NULL,
  "transaction_count" integer DEFAULT 0 NOT NULL,
  "items_sold_count" integer DEFAULT 0 NOT NULL,
  "held_transaction_count" integer DEFAULT 0 NOT NULL,
  "pending_approval_count" integer DEFAULT 0 NOT NULL,
  "opened_at" timestamp with time zone NOT NULL,
  "closed_at" timestamp with time zone NOT NULL,
  "cashier_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "finance_closing_snapshots_sales_nonnegative_ck" CHECK ("finance_closing_snapshots"."gross_sales" >= 0 and "finance_closing_snapshots"."discount_total" >= 0 and "finance_closing_snapshots"."net_sales" >= 0),
  CONSTRAINT "finance_closing_snapshots_payment_nonnegative_ck" CHECK ("finance_closing_snapshots"."cash_total" >= 0
        and "finance_closing_snapshots"."bank_transfer_total" >= 0
        and "finance_closing_snapshots"."debit_card_total" >= 0
        and "finance_closing_snapshots"."credit_card_total" >= 0),
  CONSTRAINT "finance_closing_snapshots_deposit_nonnegative_ck" CHECK ("finance_closing_snapshots"."customer_deposit_opening_balance" >= 0
        and "finance_closing_snapshots"."customer_deposit_in" >= 0
        and "finance_closing_snapshots"."customer_deposit_used" >= 0
        and "finance_closing_snapshots"."customer_deposit_withdrawal" >= 0
        and "finance_closing_snapshots"."customer_deposit_adjustment_in" >= 0
        and "finance_closing_snapshots"."customer_deposit_adjustment_out" >= 0
        and "finance_closing_snapshots"."customer_deposit_closing_balance" >= 0),
  CONSTRAINT "finance_closing_snapshots_cost_state_ck" CHECK ((
        "finance_closing_snapshots"."cost_snapshot_complete" = false
        and "finance_closing_snapshots"."cost_of_goods" is null
        and "finance_closing_snapshots"."gross_margin" is null
        and "finance_closing_snapshots"."gross_margin_rate" is null
      ) or (
        "finance_closing_snapshots"."cost_snapshot_complete" = true
        and "finance_closing_snapshots"."cost_of_goods" is not null
        and "finance_closing_snapshots"."cost_of_goods" >= 0
        and "finance_closing_snapshots"."gross_margin" is not null
        and "finance_closing_snapshots"."gross_margin_rate" is not null
      )),
  CONSTRAINT "finance_closing_snapshots_counts_nonnegative_ck" CHECK ("finance_closing_snapshots"."transaction_count" >= 0
        and "finance_closing_snapshots"."items_sold_count" >= 0
        and "finance_closing_snapshots"."held_transaction_count" >= 0
        and "finance_closing_snapshots"."pending_approval_count" >= 0),
  CONSTRAINT "finance_closing_snapshots_actual_cash_nonnegative_ck" CHECK ("finance_closing_snapshots"."actual_cash" >= 0),
  CONSTRAINT "finance_closing_snapshots_time_order_ck" CHECK ("finance_closing_snapshots"."closed_at" >= "finance_closing_snapshots"."opened_at")
);--> statement-breakpoint
CREATE TABLE "telegram_destinations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "chat_id" varchar(32) NOT NULL,
  "destination_type" "telegram_destination_type" DEFAULT 'private_group' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "telegram_destinations_name_not_blank_ck" CHECK (length(btrim("telegram_destinations"."name")) > 0 and "telegram_destinations"."name" = btrim("telegram_destinations"."name")),
  CONSTRAINT "telegram_destinations_chat_id_not_blank_ck" CHECK (length(btrim("telegram_destinations"."chat_id")) > 0 and "telegram_destinations"."chat_id" = btrim("telegram_destinations"."chat_id"))
);--> statement-breakpoint
CREATE TABLE "telegram_report_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "destination_id" uuid NOT NULL,
  "opening_enabled" boolean DEFAULT false NOT NULL,
  "closing_daily_enabled" boolean DEFAULT false NOT NULL,
  "weekly_enabled" boolean DEFAULT false NOT NULL,
  "monthly_enabled" boolean DEFAULT false NOT NULL,
  "timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "telegram_report_settings_timezone_not_blank_ck" CHECK (length(btrim("telegram_report_settings"."timezone")) > 0 and "telegram_report_settings"."timezone" = btrim("telegram_report_settings"."timezone"))
);--> statement-breakpoint
CREATE TABLE "telegram_delivery_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "event_key" varchar(200) NOT NULL,
  "destination_id" uuid NOT NULL,
  "outlet_id" uuid NOT NULL,
  "report_type" "telegram_report_type" NOT NULL,
  "business_date" date,
  "period_start" date,
  "period_end" date,
  "payload_snapshot_json" jsonb NOT NULL,
  "message_text" text NOT NULL,
  "status" "telegram_delivery_status" DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_by" varchar(120),
  "sent_at" timestamp with time zone,
  "telegram_message_id" varchar(64),
  "last_error_code" varchar(80),
  "last_error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "telegram_delivery_outbox_event_key_not_blank_ck" CHECK (length(btrim("telegram_delivery_outbox"."event_key")) > 0 and "telegram_delivery_outbox"."event_key" = btrim("telegram_delivery_outbox"."event_key")),
  CONSTRAINT "telegram_delivery_outbox_message_not_blank_ck" CHECK (length("telegram_delivery_outbox"."message_text") > 0),
  CONSTRAINT "telegram_delivery_outbox_attempts_ck" CHECK ("telegram_delivery_outbox"."attempt_count" >= 0 and "telegram_delivery_outbox"."max_attempts" > 0 and "telegram_delivery_outbox"."attempt_count" <= "telegram_delivery_outbox"."max_attempts"),
  CONSTRAINT "telegram_delivery_outbox_lock_pair_ck" CHECK (("telegram_delivery_outbox"."locked_at" is null and "telegram_delivery_outbox"."locked_by" is null)
        or ("telegram_delivery_outbox"."locked_at" is not null and "telegram_delivery_outbox"."locked_by" is not null)),
  CONSTRAINT "telegram_delivery_outbox_processing_lock_ck" CHECK ("telegram_delivery_outbox"."status" <> 'processing' or ("telegram_delivery_outbox"."locked_at" is not null and "telegram_delivery_outbox"."locked_by" is not null)),
  CONSTRAINT "telegram_delivery_outbox_sent_state_ck" CHECK ("telegram_delivery_outbox"."status" <> 'sent' or ("telegram_delivery_outbox"."sent_at" is not null and "telegram_delivery_outbox"."telegram_message_id" is not null)),
  CONSTRAINT "telegram_delivery_outbox_period_order_ck" CHECK ("telegram_delivery_outbox"."period_start" is null or "telegram_delivery_outbox"."period_end" is null or "telegram_delivery_outbox"."period_end" >= "telegram_delivery_outbox"."period_start")
);--> statement-breakpoint
CREATE TABLE "telegram_delivery_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" uuid NOT NULL,
  "attempt_number" integer NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "http_status" integer,
  "telegram_ok" boolean,
  "telegram_error_code" integer,
  "telegram_error_description" text,
  "telegram_message_id" varchar(64),
  "duration_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "telegram_delivery_attempts_number_positive_ck" CHECK ("telegram_delivery_attempts"."attempt_number" > 0),
  CONSTRAINT "telegram_delivery_attempts_http_status_ck" CHECK ("telegram_delivery_attempts"."http_status" is null or "telegram_delivery_attempts"."http_status" between 100 and 599),
  CONSTRAINT "telegram_delivery_attempts_duration_nonnegative_ck" CHECK ("telegram_delivery_attempts"."duration_ms" is null or "telegram_delivery_attempts"."duration_ms" >= 0),
  CONSTRAINT "telegram_delivery_attempts_time_order_ck" CHECK ("telegram_delivery_attempts"."completed_at" is null or "telegram_delivery_attempts"."completed_at" >= "telegram_delivery_attempts"."requested_at")
);--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD CONSTRAINT "finance_closing_snapshots_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD CONSTRAINT "finance_closing_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD CONSTRAINT "finance_closing_snapshots_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_closing_snapshots" ADD CONSTRAINT "finance_closing_snapshots_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_destinations" ADD CONSTRAINT "telegram_destinations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_destinations" ADD CONSTRAINT "telegram_destinations_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_destinations" ADD CONSTRAINT "telegram_destinations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_destinations" ADD CONSTRAINT "telegram_destinations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_report_settings" ADD CONSTRAINT "telegram_report_settings_destination_id_telegram_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."telegram_destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_delivery_outbox" ADD CONSTRAINT "telegram_delivery_outbox_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_delivery_outbox" ADD CONSTRAINT "telegram_delivery_outbox_destination_id_telegram_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."telegram_destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_delivery_outbox" ADD CONSTRAINT "telegram_delivery_outbox_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_delivery_attempts" ADD CONSTRAINT "telegram_delivery_attempts_delivery_id_telegram_delivery_outbox_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."telegram_delivery_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_cost_snapshot_nonnegative_ck" CHECK ("sale_items"."cost_amount_snapshot" is null or "sale_items"."cost_amount_snapshot" >= 0);--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_outlet_business_date_uq" ON "shifts" USING btree ("outlet_id","business_date") WHERE "shifts"."business_date" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_closing_snapshots_shift_uq" ON "finance_closing_snapshots" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_closing_snapshots_outlet_business_date_uq" ON "finance_closing_snapshots" USING btree ("outlet_id","business_date");--> statement-breakpoint
CREATE INDEX "finance_closing_snapshots_org_period_idx" ON "finance_closing_snapshots" USING btree ("organization_id","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_destinations_chat_id_uq" ON "telegram_destinations" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_destinations_one_active_per_outlet_uq" ON "telegram_destinations" USING btree ("outlet_id") WHERE "telegram_destinations"."is_active" = true;--> statement-breakpoint
CREATE INDEX "telegram_destinations_org_outlet_idx" ON "telegram_destinations" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_report_settings_destination_uq" ON "telegram_report_settings" USING btree ("destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_delivery_outbox_event_destination_uq" ON "telegram_delivery_outbox" USING btree ("event_key","destination_id");--> statement-breakpoint
CREATE INDEX "telegram_delivery_outbox_status_next_attempt_idx" ON "telegram_delivery_outbox" USING btree ("status","next_attempt_at","created_at");--> statement-breakpoint
CREATE INDEX "telegram_delivery_outbox_outlet_report_date_idx" ON "telegram_delivery_outbox" USING btree ("outlet_id","report_type","business_date","created_at");--> statement-breakpoint
CREATE INDEX "telegram_delivery_outbox_destination_created_idx" ON "telegram_delivery_outbox" USING btree ("destination_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_delivery_attempts_delivery_number_uq" ON "telegram_delivery_attempts" USING btree ("delivery_id","attempt_number");--> statement-breakpoint
CREATE INDEX "telegram_delivery_attempts_delivery_requested_idx" ON "telegram_delivery_attempts" USING btree ("delivery_id","requested_at");
