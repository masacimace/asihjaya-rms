CREATE TYPE "public"."hardware_job_attempt_status" AS ENUM('claimed', 'processing', 'dispatching', 'submitted', 'acknowledged', 'failed_before_dispatch', 'unknown_after_dispatch', 'lease_expired', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."hardware_job_status" ADD VALUE 'processing' BEFORE 'printing';--> statement-breakpoint
ALTER TYPE "public"."hardware_job_status" ADD VALUE 'submitted' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."hardware_job_status" ADD VALUE 'unknown_outcome' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."hardware_job_status" ADD VALUE 'expired' BEFORE 'cancelled';--> statement-breakpoint
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
ALTER TABLE "hardware_jobs" ADD COLUMN "target_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "current_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "protocol_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "required_capability" varchar(80);--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "payload_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "last_error_code" varchar(80);--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "last_error_message" text;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "processing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "unknown_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD COLUMN "expired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hardware_job_attempts" ADD CONSTRAINT "hardware_job_attempts_job_id_hardware_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."hardware_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_attempts" ADD CONSTRAINT "hardware_job_attempts_agent_id_hardware_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."hardware_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_job_attempts_job_number_uq" ON "hardware_job_attempts" USING btree ("job_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_job_attempts_one_active_uq" ON "hardware_job_attempts" USING btree ("job_id") WHERE "hardware_job_attempts"."status" in ('claimed', 'processing', 'dispatching', 'submitted');--> statement-breakpoint
CREATE INDEX "hardware_job_attempts_agent_status_idx" ON "hardware_job_attempts" USING btree ("agent_id","status","created_at");--> statement-breakpoint
CREATE INDEX "hardware_job_attempts_lease_idx" ON "hardware_job_attempts" USING btree ("status","lease_expires_at");--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_target_agent_id_hardware_agents_id_fk" FOREIGN KEY ("target_agent_id") REFERENCES "public"."hardware_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_current_attempt_id_hardware_job_attempts_id_fk" FOREIGN KEY ("current_attempt_id") REFERENCES "public"."hardware_job_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hardware_jobs_v2_claim_idx" ON "hardware_jobs" USING btree ("organization_id","outlet_id","register_id","protocol_version","status","required_capability","available_at","priority");--> statement-breakpoint
CREATE INDEX "hardware_jobs_target_agent_idx" ON "hardware_jobs" USING btree ("target_agent_id","status","available_at");--> statement-breakpoint
CREATE INDEX "hardware_jobs_expiry_idx" ON "hardware_jobs" USING btree ("status","expires_at") WHERE "hardware_jobs"."expires_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_jobs_current_attempt_uq" ON "hardware_jobs" USING btree ("current_attempt_id") WHERE "hardware_jobs"."current_attempt_id" is not null;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_protocol_version_ck" CHECK ("hardware_jobs"."protocol_version" in (1, 2));--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_attempts_ck" CHECK ("hardware_jobs"."protocol_version" <> 2 or ("hardware_jobs"."attempts" >= 0 and "hardware_jobs"."max_attempts" > 0 and "hardware_jobs"."attempts" <= "hardware_jobs"."max_attempts"));--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_required_capability_ck" CHECK ("hardware_jobs"."required_capability" is null or "hardware_jobs"."required_capability" in ('print_label_sato', 'print_document_pdf', 'open_cash_drawer'));--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_payload_hash_ck" CHECK ("hardware_jobs"."payload_hash" is null or "hardware_jobs"."payload_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_v2_required_fields_ck" CHECK ("hardware_jobs"."protocol_version" <> 2 or ("hardware_jobs"."required_capability" is not null and "hardware_jobs"."payload_hash" is not null and "hardware_jobs"."expires_at" is not null and "hardware_jobs"."idempotency_key" is not null));--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_v2_status_ck" CHECK ("hardware_jobs"."protocol_version" <> 2 or "hardware_jobs"."status" <> 'printing');--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_expiry_after_creation_ck" CHECK ("hardware_jobs"."expires_at" is null or "hardware_jobs"."expires_at" > "hardware_jobs"."created_at");