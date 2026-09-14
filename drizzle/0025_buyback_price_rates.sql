CREATE TABLE "metal_buyback_price_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "metal_purity_id" uuid NOT NULL,
  "rate_per_gram" numeric(18, 0) NOT NULL,
  "effective_from" timestamp with time zone DEFAULT now() NOT NULL,
  "effective_until" timestamp with time zone,
  "notes" text,
  "created_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "metal_buyback_price_rates_positive_ck" CHECK ("metal_buyback_price_rates"."rate_per_gram" > 0),
  CONSTRAINT "metal_buyback_price_rates_range_ck" CHECK ("metal_buyback_price_rates"."effective_until" is null or "metal_buyback_price_rates"."effective_until" > "metal_buyback_price_rates"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "metal_buyback_price_rates" ADD CONSTRAINT "metal_buyback_price_rates_metal_purity_id_metal_purities_id_fk" FOREIGN KEY ("metal_purity_id") REFERENCES "public"."metal_purities"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "metal_buyback_price_rates" ADD CONSTRAINT "metal_buyback_price_rates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "metal_buyback_price_rates_purity_effective_uq" ON "metal_buyback_price_rates" USING btree ("metal_purity_id", "effective_from");
--> statement-breakpoint
CREATE UNIQUE INDEX "metal_buyback_price_rates_purity_active_uq" ON "metal_buyback_price_rates" USING btree ("metal_purity_id") WHERE "metal_buyback_price_rates"."effective_until" is null;
