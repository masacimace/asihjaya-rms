import assert from "node:assert/strict";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  productBatchImportItemRows,
  productBatchImportMasterRows,
  productBatchImportMedia,
  productBatchImportSessions,
  productItems,
  productMasters,
} from "@/db/schema";
import {
  commitProductBatchImportSession,
  ProductBatchImportCommitError,
} from "@/features/product-batch-import/commit-service";
import { readProductBatchImportStagingFile } from "@/lib/storage/product-batch-import-storage";

import { loadProductBatchImportTestAuth } from "./lib/product-batch-import-test-auth";

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const sessionId = argument("session-id");
const confirmation = argument("confirm");
assert.ok(sessionId, "Gunakan --session-id=<UUID session ready>.");
assert.equal(
  confirmation,
  "FAIL_PRODUCT_BATCH_COMMIT_TEST",
  "Tambahkan --confirm=FAIL_PRODUCT_BATCH_COMMIT_TEST karena test ini sengaja membuat session menjadi failed dan mengonsumsi sequence gap.",
);

const [before] = await db
  .select({
    status: productBatchImportSessions.status,
    storageKey: productBatchImportSessions.storageKey,
    totalItemRows: productBatchImportSessions.totalItemRows,
  })
  .from(productBatchImportSessions)
  .where(eq(productBatchImportSessions.id, sessionId))
  .limit(1);
assert.ok(before, "Session tidak ditemukan.");
assert.equal(before.status, "ready", "Gunakan session khusus yang masih ready.");
assert.ok(before.totalItemRows > 0, "Failure test membutuhkan minimal satu Product Item.");

const auth = await loadProductBatchImportTestAuth(sessionId);

await assert.rejects(
  () =>
    commitProductBatchImportSession({
      auth,
      sessionId,
      testFailpoint: "after_first_identifier_allocation",
      requestMetadata: { userAgent: "product-batch-import-failure-local-test" },
    }),
  (error: unknown) =>
    error instanceof ProductBatchImportCommitError && error.code === "TEST_FAILPOINT",
);

const [session] = await db
  .select({
    status: productBatchImportSessions.status,
    failureCode: productBatchImportSessions.failureCode,
    committedMasterCount: productBatchImportSessions.committedMasterCount,
    committedItemCount: productBatchImportSessions.committedItemCount,
  })
  .from(productBatchImportSessions)
  .where(eq(productBatchImportSessions.id, sessionId))
  .limit(1);
assert.ok(session);
assert.equal(session.status, "failed");
assert.equal(session.committedMasterCount, 0);
assert.equal(session.committedItemCount, 0);

const [masterRows, itemRows, mediaRows] = await Promise.all([
  db
    .select({
      plannedId: productBatchImportMasterRows.plannedProductMasterId,
      committedId: productBatchImportMasterRows.committedProductMasterId,
    })
    .from(productBatchImportMasterRows)
    .where(eq(productBatchImportMasterRows.sessionId, sessionId)),
  db
    .select({
      plannedId: productBatchImportItemRows.plannedProductItemId,
      committedId: productBatchImportItemRows.committedProductItemId,
      generatedSku: productBatchImportItemRows.generatedSku,
      generatedBarcode: productBatchImportItemRows.generatedBarcode,
      generatedQrValue: productBatchImportItemRows.generatedQrValue,
    })
    .from(productBatchImportItemRows)
    .where(eq(productBatchImportItemRows.sessionId, sessionId)),
  db
    .select({
      status: productBatchImportMedia.status,
      finalKey: productBatchImportMedia.finalKey,
    })
    .from(productBatchImportMedia)
    .where(eq(productBatchImportMedia.sessionId, sessionId)),
]);

const plannedMasterIds = masterRows.map((row) => row.plannedId).filter((value): value is string => !!value);
const plannedItemIds = itemRows.map((row) => row.plannedId).filter((value): value is string => !!value);
assert.equal(plannedMasterIds.length, masterRows.length);
assert.equal(plannedItemIds.length, itemRows.length);
assert.ok(masterRows.every((row) => row.committedId === null));
assert.ok(
  itemRows.every(
    (row) =>
      row.committedId === null &&
      row.generatedSku === null &&
      row.generatedBarcode === null &&
      row.generatedQrValue === null,
  ),
);

const committedMasters = plannedMasterIds.length
  ? await db
      .select({ id: productMasters.id })
      .from(productMasters)
      .where(inArray(productMasters.id, plannedMasterIds))
  : [];
const committedItems = plannedItemIds.length
  ? await db
      .select({ id: productItems.id })
      .from(productItems)
      .where(inArray(productItems.id, plannedItemIds))
  : [];
assert.equal(committedMasters.length, 0, "Product Master parsial tidak boleh tersisa.");
assert.equal(committedItems.length, 0, "Product Item parsial tidak boleh tersisa.");
assert.ok(mediaRows.every((row) => row.status === "failed" && row.finalKey === null));

const archive = await readProductBatchImportStagingFile(before.storageKey);
assert.ok(archive.length > 0, "Staging archive failed session tetap tersedia untuk evidence/cancel.");

console.log("Simulated Product Batch Import commit failure berhasil.");
console.log("- Failure dipicu setelah identifier pertama dialokasikan.");
console.log("- Seluruh Product Master/Product Item database insert di-rollback.");
console.log("- Generated identifier staging tidak tersimpan; sequence gap tetap diperbolehkan.");
console.log("- Final media compensating cleanup berhasil; staging evidence tetap tersedia.");
