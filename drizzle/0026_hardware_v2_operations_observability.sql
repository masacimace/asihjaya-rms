CREATE TYPE "public"."hardware_job_resolution_type" AS ENUM('confirmed_completed', 'retry_authorized', 'cancelled');--> statement-breakpoint
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
ALTER TABLE "hardware_job_resolutions" ADD CONSTRAINT "hardware_job_resolutions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_resolutions" ADD CONSTRAINT "hardware_job_resolutions_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_resolutions" ADD CONSTRAINT "hardware_job_resolutions_job_id_hardware_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."hardware_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_resolutions" ADD CONSTRAINT "hardware_job_resolutions_attempt_id_hardware_job_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."hardware_job_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_job_resolutions" ADD CONSTRAINT "hardware_job_resolutions_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hardware_job_resolutions_job_time_idx" ON "hardware_job_resolutions" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE INDEX "hardware_job_resolutions_org_time_idx" ON "hardware_job_resolutions" USING btree ("organization_id","created_at");--> statement-breakpoint
INSERT INTO "permissions" (
  "id",
  "code",
  "name",
  "description",
  "module",
  "created_at",
  "updated_at"
)
VALUES (
  gen_random_uuid(),
  'hardware.resolve_unknown',
  'Menyelesaikan hardware job dengan hasil tidak pasti',
  'Mengonfirmasi hasil fisik, mengotorisasi retry berisiko, atau membatalkan Hardware Job Protocol v2 berstatus unknown_outcome.',
  'operations',
  now(),
  now()
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = excluded."name",
  "description" = excluded."description",
  "module" = excluded."module",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "role_permissions" (
  "id",
  "role_id",
  "permission_id",
  "constraints"
)
SELECT
  gen_random_uuid(),
  role_record."id",
  permission_record."id",
  NULL
FROM "roles" role_record
JOIN "permissions" permission_record
  ON permission_record."code" = 'hardware.resolve_unknown'
WHERE role_record."code" IN ('system_admin', 'owner', 'manager')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
