import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "src/app/(admin)/admin/produk/import/[sessionId]/page.tsx",
  "src/app/(admin)/admin/produk/import/[sessionId]/errors/route.ts",
  "src/app/(admin)/admin/produk/import/[sessionId]/media/[mediaId]/route.ts",
  "src/components/products/product-batch-import-session-actions.tsx",
  "src/features/product-batch-import/preview-queries.ts",
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
      problems.push(`File UI 2B.5 tidak ditemukan: ${file}`);
    }
  }

  const page = await read("src/app/(admin)/admin/produk/import/[sessionId]/page.tsx");
  const upload = await read("src/components/products/product-batch-import-upload.tsx");
  const actions = await read("src/components/products/product-batch-import-session-actions.tsx");
  const queries = await read("src/features/product-batch-import/preview-queries.ts");
  const mediaRoute = await read("src/app/(admin)/admin/produk/import/[sessionId]/media/[mediaId]/route.ts");
  const errorRoute = await read("src/app/(admin)/admin/produk/import/[sessionId]/errors/route.ts");

  expect(page, 'requirePermission("products.batch_import")', "preview permission", problems);
  expect(page, 'view === "masters"', "master preview", problems);
  expect(page, 'view === "items"', "item preview", problems);
  expect(page, 'view === "images"', "image preview", problems);
  expect(page, 'view === "issues"', "issue preview", problems);
  expect(page, "Foto master fallback", "effective image indicator", problems);
  expect(page, "overflow-x-clip", "page horizontal overflow guard", problems);
  expect(page, "/errors", "error workbook link", problems);
  expect(actions, "invalidRows === 0", "commit readiness guard", problems);
  expect(actions, "commitProductBatchImportSessionAction", "atomic commit action", problems);
  expect(actions, "Commit Product Batch Import?", "commit confirmation UI", problems);
  expect(actions, 'name="confirmCommit"', "explicit irreversible confirmation", problems);
  expect(upload, "router.push(`/admin/produk/import/${payload.session.id}`)", "persistent preview redirect", problems);
  expect(upload, "Buka session existing", "duplicate session recovery", problems);
  expect(upload, "Metode A — ZIP + folder foto", "operator ZIP method guidance", problems);
  expect(upload, "Metode B — Single XLSX + gambar embedded", "operator embedded XLSX guidance", problems);
  expect(upload, "Compress isi folder batch", "parent-folder ZIP guidance", problems);
  expect(upload, "Upload & validasi ZIP/XLSX", "dual upload action", problems);
  expect(upload, "Google Sheets", "Google Sheets guidance", problems);
  expect(upload, "Insert image in cell", "Google Sheets Picture in Cell guidance", problems);
  expect(upload, "Place in Cell", "Microsoft Excel Picture in Cell guidance", problems);
  expect(upload, "Cara memperbaiki", "friendly error remediation", problems);
  expect(upload, "Detail teknis", "technical error disclosure", problems);
  expect(upload, "PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory", "root master image folder", problems);
  expect(upload, "PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory", "root physical image folder", problems);
  if (upload.includes("images/masters") || upload.includes("images/physical")) {
    problems.push("Upload UX tidak boleh lagi menampilkan layout images/* lama.");
  }
  expect(queries, "productBatchImportMasterRows", "staging master query", problems);
  expect(queries, "productBatchImportItemRows", "staging item query", problems);
  expect(queries, "productBatchImportMedia", "staging media query", problems);
  expect(queries, "auth.organization.id", "organization isolation", problems);
  expect(mediaRoute, "readProductBatchImportStagingFile", "private staging image read", problems);
  expect(mediaRoute, "readImageFile", "completed final image read", problems);
  expect(mediaRoute, '"X-Content-Type-Options": "nosniff"', "media nosniff", problems);
  expect(errorRoute, "createXlsxResponse", "error workbook export", problems);
  expect(errorRoute, 'name: "MASTER_ERRORS"', "master error sheet", problems);
  expect(errorRoute, 'name: "ITEM_ERRORS"', "item error sheet", problems);
  expect(errorRoute, 'name: "WARNINGS"', "warning sheet", problems);

  for (const forbidden of [
    "insert(productMasters)",
    "insert(productItems)",
    "insert(itemBarcodes)",
    "getNextProductItemIdentifiers",
  ]) {
    if ([page, upload, actions, queries, mediaRoute, errorRoute].some((content) => content.includes(forbidden))) {
      problems.push(`2B.5 tidak boleh melakukan commit business data: ${forbidden}`);
    }
  }

  if (problems.length) {
    console.error("Pemeriksaan Product Batch Import UI gagal:");
    problems.forEach((problem) => console.error(`- ${problem}`));
    process.exit(1);
  }

  console.log("Pemeriksaan Product Batch Import UI berhasil.");
  console.log("- Preview session memakai staging DB dan organization isolation.");
  console.log("- Master/item/image/issues, fallback image, filters, dan error workbook tersedia.");
  console.log("- Upload mengarah ke preview persistent; ready session mempunyai confirmation flow menuju atomic commit 2B.6.");
}

await main();
