import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  if (!existsSync(file)) throw new Error(`${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const checkout = read("src/app/actions/pos.ts");
const posQueries = read("src/features/pos/queries.ts");
const adminSales = read("src/features/sales/admin-queries.ts");
const customers = read("src/features/customers/queries.ts");
const publicHistory = read("src/features/customers/public-history.ts");
const buybackQueries = read("src/features/buybacks/queries.ts");
const buybackHistoryPanel = read(
  "src/components/buybacks/buyback-history-panel.tsx",
);
const buybackService = read("src/features/buybacks/service.ts");
const processingQueries = read("src/features/buybacks/processing-queries.ts");
const processingService = read("src/features/buybacks/processing-service.ts");
const saleClaim = read("src/features/pos/inventory-sale-claim.ts");
const saleTransactionService = read(
  "src/features/sales/transaction-service.ts",
);
const reportQueries = read("src/features/reports/queries.ts");
const saleReceipt = read(
  "src/features/sales/documents/receipt-certificate.ts",
);
const buybackReceipt = read(
  "src/features/buybacks/documents/buyback-receipt.ts",
);

// 1. Checkout freezes historical Sale identity and economics.
for (const marker of [
  "sku: item!.sku",
  "barcode: item!.barcode",
  "itemDisplayName: item!.itemDisplayName",
  "masterProductName: item!.masterProductName",
  "productName: item!.productName",
  "categoryName: item!.categoryName",
  "weightGram: pricing.transactionWeightGram",
  "storedWeightGram: pricing.storedWeightGram",
  "purityPercent: item!.purityPercent",
  "color: item!.color",
  "costAmountSnapshot: item!.costAmount",
]) {
  assert(
    checkout.includes(marker),
    `Sale checkout snapshot marker hilang: ${marker}`,
  );
}

// 2. Current POS only sells available good/used items at outlet.
assert(
  saleClaim.includes('eq(productItems.availability, "available")') &&
    saleClaim.includes(
      'inArray(productItems.condition, ["good", "used"])',
    ) &&
    saleClaim.includes('eq(productItems.locationState, "outlet")'),
  "POS sale claim lifecycle guard tidak lengkap.",
);

// 3. Sale history identity is snapshot-first.
const historicalFiles = [
  ["POS", posQueries],
  ["Admin Sale", adminSales],
  ["Customer", customers],
] as const;

for (const [label, source] of historicalFiles) {
  assert(
    source.includes(
      "coalesce(nullif(${saleItems.snapshot}->>'sku', ''), ${productItems.sku})",
    ),
    `${label}: historical SKU belum snapshot-first.`,
  );
  assert(
    source.includes(
      "coalesce(nullif(${saleItems.snapshot}->>'itemDisplayName', ''), nullif(${saleItems.snapshot}->>'productName', '')",
    ),
    `${label}: historical product name belum snapshot-first.`,
  );
  assert(
    source.includes(
      "coalesce(nullif(${saleItems.snapshot}->>'categoryName', ''), ${productCategories.name})",
    ),
    `${label}: historical category belum snapshot-first.`,
  );
}

assert(
  posQueries.includes(
    "coalesce(nullif(${saleItems.snapshot}->>'barcode', ''), ${productItems.barcode})",
  ) &&
    posQueries.includes(
      "coalesce(nullif(${saleItems.snapshot}->>'serialNumber', ''), ${productItems.serialNumber})",
    ),
  "POS Sale detail barcode/serial belum snapshot-first.",
);

assert(
  (adminSales.match(
    /coalesce\(nullif\(\$\{saleItems\.snapshot}->>'sku', ''\), \$\{productItems\.sku\}\)/g,
  ) ?? []).length >= 3,
  "Admin Sale list/export/detail belum seluruhnya snapshot-first.",
);

// Search an old sale by its event-time item identity even after current master changes.
assert(
  posQueries.includes(
    "sql`${saleItems.snapshot}->>'itemDisplayName' ilike ${searchPattern}`",
  ) &&
    adminSales.includes(
      "${saleItems.snapshot}->>'itemDisplayName' ilike ${pattern}",
    ),
  "Historical Sale search belum membaca snapshot identity.",
);

// 4. Public customer history already resolves code/image from snapshot.
assert(
  publicHistory.includes('readSnapshotString(snapshot, "barcode")') &&
    publicHistory.includes('readSnapshotString(snapshot, "sku")') &&
    publicHistory.includes('readSnapshotString(item.snapshot, "imageKey")') &&
    publicHistory.includes(
      "coalesce(nullif(${saleItems.snapshot}->>'itemDisplayName', ''), nullif(${saleItems.snapshot}->>'productName', '')",
    ),
  "Public customer Sale history belum snapshot-first.",
);

// 5. Buyback history is acquisition snapshot-first; current inventory is fallback only.
assert(
  buybackHistoryPanel.includes(
    'readSnapshot(item.snapshot, "displayName")',
  ) &&
    buybackHistoryPanel.includes(
      'readSnapshot(item.snapshot, "originalProductMasterName")',
    ) &&
    buybackHistoryPanel.includes("item.currentDisplayName"),
  "Buyback detail historical naming contract berubah.",
);

assert(
  buybackQueries.includes("snapshot: buybackItems.snapshot") &&
    buybackQueries.includes("processingType: buybackItemProcessings.processingType") &&
    buybackQueries.includes("processingStatus: buybackItemProcessings.status"),
  "Buyback history acquisition/processing snapshot contract tidak lengkap.",
);

// 6. Buyback completed is not saleable until processing completion.
assert(
  buybackService.includes('availability: "processing"'),
  "Buyback acquisition existing item harus masuk availability processing.",
);

assert(
  processingService.includes('availability: "available"') &&
    processingService.includes('condition: "used"') &&
    processingService.includes('locationState: "outlet"') &&
    processingService.includes("resultSnapshot") &&
    processingService.includes('status: "completed"'),
  "Processing completion harus menjadi satu-satunya admission ke inventory saleable.",
);

assert(
  processingQueries.includes("sourceSnapshot") &&
    processingQueries.includes("resultSnapshot"),
  "Processing history harus memisahkan snapshot sebelum dan sesudah.",
);

// 7. Sale receipt/refund/report retain event-time facts.
assert(
  saleReceipt.includes("type SaleItemSnapshot = {") &&
    saleReceipt.includes("itemDisplayName?: string | null") &&
    saleReceipt.includes("categoryName?: string | null"),
  "Sale receipt snapshot contract hilang.",
);

assert(
  buybackReceipt.includes('readSnapshotString(snapshot, "purityPercent")') &&
    buybackReceipt.includes('readSnapshotString(snapshot, "imageKey")'),
  "Buyback receipt tidak lagi snapshot-first.",
);

assert(
  saleTransactionService.includes(
    "coalesce(nullif(${saleItems.snapshot}->>'weightGram', ''), nullif(${saleItems.snapshot}->>'storedWeightGram', ''))",
  ),
  "Refund/return tidak lagi menggunakan sold-weight snapshot.",
);

const historicalWeightOccurrences =
  reportQueries.match(/saleItems\.snapshot}->>'weightGram'/g)?.length ?? 0;
assert(
  historicalWeightOccurrences >= 4 &&
    reportQueries.includes("saleItems.costAmountSnapshot"),
  "Historical report weight/cost snapshot invariant tidak lengkap.",
);

console.log(
  "OK: B4 Final Audit — Sale snapshot / Buyback snapshot / Processing snapshot / Current Inventory terpisah.",
);
