import assert from "node:assert/strict";
import { config as loadDotenv } from "dotenv";
import { and, eq } from "drizzle-orm";

loadDotenv({ path: ".env", quiet: true });

const sessionArg = process.argv.find((arg) => arg.startsWith("--session-id="));
const confirmArg = process.argv.find((arg) => arg.startsWith("--confirm="));
const sessionId = sessionArg?.slice("--session-id=".length) ?? "";
if (confirmArg !== "--confirm=PRODUCT_BATCH_MAINTENANCE_LOCAL_TEST") {
  throw new Error(
    "Tambahkan --confirm=PRODUCT_BATCH_MAINTENANCE_LOCAL_TEST. Script ini hanya untuk database/storage development lokal.",
  );
}
if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
  throw new Error("--session-id wajib UUID session test terminal.");
}

const [
  { db, pool },
  {
    productBatchImportMasterRows,
    productBatchImportSessions,
    productMasters,
  },
  { runProductBatchImportMaintenance },
  {
    readProductBatchImportStagingFile,
    storeProductBatchImportStagingFile,
  },
  { readImageFile, storeImageBuffer },
] = await Promise.all([
  import("@/db"),
  import("@/db/schema"),
  import("@/features/product-batch-import/maintenance-service"),
  import("@/lib/storage/product-batch-import-storage"),
  import("@/lib/storage/image-storage"),
]);

const TERMINAL = new Set(["failed", "cancelled", "expired"]);
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nJ0AAAAASUVORK5CYII=",
  "base64",
);

try {
  const [session] = await db
    .select({
      id: productBatchImportSessions.id,
      organizationId: productBatchImportSessions.organizationId,
      status: productBatchImportSessions.status,
      storageKey: productBatchImportSessions.storageKey,
    })
    .from(productBatchImportSessions)
    .where(eq(productBatchImportSessions.id, sessionId))
    .limit(1);
  assert(session, "Session test tidak ditemukan.");
  assert(TERMINAL.has(session.status), "Session test harus failed/cancelled/expired.");

  let stagingAlreadyExisted = false;
  try {
    await readProductBatchImportStagingFile(session.storageKey);
    stagingAlreadyExisted = true;
  } catch {
    await storeProductBatchImportStagingFile({
      key: session.storageKey,
      buffer: Buffer.from("maintenance-staging-sentinel"),
      contentType: "application/zip",
    });
  }

  const [masterPlan] = await db
    .select({ plannedId: productBatchImportMasterRows.plannedProductMasterId })
    .from(productBatchImportMasterRows)
    .where(eq(productBatchImportMasterRows.sessionId, sessionId))
    .limit(1);

  let finalOrphanKey: string | null = null;
  if (masterPlan?.plannedId) {
    const [existing] = await db
      .select({ id: productMasters.id })
      .from(productMasters)
      .where(
        and(
          eq(productMasters.id, masterPlan.plannedId),
          eq(productMasters.organizationId, session.organizationId),
        ),
      )
      .limit(1);
    assert(!existing, "Planned master test sudah menjadi data bisnis; final orphan rehearsal dibatalkan.");
    finalOrphanKey = await storeImageBuffer({
      input: ONE_PIXEL_PNG,
      organizationId: session.organizationId,
      entityType: "products",
      entityId: masterPlan.plannedId,
    });
  }

  const result = await runProductBatchImportMaintenance();
  assert.equal(result.cleanupFailures, 0, "Maintenance tidak boleh mempunyai cleanup failure.");

  await assert.rejects(
    () => readProductBatchImportStagingFile(session.storageKey),
    "Sentinel staging terminal harus dihapus.",
  );
  if (finalOrphanKey) {
    await assert.rejects(
      () => readImageFile(finalOrphanKey!),
      "Final orphan pada planned entity uncommitted harus dihapus.",
    );
  }

  const [preservedSession] = await db
    .select({ id: productBatchImportSessions.id, status: productBatchImportSessions.status })
    .from(productBatchImportSessions)
    .where(eq(productBatchImportSessions.id, sessionId))
    .limit(1);
  assert(preservedSession, "Evidence session database tidak boleh dihapus maintenance.");

  console.log("Product Batch Import maintenance local rehearsal berhasil.");
  console.log(
    stagingAlreadyExisted
      ? "- Terminal staging existing dibersihkan."
      : "- Terminal staging sentinel dibersihkan.",
  );
  console.log(
    finalOrphanKey
      ? "- Final orphan image planned entity dibersihkan."
      : "- Final orphan image test dilewati karena session tidak mempunyai planned master ID.",
  );
  console.log("- Evidence session database tetap tersedia.");
} finally {
  await pool.end();
}
