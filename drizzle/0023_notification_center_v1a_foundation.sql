CREATE TYPE "public"."notification_category" AS ENUM('sales', 'payment', 'cash_shift', 'inventory_return', 'hardware', 'security', 'system', 'approval_result');--> statement-breakpoint
CREATE TYPE "public"."notification_recipient_status" AS ENUM('unread', 'read', 'acknowledged', 'resolved', 'archived');--> statement-breakpoint
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
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_event_id_notification_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_active_dedupe_uq" ON "notification_events" USING btree ("organization_id","deduplication_key") WHERE "notification_events"."deduplication_key" is not null and "notification_events"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "notification_events_org_occurred_idx" ON "notification_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_events_org_category_idx" ON "notification_events" USING btree ("organization_id","category","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_events_outlet_idx" ON "notification_events" USING btree ("outlet_id","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_events_entity_idx" ON "notification_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notification_events_active_action_idx" ON "notification_events" USING btree ("organization_id","requires_action","severity") WHERE "notification_events"."resolved_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipients_event_user_uq" ON "notification_recipients" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_user_status_idx" ON "notification_recipients" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "notification_recipients_event_status_idx" ON "notification_recipients" USING btree ("event_id","status");
--> statement-breakpoint
-- Preserve the existing drawer history while moving read state to per-user recipients.
INSERT INTO "notification_events" (
  "id",
  "organization_id",
  "outlet_id",
  "category",
  "event_type",
  "severity",
  "title",
  "summary",
  "entity_type",
  "entity_id",
  "action_url",
  "requires_action",
  "payload",
  "occurred_at",
  "created_at",
  "updated_at"
)
SELECT
  legacy."id",
  legacy."organization_id",
  legacy."outlet_id",
  CASE legacy."type"::text
    WHEN 'sales' THEN 'sales'
    WHEN 'hardware' THEN 'hardware'
    WHEN 'shift' THEN 'cash_shift'
    WHEN 'cash' THEN 'cash_shift'
    WHEN 'inventory' THEN 'inventory_return'
    ELSE 'system'
  END::"notification_category",
  ('legacy.' || legacy."type"::text),
  legacy."severity",
  COALESCE(NULLIF(BTRIM(legacy."title"), ''), 'Notifikasi sistem'),
  COALESCE(NULLIF(BTRIM(legacy."message"), ''), 'Detail notifikasi legacy tidak tersedia.'),
  legacy."entity_type",
  legacy."entity_id",
  CASE
    WHEN legacy."action_url" IS NULL OR LEFT(legacy."action_url", 1) = '/'
      THEN legacy."action_url"
    ELSE NULL
  END,
  false,
  COALESCE(legacy."metadata", '{}'::jsonb),
  legacy."created_at",
  legacy."created_at",
  legacy."updated_at"
FROM "notifications" legacy
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- Notifications that were already user-specific remain user-specific.
INSERT INTO "notification_recipients" (
  "event_id",
  "user_id",
  "status",
  "read_at",
  "created_at",
  "updated_at"
)
SELECT
  legacy."id",
  legacy."user_id",
  CASE WHEN legacy."is_read" THEN 'read' ELSE 'unread' END::"notification_recipient_status",
  CASE
    WHEN legacy."is_read" THEN COALESCE(legacy."read_at", legacy."updated_at", legacy."created_at")
    ELSE NULL
  END,
  legacy."created_at",
  legacy."updated_at"
FROM "notifications" legacy
JOIN "users" recipient_user
  ON recipient_user."id" = legacy."user_id"
 AND recipient_user."organization_id" = legacy."organization_id"
WHERE legacy."user_id" IS NOT NULL
ON CONFLICT ("event_id", "user_id") DO NOTHING;
--> statement-breakpoint
-- Organization/outlet notifications are expanded to active admin users once.
INSERT INTO "notification_recipients" (
  "event_id",
  "user_id",
  "status",
  "read_at",
  "created_at",
  "updated_at"
)
SELECT DISTINCT
  legacy."id",
  recipient_user."id",
  CASE WHEN legacy."is_read" THEN 'read' ELSE 'unread' END::"notification_recipient_status",
  CASE
    WHEN legacy."is_read" THEN COALESCE(legacy."read_at", legacy."updated_at", legacy."created_at")
    ELSE NULL
  END,
  legacy."created_at",
  legacy."updated_at"
FROM "notifications" legacy
JOIN "users" recipient_user
  ON recipient_user."organization_id" = legacy."organization_id"
 AND recipient_user."status" = 'active'
JOIN "user_roles" recipient_user_role
  ON recipient_user_role."user_id" = recipient_user."id"
JOIN "roles" recipient_role
  ON recipient_role."id" = recipient_user_role."role_id"
 AND recipient_role."organization_id" = legacy."organization_id"
 AND recipient_role."is_active" = true
JOIN "role_permissions" recipient_role_permission
  ON recipient_role_permission."role_id" = recipient_role."id"
JOIN "permissions" recipient_permission
  ON recipient_permission."id" = recipient_role_permission."permission_id"
 AND recipient_permission."code" = 'admin.access'
WHERE legacy."user_id" IS NULL
  AND (
    legacy."outlet_id" IS NULL
    OR EXISTS (
      SELECT 1
      FROM "user_outlets" recipient_outlet
      WHERE recipient_outlet."user_id" = recipient_user."id"
        AND recipient_outlet."outlet_id" = legacy."outlet_id"
    )
  )
ON CONFLICT ("event_id", "user_id") DO NOTHING;

