CREATE TABLE "hardware_agent_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"register_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"claimed_by_instance_id" varchar(120),
	"claimed_ip_address" varchar(64),
	"claimed_user_agent" text,
	"agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hardware_agent_enrollments_code_hash_ck" CHECK ("hardware_agent_enrollments"."code_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "hardware_agent_enrollments_status_ck" CHECK ("hardware_agent_enrollments"."status" in ('pending', 'claimed', 'completed', 'expired', 'revoked')),
	CONSTRAINT "hardware_agent_enrollments_expiry_ck" CHECK ("hardware_agent_enrollments"."expires_at" > "hardware_agent_enrollments"."created_at"),
	CONSTRAINT "hardware_agent_enrollments_state_ck" CHECK ((
        "hardware_agent_enrollments"."status" = 'pending'
        and "hardware_agent_enrollments"."claimed_at" is null
        and "hardware_agent_enrollments"."completed_at" is null
        and "hardware_agent_enrollments"."revoked_at" is null
        and "hardware_agent_enrollments"."claimed_by_instance_id" is null
        and "hardware_agent_enrollments"."agent_id" is null
      ) or (
        "hardware_agent_enrollments"."status" = 'claimed'
        and "hardware_agent_enrollments"."claimed_at" is not null
        and "hardware_agent_enrollments"."completed_at" is null
        and "hardware_agent_enrollments"."revoked_at" is null
        and "hardware_agent_enrollments"."claimed_by_instance_id" is not null
        and "hardware_agent_enrollments"."agent_id" is not null
      ) or (
        "hardware_agent_enrollments"."status" = 'completed'
        and "hardware_agent_enrollments"."claimed_at" is not null
        and "hardware_agent_enrollments"."completed_at" is not null
        and "hardware_agent_enrollments"."revoked_at" is null
        and "hardware_agent_enrollments"."claimed_by_instance_id" is not null
        and "hardware_agent_enrollments"."agent_id" is not null
      ) or (
        "hardware_agent_enrollments"."status" = 'expired'
        and "hardware_agent_enrollments"."claimed_at" is null
        and "hardware_agent_enrollments"."completed_at" is null
        and "hardware_agent_enrollments"."revoked_at" is null
        and "hardware_agent_enrollments"."claimed_by_instance_id" is null
        and "hardware_agent_enrollments"."agent_id" is null
      ) or (
        "hardware_agent_enrollments"."status" = 'revoked'
        and "hardware_agent_enrollments"."claimed_at" is null
        and "hardware_agent_enrollments"."completed_at" is null
        and "hardware_agent_enrollments"."revoked_at" is not null
        and "hardware_agent_enrollments"."claimed_by_instance_id" is null
        and "hardware_agent_enrollments"."agent_id" is null
      ))
);
--> statement-breakpoint
ALTER TABLE "hardware_agent_enrollments" ADD CONSTRAINT "hardware_agent_enrollments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hardware_agent_enrollments" ADD CONSTRAINT "hardware_agent_enrollments_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hardware_agent_enrollments" ADD CONSTRAINT "hardware_agent_enrollments_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hardware_agent_enrollments" ADD CONSTRAINT "hardware_agent_enrollments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hardware_agent_enrollments" ADD CONSTRAINT "hardware_agent_enrollments_agent_id_hardware_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."hardware_agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_agent_enrollments_code_hash_uq" ON "hardware_agent_enrollments" USING btree ("code_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_agent_enrollments_one_pending_per_register_uq" ON "hardware_agent_enrollments" USING btree ("register_id") WHERE "hardware_agent_enrollments"."status" = 'pending';
--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_agent_enrollments_agent_uq" ON "hardware_agent_enrollments" USING btree ("agent_id") WHERE "hardware_agent_enrollments"."agent_id" is not null;
--> statement-breakpoint
CREATE INDEX "hardware_agent_enrollments_org_status_created_idx" ON "hardware_agent_enrollments" USING btree ("organization_id","status","created_at");
--> statement-breakpoint
CREATE INDEX "hardware_agent_enrollments_register_status_idx" ON "hardware_agent_enrollments" USING btree ("register_id","status","created_at");
