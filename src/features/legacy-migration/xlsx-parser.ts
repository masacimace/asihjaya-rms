import { createHash } from "node:crypto";

import * as XLSX from "xlsx";

import {
  LEGACY_PRODUCT_BARCODE_LENGTH,
  LEGACY_PRODUCT_IMPORT_MAX_ROWS,
  type LegacyProductRowValidationStatus,
  type LegacyProductValidationIssue,
  type ParsedLegacyProductRow,
  type ParsedLegacyProductWorkbook,
} from "@/features/legacy-migration/contracts";

type LegacyColumnKey =
  | "sourceSequence"
  | "barcode"
  | "category"
  | "masterCode"
  | "masterName"
  | "itemName"
  | "purity"
  | "exchangePurity"
  | "pricePerGram"
  | "deductionPerGram"
  | "weightGram"
  | "color"
  | "image";

type ColumnMap = Record<LegacyColumnKey, number>;

type MutableParsedRow = Omit<ParsedLegacyProductRow, "rowFingerprint"> & {
  rowFingerprint?: string;
};

const columnMatchers: Record<LegacyColumnKey, (header: string) => boolean> = {
  sourceSequence: (header) => header === "no" || header === "nomor",
  barcode: (header) => header === "kode produk" || header === "barcode",
  category: (header) => header.startsWith("kategori"),
  masterCode: (header) => header.includes("kode master produk"),
  masterName: (header) => header.includes("nama master produk"),
  itemName: (header) =>
    header.includes("nama produk per sku") || header === "nama sku",
  purity: (header) => header.includes("kadar persen"),
  exchangePurity: (header) => header.includes("kadar tukaran"),
  pricePerGram: (header) => header === "harga" || header.includes("harga gram"),
  deductionPerGram: (header) => header.includes("potongan gram"),
  weightGram: (header) => header.includes("berat gram"),
  color: (header) => header.startsWith("warna"),
  image: (header) => header.startsWith("foto") || header.startsWith("gambar"),
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\(\s*\*\s*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactText(value: unknown, maxLength: number): string | null {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

  return normalized || null;
}

function getCell(
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
  columnIndex: number,
): XLSX.CellObject | undefined {
  return worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] as
    | XLSX.CellObject
    | undefined;
}

function getCellValue(
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
  columnIndex: number,
): unknown {
  return getCell(worksheet, rowIndex, columnIndex)?.v ?? null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^rp/i, "");

  if (!text) return null;

  let normalized = text;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed === null || !Number.isInteger(parsed)) return null;
  return parsed;
}

function normalizeBarcode(
  value: unknown,
  barcodeLength = LEGACY_PRODUCT_BARCODE_LENGTH,
): { raw: string | null; normalized: string | null } {
  if (value === null || value === undefined || value === "") {
    return { raw: null, normalized: null };
  }

  const raw =
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? String(value)
      : String(value).normalize("NFKC").trim().slice(0, 120);

  if (!/^\d+$/.test(raw) || raw.length > barcodeLength) {
    return { raw: raw || null, normalized: raw || null };
  }

  return {
    raw,
    normalized: raw.padStart(barcodeLength, "0"),
  };
}

function extractImageUrl(cell: XLSX.CellObject | undefined): string | null {
  const hyperlinkTarget = cell?.l?.Target;
  if (typeof hyperlinkTarget === "string" && hyperlinkTarget.trim()) {
    return hyperlinkTarget.trim();
  }

  const formula = typeof cell?.f === "string" ? cell.f : "";
  const formulaMatch = formula.match(/HYPERLINK\s*\(\s*["']([^"']+)["']/i);
  if (formulaMatch?.[1]) return formulaMatch[1].trim();

  const value = compactText(cell?.v, 2_000);
  if (value && /^https?:\/\//i.test(value)) return value;

  return null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function addIssue(
  row: MutableParsedRow,
  issue: LegacyProductValidationIssue,
): void {
  if (row.validationIssues.some((entry) => entry.code === issue.code)) return;
  row.validationIssues.push(issue);
}

function finalizeStatus(
  issues: readonly LegacyProductValidationIssue[],
): LegacyProductRowValidationStatus {
  if (issues.some((issue) => issue.severity === "error")) return "invalid";
  if (issues.length > 0) return "warning";
  return "valid";
}

function buildFingerprint(row: MutableParsedRow): string {
  const payload = JSON.stringify({
    barcode: row.normalizedBarcode,
    category: row.legacyCategory,
    masterCode: row.legacyMasterCode,
    masterName: row.legacyMasterName,
    itemName: row.legacyItemName,
    purity: row.legacyPurity,
    exchangePurity: row.legacyExchangePurity,
    pricePerGram: row.legacyPricePerGram,
    deductionPerGram: row.legacyDeductionPerGram,
    weightGram: row.legacyWeightGram,
    color: row.legacyColor,
    imageUrl: row.legacyImageUrl,
  });

  return createHash("sha256").update(payload).digest("hex");
}

function resolveColumns(headers: unknown[]): ColumnMap {
  const normalizedHeaders = headers.map(normalizeHeader);
  const resolved = {} as Partial<ColumnMap>;

  for (const [key, matcher] of Object.entries(columnMatchers) as Array<
    [LegacyColumnKey, (header: string) => boolean]
  >) {
    const matchingIndexes = normalizedHeaders
      .map((header, index) => (matcher(header) ? index : -1))
      .filter((index) => index >= 0);

    if (matchingIndexes.length !== 1) {
      throw new Error(
        matchingIndexes.length === 0
          ? `Kolom wajib tidak ditemukan: ${key}. Pastikan file berasal dari export master produk lama.`
          : `Kolom ${key} terdeteksi lebih dari satu kali. Rapikan header workbook terlebih dahulu.`,
      );
    }

    resolved[key] = matchingIndexes[0];
  }

  return resolved as ColumnMap;
}

function validateBaseRow(row: MutableParsedRow): void {
  if (!row.normalizedBarcode) {
    addIssue(row, {
      severity: "error",
      code: "BARCODE_REQUIRED",
      field: "barcode",
      message: "Kode barcode kosong.",
    });
  } else if (!/^\d{6}$/.test(row.normalizedBarcode)) {
    addIssue(row, {
      severity: "error",
      code: "BARCODE_INVALID_FORMAT",
      field: "barcode",
      message: "Barcode legacy harus berupa enam digit numerik.",
    });
  }

  for (const [value, field, code, message] of [
    [row.legacyCategory, "category", "CATEGORY_REQUIRED", "Kategori kosong."],
    [
      row.legacyMasterCode,
      "masterCode",
      "MASTER_CODE_REQUIRED",
      "Kode master produk kosong.",
    ],
    [
      row.legacyMasterName,
      "masterName",
      "MASTER_NAME_REQUIRED",
      "Nama master produk kosong.",
    ],
    [row.legacyItemName, "itemName", "ITEM_NAME_REQUIRED", "Nama SKU kosong."],
  ] as const) {
    if (!value) {
      addIssue(row, { severity: "error", code, field, message });
    }
  }

  if (row.legacyWeightGram === null || row.legacyWeightGram <= 0) {
    addIssue(row, {
      severity: "error",
      code: "WEIGHT_INVALID",
      field: "weightGram",
      message: "Berat harus lebih besar dari nol.",
    });
  } else if (row.legacyWeightGram > 100) {
    addIssue(row, {
      severity: "warning",
      code: "WEIGHT_OUTLIER",
      field: "weightGram",
      message: "Berat di atas 100 gram perlu diverifikasi pada barang fisik.",
    });
  }

  const isFineGold = normalizeHeader(row.legacyCategory).includes("logam mulia");

  if (row.legacyPurity === null || row.legacyPurity <= 0) {
    addIssue(row, {
      severity: "warning",
      code: "PURITY_MISSING_OR_INVALID",
      field: "purity",
      message: "Kadar legacy kosong atau tidak valid.",
    });
  } else if (!isFineGold && row.legacyPurity > 100) {
    addIssue(row, {
      severity: "warning",
      code: "PURITY_OUTLIER",
      field: "purity",
      message: "Kadar di atas 100 perlu diverifikasi.",
    });
  }

  if (row.legacyExchangePurity === null || row.legacyExchangePurity <= 0) {
    addIssue(row, {
      severity: "warning",
      code: "EXCHANGE_PURITY_MISSING_OR_INVALID",
      field: "exchangePurity",
      message: "Kadar tukaran legacy kosong atau tidak valid.",
    });
  } else if (!isFineGold && row.legacyExchangePurity > 100) {
    addIssue(row, {
      severity: "warning",
      code: "EXCHANGE_PURITY_OUTLIER",
      field: "exchangePurity",
      message: "Kadar tukaran di atas 100 perlu diverifikasi.",
    });
  }

  if (row.legacyPricePerGram === null || row.legacyPricePerGram <= 0) {
    addIssue(row, {
      severity: "warning",
      code: "PRICE_MISSING_OR_ZERO",
      field: "pricePerGram",
      message: "Harga legacy kosong atau nol; jangan gunakan sebagai harga aktif.",
    });
  } else if (row.legacyPricePerGram < 10_000) {
    addIssue(row, {
      severity: "warning",
      code: "PRICE_OUTLIER_LOW",
      field: "pricePerGram",
      message: "Harga legacy sangat rendah dan perlu diperiksa.",
    });
  }

  if (
    row.legacyDeductionPerGram === null &&
    !normalizeHeader(row.legacyCategory).includes("logam mulia")
  ) {
    addIssue(row, {
      severity: "warning",
      code: "DEDUCTION_MISSING",
      field: "deductionPerGram",
      message: "Potongan per gram legacy kosong.",
    });
  }

  if (!row.legacyImageUrl) {
    addIssue(row, {
      severity: "warning",
      code: "IMAGE_URL_MISSING",
      field: "image",
      message: "URL foto legacy tidak tersedia.",
    });
  } else if (!isValidHttpUrl(row.legacyImageUrl)) {
    addIssue(row, {
      severity: "warning",
      code: "IMAGE_URL_INVALID",
      field: "image",
      message: "URL foto legacy tidak valid.",
    });
  }
}

function rawCellValue(cell: XLSX.CellObject | undefined): unknown {
  if (!cell) return null;
  if (cell.l?.Target) return cell.l.Target;
  if (cell.f) return `=${cell.f}`;
  if (cell.v instanceof Date) return cell.v.toISOString();
  if (["string", "number", "boolean"].includes(typeof cell.v)) return cell.v;
  return cell.w ?? null;
}

export function parseLegacyProductWorkbook(
  buffer: Buffer,
): ParsedLegacyProductWorkbook {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellFormula: true,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      cellDates: false,
      dense: false,
      sheetRows: LEGACY_PRODUCT_IMPORT_MAX_ROWS + 2,
    });
  } catch {
    throw new Error("Workbook XLSX tidak dapat dibaca atau rusak.");
  }

  const worksheetName = workbook.SheetNames[0];
  if (!worksheetName) throw new Error("Workbook tidak memiliki worksheet.");

  const worksheet = workbook.Sheets[worksheetName];
  if (!worksheet?.["!ref"]) throw new Error("Worksheet pertama kosong.");

  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  const headerRowIndex = range.s.r;
  const headers = Array.from(
    { length: range.e.c - range.s.c + 1 },
    (_, offset) =>
      compactText(
        getCellValue(worksheet, headerRowIndex, range.s.c + offset),
        300,
      ) ?? "",
  );
  const columns = resolveColumns(headers);
  const absoluteColumn = (key: LegacyColumnKey) => range.s.c + columns[key];

  const rows: MutableParsedRow[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const cells = headers.map((_, offset) =>
      getCell(worksheet, rowIndex, range.s.c + offset),
    );
    const isBlank = cells.every(
      (cell) => cell?.v === null || cell?.v === undefined || cell?.v === "",
    );
    if (isBlank) continue;

    if (rows.length >= LEGACY_PRODUCT_IMPORT_MAX_ROWS) {
      throw new Error(
        `Workbook melebihi batas ${LEGACY_PRODUCT_IMPORT_MAX_ROWS.toLocaleString("id-ID")} baris.`,
      );
    }

    const barcode = normalizeBarcode(
      getCellValue(worksheet, rowIndex, absoluteColumn("barcode")),
    );
    const imageCell = getCell(worksheet, rowIndex, absoluteColumn("image"));
    const rawData = Object.fromEntries(
      headers.map((header, index) => [
        header || `Kolom ${index + 1}`,
        rawCellValue(cells[index]),
      ]),
    );

    const row: MutableParsedRow = {
      rowNumber: rowIndex + 1,
      sourceSequence: parseInteger(
        getCellValue(worksheet, rowIndex, absoluteColumn("sourceSequence")),
      ),
      legacyBarcode: barcode.raw,
      normalizedBarcode: barcode.normalized,
      legacyCategory: compactText(
        getCellValue(worksheet, rowIndex, absoluteColumn("category")),
        160,
      ),
      legacyMasterCode: compactText(
        getCellValue(worksheet, rowIndex, absoluteColumn("masterCode")),
        120,
      ),
      legacyMasterName: compactText(
        getCellValue(worksheet, rowIndex, absoluteColumn("masterName")),
        220,
      ),
      legacyItemName: compactText(
        getCellValue(worksheet, rowIndex, absoluteColumn("itemName")),
        240,
      ),
      legacyPurity: parseNumber(
        getCellValue(worksheet, rowIndex, absoluteColumn("purity")),
      ),
      legacyExchangePurity: parseNumber(
        getCellValue(worksheet, rowIndex, absoluteColumn("exchangePurity")),
      ),
      legacyPricePerGram: parseNumber(
        getCellValue(worksheet, rowIndex, absoluteColumn("pricePerGram")),
      ),
      legacyDeductionPerGram: parseNumber(
        getCellValue(worksheet, rowIndex, absoluteColumn("deductionPerGram")),
      ),
      legacyWeightGram: parseNumber(
        getCellValue(worksheet, rowIndex, absoluteColumn("weightGram")),
      ),
      legacyColor: compactText(
        getCellValue(worksheet, rowIndex, absoluteColumn("color")),
        120,
      ),
      legacyImageUrl: extractImageUrl(imageCell),
      validationStatus: "valid",
      validationIssues: [],
      rawData,
    };

    validateBaseRow(row);
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("Workbook tidak memiliki baris produk.");
  }

  const barcodeRows = new Map<string, MutableParsedRow[]>();
  for (const row of rows) {
    if (!row.normalizedBarcode) continue;
    const current = barcodeRows.get(row.normalizedBarcode) ?? [];
    current.push(row);
    barcodeRows.set(row.normalizedBarcode, current);
  }

  let duplicateBarcodeCount = 0;
  for (const [barcodeValue, duplicates] of barcodeRows) {
    if (duplicates.length < 2) continue;
    duplicateBarcodeCount += 1;
    for (const row of duplicates) {
      addIssue(row, {
        severity: "error",
        code: "BARCODE_DUPLICATE",
        field: "barcode",
        message: `Barcode ${barcodeValue} muncul ${duplicates.length} kali dalam workbook.`,
      });
    }
  }

  const masterMappings = new Map<string, Map<string, MutableParsedRow[]>>();
  for (const row of rows) {
    if (!row.legacyMasterCode) continue;
    const normalizedCode = normalizeHeader(row.legacyMasterCode);
    const mappingKey = `${normalizeHeader(row.legacyCategory)}|${normalizeHeader(row.legacyMasterName)}`;
    const mappings = masterMappings.get(normalizedCode) ?? new Map();
    const matchingRows = mappings.get(mappingKey) ?? [];
    matchingRows.push(row);
    mappings.set(mappingKey, matchingRows);
    masterMappings.set(normalizedCode, mappings);
  }

  for (const mappings of masterMappings.values()) {
    if (mappings.size < 2) continue;
    for (const mappedRows of mappings.values()) {
      for (const row of mappedRows) {
        addIssue(row, {
          severity: "warning",
          code: "MASTER_MAPPING_INCONSISTENT",
          field: "masterCode",
          message:
            "Kode master yang sama memiliki nama atau kategori berbeda dalam workbook.",
        });
      }
    }
  }

  const finalizedRows = rows.map((row): ParsedLegacyProductRow => {
    row.validationStatus = finalizeStatus(row.validationIssues);
    row.rowFingerprint = buildFingerprint(row);
    return row as ParsedLegacyProductRow;
  });

  const validationCodeCounts: Record<string, number> = {};
  for (const row of finalizedRows) {
    for (const issue of row.validationIssues) {
      validationCodeCounts[issue.code] =
        (validationCodeCounts[issue.code] ?? 0) + 1;
    }
  }

  const uniqueValues = (values: Array<string | null>) =>
    new Set(values.map((value) => normalizeHeader(value)).filter(Boolean)).size;

  return {
    worksheetName: worksheetName.slice(0, 160),
    headers,
    barcodeLength: LEGACY_PRODUCT_BARCODE_LENGTH,
    rows: finalizedRows,
    summary: {
      totalRows: finalizedRows.length,
      validRows: finalizedRows.filter((row) => row.validationStatus === "valid")
        .length,
      warningRows: finalizedRows.filter(
        (row) => row.validationStatus === "warning",
      ).length,
      invalidRows: finalizedRows.filter(
        (row) => row.validationStatus === "invalid",
      ).length,
      uniqueMasterCount: uniqueValues(
        finalizedRows.map((row) => row.legacyMasterCode),
      ),
      uniqueCategoryCount: uniqueValues(
        finalizedRows.map((row) => row.legacyCategory),
      ),
      uniqueColorCount: uniqueValues(
        finalizedRows.map((row) => row.legacyColor),
      ),
      duplicateBarcodeCount,
      leadingZeroBarcodeCount: finalizedRows.filter((row) =>
        row.normalizedBarcode?.startsWith("0"),
      ).length,
      imageUrlCount: finalizedRows.filter((row) => row.legacyImageUrl).length,
      validationCodeCounts,
      sourceWarnings: [
        "Export legacy tidak memiliki status stok. Semua baris hanya menjadi referensi staging dan tidak boleh otomatis menjadi inventaris aktif.",
        "Harga dan potongan legacy hanya disimpan sebagai referensi. Pricing aktif harus ditentukan pada sistem baru.",
      ],
    },
  };
}
