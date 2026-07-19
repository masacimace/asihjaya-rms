CREATE TYPE "public"."approval_execution_status" AS ENUM('not_started', 'executing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."approval_type" AS ENUM('discount', 'void_receipt', 'refund_transaction', 'manual_payment_verification', 'stock_adjustment', 'other');--> statement-breakpoint
CREATE TYPE "public"."cash_movement_type" AS ENUM('opening_balance', 'cash_sale', 'cash_refund', 'cash_in', 'cash_out', 'closing_adjustment');--> statement-breakpoint
CREATE TYPE "public"."hardware_agent_status" AS ENUM('online', 'offline', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."hardware_device_type" AS ENUM('label_printer', 'document_printer', 'cash_drawer', 'other');--> statement-breakpoint
CREATE TYPE "public"."hardware_job_attempt_status" AS ENUM('claimed', 'processing', 'dispatching', 'submitted', 'acknowledged', 'failed_before_dispatch', 'unknown_after_dispatch', 'lease_expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hardware_job_resolution_type" AS ENUM('confirmed_completed', 'retry_authorized', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hardware_job_status" AS ENUM('pending', 'claimed', 'processing', 'printing', 'submitted', 'completed', 'failed', 'unknown_outcome', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hardware_job_type" AS ENUM('print_label_sato', 'print_receipt_certificate', 'open_cash_drawer', 'test_label_printer', 'test_document_printer', 'test_cash_drawer');--> statement-breakpoint
CREATE TYPE "public"."item_availability" AS ENUM('draft', 'available', 'reserved', 'inspection', 'sold');--> statement-breakpoint
CREATE TYPE "public"."item_condition" AS ENUM('good', 'damaged', 'lost', 'returned');--> statement-breakpoint
CREATE TYPE "public"."item_location_state" AS ENUM('outlet', 'warehouse', 'in_transit', 'customer', 'repair');--> statement-breakpoint
CREATE TYPE "public"."manual_payment_verification_status" AS ENUM('self_verified', 'co_verification_required', 'co_verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."master_status" AS ENUM('draft', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('goods_receipt', 'sale', 'sale_return', 'transfer_out', 'transfer_in', 'reservation', 'reservation_release', 'adjustment', 'damaged', 'lost', 'repair_out', 'repair_in', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('sales', 'payment', 'cash_shift', 'inventory_return', 'hardware', 'security', 'system', 'approval_result');--> statement-breakpoint
CREATE TYPE "public"."notification_recipient_status" AS ENUM('unread', 'read', 'acknowledged', 'resolved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'success', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('sales', 'hardware', 'shift', 'cash', 'inventory', 'system');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'debit_card', 'credit_card', 'bank_transfer', 'qris_manual', 'qris_gateway', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_refund_status" AS ENUM('requested', 'approved', 'processing', 'confirmed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_settlement_status" AS ENUM('not_applicable', 'unreconciled', 'pending_settlement', 'reconciled', 'mismatch', 'not_found', 'waived');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'expired', 'cancelled', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."pos_checkout_attempt_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pos_held_cart_status" AS ENUM('active', 'resumed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."return_inspection_decision" AS ENUM('restock', 'repair', 'damaged', 'reject');--> statement-breakpoint
CREATE TYPE "public"."sale_return_case_status" AS ENUM('awaiting_receipt', 'pending_inspection', 'partially_inspected', 'completed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sale_return_item_status" AS ENUM('awaiting_receipt', 'pending_inspection', 'restocked', 'repair', 'damaged', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('draft', 'awaiting_payment', 'completed', 'cancelled', 'voided', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."settlement_import_row_status" AS ENUM('pending', 'matched', 'ambiguous', 'mismatch', 'not_found', 'duplicate', 'ignored', 'applied', 'failed');--> statement-breakpoint
CREATE TYPE "public"."settlement_import_status" AS ENUM('uploaded', 'ready', 'processing', 'completed', 'completed_with_issues', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('open', 'closing', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE SEQUENCE "public"."product_item_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid,
	"type" "approval_type" NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"approved_by" uuid,
	"reference_type" varchar(80),
	"reference_id" uuid,
	"request_data" jsonb NOT NULL,
	"notes" text,
	"response_notes" text,
	"execution_status" "approval_execution_status" DEFAULT 'not_started' NOT NULL,
	"execution_idempotency_key" varchar(160),
	"execution_started_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"executed_by" uuid,
	"execution_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "approvals_executing_state_ck" CHECK ("approvals"."execution_status" <> 'executing' or "approvals"."execution_started_at" is not null),
	CONSTRAINT "approvals_completed_state_ck" CHECK ("approvals"."execution_status" <> 'completed' or (
        "approvals"."executed_at" is not null and "approvals"."executed_by" is not null
      ))
);
--> statement-breakpoint
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_movements_amount_ck" CHECK ((
        "cash_movements"."type" = 'opening_balance' and "cash_movements"."amount" >= 0
      ) or (
        "cash_movements"."type" <> 'opening_balance' and "cash_movements"."amount" > 0
      )),
	CONSTRAINT "cash_movements_system_reference_ck" CHECK ("cash_movements"."type" not in ('opening_balance', 'cash_sale', 'cash_refund')
        or ("cash_movements"."reference_type" is not null and "cash_movements"."reference_id" is not null))
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
CREATE TABLE "hardware_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"secret_hash" text NOT NULL,
	"status" "hardware_agent_status" DEFAULT 'offline' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"last_seen_at" timestamp with time zone,
	"last_ip_address" varchar(64),
	"last_user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hardware_job_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" "hardware_job_attempt_status" DEFAULT 'claimed' NOT NULL,
	"lease_token_hash" text NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"event_sequence" integer DEFAULT 0 NOT NULL,
	"dispatch_started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"server_acknowledged_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" varchar(80),
	"error_message" text,
	"retry_safe" boolean,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hardware_job_attempts_number_ck" CHECK ("hardware_job_attempts"."attempt_number" > 0),
	CONSTRAINT "hardware_job_attempts_event_sequence_ck" CHECK ("hardware_job_attempts"."event_sequence" >= 0),
	CONSTRAINT "hardware_job_attempts_payload_hash_ck" CHECK ("hardware_job_attempts"."payload_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "hardware_job_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt_id" uuid,
	"resolved_by_user_id" uuid NOT NULL,
	"resolution_type" "hardware_job_resolution_type" NOT NULL,
	"reason" text NOT NULL,
	"duplicate_risk_acknowledged" boolean DEFAULT false NOT NULL,
	"previous_status" "hardware_job_status" NOT NULL,
	"next_status" "hardware_job_status" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hardware_job_resolutions_reason_ck" CHECK (char_length(trim("hardware_job_resolutions"."reason")) between 12 and 500),
	CONSTRAINT "hardware_job_resolutions_retry_ack_ck" CHECK ("hardware_job_resolutions"."resolution_type" <> 'retry_authorized' or "hardware_job_resolutions"."duplicate_risk_acknowledged" = true),
	CONSTRAINT "hardware_job_resolutions_status_ck" CHECK ("hardware_job_resolutions"."previous_status" = 'unknown_outcome' and "hardware_job_resolutions"."next_status" in ('completed', 'pending', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "hardware_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"agent_id" uuid,
	"target_agent_id" uuid,
	"current_attempt_id" uuid,
	"created_by_user_id" uuid,
	"protocol_version" integer DEFAULT 1 NOT NULL,
	"job_type" "hardware_job_type" NOT NULL,
	"device_type" "hardware_device_type" NOT NULL,
	"required_capability" varchar(80),
	"target_device" varchar(120),
	"status" "hardware_job_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" varchar(64),
	"result" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"last_error_code" varchar(80),
	"last_error_message" text,
	"idempotency_key" varchar(160),
	"source_type" varchar(80),
	"source_id" varchar(160),
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"processing_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"unknown_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hardware_jobs_protocol_version_ck" CHECK ("hardware_jobs"."protocol_version" in (1, 2)),
	CONSTRAINT "hardware_jobs_attempts_ck" CHECK ("hardware_jobs"."protocol_version" <> 2 or ("hardware_jobs"."attempts" >= 0 and "hardware_jobs"."max_attempts" > 0 and "hardware_jobs"."attempts" <= "hardware_jobs"."max_attempts")),
	CONSTRAINT "hardware_jobs_required_capability_ck" CHECK ("hardware_jobs"."required_capability" is null or "hardware_jobs"."required_capability" in ('print_label_sato', 'print_document_pdf', 'open_cash_drawer')),
	CONSTRAINT "hardware_jobs_payload_hash_ck" CHECK ("hardware_jobs"."payload_hash" is null or "hardware_jobs"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "hardware_jobs_v2_required_fields_ck" CHECK ("hardware_jobs"."protocol_version" <> 2 or ("hardware_jobs"."required_capability" is not null and "hardware_jobs"."payload_hash" is not null and "hardware_jobs"."expires_at" is not null and "hardware_jobs"."idempotency_key" is not null)),
	CONSTRAINT "hardware_jobs_v2_status_ck" CHECK ("hardware_jobs"."protocol_version" <> 2 or "hardware_jobs"."status" <> 'printing'),
	CONSTRAINT "hardware_jobs_expiry_after_creation_ck" CHECK ("hardware_jobs"."expires_at" is null or "hardware_jobs"."expires_at" > "hardware_jobs"."created_at")
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
);
--> statement-breakpoint
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
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid,
	"category" "notification_category" NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"severity" "notification_severity" DEFAULT 'info' NOT NULL,
	"title" varchar(160) NOT NULL,
	"summary" text NOT NULL,
	"entity_type" varchar(80),
	"entity_id" varchar(160),
	"action_url" varchar(300),
	"requires_action" boolean DEFAULT false NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deduplication_key" varchar(220),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_events_title_summary_ck" CHECK (length(btrim("notification_events"."title")) > 0 and length(btrim("notification_events"."summary")) > 0),
	CONSTRAINT "notification_events_action_url_ck" CHECK ("notification_events"."action_url" is null or left("notification_events"."action_url", 1) = '/'),
	CONSTRAINT "notification_events_resolved_time_ck" CHECK ("notification_events"."resolved_at" is null or "notification_events"."resolved_at" >= "notification_events"."occurred_at")
);
--> statement-breakpoint
CREATE TABLE "notification_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "notification_recipient_status" DEFAULT 'unread' NOT NULL,
	"read_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_recipients_read_time_ck" CHECK ("notification_recipients"."status" <> 'read' or "notification_recipients"."read_at" is not null),
	CONSTRAINT "notification_recipients_ack_time_ck" CHECK ("notification_recipients"."status" <> 'acknowledged' or "notification_recipients"."acknowledged_at" is not null),
	CONSTRAINT "notification_recipients_resolved_time_ck" CHECK ("notification_recipients"."status" <> 'resolved' or "notification_recipients"."resolved_at" is not null),
	CONSTRAINT "notification_recipients_archived_time_ck" CHECK ("notification_recipients"."status" <> 'archived' or "notification_recipients"."archived_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid,
	"user_id" uuid,
	"type" "notification_type" NOT NULL,
	"severity" "notification_severity" DEFAULT 'info' NOT NULL,
	"title" varchar(160) NOT NULL,
	"message" text NOT NULL,
	"entity_type" varchar(80),
	"entity_id" varchar(160),
	"action_url" varchar(300),
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
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
	"google_maps_embed_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "payment_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"status" "payment_settlement_status" NOT NULL,
	"expected_amount" numeric(18, 0) NOT NULL,
	"settlement_gross_amount" numeric(18, 0),
	"fee_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"net_settlement_amount" numeric(18, 0),
	"difference_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"settlement_date" timestamp with time zone,
	"settlement_reference" varchar(160),
	"evidence_key" text,
	"notes" text,
	"reconciled_by" uuid NOT NULL,
	"reconciled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reconciliations_actionable_status_ck" CHECK ("payment_reconciliations"."status" not in ('not_applicable', 'unreconciled')),
	CONSTRAINT "payment_reconciliations_expected_positive_ck" CHECK ("payment_reconciliations"."expected_amount" > 0),
	CONSTRAINT "payment_reconciliations_amounts_nonnegative_ck" CHECK ("payment_reconciliations"."fee_amount" >= 0 and "payment_reconciliations"."tax_amount" >= 0 and ("payment_reconciliations"."settlement_gross_amount" is null or "payment_reconciliations"."settlement_gross_amount" >= 0) and ("payment_reconciliations"."net_settlement_amount" is null or "payment_reconciliations"."net_settlement_amount" >= 0)),
	CONSTRAINT "payment_reconciliations_net_formula_ck" CHECK ("payment_reconciliations"."settlement_gross_amount" is null or "payment_reconciliations"."net_settlement_amount" is null or "payment_reconciliations"."net_settlement_amount" = "payment_reconciliations"."settlement_gross_amount" - "payment_reconciliations"."fee_amount" - "payment_reconciliations"."tax_amount"),
	CONSTRAINT "payment_reconciliations_difference_formula_ck" CHECK ("payment_reconciliations"."settlement_gross_amount" is null or "payment_reconciliations"."difference_amount" = "payment_reconciliations"."settlement_gross_amount" - "payment_reconciliations"."expected_amount"),
	CONSTRAINT "payment_reconciliations_reconciled_complete_ck" CHECK ("payment_reconciliations"."status" <> 'reconciled' or (
        "payment_reconciliations"."settlement_gross_amount" = "payment_reconciliations"."expected_amount"
        and "payment_reconciliations"."difference_amount" = 0
        and "payment_reconciliations"."net_settlement_amount" is not null
        and "payment_reconciliations"."settlement_date" is not null
        and "payment_reconciliations"."settlement_reference" is not null
        and btrim("payment_reconciliations"."settlement_reference") <> ''
      )),
	CONSTRAINT "payment_reconciliations_mismatch_complete_ck" CHECK ("payment_reconciliations"."status" <> 'mismatch' or (
        "payment_reconciliations"."settlement_gross_amount" is not null
        and "payment_reconciliations"."difference_amount" <> 0
      )),
	CONSTRAINT "payment_reconciliations_not_found_notes_ck" CHECK ("payment_reconciliations"."status" <> 'not_found' or ("payment_reconciliations"."notes" is not null and length(btrim("payment_reconciliations"."notes")) >= 8)),
	CONSTRAINT "payment_reconciliations_waived_resolution_ck" CHECK ("payment_reconciliations"."status" <> 'waived' or (
        "payment_reconciliations"."notes" is not null
        and length(btrim("payment_reconciliations"."notes")) >= 8
        and "payment_reconciliations"."resolved_by" is not null
        and "payment_reconciliations"."resolved_at" is not null
      ))
);
--> statement-breakpoint
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
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider" varchar(80) DEFAULT 'manual' NOT NULL,
	"amount" numeric(18, 0) NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider_reference" varchar(160),
	"normalized_reference" varchar(160),
	"external_order_id" varchar(160),
	"verification_status" "manual_payment_verification_status" DEFAULT 'self_verified' NOT NULL,
	"verification_source" varchar(40),
	"provider_paid_at" timestamp with time zone,
	"verification_approval_id" uuid,
	"co_verified_by" uuid,
	"co_verified_at" timestamp with time zone,
	"evidence_key" text,
	"manual_payment_profile_id" uuid,
	"settlement_status" "payment_settlement_status" DEFAULT 'not_applicable' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive_ck" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_paid_state_complete_ck" CHECK ("payments"."status" <> 'paid' or (
        "payments"."verified_by" is not null
        and "payments"."verified_at" is not null
        and "payments"."paid_at" is not null
      )),
	CONSTRAINT "payments_manual_noncash_verification_ck" CHECK ("payments"."method" not in ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer') or (
        btrim("payments"."provider") <> ''
        and lower(btrim("payments"."provider")) <> 'manual'
        and "payments"."provider_reference" is not null
        and btrim("payments"."provider_reference") <> ''
        and "payments"."normalized_reference" is not null
        and length("payments"."normalized_reference") >= 4
        and "payments"."verification_source" in ('merchant_app', 'edc_terminal', 'bank_app', 'bank_statement')
        and "payments"."provider_paid_at" is not null
        and "payments"."settlement_status" <> 'not_applicable'
      )),
	CONSTRAINT "payments_co_verified_state_ck" CHECK ("payments"."verification_status" <> 'co_verified' or (
        "payments"."verification_approval_id" is not null
        and "payments"."co_verified_by" is not null
        and "payments"."co_verified_at" is not null
      )),
	CONSTRAINT "payments_cash_settlement_ck" CHECK ("payments"."method" <> 'cash' or (
        "payments"."settlement_status" = 'not_applicable'
        and "payments"."verification_source" is null
        and "payments"."provider_paid_at" is null
        and "payments"."verification_approval_id" is null
        and "payments"."co_verified_by" is null
        and "payments"."co_verified_at" is null
        and "payments"."evidence_key" is null
      ))
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
	"display_name" varchar(220),
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_items_list_price_positive_ck" CHECK ("sale_items"."list_price_amount" > 0),
	CONSTRAINT "sale_items_discount_nonnegative_ck" CHECK ("sale_items"."discount_amount" >= 0),
	CONSTRAINT "sale_items_discount_not_above_list_ck" CHECK ("sale_items"."discount_amount" <= "sale_items"."list_price_amount"),
	CONSTRAINT "sale_items_final_price_formula_ck" CHECK ("sale_items"."final_price_amount" = "sale_items"."list_price_amount" - "sale_items"."discount_amount")
);
--> statement-breakpoint
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
	"checkout_fingerprint" varchar(64),
	"status" "sale_status" DEFAULT 'draft' NOT NULL,
	"subtotal_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"discount_reason" text,
	"additional_fee_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_subtotal_nonnegative_ck" CHECK ("sales"."subtotal_amount" >= 0),
	CONSTRAINT "sales_discount_nonnegative_ck" CHECK ("sales"."discount_amount" >= 0),
	CONSTRAINT "sales_additional_fee_nonnegative_ck" CHECK ("sales"."additional_fee_amount" >= 0),
	CONSTRAINT "sales_total_nonnegative_ck" CHECK ("sales"."total_amount" >= 0),
	CONSTRAINT "sales_discount_not_above_subtotal_ck" CHECK ("sales"."discount_amount" <= "sales"."subtotal_amount"),
	CONSTRAINT "sales_total_formula_ck" CHECK ("sales"."total_amount" = "sales"."subtotal_amount" - "sales"."discount_amount" + "sales"."additional_fee_amount"),
	CONSTRAINT "sales_completed_timestamp_ck" CHECK ("sales"."status" <> 'completed' or "sales"."completed_at" is not null),
	CONSTRAINT "sales_cancelled_timestamp_ck" CHECK ("sales"."status" not in ('cancelled', 'voided', 'refunded') or "sales"."cancelled_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "settlement_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_key" text NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"status" "settlement_import_status" DEFAULT 'uploaded' NOT NULL,
	"delimiter" varchar(8) DEFAULT ',' NOT NULL,
	"headers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"valid_row_count" integer DEFAULT 0 NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"applied_count" integer DEFAULT 0 NOT NULL,
	"ambiguous_count" integer DEFAULT 0 NOT NULL,
	"mismatch_count" integer DEFAULT 0 NOT NULL,
	"not_found_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"ignored_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_import_batches_file_size_ck" CHECK ("settlement_import_batches"."file_size_bytes" between 1 and 5242880),
	CONSTRAINT "settlement_import_batches_counts_ck" CHECK ("settlement_import_batches"."row_count" >= 0
        and "settlement_import_batches"."valid_row_count" >= 0
        and "settlement_import_batches"."matched_count" >= 0
        and "settlement_import_batches"."applied_count" >= 0
        and "settlement_import_batches"."ambiguous_count" >= 0
        and "settlement_import_batches"."mismatch_count" >= 0
        and "settlement_import_batches"."not_found_count" >= 0
        and "settlement_import_batches"."duplicate_count" >= 0
        and "settlement_import_batches"."ignored_count" >= 0
        and "settlement_import_batches"."failed_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settlement_import_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"delimiter" varchar(8) DEFAULT ',' NOT NULL,
	"column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_import_mappings_delimiter_ck" CHECK (length("settlement_import_mappings"."delimiter") between 1 and 8)
);
--> statement-breakpoint
CREATE TABLE "settlement_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transaction_date" timestamp with time zone,
	"payment_reference" varchar(160),
	"normalized_reference" varchar(160),
	"gross_amount" numeric(18, 0),
	"fee_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"net_amount" numeric(18, 0),
	"settlement_reference" varchar(160),
	"provider_status" varchar(80),
	"status" "settlement_import_row_status" DEFAULT 'pending' NOT NULL,
	"matched_payment_id" uuid,
	"candidate_payment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"match_reason" text,
	"error_message" text,
	"review_notes" text,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_import_rows_row_number_ck" CHECK ("settlement_import_rows"."row_number" > 1),
	CONSTRAINT "settlement_import_rows_amounts_ck" CHECK (("settlement_import_rows"."gross_amount" is null or "settlement_import_rows"."gross_amount" >= 0)
        and "settlement_import_rows"."fee_amount" >= 0
        and "settlement_import_rows"."tax_amount" >= 0
        and ("settlement_import_rows"."net_amount" is null or "settlement_import_rows"."net_amount" >= 0)),
	CONSTRAINT "settlement_import_rows_applied_ck" CHECK ("settlement_import_rows"."status" <> 'applied' or (
        "settlement_import_rows"."matched_payment_id" is not null
        and "settlement_import_rows"."applied_at" is not null
      ))
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_opening_cash_nonnegative_ck" CHECK ("shifts"."opening_cash" >= 0),
	CONSTRAINT "shifts_actual_cash_nonnegative_ck" CHECK ("shifts"."actual_cash" is null or "shifts"."actual_cash" >= 0),
	CONSTRAINT "shifts_closed_state_complete_ck" CHECK ("shifts"."status" <> 'closed' or (
        "shifts"."closed_by" is not null
        and "shifts"."expected_cash" is not null
        and "shifts"."actual_cash" is not null
        and "shifts"."cash_variance" is not null
        and "shifts"."closed_at" is not null
      ))
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
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_agents" ADD CONSTRAINT "hardware_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_agents" ADD CONSTRAINT "hardware_agents_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_agents" ADD CONSTRAINT "hardware_agents_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_attempts" ADD CONSTRAINT "hardware_job_attempts_job_id_hardware_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."hardware_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_attempts" ADD CONSTRAINT "hardware_job_attempts_agent_id_hardware_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."hardware_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_resolutions" ADD CONSTRAINT "hardware_job_resolutions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_resolutions" ADD CONSTRAINT "hardware_job_resolutions_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_resolutions" ADD CONSTRAINT "hardware_job_resolutions_job_id_hardware_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."hardware_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_resolutions" ADD CONSTRAINT "hardware_job_resolutions_attempt_id_hardware_job_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."hardware_job_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_resolutions" ADD CONSTRAINT "hardware_job_resolutions_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_agent_id_hardware_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."hardware_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_target_agent_id_hardware_agents_id_fk" FOREIGN KEY ("target_agent_id") REFERENCES "public"."hardware_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_current_attempt_id_hardware_job_attempts_id_fk" FOREIGN KEY ("current_attempt_id") REFERENCES "public"."hardware_job_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_product_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."product_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_from_outlet_id_outlets_id_fk" FOREIGN KEY ("from_outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_to_outlet_id_outlets_id_fk" FOREIGN KEY ("to_outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_policies" ADD CONSTRAINT "manual_payment_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_profiles" ADD CONSTRAINT "manual_payment_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_profiles" ADD CONSTRAINT "manual_payment_profiles_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_profiles" ADD CONSTRAINT "manual_payment_profiles_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metal_price_rates" ADD CONSTRAINT "metal_price_rates_metal_purity_id_metal_purities_id_fk" FOREIGN KEY ("metal_purity_id") REFERENCES "public"."metal_purities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metal_price_rates" ADD CONSTRAINT "metal_price_rates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metal_purities" ADD CONSTRAINT "metal_purities_metal_id_metals_id_fk" FOREIGN KEY ("metal_id") REFERENCES "public"."metals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metals" ADD CONSTRAINT "metals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_event_id_notification_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence_uploads" ADD CONSTRAINT "payment_evidence_uploads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence_uploads" ADD CONSTRAINT "payment_evidence_uploads_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence_uploads" ADD CONSTRAINT "payment_evidence_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence_uploads" ADD CONSTRAINT "payment_evidence_uploads_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verification_approval_id_approvals_id_fk" FOREIGN KEY ("verification_approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_co_verified_by_users_id_fk" FOREIGN KEY ("co_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_manual_payment_profile_id_manual_payment_profiles_id_fk" FOREIGN KEY ("manual_payment_profile_id") REFERENCES "public"."manual_payment_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_checkout_attempts" ADD CONSTRAINT "pos_checkout_attempts_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_batches" ADD CONSTRAINT "settlement_import_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_batches" ADD CONSTRAINT "settlement_import_batches_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_batches" ADD CONSTRAINT "settlement_import_batches_profile_id_manual_payment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."manual_payment_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_batches" ADD CONSTRAINT "settlement_import_batches_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_mappings" ADD CONSTRAINT "settlement_import_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_mappings" ADD CONSTRAINT "settlement_import_mappings_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_mappings" ADD CONSTRAINT "settlement_import_mappings_profile_id_manual_payment_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."manual_payment_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_mappings" ADD CONSTRAINT "settlement_import_mappings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_rows" ADD CONSTRAINT "settlement_import_rows_batch_id_settlement_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."settlement_import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_import_rows" ADD CONSTRAINT "settlement_import_rows_matched_payment_id_payments_id_fk" FOREIGN KEY ("matched_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
CREATE UNIQUE INDEX "approvals_execution_idempotency_uq" ON "approvals" USING btree ("organization_id","execution_idempotency_key") WHERE "approvals"."execution_idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_manual_payment_fingerprint_uq" ON "approvals" USING btree ("organization_id","outlet_id","requested_by",("request_data"->>'verificationFingerprint')) WHERE "approvals"."type" = 'manual_payment_verification';--> statement-breakpoint
CREATE INDEX "approvals_org_status_idx" ON "approvals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "approvals_ref_idx" ON "approvals" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "approvals_execution_status_idx" ON "approvals" USING btree ("organization_id","execution_status");--> statement-breakpoint
CREATE INDEX "audit_logs_org_time_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movements_reference_guard_uq" ON "cash_movements" USING btree ("type","reference_type","reference_id") WHERE "cash_movements"."reference_type" is not null and "cash_movements"."reference_id" is not null;--> statement-breakpoint
CREATE INDEX "cash_movements_shift_time_idx" ON "cash_movements" USING btree ("shift_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_org_code_uq" ON "customers" USING btree ("organization_id","customer_code");--> statement-breakpoint
CREATE INDEX "customers_org_phone_idx" ON "customers" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_agents_org_code_uq" ON "hardware_agents" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "hardware_agents_register_idx" ON "hardware_agents" USING btree ("register_id","is_active");--> statement-breakpoint
CREATE INDEX "hardware_agents_org_status_idx" ON "hardware_agents" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_job_attempts_job_number_uq" ON "hardware_job_attempts" USING btree ("job_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_job_attempts_one_active_uq" ON "hardware_job_attempts" USING btree ("job_id") WHERE "hardware_job_attempts"."status" in ('claimed', 'processing', 'dispatching', 'submitted');--> statement-breakpoint
CREATE INDEX "hardware_job_attempts_agent_status_idx" ON "hardware_job_attempts" USING btree ("agent_id","status","created_at");--> statement-breakpoint
CREATE INDEX "hardware_job_attempts_lease_idx" ON "hardware_job_attempts" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "hardware_job_resolutions_job_time_idx" ON "hardware_job_resolutions" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE INDEX "hardware_job_resolutions_org_time_idx" ON "hardware_job_resolutions" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "hardware_jobs_claim_idx" ON "hardware_jobs" USING btree ("organization_id","outlet_id","register_id","status","available_at");--> statement-breakpoint
CREATE INDEX "hardware_jobs_v2_claim_idx" ON "hardware_jobs" USING btree ("organization_id","outlet_id","register_id","protocol_version","status","required_capability","available_at","priority");--> statement-breakpoint
CREATE INDEX "hardware_jobs_agent_status_idx" ON "hardware_jobs" USING btree ("agent_id","status");--> statement-breakpoint
CREATE INDEX "hardware_jobs_target_agent_idx" ON "hardware_jobs" USING btree ("target_agent_id","status","available_at");--> statement-breakpoint
CREATE INDEX "hardware_jobs_expiry_idx" ON "hardware_jobs" USING btree ("status","expires_at") WHERE "hardware_jobs"."expires_at" is not null;--> statement-breakpoint
CREATE INDEX "hardware_jobs_source_idx" ON "hardware_jobs" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_jobs_current_attempt_uq" ON "hardware_jobs" USING btree ("current_attempt_id") WHERE "hardware_jobs"."current_attempt_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_jobs_idempotency_uq" ON "hardware_jobs" USING btree ("organization_id","idempotency_key") WHERE "hardware_jobs"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "inventory_movements_item_time_idx" ON "inventory_movements" USING btree ("item_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_reference_idx" ON "inventory_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_reference_guard_uq" ON "inventory_movements" USING btree ("item_id","movement_type","reference_type","reference_id") WHERE "inventory_movements"."reference_type" is not null and "inventory_movements"."reference_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_payment_policies_org_method_uq" ON "manual_payment_policies" USING btree ("organization_id","method");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_payment_profiles_org_outlet_code_uq" ON "manual_payment_profiles" USING btree ("organization_id","outlet_id","code");--> statement-breakpoint
CREATE INDEX "manual_payment_profiles_outlet_type_idx" ON "manual_payment_profiles" USING btree ("outlet_id","profile_type","is_active","display_order");--> statement-breakpoint
CREATE INDEX "manual_payment_profiles_register_idx" ON "manual_payment_profiles" USING btree ("register_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "metal_price_rates_purity_effective_uq" ON "metal_price_rates" USING btree ("metal_purity_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "metal_purities_metal_code_uq" ON "metal_purities" USING btree ("metal_id","code");--> statement-breakpoint
CREATE INDEX "metal_purities_metal_active_idx" ON "metal_purities" USING btree ("metal_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "metals_org_code_uq" ON "metals" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "metals_org_active_idx" ON "metals" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_active_dedupe_uq" ON "notification_events" USING btree ("organization_id","deduplication_key") WHERE "notification_events"."deduplication_key" is not null and "notification_events"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "notification_events_org_occurred_idx" ON "notification_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_events_org_category_idx" ON "notification_events" USING btree ("organization_id","category","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_events_outlet_idx" ON "notification_events" USING btree ("outlet_id","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_events_entity_idx" ON "notification_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notification_events_active_action_idx" ON "notification_events" USING btree ("organization_id","requires_action","severity") WHERE "notification_events"."resolved_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipients_event_user_uq" ON "notification_recipients" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_user_status_idx" ON "notification_recipients" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "notification_recipients_event_status_idx" ON "notification_recipients" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "notifications_org_unread_idx" ON "notifications" USING btree ("organization_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "notifications_org_type_idx" ON "notifications" USING btree ("organization_id","type");--> statement-breakpoint
CREATE INDEX "notifications_outlet_idx" ON "notifications" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_entity_idx" ON "notifications" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uq" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_org_code_uq" ON "outlets" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "outlets_org_idx" ON "outlets" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_evidence_uploads_storage_key_uq" ON "payment_evidence_uploads" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "payment_evidence_uploads_org_outlet_idx" ON "payment_evidence_uploads" USING btree ("organization_id","outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_evidence_uploads_expiry_idx" ON "payment_evidence_uploads" USING btree ("sale_id","expires_at");--> statement-breakpoint
CREATE INDEX "payment_evidence_uploads_uploader_idx" ON "payment_evidence_uploads" USING btree ("uploaded_by","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reconciliations_payment_uq" ON "payment_reconciliations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_reconciliations_org_status_idx" ON "payment_reconciliations" USING btree ("organization_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "payment_reconciliations_outlet_status_idx" ON "payment_reconciliations" USING btree ("outlet_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "payment_reconciliations_settlement_date_idx" ON "payment_reconciliations" USING btree ("settlement_date");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_org_idempotency_uq" ON "payment_refunds" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_approval_payment_uq" ON "payment_refunds" USING btree ("approval_id","payment_id") WHERE "payment_refunds"."approval_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_refunds_sale_status_idx" ON "payment_refunds" USING btree ("sale_id","status");--> statement-breakpoint
CREATE INDEX "payment_refunds_payment_status_idx" ON "payment_refunds" USING btree ("payment_id","status");--> statement-breakpoint
CREATE INDEX "payment_refunds_refund_shift_idx" ON "payment_refunds" USING btree ("refund_shift_id");--> statement-breakpoint
CREATE INDEX "payment_refunds_provider_reference_idx" ON "payment_refunds" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE INDEX "payments_sale_status_idx" ON "payments" USING btree ("sale_id","status");--> statement-breakpoint
CREATE INDEX "payments_provider_reference_idx" ON "payments" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE INDEX "payments_normalized_reference_idx" ON "payments" USING btree ("method","provider","normalized_reference");--> statement-breakpoint
CREATE INDEX "payments_verification_status_idx" ON "payments" USING btree ("verification_status","created_at");--> statement-breakpoint
CREATE INDEX "payments_settlement_status_idx" ON "payments" USING btree ("settlement_status","created_at");--> statement-breakpoint
CREATE INDEX "payments_manual_profile_idx" ON "payments" USING btree ("manual_payment_profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_code_uq" ON "permissions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_checkout_attempts_idempotency_uq" ON "pos_checkout_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "pos_checkout_attempts_org_cashier_idx" ON "pos_checkout_attempts" USING btree ("organization_id","cashier_id","created_at");--> statement-breakpoint
CREATE INDEX "pos_checkout_attempts_sale_idx" ON "pos_checkout_attempts" USING btree ("sale_id");--> statement-breakpoint
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
CREATE INDEX "pos_held_carts_held_by_idx" ON "pos_held_carts" USING btree ("held_by_user_id");--> statement-breakpoint
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
CREATE UNIQUE INDEX "sale_return_cases_sale_uq" ON "sale_return_cases" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_return_cases_approval_uq" ON "sale_return_cases" USING btree ("approval_id") WHERE "sale_return_cases"."approval_id" is not null;--> statement-breakpoint
CREATE INDEX "sale_return_cases_outlet_status_idx" ON "sale_return_cases" USING btree ("outlet_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_return_items_case_sale_item_uq" ON "sale_return_items" USING btree ("return_case_id","sale_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_return_items_case_product_item_uq" ON "sale_return_items" USING btree ("return_case_id","product_item_id");--> statement-breakpoint
CREATE INDEX "sale_return_items_case_status_idx" ON "sale_return_items" USING btree ("return_case_id","status");--> statement-breakpoint
CREATE INDEX "sale_return_items_product_status_idx" ON "sale_return_items" USING btree ("product_item_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_org_invoice_uq" ON "sales" USING btree ("organization_id","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_idempotency_uq" ON "sales" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "sales_outlet_created_idx" ON "sales" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_shift_idx" ON "sales" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_import_batches_org_hash_uq" ON "settlement_import_batches" USING btree ("organization_id","file_hash");--> statement-breakpoint
CREATE INDEX "settlement_import_batches_org_status_idx" ON "settlement_import_batches" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "settlement_import_batches_outlet_profile_idx" ON "settlement_import_batches" USING btree ("outlet_id","profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_import_mappings_profile_uq" ON "settlement_import_mappings" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "settlement_import_mappings_org_outlet_idx" ON "settlement_import_mappings" USING btree ("organization_id","outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_import_rows_batch_row_uq" ON "settlement_import_rows" USING btree ("batch_id","row_number");--> statement-breakpoint
CREATE INDEX "settlement_import_rows_batch_status_idx" ON "settlement_import_rows" USING btree ("batch_id","status","row_number");--> statement-breakpoint
CREATE INDEX "settlement_import_rows_reference_idx" ON "settlement_import_rows" USING btree ("normalized_reference");--> statement-breakpoint
CREATE INDEX "settlement_import_rows_payment_idx" ON "settlement_import_rows" USING btree ("matched_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_one_active_per_register_uq" ON "shifts" USING btree ("register_id") WHERE "shifts"."status" in ('open', 'closing');--> statement-breakpoint
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