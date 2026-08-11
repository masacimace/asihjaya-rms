import assert from "node:assert/strict";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  inventoryMovements,
  itemBarcodes,
  productBatchImportItemRows,
  productBatchImportMasterRows,
  productBatchImportMedia,
  productBatchImportSessions,
  productItems,
  productMasters,
} from "@/db/schema";
import { readImageFile } from "@/lib/storage/image-storage";
import { readProductBatchImportStagingFile } from "@/lib/storage/product-batch-import-storage";

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const sessionId = argument("session-id");
assert.ok(sessionId, "Gunakan --session-id=<UUID session completed>.");

const [session] = await db
  .select({
    id: productBatchImportSessions.id,
    organizationId: productBatchImportSessions.organizationId,
    status: productBatchImportSessions.status,
    storageKey: productBatchImportSessions.storageKey,
    totalMasterRows: productBatchImportSessions.totalMasterRows,
    totalItemRows: productBatchImportSessions.totalItemRows,
    committedMasterCount: productBatchImportSessions.committedMasterCount,
    committedItemCount: productBatchImportSessions.committedItemCount,
    failureCode: productBatchImportSessions.failureCode,
  })
  .from(productBatchImportSessions)
  .where(eq(productBatchImportSessions.id, sessionId))
  .limit(1);

assert.ok(session, "Session tidak ditemukan.");
assert.equal(session.status, "completed", "Session harus completed.");
assert.equal(session.committedMasterCount, session.totalMasterRows);
assert.equal(session.committedItemCount, session.totalItemRows);
assert.equal(
  session.failureCode,
  null,
  `Cleanup warning/failure masih tercatat: ${session.failureCode ?? ""}`,
);

const [masterRows, itemRows, mediaRows] = await Promise.all([
  db
    .select({
      masterKey: productBatchImportMasterRows.masterKey,
      plannedId: productBatchImportMasterRows.plannedProductMasterId,
      committedId: productBatchImportMasterRows.committedProductMasterId,
    })
    .from(productBatchImportMasterRows)
    .where(eq(productBatchImportMasterRows.sessionId, session.id)),
  db
    .select({
      rowKey: productBatchImportItemRows.rowKey,
      plannedId: productBatchImportItemRows.plannedProductItemId,
      committedId: productBatchImportItemRows.committedProductItemId,
      sku: productBatchImportItemRows.generatedSku,
      barcode: productBatchImportItemRows.generatedBarcode,
      qrValue: productBatchImportItemRows.generatedQrValue,
      normalizedPayload: productBatchImportItemRows.normalizedPayload,
    })
    .from(productBatchImportItemRows)
    .where(eq(productBatchImportItemRows.sessionId, session.id)),
  db
    .select({
      id: productBatchImportMedia.id,
      stagingKey: productBatchImportMedia.stagingKey,
      finalKey: productBatchImportMedia.finalKey,
      status: productBatchImportMedia.status,
    })
    .from(productBatchImportMedia)
    .where(eq(productBatchImportMedia.sessionId, session.id)),
]);

assert.equal(masterRows.length, session.totalMasterRows);
assert.equal(itemRows.length, session.totalItemRows);
for (const row of masterRows) {
  assert.ok(row.plannedId && row.committedId);
  assert.equal(row.plannedId, row.committedId);
}
for (const row of itemRows) {
  assert.ok(row.plannedId && row.committedId && row.sku && row.barcode && row.qrValue);
  assert.equal(row.plannedId, row.committedId);
  assert.match(row.sku, /^AJ-ITEM-\d{8,}$/);
  assert.match(row.barcode, /^AJ\d{8,}$/);
  assert.equal(row.barcode, row.qrValue);
}

const masterIds = masterRows.map((row) => row.committedId!).filter(Boolean);
const itemIds = itemRows.map((row) => row.committedId!).filter(Boolean);

const masters = masterIds.length
  ? await db
      .select({
        id: productMasters.id,
        organizationId: productMasters.organizationId,
        code: productMasters.code,
        imageKey: productMasters.imageKey,
      })
      .from(productMasters)
      .where(
        and(
          eq(productMasters.organizationId, session.organizationId),
          inArray(productMasters.id, masterIds),
        ),
      )
  : [];
assert.equal(masters.length, masterIds.length);
for (const master of masters) {
  assert.match(master.code, /^PM-\d{6,}$/);
  assert.ok(master.imageKey, `Product Master ${master.id} tidak mempunyai final image.`);
}

const items = itemIds.length
  ? await db
      .select({
        id: productItems.id,
        organizationId: productItems.organizationId,
        sku: productItems.sku,
        barcode: productItems.barcode,
        qrValue: productItems.qrValue,
        availability: productItems.availability,
      })
      .from(productItems)
      .where(
        and(
          eq(productItems.organizationId, session.organizationId),
          inArray(productItems.id, itemIds),
        ),
      )
  : [];
assert.equal(items.length, itemIds.length);

const itemsById = new Map(items.map((item) => [item.id, item]));
for (const row of itemRows) {
  const item = itemsById.get(row.committedId!);
  assert.ok(item, `Product Item ${row.rowKey} tidak ditemukan.`);
  assert.equal(item.sku, row.sku);
  assert.equal(item.barcode, row.barcode);
  assert.equal(item.qrValue, row.qrValue);
}

const barcodeRows = itemIds.length
  ? await db
      .select({
        itemId: itemBarcodes.itemId,
        barcodeValue: itemBarcodes.barcodeValue,
        source: itemBarcodes.source,
        isPrimary: itemBarcodes.isPrimary,
        isActive: itemBarcodes.isActive,
      })
      .from(itemBarcodes)
      .where(
        and(
          eq(itemBarcodes.organizationId, session.organizationId),
          inArray(itemBarcodes.itemId, itemIds),
        ),
      )
  : [];
const primaryByItem = new Map(
  barcodeRows
    .filter((row) => row.isPrimary && row.isActive)
    .map((row) => [row.itemId, row]),
);
for (const row of itemRows) {
  const barcode = primaryByItem.get(row.committedId!);
  assert.ok(barcode, `Primary barcode ${row.rowKey} tidak ditemukan.`);
  assert.equal(barcode.barcodeValue, row.barcode);
  assert.equal(barcode.source, "system_generated");
}

const availableItemIds = itemRows
  .filter(
    (row) =>
      String(row.normalizedPayload.initial_availability ?? "draft") ===
      "available",
  )
  .map((row) => row.committedId!);
const movements = availableItemIds.length
  ? await db
      .select({
        itemId: inventoryMovements.itemId,
        movementType: inventoryMovements.movementType,
        referenceType: inventoryMovements.referenceType,
        referenceId: inventoryMovements.referenceId,
      })
      .from(inventoryMovements)
      .where(
        and(
          inArray(inventoryMovements.itemId, availableItemIds),
          eq(inventoryMovements.movementType, "goods_receipt"),
          eq(inventoryMovements.referenceType, "product_item"),
        ),
      )
  : [];
const movementItemIds = new Set(movements.map((row) => row.itemId));
for (const itemId of availableItemIds) {
  assert.ok(movementItemIds.has(itemId), `goods_receipt ${itemId} tidak ditemukan.`);
}

for (const media of mediaRows) {
  assert.equal(media.status, "promoted");
  assert.ok(media.finalKey, `Final media key ${media.id} kosong.`);
}

for (const media of mediaRows.slice(0, 5)) {
  const bytes = await readImageFile(media.finalKey!);
  assert.ok(bytes.length > 0, `Final image ${media.id} tidak dapat dibaca.`);
}

await assert.rejects(
  () => readProductBatchImportStagingFile(session.storageKey),
  "Archive staging seharusnya sudah dibersihkan setelah completed.",
);
for (const media of mediaRows.slice(0, 10)) {
  await assert.rejects(
    () => readProductBatchImportStagingFile(media.stagingKey),
    `Staging media ${media.id} seharusnya sudah dibersihkan.`,
  );
}

console.log("Pemeriksaan Product Batch Import atomic commit live berhasil.");
console.log(`- Session ${session.id}: ${masterRows.length} master, ${itemRows.length} item.`);
console.log(`- ${availableItemIds.length} item available memiliki goods_receipt.`);
console.log("- SKU/barcode/QR, primary barcode registry, dan Product Master code cocok dengan data committed.");
console.log("- Final media dapat dibaca dan staging cleanup berhasil.");
