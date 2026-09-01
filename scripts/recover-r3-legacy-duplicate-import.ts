import { config as loadDotenv } from "dotenv";

function readArg(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length) ?? null;
}

function assertUuid(value: string | null, label: string): asserts value is string {
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error(`${label} harus berupa UUID yang valid.`);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const envFile = readArg("--env-file") ?? ".env";
const batchId = readArg("--batch-id");
const apply = process.argv.includes("--apply");
loadDotenv({ path: envFile, quiet: true });
assertUuid(batchId, "--batch-id");

const [{ pool }] = await Promise.all([import("@/db")]);
const client = await pool.connect();

try {
  const batchResult = await client.query<{
    id: string;
    organization_id: string;
    outlet_id: string;
    uploaded_by: string;
    total_rows: number;
    status: string;
    validation_summary: Record<string, unknown>;
  }>(
    `select id, organization_id, outlet_id, uploaded_by, total_rows, status, validation_summary
       from legacy_product_import_batches
      where id = $1`,
    [batchId],
  );
  const batch = batchResult.rows[0];
  if (!batch) throw new Error(`Batch ${batchId} tidak ditemukan.`);

  const cohortsResult = await client.query<{
    imported_at: string;
    total_items: number;
    cleanup_items: number;
    images_synced: number;
    photo_source_items: number;
    first_created: Date;
    last_created: Date;
  }>(
    `select
       attributes->'legacyImport'->>'importedAt' as imported_at,
       count(*)::int as total_items,
       count(*) filter (
         where coalesce((attributes->'legacyImport'->>'needsCleanup')::boolean, false)
       )::int as cleanup_items,
       count(*) filter (where image_key is not null)::int as images_synced,
       count(*) filter (where legacy_url is not null)::int as photo_source_items,
       min(created_at) as first_created,
       max(created_at) as last_created
     from product_items
     where organization_id = $2
       and attributes->'legacyImport'->>'batchId' = $1
     group by attributes->'legacyImport'->>'importedAt'
     order by min(created_at)`,
    [batchId, batch.organization_id],
  );

  if (cohortsResult.rows.length !== 2) {
    throw new Error(
      `Recovery ini hanya aman untuk tepat 2 cohort import. Ditemukan ${cohortsResult.rows.length}.`,
    );
  }

  const [keeper, duplicate] = cohortsResult.rows;
  if (!keeper?.imported_at || !duplicate?.imported_at) {
    throw new Error("Metadata importedAt pada cohort legacy tidak lengkap.");
  }
  if (
    keeper.total_items !== batch.total_rows ||
    duplicate.total_items !== batch.total_rows
  ) {
    throw new Error(
      `Ukuran cohort tidak sama dengan totalRows batch (${batch.total_rows}). Keeper=${keeper.total_items}, duplicate=${duplicate.total_items}.`,
    );
  }
  if (duplicate.images_synced > 0) {
    throw new Error(
      `Cohort duplicate memiliki ${duplicate.images_synced} image_key. Recovery dihentikan agar file internal tidak menjadi orphan.`,
    );
  }

  const rowIdentityResult = await client.query<{
    source_rows: number;
    min_items_per_row: number;
    max_items_per_row: number;
    total_items: number;
  }>(
    `with grouped as (
       select
         attributes->'legacyImport'->>'rowId' as row_id,
         count(*)::int as item_count
       from product_items
       where organization_id = $2
         and attributes->'legacyImport'->>'batchId' = $1
       group by attributes->'legacyImport'->>'rowId'
     )
     select
       count(*)::int as source_rows,
       min(item_count)::int as min_items_per_row,
       max(item_count)::int as max_items_per_row,
       sum(item_count)::int as total_items
     from grouped`,
    [batchId, batch.organization_id],
  );
  const identity = rowIdentityResult.rows[0];
  if (
    !identity ||
    identity.source_rows !== batch.total_rows ||
    identity.min_items_per_row !== 2 ||
    identity.max_items_per_row !== 2 ||
    identity.total_items !== batch.total_rows * 2
  ) {
    throw new Error(
      `Pola duplicate source row tidak persis 2-per-row. sourceRows=${identity?.source_rows ?? 0}, min=${identity?.min_items_per_row ?? 0}, max=${identity?.max_items_per_row ?? 0}, total=${identity?.total_items ?? 0}.`,
    );
  }

  const dependencyResult = await client.query<{
    duplicate_items: number;
    inventory_movements: number;
    item_barcodes: number;
    sale_items: number;
    sale_return_items: number;
    held_cart_items: number;
    product_batch_rows: number;
  }>(
    `with duplicate_items as (
       select id
       from product_items
       where organization_id = $2
         and attributes->'legacyImport'->>'batchId' = $1
         and attributes->'legacyImport'->>'importedAt' = $3
     )
     select
       (select count(*)::int from duplicate_items) as duplicate_items,
       (select count(*)::int from inventory_movements im join duplicate_items d on d.id = im.item_id) as inventory_movements,
       (select count(*)::int from item_barcodes ib join duplicate_items d on d.id = ib.item_id) as item_barcodes,
       (select count(*)::int from sale_items si join duplicate_items d on d.id = si.product_item_id) as sale_items,
       (select count(*)::int from sale_return_items sri join duplicate_items d on d.id = sri.product_item_id) as sale_return_items,
       (select count(*)::int from pos_held_cart_items hc join duplicate_items d on d.id = hc.product_item_id) as held_cart_items,
       (select count(*)::int from product_batch_import_item_rows pbi join duplicate_items d on d.id = pbi.committed_product_item_id) as product_batch_rows`,
    [batchId, batch.organization_id, duplicate.imported_at],
  );
  const dependencies = dependencyResult.rows[0];
  if (!dependencies || dependencies.duplicate_items !== batch.total_rows) {
    throw new Error("Jumlah target duplicate berubah selama inspeksi. Recovery dihentikan.");
  }

  const blockingReferences =
    dependencies.sale_items +
    dependencies.sale_return_items +
    dependencies.held_cart_items +
    dependencies.product_batch_rows;
  if (blockingReferences > 0) {
    throw new Error(
      `Cohort duplicate sudah memiliki ${blockingReferences} reference operasional. Recovery otomatis dihentikan.`,
    );
  }

  const firstAuditResult = await client.query<{
    after_data: Record<string, unknown> | null;
  }>(
    `select after_data
       from audit_logs
      where organization_id = $2
        and action = 'legacy_product_import.direct_commit'
        and entity_type = 'legacy_product_import_batch'
        and entity_id = $1
      order by created_at asc
      limit 1`,
    [batchId, batch.organization_id],
  );
  const firstAudit = asRecord(firstAuditResult.rows[0]?.after_data);

  const keeperAliasResult = await client.query<{ total: number }>(
    `select count(*)::int as total
       from item_barcodes ib
       join product_items pi on pi.id = ib.item_id
      where pi.organization_id = $2
        and pi.attributes->'legacyImport'->>'batchId' = $1
        and pi.attributes->'legacyImport'->>'importedAt' = $3
        and ib.source = 'legacy_import'
        and ib.is_active = true`,
    [batchId, batch.organization_id, keeper.imported_at],
  );
  const legacyBarcodeAliasCount = keeperAliasResult.rows[0]?.total ?? 0;
  const directImportSummary = {
    ...firstAudit,
    batchId,
    importedItemCount: keeper.total_items,
    cleanupItemCount: keeper.cleanup_items,
    legacyBarcodeAliasCount,
    systemOnlyBarcodeCount: keeper.total_items - legacyBarcodeAliasCount,
    imagePendingCount: keeper.photo_source_items,
    imageMissingCount: keeper.total_items - keeper.photo_source_items,
    completedAt: keeper.imported_at,
    duplicateRecovery: {
      recoveredAt: new Date().toISOString(),
      keptImportedAt: keeper.imported_at,
      removedImportedAt: duplicate.imported_at,
      removedItemCount: duplicate.total_items,
    },
  };

  const plan = {
    mode: apply ? "apply" : "dry-run",
    batchId,
    batchStatus: batch.status,
    totalRows: batch.total_rows,
    keeper: {
      importedAt: keeper.imported_at,
      totalItems: keeper.total_items,
      cleanupItems: keeper.cleanup_items,
      imagesSynced: keeper.images_synced,
      photoSourceItems: keeper.photo_source_items,
    },
    duplicate: {
      importedAt: duplicate.imported_at,
      totalItems: duplicate.total_items,
      cleanupItems: duplicate.cleanup_items,
      imagesSynced: duplicate.images_synced,
    },
    dependencies,
    expectedAfterRecovery: {
      legacyItemsForBatch: keeper.total_items,
      cleanupItems: keeper.cleanup_items,
      imagesPreserved: keeper.images_synced,
    },
  };

  console.log(JSON.stringify(plan, null, 2));
  if (!apply) {
    console.log(
      "\nDry-run aman. Jalankan ulang dengan --apply untuk melakukan recovery transactional.",
    );
    process.exitCode = 0;
  } else {
    await client.query("begin");
    try {
      await client.query(
        `select pg_advisory_xact_lock(hashtext($1))`,
        [`legacy-direct-import:${batch.organization_id}:${batchId}`],
      );
      await client.query(
        `select id from legacy_product_import_batches where id = $1 for update`,
        [batchId],
      );

      const deleteMovements = await client.query(
        `delete from inventory_movements im
          using product_items pi
          where im.item_id = pi.id
            and pi.organization_id = $2
            and pi.attributes->'legacyImport'->>'batchId' = $1
            and pi.attributes->'legacyImport'->>'importedAt' = $3`,
        [batchId, batch.organization_id, duplicate.imported_at],
      );
      const deleteBarcodes = await client.query(
        `delete from item_barcodes ib
          using product_items pi
          where ib.item_id = pi.id
            and pi.organization_id = $2
            and pi.attributes->'legacyImport'->>'batchId' = $1
            and pi.attributes->'legacyImport'->>'importedAt' = $3`,
        [batchId, batch.organization_id, duplicate.imported_at],
      );
      const deleteItems = await client.query(
        `delete from product_items
          where organization_id = $2
            and attributes->'legacyImport'->>'batchId' = $1
            and attributes->'legacyImport'->>'importedAt' = $3`,
        [batchId, batch.organization_id, duplicate.imported_at],
      );

      if (deleteItems.rowCount !== batch.total_rows) {
        throw new Error(
          `Delete guard gagal: expected ${batch.total_rows}, actual ${deleteItems.rowCount ?? 0}.`,
        );
      }

      await client.query(
        `update legacy_product_import_batches
            set status = 'ready',
                validation_summary = jsonb_set(
                  coalesce(validation_summary, '{}'::jsonb),
                  '{directImport}',
                  $2::jsonb,
                  true
                ),
                error_message = null,
                completed_at = $3::timestamptz,
                updated_at = now()
          where id = $1`,
        [batchId, JSON.stringify(directImportSummary), keeper.imported_at],
      );

      await client.query(
        `insert into audit_logs (
           organization_id, outlet_id, actor_user_id, action, entity_type,
           entity_id, after_data, reason, created_at
         ) values (
           $1, $2, $3, 'legacy_product_import.duplicate_recovery',
           'legacy_product_import_batch', $4, $5::jsonb,
           'Duplicate cohort dari retry R3 dibersihkan. Cohort import pertama dipertahankan beserta foto dan metadata cleanup yang valid.',
           now()
         )`,
        [
          batch.organization_id,
          batch.outlet_id,
          batch.uploaded_by,
          batchId,
          JSON.stringify({
            keptImportedAt: keeper.imported_at,
            removedImportedAt: duplicate.imported_at,
            removedItemCount: deleteItems.rowCount,
            removedInventoryMovements: deleteMovements.rowCount ?? 0,
            removedItemBarcodes: deleteBarcodes.rowCount ?? 0,
            restoredCleanupItemCount: keeper.cleanup_items,
            preservedImageCount: keeper.images_synced,
          }),
        ],
      );

      const verifyResult = await client.query<{
        total_items: number;
        cleanup_items: number;
        duplicate_source_rows: number;
      }>(
        `select
           count(*)::int as total_items,
           count(*) filter (
             where coalesce((attributes->'legacyImport'->>'needsCleanup')::boolean, false)
           )::int as cleanup_items,
           (
             select count(*)::int
             from (
               select attributes->'legacyImport'->>'rowId' as row_id
               from product_items
               where organization_id = $2
                 and attributes->'legacyImport'->>'batchId' = $1
               group by attributes->'legacyImport'->>'rowId'
               having count(*) > 1
             ) duplicates
           ) as duplicate_source_rows
         from product_items
         where organization_id = $2
           and attributes->'legacyImport'->>'batchId' = $1`,
        [batchId, batch.organization_id],
      );
      const verified = verifyResult.rows[0];
      if (
        !verified ||
        verified.total_items !== batch.total_rows ||
        verified.cleanup_items !== keeper.cleanup_items ||
        verified.duplicate_source_rows !== 0
      ) {
        throw new Error(
          `Post-recovery assertion gagal: ${JSON.stringify(verified ?? {})}`,
        );
      }

      await client.query("commit");
      console.log(
        JSON.stringify(
          {
            event: "r3_legacy_duplicate_recovery_completed",
            outcome: "success",
            batchId,
            removedItems: deleteItems.rowCount ?? 0,
            removedInventoryMovements: deleteMovements.rowCount ?? 0,
            removedItemBarcodes: deleteBarcodes.rowCount ?? 0,
            remainingLegacyItems: verified.total_items,
            cleanupItems: verified.cleanup_items,
            duplicateSourceRows: verified.duplicate_source_rows,
            preservedImages: keeper.images_synced,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        event: "r3_legacy_duplicate_recovery_failed",
        outcome: "failed",
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
