CREATE TABLE "inventory_label_alias_counters" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "inventory_label_alias_counters_range_ck" CHECK ("inventory_label_alias_counters"."next_value" between 1 and 1000000)
);
--> statement-breakpoint
ALTER TABLE "inventory_label_alias_counters" ADD CONSTRAINT "inventory_label_alias_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;