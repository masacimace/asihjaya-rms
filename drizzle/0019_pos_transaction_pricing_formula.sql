ALTER TABLE "sale_items"
  DROP CONSTRAINT IF EXISTS "sale_items_final_price_formula_ck";

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_final_price_formula_ck"
  CHECK (
    "final_price_amount" =
      "list_price_amount"
      - "discount_amount"
      + COALESCE(NULLIF("snapshot"->>'laborAmount', '')::numeric, 0)
      + COALESCE(NULLIF("snapshot"->>'adjustmentAmount', '')::numeric, 0)
  );

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_final_price_positive_ck"
  CHECK ("final_price_amount" > 0);
