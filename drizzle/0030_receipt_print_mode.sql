-- Per-outlet receipt media choice. NULL means environment/default fallback.
ALTER TABLE "outlets" ADD COLUMN "receipt_print_mode" varchar(40);
--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_receipt_print_mode_ck"
CHECK ("receipt_print_mode" IS NULL OR "receipt_print_mode" IN ('preprinted_overlay', 'full_design_front_only'));
