CREATE TABLE "customer_history_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"pin_hash" text NOT NULL,
	"credential_version" integer DEFAULT 1 NOT NULL,
	"must_change_pin" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_attempt_count" integer DEFAULT 0 NOT NULL,
	"failed_window_started_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"pin_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pin_reset_at" timestamp with time zone,
	"pin_created_by_user_id" uuid,
	"last_successful_access_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_history_credentials_version_ck" CHECK ("customer_history_credentials"."credential_version" > 0),
	CONSTRAINT "customer_history_credentials_failed_count_ck" CHECK ("customer_history_credentials"."failed_attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customer_history_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"credential_version" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"requires_pin_change" boolean DEFAULT false NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_history_sessions_version_ck" CHECK ("customer_history_sessions"."credential_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "customer_history_ip_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"blocked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_history_ip_rate_limits_failure_count_ck" CHECK ("customer_history_ip_rate_limits"."failure_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "customer_history_credentials" ADD CONSTRAINT "customer_history_credentials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_history_credentials" ADD CONSTRAINT "customer_history_credentials_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_history_credentials" ADD CONSTRAINT "customer_history_credentials_pin_created_by_user_id_users_id_fk" FOREIGN KEY ("pin_created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_history_sessions" ADD CONSTRAINT "customer_history_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_history_sessions" ADD CONSTRAINT "customer_history_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_history_credentials_customer_uq" ON "customer_history_credentials" USING btree ("customer_id");
--> statement-breakpoint
CREATE INDEX "customer_history_credentials_org_active_idx" ON "customer_history_credentials" USING btree ("organization_id", "is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_history_sessions_token_hash_uq" ON "customer_history_sessions" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "customer_history_sessions_customer_expiry_idx" ON "customer_history_sessions" USING btree ("customer_id", "absolute_expires_at");
--> statement-breakpoint
CREATE INDEX "customer_history_sessions_expiry_idx" ON "customer_history_sessions" USING btree ("absolute_expires_at", "idle_expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_history_ip_rate_limits_key_uq" ON "customer_history_ip_rate_limits" USING btree ("key_hash");
--> statement-breakpoint
CREATE INDEX "customer_history_ip_rate_limits_blocked_idx" ON "customer_history_ip_rate_limits" USING btree ("blocked_until");
--> statement-breakpoint
INSERT INTO "permissions" ("code", "name", "module", "description", "created_at", "updated_at")
VALUES (
  'customers.history_pin.manage',
  'Membuat dan mereset PIN riwayat pelanggan',
  'customers',
  'Membuat PIN sementara, mereset PIN, dan mencabut sesi riwayat pelanggan.',
  now(),
  now()
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = excluded."name",
  "module" = excluded."module",
  "description" = excluded."description",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT "roles"."id", "permissions"."id"
FROM "roles"
CROSS JOIN "permissions"
WHERE "roles"."code" IN ('system_admin', 'owner', 'manager')
  AND "permissions"."code" = 'customers.history_pin.manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
