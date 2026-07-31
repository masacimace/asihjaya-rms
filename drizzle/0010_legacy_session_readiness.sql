ALTER TABLE "legacy_migration_sold_records"
  ADD COLUMN "session_id" uuid;

UPDATE "legacy_migration_sold_records" AS sold
SET "session_id" = verification."session_id"
FROM "legacy_migration_verifications" AS verification
WHERE sold."verification_id" = verification."id"
  AND sold."session_id" IS NULL;

ALTER TABLE "legacy_migration_sold_records"
  ADD CONSTRAINT "legacy_migration_sold_records_session_id_legacy_migration_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."legacy_migration_sessions"("id")
  ON DELETE restrict ON UPDATE no action;

CREATE INDEX "legacy_migration_sold_records_batch_session_sold_at_idx"
  ON "legacy_migration_sold_records" USING btree ("batch_id", "session_id", "sold_at");

UPDATE "product_items" AS item
SET
  "price_per_gram" = coalesce(
    item."price_per_gram",
    CASE
      WHEN legacy_row."legacy_price_per_gram" > 0
      THEN legacy_row."legacy_price_per_gram"
      ELSE NULL
    END
  ),
  "deduction_per_gram" = coalesce(
    item."deduction_per_gram",
    CASE
      WHEN legacy_row."legacy_deduction_per_gram" >= 0
      THEN legacy_row."legacy_deduction_per_gram"
      ELSE NULL
    END
  ),
  "selling_amount" = coalesce(
    item."selling_amount",
    CASE
      WHEN round(
        verification."verified_weight_gram" *
        coalesce(
          item."price_per_gram",
          CASE
            WHEN legacy_row."legacy_price_per_gram" > 0
            THEN legacy_row."legacy_price_per_gram"
            ELSE NULL
          END
        )
      ) BETWEEN 1 AND 999999999999999999
      THEN round(
        verification."verified_weight_gram" *
        coalesce(
          item."price_per_gram",
          CASE
            WHEN legacy_row."legacy_price_per_gram" > 0
            THEN legacy_row."legacy_price_per_gram"
            ELSE NULL
          END
        )
      )
      ELSE NULL
    END
  ),
  "updated_at" = now()
FROM "legacy_migration_verifications" AS verification
INNER JOIN "legacy_product_rows" AS legacy_row
  ON legacy_row."id" = verification."legacy_row_id"
WHERE verification."product_item_id" = item."id"
  AND verification."status" = 'approved'
  AND item."availability" = 'migration_hold'
  AND (
    item."price_per_gram" IS NULL
    OR item."selling_amount" IS NULL
    OR item."deduction_per_gram" IS NULL
  );
