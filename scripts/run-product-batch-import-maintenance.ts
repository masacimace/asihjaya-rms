import { config as loadDotenv } from "dotenv";

function readArg(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length) ?? null;
}

const envFile = readArg("--env-file") ?? ".env";
const dryRun = process.argv.includes("--dry-run");
loadDotenv({ path: envFile, quiet: true });

const [{ pool }, { runProductBatchImportMaintenance }] = await Promise.all([
  import("@/db"),
  import("@/features/product-batch-import/maintenance-service"),
]);

try {
  const result = await runProductBatchImportMaintenance({ dryRun });
  console.log(
    JSON.stringify({
      event: "product_batch_import_maintenance_result",
      outcome: result.cleanupFailures > 0 ? "completed_with_errors" : "success",
      ...result,
    }),
  );
  if (result.cleanupFailures > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    JSON.stringify({
      event: "product_batch_import_maintenance_fatal",
      outcome: "failed",
      errorCode:
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code ?? "MAINTENANCE_FATAL")
          : "MAINTENANCE_FATAL",
      message:
        error instanceof Error
          ? error.message.replace(/[\r\n]+/g, " ").slice(0, 1_000)
          : "Unknown Product Batch Import maintenance failure",
    }),
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
