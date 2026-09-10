CREATE TABLE "product_color_presets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" varchar(64) NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_color_presets_name_not_blank_ck" CHECK (length(btrim("product_color_presets"."name")) > 0 and "product_color_presets"."name" = btrim("product_color_presets"."name"))
);--> statement-breakpoint
ALTER TABLE "product_color_presets" ADD CONSTRAINT "product_color_presets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_color_presets_org_name_ci_uq" ON "product_color_presets" USING btree ("organization_id", lower(btrim("name")));--> statement-breakpoint
CREATE INDEX "product_color_presets_org_active_name_idx" ON "product_color_presets" USING btree ("organization_id", "is_active", "name");--> statement-breakpoint
WITH "legacy_colors" AS (
  SELECT "product_items"."organization_id", btrim("product_items"."color") AS "name"
  FROM "product_items"
  WHERE "product_items"."color" IS NOT NULL

  UNION ALL

  SELECT "buybacks"."organization_id", btrim("buyback_items"."snapshot"->>'color') AS "name"
  FROM "buyback_items"
  INNER JOIN "buybacks" ON "buybacks"."id" = "buyback_items"."buyback_id"
  WHERE "buyback_items"."snapshot"->>'color' IS NOT NULL

  UNION ALL

  SELECT "buybacks"."organization_id", btrim("buyback_item_processings"."result_snapshot"->>'color') AS "name"
  FROM "buyback_item_processings"
  INNER JOIN "buyback_items" ON "buyback_items"."id" = "buyback_item_processings"."buyback_item_id"
  INNER JOIN "buybacks" ON "buybacks"."id" = "buyback_items"."buyback_id"
  WHERE "buyback_item_processings"."result_snapshot"->>'color' IS NOT NULL
), "normalized_colors" AS (
  SELECT
    "organization_id",
    min("name") AS "name"
  FROM "legacy_colors"
  WHERE length("name") BETWEEN 1 AND 64
  GROUP BY "organization_id", lower("name")
)
INSERT INTO "product_color_presets" ("organization_id", "name", "description", "is_active")
SELECT "organization_id", "name", NULL, true
FROM "normalized_colors"
ON CONFLICT DO NOTHING;
