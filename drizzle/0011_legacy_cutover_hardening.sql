DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "inventory_movements"
    WHERE "movement_type" = 'migration_opening'
    GROUP BY "item_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'R5F3 cannot add migration opening uniqueness: duplicate migration_opening rows exist for at least one item';
  END IF;
END $$;

CREATE UNIQUE INDEX "inventory_movements_migration_opening_item_uq"
  ON "inventory_movements" USING btree ("item_id")
  WHERE "movement_type" = 'migration_opening';
