import { rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const retired = [
  "src/app/(admin)/admin/migrasi-produk/[batchId]/cutover",
  "src/app/(admin)/admin/migrasi-produk/[batchId]/mapping",
  "src/app/(admin)/admin/migrasi-produk/[batchId]/rekonsiliasi",
  "src/app/(admin)/admin/migrasi-produk/[batchId]/review",
  "src/app/(admin)/admin/migrasi-produk/[batchId]/sesi",
  "src/app/(admin)/admin/migrasi-produk/[batchId]/sold",
  "src/app/(pos)/pos/migrasi-barang",

  "src/app/actions/legacy-migration-cutover.ts",
  "src/app/actions/legacy-migration-management.ts",
  "src/app/actions/legacy-migration-reconciliation.ts",
  "src/app/actions/legacy-migration-review.ts",
  "src/app/actions/legacy-migration-sold.ts",
  "src/app/actions/legacy-migration-verification.ts",

  "src/features/legacy-migration/components/migration-control-center.tsx",
  "src/features/legacy-migration/components/mobile-migration-scanner.tsx",
  "src/features/legacy-migration/control-center-queries.ts",
  "src/features/legacy-migration/control-center-rules.ts",
  "src/features/legacy-migration/cutover-contracts.ts",
  "src/features/legacy-migration/cutover-queries.ts",
  "src/features/legacy-migration/cutover-rules.ts",
  "src/features/legacy-migration/cutover-service.ts",
  "src/features/legacy-migration/management-queries.ts",
  "src/features/legacy-migration/reconciliation-contracts.ts",
  "src/features/legacy-migration/reconciliation-queries.ts",
  "src/features/legacy-migration/reconciliation-rules.ts",
  "src/features/legacy-migration/review-contracts.ts",
  "src/features/legacy-migration/review-queries.ts",
  "src/features/legacy-migration/review-rules.ts",
  "src/features/legacy-migration/sold-contracts.ts",
  "src/features/legacy-migration/sold-queries.ts",
  "src/features/legacy-migration/sold-rules.ts",
  "src/features/legacy-migration/verification-contracts.ts",
  "src/features/legacy-migration/verification-queries.ts",
  "src/features/legacy-migration/verification-rules.ts",
  "src/features/legacy-migration/pricing-rules.ts",

  "tests/integration/legacy-migration-cutover-suite.ts",
  "scripts/run-legacy-migration-cutover-tests.ts",
  "scripts/run-legacy-migration-cutover-local.ts",
];

let removed = 0;
for (const relative of retired) {
  try {
    await rm(path.join(root, relative), { recursive: true, force: true });
    removed += 1;
  } catch (error) {
    console.warn(`Tidak dapat membersihkan ${relative}:`, error);
  }
}

console.log(
  `R3 cleanup selesai: ${removed} route/file stock-opname, review, reconciliation, dan cutover legacy dibersihkan.`,
);
