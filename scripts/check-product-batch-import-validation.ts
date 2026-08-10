import assert from "node:assert/strict";

import sharp from "sharp";

import type { AuthContext } from "../src/lib/auth/session";
import { buildXlsxBuffer } from "../src/lib/export-files";
import { parseProductBatchImportPackage } from "../src/features/product-batch-import/package-parser";
import { buildProductBatchImportTemplateSheets } from "../src/features/product-batch-import/template";
import { validateProductBatchImportPackage } from "../src/features/product-batch-import/validation";
import { buildTestZip } from "./lib/product-batch-import-test-zip";

function auth(permissionCodes: string[], outlet = true): AuthContext {
  return {
    session: { id: "00000000-0000-4000-8000-000000000001", expiresAt: new Date("2026-08-11T00:00:00Z") },
    organization: { id: "00000000-0000-4000-8000-000000000002", name: "Test", slug: "test", timezone: "Asia/Jakarta" },
    user: { id: "00000000-0000-4000-8000-000000000003", email: "test@example.com", username: "test", fullName: "Test" },
    roles: [],
    permissionCodes,
    outlets: outlet
      ? [{ id: "00000000-0000-4000-8000-000000000010", code: "OUTLET-01", name: "Outlet", isPrimary: true }]
      : [],
  };
}

async function jpeg() {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 170, b: 90 } } })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function packageFromSheets(sheets: ReturnType<typeof buildProductBatchImportTemplateSheets>) {
  const image = await jpeg();
  return parseProductBatchImportPackage(
    buildTestZip([
      { path: "products.xlsx", data: buildXlsxBuffer(sheets) },
      { path: "images/masters/MASTER-001.jpg", data: image },
      { path: "images/masters/MASTER-002.jpg", data: image },
      { path: "images/physical/ITEM-001.jpg", data: image },
    ]),
  );
}

const fullPermissions = [
  "products.batch_import",
  "products.manage",
  "inventory.receive",
  "pricing.manage",
];
const lookups = {
  categoriesByCode: new Map([
    ["BRACELET", { id: "00000000-0000-4000-8000-000000000020", code: "BRACELET" }],
    ["RING", { id: "00000000-0000-4000-8000-000000000021", code: "RING" }],
  ]),
  outletsByCode: new Map([
    ["OUTLET-01", { id: "00000000-0000-4000-8000-000000000010", code: "OUTLET-01" }],
  ]),
};

async function main() {
  const baseSheets = buildProductBatchImportTemplateSheets({
    generatedAt: new Date("2026-08-10T00:00:00Z"),
    includeSampleRows: true,
  });
  const parsed = await packageFromSheets(baseSheets);
  const valid = validateProductBatchImportPackage({
    workbook: parsed.workbook,
    images: parsed.images,
    lookups,
    auth: auth(fullPermissions),
  });
  assert.equal(valid.invalidRows, 0);
  assert.equal(valid.validMasterRows, 2);
  assert.equal(valid.validItemRows, 3);
  assert.ok(valid.itemRows.some((row) => row.validationWarnings.some((warning) => warning.code === "MASTER_IMAGE_FALLBACK")));
  assert.equal(valid.masterRows[1]?.normalizedPayload.status, "active");
  assert.equal(valid.itemRows[2]?.normalizedPayload.initial_availability, "draft");

  const noPricing = validateProductBatchImportPackage({
    workbook: parsed.workbook,
    images: parsed.images,
    lookups,
    auth: auth(fullPermissions.filter((permission) => permission !== "pricing.manage")),
  });
  assert.ok(noPricing.itemRows.some((row) => row.validationErrors.some((error) => error.code === "PERMISSION_PRICING_REQUIRED")));

  const noOutletAccess = validateProductBatchImportPackage({
    workbook: parsed.workbook,
    images: parsed.images,
    lookups,
    auth: auth(fullPermissions, false),
  });
  assert.ok(noOutletAccess.itemRows.some((row) => row.validationErrors.some((error) => error.code === "OUTLET_ACCESS_DENIED")));

  const duplicateSheets = buildProductBatchImportTemplateSheets({
    generatedAt: new Date("2026-08-10T00:00:00Z"),
    includeSampleRows: true,
  });
  duplicateSheets[2]!.rows[1]![0] = "ITEM-001";
  const duplicateParsed = await packageFromSheets(duplicateSheets);
  const duplicate = validateProductBatchImportPackage({
    workbook: duplicateParsed.workbook,
    images: duplicateParsed.images,
    lookups,
    auth: auth(fullPermissions),
  });
  const duplicateRows = duplicate.itemRows.filter((row) => row.validationErrors.some((error) => error.code === "ROW_KEY_DUPLICATE"));
  assert.equal(duplicateRows.length, 2);
  assert.equal(new Set(duplicate.itemRows.map((row) => row.stagingRowKey)).size, duplicate.itemRows.length);

  console.log("Pemeriksaan Product Batch Import validation berhasil.");
  console.log("- Default master/item, category/outlet resolve, pricing permission, dan effective-image fallback valid.");
  console.log("- Duplicate row key tersimpan sebagai validation error tanpa melanggar staging unique key.");
}

void main();
