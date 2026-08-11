import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "src/features/product-batch-import/result-queries.ts",
  "src/features/product-batch-import/label-service.ts",
  "src/components/products/product-batch-import-labels.tsx",
  "src/lib/hardware/label-target.ts",
  "src/app/(admin)/admin/produk/import/[sessionId]/result/route.ts",
  "src/app/(admin)/admin/produk/import/history/page.tsx",
];

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

function expect(content: string, token: string, label: string, problems: string[]) {
  if (!content.includes(token)) problems.push(`${label}: token tidak ditemukan: ${token}`);
}

async function main() {
  const problems: string[] = [];
  for (const file of requiredFiles) {
    try {
      await access(path.join(root, file));
    } catch {
      problems.push(`File 2B.7 tidak ditemukan: ${file}`);
    }
  }

  const resultQueries = await read("src/features/product-batch-import/result-queries.ts");
  const labelService = await read("src/features/product-batch-import/label-service.ts");
  const labels = await read("src/components/products/product-batch-import-labels.tsx");
  const labelTarget = await read("src/lib/hardware/label-target.ts");
  const resultRoute = await read("src/app/(admin)/admin/produk/import/[sessionId]/result/route.ts");
  const historyPage = await read("src/app/(admin)/admin/produk/import/history/page.tsx");
  const sessionPage = await read("src/app/(admin)/admin/produk/import/[sessionId]/page.tsx");
  const actions = await read("src/app/actions/product-batch-import.ts");

  expect(resultQueries, "committedProductMasterId", "committed master result query", problems);
  expect(resultQueries, "committedProductItemId", "committed item result query", problems);
  expect(resultQueries, "generatedBarcode", "generated identifier evidence", problems);
  expect(resultQueries, 'sourceType, "product_batch_import"', "session-scoped label jobs", problems);
  expect(resultRoute, "createXlsxResponse", "formula-safe result workbook", problems);
  expect(resultRoute, 'name: "IMPORT_SUMMARY"', "result summary sheet", problems);
  expect(resultRoute, 'name: "CREATED_MASTERS"', "created masters sheet", problems);
  expect(resultRoute, 'name: "CREATED_ITEMS"', "created items sheet", problems);
  expect(resultRoute, 'name: "WARNINGS"', "warning sheet", problems);
  expect(labelService, 'hasPermission(input.auth, "inventory.print_label")', "label permission", problems);
  expect(labelService, "buildInventoryLabelPayloadV2", "existing inventory label payload", problems);
  expect(labelService, "createHardwareJobV2InTransaction", "existing Hardware Hub producer", problems);
  expect(labelService, 'jobType: "print_label_sato"', "existing SATO job type", problems);
  expect(labelService, 'sourceType: "product_batch_import"', "batch label source", problems);
  expect(labelService, "batch-label:", "label idempotency key", problems);
  expect(labelService, "getLabelHardwareTargets", "capable Hardware Agent target resolver", problems);
  expect(labelService, "targetAgentId: target.agentId", "exact Hardware Agent target", problems);
  expect(labelTarget, "registers.isHardwareHub", "Hardware Hub register guard", problems);
  expect(labelTarget, '"print_label_sato"', "label capability guard", problems);
  expect(labelTarget, 'agentStatus === "online"', "prefer online Hardware Agent", problems);
  expect(labels, "Print selected", "selected labels", problems);
  expect(labels, "Print all eligible", "all labels", problems);
  expect(labels, "reprint", "reprint guidance", problems);
  expect(actions, "printProductBatchImportLabelsAction", "label server action", problems);
  expect(sessionPage, "/result", "result workbook UI", problems);
  expect(sessionPage, "ProductBatchImportLabels", "label UI on completed session", problems);
  expect(sessionPage, "/admin/inventaris/item/", "created item links", problems);
  expect(historyPage, "getProductBatchImportHistory", "history query", problems);

  for (const forbidden of [
    "buildNewLabelPayload",
    "print_label_batch_custom",
    "MAX(barcode)",
  ]) {
    if ([labelService, labels, actions].some((content) => content.includes(forbidden))) {
      problems.push(`2B.7 tidak boleh membuat label/identifier system baru: ${forbidden}`);
    }
  }

  if (problems.length) {
    console.error("Pemeriksaan Product Batch Import result/label gagal:");
    problems.forEach((problem) => console.error(`- ${problem}`));
    process.exit(1);
  }

  console.log("Pemeriksaan Product Batch Import result/label berhasil.");
  console.log("- Result workbook memakai committed staging evidence dan formula-safe XLSX utility.");
  console.log("- Print selected/all/reprint memakai print_label_sato + Hardware Hub contract existing.");
  console.log("- History/session completed dapat dibuka ulang tanpa membuat label system baru.");
}

await main();
