import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "src/app/(admin)/admin/produk/import/[sessionId]/page.tsx",
  "src/app/(admin)/admin/produk/import/[sessionId]/errors/route.ts",
  "src/app/(admin)/admin/produk/import/[sessionId]/media/[mediaId]/route.ts",
  "src/components/products/product-batch-import-v2-session.tsx",
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
      problems.push(`File UI Product Batch Import tidak ditemukan: ${file}`);
    }
  }

  const page = await read("src/app/(admin)/admin/produk/import/[sessionId]/page.tsx");
  const importPage = await read("src/app/(admin)/admin/produk/import/page.tsx");
  const upload = await read("src/components/products/product-batch-import-upload.tsx");
  const v2Session = await read("src/components/products/product-batch-import-v2-session.tsx");
  const legacyActions = await read("src/components/products/product-batch-import-session-actions.tsx");
  const queries = await read("src/features/product-batch-import/preview-queries.ts");
  const mediaRoute = await read("src/app/(admin)/admin/produk/import/[sessionId]/media/[mediaId]/route.ts");
  const errorRoute = await read("src/app/(admin)/admin/produk/import/[sessionId]/errors/route.ts");
  const uploadRoute = await read("src/app/api/admin/product-batch-import/upload/route.ts");

  expect(page, 'requirePermission("products.batch_import")', "session permission", problems);
  expect(page, "preview.session.templateVersion === 2", "v2 session branch", problems);
  expect(page, "ProductBatchImportV2Session", "v2 simplified session UI", problems);
  expect(v2Session, "Import selesai", "v2 completed UX", problems);
  expect(v2Session, "File perlu diperbaiki", "v2 validation error UX", problems);
  expect(v2Session, "Import gagal diproses", "v2 system failure UX", problems);
  expect(v2Session, "/errors", "v2 error workbook link", problems);
  expect(v2Session, "ProductBatchImportLabels", "existing label UI on v2 result", problems);

  expect(upload, "Upload & Import", "single-step upload action", problems);
  expect(upload, "Gelang Rantai Kaki.xlsx", "arbitrary XLSX filename guidance", problems);
  expect(upload, "Google Sheets & Excel tetap didukung", "Google Sheets/Excel guidance", problems);
  expect(upload, "Compatibility ZIP", "ZIP compatibility guidance", problems);
  expect(upload, "tepat satu file .xlsx", "arbitrary root XLSX ZIP guidance", problems);
  expect(upload, "router.push(`/admin/produk/import/${payload.session.id}`)", "persistent session redirect", problems);
  expect(importPage, "satu worksheet PRODUCTS", "single-sheet official guidance", problems);
  expect(importPage, "products.xlsx", "official template filename", problems);

  expect(uploadRoute, "session.templateVersion === 2", "v2 auto-commit detection", problems);
  expect(uploadRoute, "commitProductBatchImportSession", "v2 atomic auto-commit", problems);
  expect(uploadRoute, 'status: commitResult ? "completed" : commitFailure ? "failed" : session.status', "failed session handoff", problems);

  // V1 compatibility keeps the old explicit review/confirmation path only for legacy files.
  expect(legacyActions, "Commit Product Batch Import?", "v1 compatibility confirmation", problems);
  expect(legacyActions, 'name="confirmCommit"', "v1 compatibility confirmation field", problems);

  expect(queries, "productBatchImportMasterRows", "staging master query", problems);
  expect(queries, "productBatchImportItemRows", "staging item query", problems);
  expect(queries, "productBatchImportMedia", "staging media query", problems);
  expect(queries, "auth.organization.id", "organization isolation", problems);
  expect(mediaRoute, "readProductBatchImportStagingFile", "private staging image read", problems);
  expect(mediaRoute, "readImageFile", "completed final image read", problems);
  expect(mediaRoute, '"X-Content-Type-Options": "nosniff"', "media nosniff", problems);
  expect(errorRoute, "preview.session.templateVersion === 2", "v2 error workbook branch", problems);
  expect(errorRoute, 'name: "PRODUCTS"', "v2 simplified error sheet", problems);
  expect(errorRoute, 'name: "WARNINGS"', "warning sheet", problems);
  expect(errorRoute, 'name: "MASTER_ERRORS"', "v1 master error compatibility", problems);
  expect(errorRoute, 'name: "ITEM_ERRORS"', "v1 item error compatibility", problems);

  for (const forbidden of [
    "Metode A — ZIP + folder foto",
    "Metode B — Single XLSX + gambar embedded",
    "Compress isi folder batch",
  ]) {
    if (upload.includes(forbidden)) {
      problems.push(`UX v2 tidak boleh kembali ke instruksi berlapis lama: ${forbidden}`);
    }
  }

  if (problems.length) {
    console.error("Pemeriksaan Product Batch Import UI gagal:");
    problems.forEach((problem) => console.error(`- ${problem}`));
    process.exit(1);
  }

  console.log("Pemeriksaan Product Batch Import UI berhasil.");
  console.log("- V2 memakai single XLSX + auto commit, validation error sederhana, dan failed-session UX terpisah.");
  console.log("- V1 preview/confirmation tetap tersedia sebagai compatibility path.");
}

await main();
