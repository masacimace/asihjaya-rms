CREATE TABLE "security_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(80) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"blocked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_rate_limits_attempt_count_ck" CHECK ("security_rate_limits"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "security_rate_limits_scope_key_uq" ON "security_rate_limits" USING btree ("scope", "key_hash");
--> statement-breakpoint
CREATE INDEX "security_rate_limits_blocked_idx" ON "security_rate_limits" USING btree ("blocked_until");
--> statement-breakpoint
CREATE INDEX "security_rate_limits_updated_idx" ON "security_rate_limits" USING btree ("updated_at");
