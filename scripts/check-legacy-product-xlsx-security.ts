import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import * as XLSX from "xlsx";

import {
  LEGACY_PRODUCT_IMPORT_MAX_COLUMNS,
  LEGACY_PRODUCT_IMPORT_MAX_FORMULA_LENGTH,
  LEGACY_PRODUCT_IMPORT_MAX_WORKSHEETS,
} from "../src/features/legacy-migration/contracts";
import {
  LegacyProductWorkbookError,
  parseLegacyProductWorkbook,
} from "../src/features/legacy-migration/xlsx-parser";

const SHEETJS_VERSION = "0.20.3";
const SHEETJS_URL =
  `https://cdn.sheetjs.com/xlsx-${SHEETJS_VERSION}/xlsx-${SHEETJS_VERSION}.tgz`;
const SHEETJS_VENDORED = `file:vendor/xlsx-${SHEETJS_VERSION}.tgz`;
const SHEETJS_INTEGRITY =
  "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==";

const requiredHeaders = [
  "No",
  "Kode Produk",
  "Kategori (*)",
  "Kode Master Produk (*)",
  "Nama Master Produk (*)",
  "Nama Produk Per SKU (*)",
  "Kadar Persen (*)",
  "Kadar Tukaran (*)",
  "Harga (*)",
  "Potongan / Gram (*)",
  "Berat / Gram (*)",
  "Warna (*)",
  "Foto (*)",
];

const validRow = [
  1,
  "003037",
  "Cincin",
  "CIN/01",
  "Cincin Nikah",
  "Cincin Test",
  40,
  48,
  980_000,
  25_000,
  2.1,
  "Kombinasi",
  "https://legacy.example.test/item.jpeg",
];

function createWorkbookBuffer(options?: {
  headers?: unknown[];
  row?: unknown[];
  worksheetCount?: number;
  mutateFirstWorksheet?: (worksheet: XLSX.WorkSheet) => void;
}): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([
    options?.headers ?? requiredHeaders,
    options?.row ?? validRow,
  ]);
  options?.mutateFirstWorksheet?.(worksheet);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Produk");

  const worksheetCount = options?.worksheetCount ?? 1;
  for (let index = 1; index < worksheetCount; index += 1) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([[`Worksheet ${index + 1}`]]),
      `Tambahan ${index}`,
    );
  }

  return Buffer.from(
    XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      compression: true,
    }),
  );
}

function expectWorkbookError(buffer: Buffer, messagePart: string): void {
  assert.throws(
    () => parseLegacyProductWorkbook(buffer),
    (error: unknown) => {
      assert.ok(
        error instanceof LegacyProductWorkbookError,
        "Parser harus mengembalikan error workbook yang aman untuk pengguna.",
      );
      assert.match(error.message, new RegExp(messagePart, "i"));
      return true;
    },
  );
}

type PackageJson = {
  dependencies?: Record<string, string>;
};

type PackageLockEntry = {
  version?: string;
  resolved?: string;
  integrity?: string;
};

type PackageLock = {
  packages?: Record<
    string,
    PackageLockEntry & {
      dependencies?: Record<string, string>;
    }
  >;
};

const packageJson = JSON.parse(
  readFileSync("package.json", "utf8"),
) as PackageJson;
const packageLock = JSON.parse(
  readFileSync("package-lock.json", "utf8"),
) as PackageLock;
const configuredDependency = packageJson.dependencies?.xlsx;
const lockEntry = packageLock.packages?.["node_modules/xlsx"];

assert.ok(
  configuredDependency === SHEETJS_URL ||
    configuredDependency === SHEETJS_VENDORED,
  "Dependency xlsx harus memakai distribusi resmi atau archive vendored SheetJS CE 0.20.3.",
);
assert.equal(
  packageLock.packages?.[""]?.dependencies?.xlsx,
  configuredDependency,
  "Root package-lock.json harus selaras dengan dependency xlsx pada package.json.",
);
assert.equal(lockEntry?.version, SHEETJS_VERSION);
assert.equal(
  lockEntry?.resolved,
  configuredDependency,
  "Resolved xlsx pada lockfile harus selaras dengan dependency yang dikonfigurasi.",
);

if (configuredDependency === SHEETJS_VENDORED) {
  const vendorArchive = `vendor/xlsx-${SHEETJS_VERSION}.tgz`;
  assert.ok(
    existsSync(vendorArchive),
    `Archive ${vendorArchive} belum tersedia. Jalankan npm run vendor:xlsx.`,
  );
  const vendoredIntegrity = `sha512-${createHash("sha512")
    .update(readFileSync(vendorArchive))
    .digest("base64")}`;
  assert.equal(
    lockEntry?.integrity,
    vendoredIntegrity,
    "Integrity xlsx vendored pada lockfile tidak cocok dengan archive lokal.",
  );
} else {
  assert.equal(
    lockEntry?.integrity,
    SHEETJS_INTEGRITY,
    "Integrity SheetJS resmi pada lockfile tidak cocok.",
  );
}

assert.equal(
  XLSX.version,
  SHEETJS_VERSION,
  `Runtime SheetJS harus menggunakan versi ${SHEETJS_VERSION}.`,
);

const parsed = parseLegacyProductWorkbook(createWorkbookBuffer());
assert.equal(parsed.rows.length, 1);
assert.equal(parsed.rows[0]?.normalizedBarcode, "003037");

expectWorkbookError(
  Buffer.from("bukan workbook XLSX", "utf8"),
  "tidak dikenali sebagai workbook XLSX",
);
expectWorkbookError(
  Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]),
  "tidak dapat dibaca atau rusak",
);

expectWorkbookError(
  createWorkbookBuffer({
    headers: [...requiredHeaders, "Catatan", "Catatan"],
    row: [...validRow, "A", "B"],
  }),
  "Header kolom terdeteksi lebih dari satu kali",
);

expectWorkbookError(
  createWorkbookBuffer({
    mutateFirstWorksheet: (worksheet) => {
      const lastColumn = XLSX.utils.encode_col(
        LEGACY_PRODUCT_IMPORT_MAX_COLUMNS,
      );
      worksheet["!ref"] = `A1:${lastColumn}2`;
    },
  }),
  `${LEGACY_PRODUCT_IMPORT_MAX_COLUMNS} kolom`,
);

expectWorkbookError(
  createWorkbookBuffer({
    worksheetCount: LEGACY_PRODUCT_IMPORT_MAX_WORKSHEETS + 1,
  }),
  `${LEGACY_PRODUCT_IMPORT_MAX_WORKSHEETS} worksheet`,
);

const longFormulaBuffer = createWorkbookBuffer({
  mutateFirstWorksheet: (worksheet) => {
    worksheet.M2 = {
      t: "s",
      v: "Lihat gambar",
      f: `HYPERLINK("https://legacy.example.test/${"x".repeat(
        LEGACY_PRODUCT_IMPORT_MAX_FORMULA_LENGTH,
      )}","Lihat")`,
    } as XLSX.CellObject;
  },
});
const longFormulaParsed = parseLegacyProductWorkbook(longFormulaBuffer);
assert.equal(
  longFormulaParsed.rows[0]?.legacyImageUrl,
  null,
  "Formula yang melebihi batas tidak boleh diproses sebagai URL gambar.",
);

console.log("Legacy product XLSX security checks passed.");
