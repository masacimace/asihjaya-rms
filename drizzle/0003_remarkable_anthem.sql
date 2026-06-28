CREATE TYPE "public"."hardware_agent_status" AS ENUM('online', 'offline', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."hardware_device_type" AS ENUM('label_printer', 'document_printer', 'cash_drawer', 'other');--> statement-breakpoint
CREATE TYPE "public"."hardware_job_status" AS ENUM('pending', 'claimed', 'printing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hardware_job_type" AS ENUM('print_label_sato', 'print_receipt_certificate', 'open_cash_drawer', 'test_label_printer', 'test_document_printer', 'test_cash_drawer');--> statement-breakpoint
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
CREATE TABLE "hardware_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"agent_id" uuid,
	"created_by_user_id" uuid,
	"job_type" "hardware_job_type" NOT NULL,
	"device_type" "hardware_device_type" NOT NULL,
	"target_device" varchar(120),
	"status" "hardware_job_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"idempotency_key" varchar(160),
	"source_type" varchar(80),
	"source_id" varchar(160),
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hardware_agents" ADD CONSTRAINT "hardware_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_agents" ADD CONSTRAINT "hardware_agents_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_agents" ADD CONSTRAINT "hardware_agents_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_agent_id_hardware_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."hardware_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_jobs" ADD CONSTRAINT "hardware_jobs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_agents_org_code_uq" ON "hardware_agents" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "hardware_agents_register_idx" ON "hardware_agents" USING btree ("register_id","is_active");--> statement-breakpoint
CREATE INDEX "hardware_agents_org_status_idx" ON "hardware_agents" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "hardware_jobs_claim_idx" ON "hardware_jobs" USING btree ("organization_id","outlet_id","register_id","status","available_at");--> statement-breakpoint
CREATE INDEX "hardware_jobs_agent_status_idx" ON "hardware_jobs" USING btree ("agent_id","status");--> statement-breakpoint
CREATE INDEX "hardware_jobs_source_idx" ON "hardware_jobs" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_jobs_idempotency_uq" ON "hardware_jobs" USING btree ("organization_id","idempotency_key") WHERE "hardware_jobs"."idempotency_key" is not null;