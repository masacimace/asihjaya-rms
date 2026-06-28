CREATE TYPE "public"."print_job_status" AS ENUM('pending', 'printing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "print_job_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_jobs_org_status_idx" ON "print_jobs" USING btree ("organization_id","status");