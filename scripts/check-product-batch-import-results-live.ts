import { and, eq } from "drizzle-orm";

import { db } from "../src/db";
import {
  hardwareJobs,
  productBatchImportItemRows,
  productBatchImportMasterRows,
  productBatchImportSessions,
  productItems,
  productMasters,
} from "../src/db/schema";

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const sessionId = readArg("session-id");
const requireLabelJobs = process.argv.includes("--require-label-jobs");
if (!sessionId) {
  throw new Error("Gunakan --session-id=UUID_SESSION.");
}

const [session] = await db
  .select()
  .from(productBatchImportSessions)
  .where(eq(productBatchImportSessions.id, sessionId))
  .limit(1);
if (!session) throw new Error("Session Product Batch Import tidak ditemukan.");
if (session.status !== "completed") throw new Error(`Session harus completed, sekarang ${session.status}.`);

const [masters, items, labelJobs] = await Promise.all([
  db
    .select({
      stagedId: productBatchImportMasterRows.committedProductMasterId,
      actualId: productMasters.id,
      code: productMasters.code,
    })
    .from(productBatchImportMasterRows)
    .leftJoin(productMasters, eq(productBatchImportMasterRows.committedProductMasterId, productMasters.id))
    .where(eq(productBatchImportMasterRows.sessionId, sessionId)),
  db
    .select({
      stagedId: productBatchImportItemRows.committedProductItemId,
      actualId: productItems.id,
      stagedSku: productBatchImportItemRows.generatedSku,
      actualSku: productItems.sku,
      stagedBarcode: productBatchImportItemRows.generatedBarcode,
      actualBarcode: productItems.barcode,
      stagedQr: productBatchImportItemRows.generatedQrValue,
      actualQr: productItems.qrValue,
    })
    .from(productBatchImportItemRows)
    .leftJoin(productItems, eq(productBatchImportItemRows.committedProductItemId, productItems.id))
    .where(eq(productBatchImportItemRows.sessionId, sessionId)),
  db
    .select({
      id: hardwareJobs.id,
      jobType: hardwareJobs.jobType,
      sourceType: hardwareJobs.sourceType,
      sourceId: hardwareJobs.sourceId,
      payload: hardwareJobs.payload,
      status: hardwareJobs.status,
    })
    .from(hardwareJobs)
    .where(
      and(
        eq(hardwareJobs.organizationId, session.organizationId),
        eq(hardwareJobs.sourceType, "product_batch_import"),
        eq(hardwareJobs.sourceId, sessionId),
      ),
    ),
]);

if (masters.length !== session.committedMasterCount) {
  throw new Error(`Master result count mismatch: ${masters.length} != ${session.committedMasterCount}.`);
}
if (items.length !== session.committedItemCount) {
  throw new Error(`Item result count mismatch: ${items.length} != ${session.committedItemCount}.`);
}
if (masters.some((row) => !row.stagedId || row.stagedId !== row.actualId || !row.code?.startsWith("PM-"))) {
  throw new Error("Committed Product Master result evidence tidak konsisten.");
}
if (
  items.some(
    (row) =>
      !row.stagedId ||
      row.stagedId !== row.actualId ||
      row.stagedSku !== row.actualSku ||
      row.stagedBarcode !== row.actualBarcode ||
      row.stagedQr !== row.actualQr,
  )
) {
  throw new Error("Generated SKU/barcode/QR staging tidak cocok dengan Product Item database.");
}

const itemIds = new Set(items.flatMap((row) => (row.actualId ? [row.actualId] : [])));
for (const job of labelJobs) {
  if (job.jobType !== "print_label_sato" || job.sourceType !== "product_batch_import" || job.sourceId !== sessionId) {
    throw new Error(`Hardware job ${job.id} tidak mengikuti Batch Import label contract.`);
  }
  const itemId = typeof job.payload.itemId === "string" ? job.payload.itemId : null;
  if (!itemId || !itemIds.has(itemId)) {
    throw new Error(`Hardware job ${job.id} menunjuk item di luar session.`);
  }
}
if (requireLabelJobs && labelJobs.length === 0) {
  throw new Error("Belum ada label job untuk session. Jalankan Print selected/all terlebih dahulu.");
}

console.log("Pemeriksaan Product Batch Import result/label live berhasil.");
console.log(`- Session ${sessionId}: ${masters.length} master, ${items.length} item.`);
console.log("- Generated SKU/barcode/QR staging cocok dengan database committed.");
console.log(`- Label jobs session-scoped: ${labelJobs.length}.`);
