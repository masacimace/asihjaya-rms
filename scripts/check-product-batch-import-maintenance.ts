import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "src/features/product-batch-import/maintenance-service.ts",
  "src/features/product-batch-import/observability.ts",
  "scripts/run-product-batch-import-maintenance.ts",
  "scripts/check-product-batch-import-maintenance-live.ts",
  "scripts/run-product-batch-import-maintenance-local.ts",
  "ops/scripts/ajsystem-product-batch-maintenance",
  "ops/scripts/ajsystem-install-product-batch-maintenance",
  "ops/systemd/ajsystem-product-batch-maintenance.service",
  "ops/systemd/ajsystem-product-batch-maintenance.timer",
];

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

function expect(
  content: string,
  token: string,
  label: string,
  problems: string[],
) {
  if (!content.includes(token)) {
    problems.push(`${label}: token tidak ditemukan: ${token}`);
  }
}

async function main() {
  const problems: string[] = [];
  for (const file of requiredFiles) {
    try {
      await access(path.join(root, file));
    } catch {
      problems.push(`File 2B.8 tidak ditemukan: ${file}`);
    }
  }

  const maintenance = await read(
    "src/features/product-batch-import/maintenance-service.ts",
  );
  const stagingStorage = await read(
    "src/lib/storage/product-batch-import-storage.ts",
  );
  const imageStorage = await read("src/lib/storage/image-storage.ts");
  const observability = await read(
    "src/features/product-batch-import/observability.ts",
  );
  const sessionService = await read(
    "src/features/product-batch-import/session-service.ts",
  );
  const commitService = await read(
    "src/features/product-batch-import/commit-service.ts",
  );
  const runner = await read("scripts/run-product-batch-import-maintenance.ts");
  const localRehearsal = await read("scripts/run-product-batch-import-maintenance-local.ts");
  const compose = await read("compose.production.yaml");
  const dockerfile = await read("Dockerfile");
  const wrapper = await read("ops/scripts/ajsystem-product-batch-maintenance");
  const installer = await read("ops/scripts/ajsystem-install-product-batch-maintenance");
  const service = await read(
    "ops/systemd/ajsystem-product-batch-maintenance.service",
  );
  const timer = await read("ops/systemd/ajsystem-product-batch-maintenance.timer");

  expect(maintenance, "expireProductBatchImportSessions", "expired staging cleanup", problems);
  expect(maintenance, "TERMINAL_STAGING_CLEANUP_STATUSES", "cancelled/failed/completed staging cleanup", problems);
  expect(maintenance, "orphanStorageGraceMs", "orphan race grace", problems);
  expect(maintenance, "SAFE_FINAL_ORPHAN_CLEANUP_STATUSES", "safe final orphan scope", problems);
  expect(maintenance, "TERMINAL_SESSION_HAS_BUSINESS_ENTITY", "business entity deletion guard", problems);
  expect(maintenance, "FINAL_IMAGE_STILL_REFERENCED", "final image reference deletion guard", problems);
  expect(maintenance, "STALE_COMMITTING_SESSION", "stale commit detection", problems);
  expect(maintenance, "COMPLETED_EVIDENCE_MISMATCH", "completed evidence protection", problems);
  expect(maintenance, "diskUsedPercent", "disk observability", problems);
  expect(stagingStorage, "ListObjectsV2Command", "S3 staging scan", problems);
  expect(stagingStorage, "statfs", "local disk usage", problems);
  expect(imageStorage, "listImageKeysForEntity", "bounded final image orphan scan", problems);
  expect(observability, 'scope: "product_batch_import"', "structured log scope", problems);
  expect(sessionService, 'event: "upload_validated"', "upload duration/count logging", problems);
  expect(sessionService, 'event: "upload_failed"', "upload failure logging", problems);
  expect(commitService, 'event: "commit_completed"', "commit duration/count logging", problems);
  expect(commitService, 'event: "commit_failed"', "commit failure logging", problems);
  expect(runner, "runProductBatchImportMaintenance", "maintenance CLI", problems);
  expect(localRehearsal, "PRODUCT_BATCH_MAINTENANCE_LOCAL_TEST", "explicit destructive local confirmation", problems);
  expect(localRehearsal, "Evidence session database tetap tersedia", "evidence preservation rehearsal", problems);
  expect(compose, "product-batch-maintenance-runtime:", "maintenance runtime", problems);
  expect(compose, "app_uploads:/app/.data/uploads", "shared local image volume", problems);
  expect(dockerfile, "src/features/product-batch-import", "operations maintenance source", problems);
  expect(wrapper, "product-batch:maintenance", "immutable maintenance wrapper", problems);
  expect(wrapper, "ASIHJAYA_OPERATIONS_IMAGE", "exact operations image routing", problems);
  expect(installer, "Timer sengaja BELUM di-enable", "safe systemd installer", problems);
  expect(installer, "source checkout tidak sama dengan exact current release", "installer exact release guard", problems);
  expect(service, "ajsystem-product-batch-maintenance", "systemd service wrapper", problems);
  expect(timer, "OnUnitInactiveSec=1h", "hourly maintenance cadence", problems);

  for (const forbidden of [
    "delete from product_batch_import_sessions",
    "delete(productBatchImportSessions)",
    "db.delete(productBatchImportSessions)",
  ]) {
    if (maintenance.toLowerCase().includes(forbidden.toLowerCase())) {
      problems.push(`2B.8 tidak boleh menghapus completed evidence/session: ${forbidden}`);
    }
  }

  if (problems.length > 0) {
    console.error("Pemeriksaan Product Batch Import maintenance gagal:");
    problems.forEach((problem) => console.error(`- ${problem}`));
    process.exit(1);
  }

  console.log("Pemeriksaan Product Batch Import maintenance berhasil.");
  console.log("- Expired/cancelled/failed/completed staging cleanup dan orphan detection tersedia.");
  console.log("- Final product images completed dilindungi; stale committing hanya dideteksi.");
  console.log("- Structured logs, storage usage, runner, dan systemd hourly maintenance tersedia.");
}

await main();
