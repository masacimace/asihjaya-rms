ALTER TABLE "buyback_items" DROP CONSTRAINT "buyback_items_exchange_purity_range_ck";--> statement-breakpoint
ALTER TABLE "buyback_items" DROP CONSTRAINT "buyback_items_price_positive_ck";--> statement-breakpoint
ALTER TABLE "buyback_items" ALTER COLUMN "product_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "buyback_items" ALTER COLUMN "exchange_purity_percent" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "buyback_items" ALTER COLUMN "buyback_price_per_gram" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "buyback_items" ADD CONSTRAINT "buyback_items_exchange_purity_range_ck" CHECK ("buyback_items"."exchange_purity_percent" is null or ("buyback_items"."exchange_purity_percent" > 0 and "buyback_items"."exchange_purity_percent" <= 999.999));--> statement-breakpoint
ALTER TABLE "buyback_items" ADD CONSTRAINT "buyback_items_price_positive_ck" CHECK ("buyback_items"."buyback_price_per_gram" is null or "buyback_items"."buyback_price_per_gram" > 0);