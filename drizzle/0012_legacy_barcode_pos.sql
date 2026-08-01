DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM product_items
    WHERE length(btrim(barcode)) = 0
       OR barcode <> btrim(barcode)
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'MIGRATION_R5D_PRODUCT_ITEM_BARCODE_NOT_NORMALIZED',
      HINT = 'Perbaiki barcode kosong atau whitespace di awal/akhir pada product_items sebelum menjalankan migration 0012.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM item_barcodes
    WHERE length(btrim(barcode_value)) = 0
       OR barcode_value <> btrim(barcode_value)
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'MIGRATION_R5D_ITEM_BARCODE_NOT_NORMALIZED',
      HINT = 'Perbaiki barcode_value kosong atau whitespace di awal/akhir pada item_barcodes sebelum menjalankan migration 0012.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM product_items AS item
    INNER JOIN item_barcodes AS alias
      ON alias.organization_id = item.organization_id
     AND alias.barcode_value = item.barcode
     AND alias.is_active = true
     AND alias.item_id <> item.id
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'MIGRATION_R5D_INTERNAL_BARCODE_CONFLICT',
      HINT = 'Ada barcode internal product_items yang sudah menjadi alias aktif milik item lain. Selesaikan konflik sebelum backfill.';
  END IF;
END
$$;
--> statement-breakpoint
UPDATE item_barcodes AS alias
SET
  is_active = true,
  is_primary = NOT EXISTS (
    SELECT 1
    FROM item_barcodes AS active_primary
    WHERE active_primary.item_id = alias.item_id
      AND active_primary.is_active = true
      AND active_primary.is_primary = true
      AND active_primary.id <> alias.id
  ),
  updated_at = now()
FROM product_items AS item
WHERE alias.item_id = item.id
  AND alias.organization_id = item.organization_id
  AND alias.barcode_value = item.barcode
  AND alias.is_active = false;
--> statement-breakpoint
INSERT INTO item_barcodes (
  organization_id,
  item_id,
  barcode_value,
  source,
  is_primary,
  is_active,
  created_by,
  created_at,
  updated_at
)
SELECT
  item.organization_id,
  item.id,
  item.barcode,
  'system_generated'::item_barcode_source,
  NOT EXISTS (
    SELECT 1
    FROM item_barcodes AS active_primary
    WHERE active_primary.item_id = item.id
      AND active_primary.is_active = true
      AND active_primary.is_primary = true
  ),
  true,
  NULL,
  now(),
  now()
FROM product_items AS item
WHERE NOT EXISTS (
  SELECT 1
  FROM item_barcodes AS existing_alias
  WHERE existing_alias.item_id = item.id
    AND existing_alias.barcode_value = item.barcode
);
--> statement-breakpoint
UPDATE item_barcodes AS alias
SET
  is_primary = true,
  updated_at = now()
FROM product_items AS item
WHERE alias.item_id = item.id
  AND alias.organization_id = item.organization_id
  AND alias.barcode_value = item.barcode
  AND alias.is_active = true
  AND alias.is_primary = false
  AND NOT EXISTS (
    SELECT 1
    FROM item_barcodes AS active_primary
    WHERE active_primary.item_id = item.id
      AND active_primary.is_active = true
      AND active_primary.is_primary = true
  );
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM product_items AS item
    WHERE NOT EXISTS (
      SELECT 1
      FROM item_barcodes AS alias
      WHERE alias.organization_id = item.organization_id
        AND alias.item_id = item.id
        AND alias.barcode_value = item.barcode
        AND alias.is_active = true
    )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'MIGRATION_R5D_INTERNAL_BARCODE_BACKFILL_INCOMPLETE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM product_items AS item
    WHERE NOT EXISTS (
      SELECT 1
      FROM item_barcodes AS alias
      WHERE alias.item_id = item.id
        AND alias.is_active = true
        AND alias.is_primary = true
    )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'MIGRATION_R5D_PRIMARY_BARCODE_BACKFILL_INCOMPLETE';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE product_items
  ADD CONSTRAINT product_items_barcode_not_blank_ck
  CHECK (length(btrim(barcode)) > 0 AND barcode = btrim(barcode));
--> statement-breakpoint
ALTER TABLE item_barcodes
  ADD CONSTRAINT item_barcodes_barcode_not_blank_ck
  CHECK (length(btrim(barcode_value)) > 0 AND barcode_value = btrim(barcode_value));
