import { config as loadDotenv } from "dotenv";

const envArg = process.argv.find((arg) => arg.startsWith("--env-file="));
loadDotenv({ path: envArg?.slice("--env-file=".length) ?? ".env", quiet: true });

const [{ pool }, { runProductBatchImportMaintenance }] = await Promise.all([
  import("@/db"),
  import("@/features/product-batch-import/maintenance-service"),
]);

try {
  const result = await runProductBatchImportMaintenance({ dryRun: true });
  console.log("Pemeriksaan Product Batch Import maintenance live berhasil.");
  console.log(`- Staging: ${result.storage.objectCount} object / ${result.storage.totalBytes} byte.`);
  console.log(`- Disk used: ${result.storage.diskUsedPercent ?? "n/a"}%.`);
  console.log(`- Expired candidates: ${result.expiredSessions}.`);
  console.log(`- Stale committing: ${result.staleCommittingSessions.length}.`);
  console.log(`- Completed evidence anomalies: ${result.completedEvidenceAnomalies}.`);
  console.log(`- Issues terdeteksi: ${result.issues.length}.`);
  if (result.cleanupFailures > 0) {
    throw new Error("Dry-run maintenance melaporkan cleanup failure yang tidak diharapkan.");
  }
} finally {
  await pool.end();
}
