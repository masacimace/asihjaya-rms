import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const retiredPaths = [
  "scripts/check-payment-reconciliation.ts",
  "scripts/check-settlement-import.ts",
  "scripts/check-settlement-import-mobile-layout.ts",
  "scripts/cleanup-payment-evidence.ts",
  "src/app/(admin)/admin/keuangan/rekonsiliasi",
  "src/app/(admin)/admin/operasional/approval",
  "src/app/actions/approvals.ts",
  "src/app/actions/payment-reconciliation.ts",
  "src/app/actions/settlement-import.ts",
  "src/app/media/payment-evidence",
  "src/app/media/payment-reconciliation",
  "src/app/media/settlement-import",
  "src/components/approvals",
  "src/components/layout/approval-drawer.tsx",
  "src/components/reconciliation",
  "src/features/approvals",
  "src/features/notifications/approvals.ts",
  "src/features/notifications/reconciliation.ts",
  "src/features/pos/checkout/manual-payment-review-service.ts",
  "src/features/reconciliation",
  "src/lib/storage/payment-evidence-storage.ts",
  "src/lib/storage/reconciliation-evidence-storage.ts",
  "src/lib/storage/settlement-import-storage.ts",
];

for (const retiredPath of retiredPaths) {
  await rm(resolve(process.cwd(), retiredPath), { recursive: true, force: true });
}

console.log(
  `R1 cleanup selesai: ${retiredPaths.length} file/folder approval, evidence, dan payment reconciliation legacy dibersihkan.`,
);
