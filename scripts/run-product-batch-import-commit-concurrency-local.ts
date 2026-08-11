import assert from "node:assert/strict";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { productBatchImportSessions } from "@/db/schema";
import {
  commitProductBatchImportSession,
  ProductBatchImportCommitError,
} from "@/features/product-batch-import/commit-service";

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
  "COMMIT_PRODUCT_BATCH_CONCURRENCY_TEST",
  "Tambahkan --confirm=COMMIT_PRODUCT_BATCH_CONCURRENCY_TEST karena test ini benar-benar melakukan commit data bisnis.",
);

const [before] = await db
  .select({ status: productBatchImportSessions.status })
  .from(productBatchImportSessions)
  .where(eq(productBatchImportSessions.id, sessionId))
  .limit(1);
assert.ok(before, "Session tidak ditemukan.");
assert.equal(before.status, "ready", "Gunakan session khusus yang masih ready.");

const auth = await loadProductBatchImportTestAuth(sessionId);
const attempts = await Promise.allSettled([
  commitProductBatchImportSession({
    auth,
    sessionId,
    requestMetadata: { userAgent: "product-batch-concurrency-test-A" },
  }),
  commitProductBatchImportSession({
    auth,
    sessionId,
    requestMetadata: { userAgent: "product-batch-concurrency-test-B" },
  }),
]);

const fulfilled = attempts.filter(
  (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof commitProductBatchImportSession>>> =>
    result.status === "fulfilled",
);
const rejected = attempts.filter(
  (result): result is PromiseRejectedResult => result.status === "rejected",
);

assert.equal(fulfilled.length, 1, "Tepat satu concurrent commit harus berhasil.");
assert.equal(rejected.length, 1, "Tepat satu concurrent commit harus ditolak.");
assert.ok(
  rejected[0]!.reason instanceof ProductBatchImportCommitError &&
    rejected[0]!.reason.code === "SESSION_NOT_READY",
  `Concurrent loser harus ditolak oleh status guard, bukan membuat commit kedua: ${String(rejected[0]!.reason)}`,
);

const [after] = await db
  .select({
    status: productBatchImportSessions.status,
    committedMasterCount: productBatchImportSessions.committedMasterCount,
    committedItemCount: productBatchImportSessions.committedItemCount,
  })
  .from(productBatchImportSessions)
  .where(eq(productBatchImportSessions.id, sessionId))
  .limit(1);
assert.ok(after);
assert.equal(after.status, "completed");
assert.equal(after.committedMasterCount, fulfilled[0]!.value.committedMasterCount);
assert.equal(after.committedItemCount, fulfilled[0]!.value.committedItemCount);

console.log("Concurrency Product Batch Import commit berhasil.");
console.log("- Dua commit dijalankan bersamaan; tepat satu berhasil dan satu ditolak status guard.");
console.log(`- Session completed dengan ${after.committedMasterCount} master dan ${after.committedItemCount} item.`);
console.log("- Jalankan check:product-batch-commit:live untuk verifikasi barcode/movement/media akhir.");
