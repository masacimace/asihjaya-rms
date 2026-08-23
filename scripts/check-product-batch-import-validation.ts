import assert from "node:assert/strict";

import sharp from "sharp";

import type { AuthContext } from "../src/lib/auth/session";
import { buildXlsxBuffer } from "../src/lib/export-files";
import { parseProductBatchImportPackage } from "../src/features/product-batch-import/package-parser";
import { buildProductBatchImportTemplateSheets } from "../src/features/product-batch-import/template";
import { validateProductBatchImportPackage } from "../src/features/product-batch-import/validation";
import { buildLegacyProductBatchImportTemplateSheets } from "./lib/product-batch-import-v1-template";
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

async function legacyPackageFromSheets(
  sheets: ReturnType<typeof buildLegacyProductBatchImportTemplateSheets>,
) {
  const image = await jpeg();
  return parseProductBatchImportPackage(
    buildTestZip([
      { path: "products.xlsx", data: buildXlsxBuffer(sheets) },
      { path: "masters/MASTER-001.jpg", data: image },
      { path: "masters/MASTER-002.jpg", data: image },
      { path: "physical/ITEM-001.jpg", data: image },
    ]),
  );
}

const fullPermissions = [
  "products.batch_import",
  "products.manage",
  "inventory.receive",
  "pricing.manage",
];

const braceletCategory = {
  id: "00000000-0000-4000-8000-000000000020",
  code: "BRACELET",
  name: "Gelang",
  isActive: true,
};
const ringCategory = {
  id: "00000000-0000-4000-8000-000000000021",
  code: "RING",
  name: "Cincin",
  isActive: true,
};
const outlet = {
  id: "00000000-0000-4000-8000-000000000010",
  code: "OUTLET-01",
};

const legacyLookups = {
  categoriesByCode: new Map([
    [braceletCategory.code, braceletCategory],
    [ringCategory.code, ringCategory],
  ]),
  categoriesByLookupKey: new Map<string, readonly (typeof braceletCategory)[]>(),
  mastersByCategoryAndName: new Map(),
  outletsByCode: new Map([[outlet.code, outlet]]),
};

const v2Lookups = {
  categoriesByCode: new Map([[ringCategory.code, ringCategory]]),
  categoriesByLookupKey: new Map<string, readonly (typeof ringCategory)[]>([
    ["RING", [ringCategory]],
    ["CINCIN", [ringCategory]],
  ]),
  mastersByCategoryAndName: new Map([
    [
      `${ringCategory.id}:CINCIN ANAK`,
      [
        {
          id: "00000000-0000-4000-8000-000000000030",
          categoryId: ringCategory.id,
          name: "Cincin Anak",
          status: "active" as const,
        },
      ],
    ],
  ]),
  outletsByCode: new Map([[outlet.code, outlet]]),
};

async function main() {
  // Compatibility v1 remains covered.
  const baseSheets = buildLegacyProductBatchImportTemplateSheets({
    generatedAt: new Date("2026-08-10T00:00:00Z"),
    includeSampleRows: true,
  });
  const parsed = await legacyPackageFromSheets(baseSheets);
  const valid = validateProductBatchImportPackage({
    workbook: parsed.workbook,
    images: parsed.images,
    lookups: legacyLookups,
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
    lookups: legacyLookups,
    auth: auth(fullPermissions.filter((permission) => permission !== "pricing.manage")),
  });
  assert.ok(noPricing.itemRows.some((row) => row.validationErrors.some((error) => error.code === "PERMISSION_PRICING_REQUIRED")));

  const duplicateSheets = buildLegacyProductBatchImportTemplateSheets({
    generatedAt: new Date("2026-08-10T00:00:00Z"),
    includeSampleRows: true,
  });
  duplicateSheets[2]!.rows[1]![0] = "ITEM-001";
  const duplicateParsed = await legacyPackageFromSheets(duplicateSheets);
  const duplicate = validateProductBatchImportPackage({
    workbook: duplicateParsed.workbook,
    images: duplicateParsed.images,
    lookups: legacyLookups,
    auth: auth(fullPermissions),
  });
  const duplicateRows = duplicate.itemRows.filter((row) =>
    row.validationErrors.some((error) => error.code === "ROW_KEY_DUPLICATE"),
  );
  assert.equal(duplicateRows.length, 2);
  assert.equal(new Set(duplicate.itemRows.map((row) => row.stagingRowKey)).size, duplicate.itemRows.length);

  // V2: one row PRODUCTS, existing category/master reuse, no pricing permission required.
  const v2Sheets = buildProductBatchImportTemplateSheets({ includeSampleRows: true });
  const v2Workbook = buildXlsxBuffer(v2Sheets);
  const v2Parsed = await parseProductBatchImportPackage(v2Workbook, {
    fileName: "Cincin Anak Agustus.xlsx",
  });
  const v2 = validateProductBatchImportPackage({
    workbook: v2Parsed.workbook,
    images: v2Parsed.images,
    lookups: v2Lookups,
    auth: auth(["products.batch_import", "products.manage", "inventory.receive"]),
  });
  assert.equal(v2.invalidRows, 0);
  assert.equal(v2.validMasterRows, 1);
  assert.equal(v2.validItemRows, 1);
  assert.equal(v2.masterRows[0]?.normalizedPayload._existing_product_master_id, "00000000-0000-4000-8000-000000000030");
  assert.equal(v2.itemRows[0]?.normalizedPayload.initial_availability, "available");
  assert.equal(v2.itemRows[0]?.normalizedPayload.condition, "good");
  assert.equal(v2.itemRows[0]?.normalizedPayload.selling_amount, null);
  assert.equal(v2.itemRows[0]?.normalizedPayload.price_per_gram, null);

  // New category/master is valid during validation and will be created atomically at commit.
  const newCategorySheets = buildProductBatchImportTemplateSheets({ includeSampleRows: true });
  newCategorySheets[0]!.rows[0]![0] = "Kategori Baru";
  newCategorySheets[0]!.rows[0]![1] = "Master Baru";
  const newCategoryParsed = await parseProductBatchImportPackage(buildXlsxBuffer(newCategorySheets), {
    fileName: "Master Baru.xlsx",
  });
  const newCategoryValidation = validateProductBatchImportPackage({
    workbook: newCategoryParsed.workbook,
    images: newCategoryParsed.images,
    lookups: {
      ...v2Lookups,
      categoriesByLookupKey: new Map(),
      mastersByCategoryAndName: new Map(),
    },
    auth: auth(["products.batch_import", "products.manage", "inventory.receive"]),
  });
  assert.equal(newCategoryValidation.invalidRows, 0);
  assert.equal(newCategoryValidation.masterRows[0]?.resolvedCategoryId, null);

  // Damaged/Rusak is intentionally blocked from direct AVAILABLE batch flow.
  const damagedSheets = buildProductBatchImportTemplateSheets({ includeSampleRows: true });
  damagedSheets[0]!.rows[0]![8] = "Rusak";
  const damagedParsed = await parseProductBatchImportPackage(buildXlsxBuffer(damagedSheets), {
    fileName: "Barang Rusak.xlsx",
  });
  const damaged = validateProductBatchImportPackage({
    workbook: damagedParsed.workbook,
    images: damagedParsed.images,
    lookups: v2Lookups,
    auth: auth(["products.batch_import", "products.manage", "inventory.receive"]),
  });
  assert.ok(
    damaged.itemRows[0]?.validationErrors.some(
      (error) => error.code === "ITEM_CONDITION_NOT_SELLABLE",
    ),
  );

  console.log("Pemeriksaan Product Batch Import validation berhasil.");
  console.log("- Compatibility v1 tetap tervalidasi termasuk pricing permission dan master-image fallback.");
  console.log("- V2 tidak membutuhkan pricing.manage, langsung available, dapat reuse/create category/master, dan menolak damaged.");
}

void main();
