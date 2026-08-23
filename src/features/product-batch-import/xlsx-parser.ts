import { createHash } from "node:crypto";
import path from "node:path";

import * as XLSX from "xlsx";

import {
  PRODUCT_BATCH_IMPORT_ITEM_HEADERS,
  PRODUCT_BATCH_IMPORT_LEGACY_TEMPLATE_VERSION,
  PRODUCT_BATCH_IMPORT_LEGACY_TYPE,
  PRODUCT_BATCH_IMPORT_LIMITS,
  PRODUCT_BATCH_IMPORT_MASTER_HEADERS,
  PRODUCT_BATCH_IMPORT_METADATA_HEADERS,
  PRODUCT_BATCH_IMPORT_SHEET_NAMES,
  PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
  PRODUCT_BATCH_IMPORT_TYPE,
  PRODUCT_BATCH_IMPORT_V2_HEADERS,
  PRODUCT_BATCH_IMPORT_V2_SHEET_NAME,
} from "./contracts";
import {
  extractStrictZipEntry,
  inspectStrictZipArchive,
  StrictZipError,
} from "./zip-reader";

const MAX_WORKSHEET_RANGE_TEXT_LENGTH = 64;
const BLOCKED_XLSX_PATH_PREFIXES = [
  "xl/activeX/",
  "xl/charts/",
  "xl/embeddings/",
  "xl/externalLinks/",
  "xl/oleObjects/",
  "xl/queryTables/",
  "xl/webextensions/",
] as const;
const BLOCKED_XLSX_EXACT_PATHS = new Set([
  "xl/cellimages.xml",
  "xl/connections.xml",
  "xl/vbaProject.bin",
]);
const XLSX_WORKBOOK_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";

type ProductBatchCellValue = string | number | boolean | null;
type ProductBatchRawPayload = Record<string, ProductBatchCellValue>;

export type ParsedProductBatchMasterRow = {
  rowNumber: number;
  rawPayload: ProductBatchRawPayload;
  normalizedPayload: ProductBatchRawPayload;
  rowFingerprint: string;
};

export type ParsedProductBatchItemRow = {
  rowNumber: number;
  rawPayload: ProductBatchRawPayload;
  normalizedPayload: ProductBatchRawPayload;
  rowFingerprint: string;
};

export type ProductBatchWorkbookWarning = {
  code: "UNKNOWN_METADATA_KEY";
  message: string;
};

export type ParsedProductBatchWorkbook = {
  workbookSha256: string;
  templateVersion: string;
  importType: string;
  metadata: Record<string, string>;
  masterRows: ParsedProductBatchMasterRow[];
  itemRows: ParsedProductBatchItemRow[];
  warnings: ProductBatchWorkbookWarning[];
};

export class ProductBatchWorkbookError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProductBatchWorkbookError";
  }
}

function workbookError(code: string, message: string, cause?: unknown) {
  return new ProductBatchWorkbookError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function readXmlAttribute(tag: string, attributeName: string): string | null {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] ?? null;
}

function getWorkbookContentType(contentTypesXml: string): string | null {
  const overrideTags = contentTypesXml.match(/<(?:[A-Za-z_][\w.-]*:)?Override\b[^>]*>/gi) ?? [];
  for (const tag of overrideTags) {
    const partName = readXmlAttribute(tag, "PartName");
    if (partName !== "/xl/workbook.xml") continue;
    return readXmlAttribute(tag, "ContentType");
  }
  return null;
}

function getExternalRelationshipTarget(relationshipsXml: string): string | null {
  const relationshipTags =
    relationshipsXml.match(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b[^>]*>/gi) ?? [];
  for (const tag of relationshipTags) {
    const targetMode = readXmlAttribute(tag, "TargetMode");
    if (targetMode?.toLowerCase() !== "external") continue;
    return readXmlAttribute(tag, "Target") ?? "external target";
  }
  return null;
}

type WorkbookRelationship = {
  id: string;
  type: string;
  target: string;
};

function normalizeRelationshipTarget(sourcePartPath: string, target: string) {
  if (!target || target.includes("\\") || target.includes("\0")) {
    throw workbookError(
      "WORKBOOK_RELATIONSHIP_INVALID",
      `Target relationship tidak valid pada ${sourcePartPath}.`,
    );
  }
  if (
    target.startsWith("/") ||
    /^[A-Za-z]:/.test(target) ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  ) {
    throw workbookError(
      "WORKBOOK_RELATIONSHIP_INVALID",
      `Target relationship absolute/external ditolak pada ${sourcePartPath}: ${target}.`,
    );
  }
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(sourcePartPath), target),
  );
  if (
    !resolved ||
    resolved === "." ||
    resolved === ".." ||
    resolved.startsWith("../") ||
    resolved.includes("/../")
  ) {
    throw workbookError(
      "WORKBOOK_RELATIONSHIP_INVALID",
      `Target relationship keluar dari package OOXML: ${sourcePartPath} -> ${target}.`,
    );
  }
  return resolved;
}

function parseWorkbookRelationships(xml: string): Map<string, WorkbookRelationship> {
  const result = new Map<string, WorkbookRelationship>();
  const relationshipTags =
    xml.match(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b[^>]*>/gi) ?? [];
  for (const tag of relationshipTags) {
    const id = readXmlAttribute(tag, "Id");
    const type = readXmlAttribute(tag, "Type");
    const target = readXmlAttribute(tag, "Target");
    if (!id || !type || !target || result.has(id)) {
      throw workbookError(
        "WORKBOOK_RELATIONSHIP_INVALID",
        "Relationship workbook tidak lengkap atau duplicate.",
      );
    }
    result.set(id, { id, type, target });
  }
  return result;
}

type ProductBatchWorksheetInspection = {
  richValuePlaceholders: Set<string>;
  actualReferences: Map<string, string>;
};

function collectWorksheetInspection({
  buffer,
  inspection,
  allowEmbeddedImages,
}: {
  buffer: Buffer;
  inspection: ReturnType<typeof inspectStrictZipArchive>;
  allowEmbeddedImages: boolean;
}): ProductBatchWorksheetInspection {
  const workbookEntry = inspection.entries.find(
    (entry) => entry.path === "xl/workbook.xml" && !entry.isDirectory,
  );
  const relationshipsEntry = inspection.entries.find(
    (entry) => entry.path === "xl/_rels/workbook.xml.rels" && !entry.isDirectory,
  );
  if (!workbookEntry || !relationshipsEntry) {
    throw workbookError(
      "WORKBOOK_OOXML_INVALID",
      "Relationship workbook XLSX tidak lengkap.",
    );
  }

  const workbookXml = extractStrictZipEntry(buffer, workbookEntry).toString("utf8");
  const workbookRelationships = parseWorkbookRelationships(
    extractStrictZipEntry(buffer, relationshipsEntry).toString("utf8"),
  );
  const sheetTags = workbookXml.match(/<(?:[A-Za-z_][\w.-]*:)?sheet\b[^>]*>/gi) ?? [];
  const placeholders = new Set<string>();
  const actualReferences = new Map<string, string>();

  for (const sheetTag of sheetTags) {
    const sheetName = readXmlAttribute(sheetTag, "name");
    const relationshipId = readXmlAttribute(sheetTag, "r:id");
    if (!sheetName || !relationshipId) {
      throw workbookError(
        "WORKBOOK_OOXML_INVALID",
        "Definisi worksheet pada xl/workbook.xml tidak lengkap.",
      );
    }
    const relationship = workbookRelationships.get(relationshipId);
    if (!relationship || !relationship.type.endsWith("/worksheet")) {
      throw workbookError(
        "WORKBOOK_OOXML_INVALID",
        `Relationship worksheet ${sheetName} tidak valid.`,
      );
    }
    const worksheetPath = normalizeRelationshipTarget(
      "xl/workbook.xml",
      relationship.target,
    );
    const worksheetEntry = inspection.entries.find(
      (entry) => entry.path === worksheetPath && !entry.isDirectory,
    );
    if (!worksheetEntry) {
      throw workbookError(
        "WORKBOOK_OOXML_INVALID",
        `Worksheet ${sheetName} tidak ditemukan.`,
      );
    }
    const worksheetXml = extractStrictZipEntry(buffer, worksheetEntry).toString("utf8");
    const cellBlocks =
      worksheetXml.match(
        /<(?:[A-Za-z_][\w.-]*:)?c\b[^>]*(?:\/>|>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?c>)/gi,
      ) ?? [];
    let minRow = Number.POSITIVE_INFINITY;
    let minColumn = Number.POSITIVE_INFINITY;
    let maxRow = -1;
    let maxColumn = -1;

    for (const cellBlock of cellBlocks) {
      const openingTag =
        cellBlock.match(/^<(?:[A-Za-z_][\w.-]*:)?c\b[^>]*>/i)?.[0] ?? cellBlock;
      const vmText = readXmlAttribute(openingTag, "vm");
      const address = readXmlAttribute(openingTag, "r");
      const hasMeaningfulValue =
        vmText !== null ||
        /<(?:[A-Za-z_][\w.-]*:)?(?:v|f|is)\b/i.test(cellBlock);

      if (!hasMeaningfulValue) {
        continue;
      }
      if (!address) {
        throw workbookError(
          "WORKBOOK_RANGE_INVALID",
          `Alamat cell tidak valid pada worksheet ${sheetName}.`,
        );
      }

      let decoded: XLSX.CellAddress;
      try {
        decoded = XLSX.utils.decode_cell(address);
      } catch (error) {
        throw workbookError(
          "WORKBOOK_RANGE_INVALID",
          `Alamat cell tidak valid pada ${sheetName}!${address}.`,
          error,
        );
      }

      minRow = Math.min(minRow, decoded.r);
      minColumn = Math.min(minColumn, decoded.c);
      maxRow = Math.max(maxRow, decoded.r);
      maxColumn = Math.max(maxColumn, decoded.c);

      if (vmText === null) continue;
      if (!allowEmbeddedImages) {
        throw workbookError(
          "WORKBOOK_ACTIVE_CONTENT_REJECTED",
          `Workbook mengandung Picture in Cell yang tidak diizinkan pada ${sheetName}!${address}.`,
        );
      }
      const vm = Number(vmText);
      if (!Number.isSafeInteger(vm) || vm <= 0) {
        throw workbookError(
          "WORKBOOK_RICH_VALUE_INVALID",
          `Rich-value cell tidak valid pada worksheet ${sheetName}.`,
        );
      }
      const validTarget =
        (sheetName === "PRODUCT_MASTERS" && decoded.r >= 1 && decoded.c === 7) ||
        (sheetName === "PHYSICAL_PRODUCTS" && decoded.r >= 1 && decoded.c === 16) ||
        (sheetName === PRODUCT_BATCH_IMPORT_V2_SHEET_NAME &&
          decoded.r >= 1 &&
          decoded.c === 10);
      if (!validTarget) {
        throw workbookError(
          "WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID",
          `Picture in Cell hanya boleh berada pada kolom foto yang didukung template, bukan ${sheetName}!${address}.`,
        );
      }
      placeholders.add(`${sheetName}!${address.toUpperCase()}`);
    }

    if (maxRow >= 0 && maxColumn >= 0) {
      actualReferences.set(
        sheetName,
        XLSX.utils.encode_range({
          s: { r: minRow, c: minColumn },
          e: { r: maxRow, c: maxColumn },
        }),
      );
    }
  }

  return { richValuePlaceholders: placeholders, actualReferences };
}

export type ProductBatchWorkbookParseOptions = {
  allowEmbeddedImages?: boolean;
};

function inspectXlsxContainer(
  buffer: Buffer,
  options: ProductBatchWorkbookParseOptions,
): ProductBatchWorksheetInspection {
  let inspection;
  try {
    inspection = inspectStrictZipArchive(buffer, {
      maxArchiveBytes: options.allowEmbeddedImages
        ? PRODUCT_BATCH_IMPORT_LIMITS.xlsxUploadBytes
        : PRODUCT_BATCH_IMPORT_LIMITS.workbookBytes,
      maxEntries: options.allowEmbeddedImages
        ? PRODUCT_BATCH_IMPORT_LIMITS.embeddedWorkbookArchiveEntries
        : PRODUCT_BATCH_IMPORT_LIMITS.workbookArchiveEntries,
      maxUncompressedBytes: options.allowEmbeddedImages
        ? PRODUCT_BATCH_IMPORT_LIMITS.embeddedWorkbookUncompressedBytes
        : PRODUCT_BATCH_IMPORT_LIMITS.workbookUncompressedBytes,
      maxFileNameBytes: PRODUCT_BATCH_IMPORT_LIMITS.archiveEntryNameBytes,
    });
  } catch (error) {
    if (error instanceof StrictZipError) {
      throw workbookError("WORKBOOK_CONTAINER_INVALID", error.message, error);
    }
    throw error;
  }

  const entryPaths = new Set(inspection.entries.map((entry) => entry.path));
  if (!entryPaths.has("[Content_Types].xml") || !entryPaths.has("xl/workbook.xml")) {
    throw workbookError("WORKBOOK_OOXML_INVALID", "products.xlsx bukan workbook OOXML XLSX yang valid.");
  }

  const contentTypesEntry = inspection.entries.find(
    (entry) => entry.path === "[Content_Types].xml",
  );
  if (!contentTypesEntry) {
    throw workbookError("WORKBOOK_OOXML_INVALID", "[Content_Types].xml tidak ditemukan.");
  }
  const contentTypes = extractStrictZipEntry(buffer, contentTypesEntry).toString("utf8");
  const workbookContentType = getWorkbookContentType(contentTypes);
  if (!workbookContentType) {
    throw workbookError(
      "WORKBOOK_OOXML_INVALID",
      "Content type untuk xl/workbook.xml tidak ditemukan.",
    );
  }
  if (workbookContentType !== XLSX_WORKBOOK_CONTENT_TYPE) {
    throw workbookError(
      "WORKBOOK_MACRO_REJECTED",
      "Workbook macro-enabled/non-XLSX tidak diizinkan.",
    );
  }

  for (const entry of inspection.entries) {
    if (
      BLOCKED_XLSX_EXACT_PATHS.has(entry.path) ||
      BLOCKED_XLSX_PATH_PREFIXES.some((prefix) => entry.path.startsWith(prefix)) ||
      (!options.allowEmbeddedImages && entry.path.startsWith("xl/media/")) ||
      (!options.allowEmbeddedImages && entry.path.startsWith("xl/richData/"))
    ) {
      throw workbookError(
        "WORKBOOK_ACTIVE_CONTENT_REJECTED",
        `Workbook mengandung embedded/active/external content yang tidak diizinkan: ${entry.path}.`,
      );
    }
    if (entry.isDirectory || !entry.path.endsWith(".rels")) continue;

    let extracted: Buffer;
    try {
      extracted = extractStrictZipEntry(buffer, entry);
    } catch (error) {
      if (error instanceof StrictZipError) {
        throw workbookError("WORKBOOK_CONTAINER_INVALID", error.message, error);
      }
      throw error;
    }

    const externalTarget = getExternalRelationshipTarget(extracted.toString("utf8"));
    if (externalTarget) {
      throw workbookError(
        "WORKBOOK_ACTIVE_CONTENT_REJECTED",
        `Workbook mengandung external relationship yang tidak diizinkan: ${entry.path} -> ${externalTarget}.`,
      );
    }
  }

  return collectWorksheetInspection({
    buffer,
    inspection,
    allowEmbeddedImages: options.allowEmbeddedImages === true,
  });
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function normalizeCellValue(value: ProductBatchCellValue): ProductBatchCellValue {
  return typeof value === "string" ? normalizeText(value) : value;
}

function cellValue(cell: XLSX.CellObject | undefined, sheetName: string, address: string): ProductBatchCellValue {
  if (!cell || cell.v === undefined || cell.v === null || cell.v === "") return null;
  if (cell.f) {
    throw workbookError("WORKBOOK_FORMULA_REJECTED", `Formula tidak diizinkan pada ${sheetName}!${address}.`);
  }
  if (cell.l) {
    throw workbookError("WORKBOOK_HYPERLINK_REJECTED", `Hyperlink tidak diizinkan pada ${sheetName}!${address}.`);
  }
  if (cell.t === "e") {
    throw workbookError("WORKBOOK_CELL_ERROR", `Cell error tidak diizinkan pada ${sheetName}!${address}.`);
  }

  if (typeof cell.v === "string") {
    if (cell.v.length > PRODUCT_BATCH_IMPORT_LIMITS.workbookCellTextChars) {
      throw workbookError("WORKBOOK_CELL_TOO_LONG", `Text cell terlalu panjang pada ${sheetName}!${address}.`);
    }
    return cell.v;
  }
  if (typeof cell.v === "number") {
    if (!Number.isFinite(cell.v)) {
      throw workbookError("WORKBOOK_CELL_INVALID", `Angka tidak valid pada ${sheetName}!${address}.`);
    }
    return cell.v;
  }
  if (typeof cell.v === "boolean") return cell.v;

  const rendered = String(cell.w ?? cell.v ?? "");
  if (rendered.length > PRODUCT_BATCH_IMPORT_LIMITS.workbookCellTextChars) {
    throw workbookError("WORKBOOK_CELL_TOO_LONG", `Text cell terlalu panjang pada ${sheetName}!${address}.`);
  }
  return rendered || null;
}

function decodeRange(reference: string, sheetName: string, maxColumns: number, maxDataRows: number): XLSX.Range {
  if (!reference || reference.length > MAX_WORKSHEET_RANGE_TEXT_LENGTH || /[^A-Za-z0-9:$]/.test(reference)) {
    throw workbookError("WORKBOOK_RANGE_INVALID", `Rentang worksheet ${sheetName} tidak valid.`);
  }

  let range: XLSX.Range;
  try {
    range = XLSX.utils.decode_range(reference);
  } catch (error) {
    throw workbookError("WORKBOOK_RANGE_INVALID", `Rentang worksheet ${sheetName} tidak valid.`, error);
  }

  if (
    range.s.r !== 0 ||
    range.s.c !== 0 ||
    range.e.r < range.s.r ||
    range.e.c < range.s.c ||
    range.e.c + 1 > maxColumns ||
    range.e.r + 1 > maxDataRows + 1
  ) {
    throw workbookError("WORKBOOK_RANGE_LIMIT", `Worksheet ${sheetName} melebihi batas row/column template.`);
  }
  return range;
}

function assertSheetVisibility(
  workbook: XLSX.WorkBook,
  expectedSheetNames: readonly string[],
): void {
  const sheetMetadata = workbook.Workbook?.Sheets ?? [];
  if (sheetMetadata.length !== expectedSheetNames.length) {
    throw workbookError(
      "WORKBOOK_SHEETS_INVALID",
      `Workbook harus mempunyai tepat ${expectedSheetNames.length} worksheet sesuai template.`,
    );
  }
  for (const sheet of sheetMetadata) {
    if ((sheet.Hidden ?? 0) !== 0) {
      throw workbookError(
        "WORKBOOK_HIDDEN_SHEET",
        `Hidden worksheet tidak diizinkan: ${sheet.name}.`,
      );
    }
  }
}

function assertExactHeaders(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  expected: readonly string[],
): void {
  const actual = expected.map((_, columnIndex) => {
    const address = XLSX.utils.encode_cell({ r: 0, c: columnIndex });
    return normalizeText(String(cellValue(worksheet[address] as XLSX.CellObject | undefined, sheetName, address) ?? ""));
  });
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw workbookError("WORKBOOK_HEADERS_INVALID", `Header ${sheetName} harus exact sesuai template.`);
  }
}

function getActualReference(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  actualReferences: ReadonlyMap<string, string>,
): string | null {
  return actualReferences.get(sheetName) ?? worksheet["!ref"] ?? null;
}

function assertNoFormulaOrHyperlink(worksheet: XLSX.WorkSheet, sheetName: string): void {
  for (const [address, candidate] of Object.entries(worksheet)) {
    if (address.startsWith("!")) continue;
    const cell = candidate as XLSX.CellObject;
    if (cell.f) {
      throw workbookError("WORKBOOK_FORMULA_REJECTED", `Formula tidak diizinkan pada ${sheetName}!${address}.`);
    }
    if (cell.l) {
      throw workbookError("WORKBOOK_HYPERLINK_REJECTED", `Hyperlink tidak diizinkan pada ${sheetName}!${address}.`);
    }
  }
}

function isBlankRow(values: ProductBatchCellValue[]): boolean {
  return values.every((value) => value === null || (typeof value === "string" && normalizeText(value) === ""));
}

function fingerprintPayload(payload: ProductBatchRawPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function parseDataRows<T extends ParsedProductBatchMasterRow | ParsedProductBatchItemRow>({
  worksheet,
  sheetName,
  headers,
  maxRows,
  richValuePlaceholders,
  actualReferences,
}: {
  worksheet: XLSX.WorkSheet;
  sheetName: string;
  headers: readonly string[];
  maxRows: number;
  richValuePlaceholders: ReadonlySet<string>;
  actualReferences: ReadonlyMap<string, string>;
}): T[] {
  const reference = getActualReference(worksheet, sheetName, actualReferences);
  if (!reference) return [];
  const range = decodeRange(reference, sheetName, headers.length, maxRows);
  assertExactHeaders(worksheet, sheetName, headers);
  assertNoFormulaOrHyperlink(worksheet, sheetName);

  const rows: T[] = [];
  for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex += 1) {
    const rawValues = headers.map((_, columnIndex) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (richValuePlaceholders.has(`${sheetName}!${address}`)) return null;
      return cellValue(worksheet[address] as XLSX.CellObject | undefined, sheetName, address);
    });
    if (isBlankRow(rawValues)) continue;
    if (rows.length >= maxRows) {
      throw workbookError("WORKBOOK_ROW_LIMIT", `${sheetName} melebihi batas ${maxRows} data rows.`);
    }

    const rawPayload = Object.fromEntries(headers.map((header, index) => [header, rawValues[index] ?? null]));
    const normalizedPayload = Object.fromEntries(
      headers.map((header, index) => [header, normalizeCellValue(rawValues[index] ?? null)]),
    );
    rows.push({
      rowNumber: rowIndex + 1,
      rawPayload,
      normalizedPayload,
      rowFingerprint: fingerprintPayload(normalizedPayload),
    } as T);
  }
  return rows;
}

function parseMetadata(
  worksheet: XLSX.WorkSheet,
  actualReferences: ReadonlyMap<string, string>,
): {
  metadata: Record<string, string>;
  warnings: ProductBatchWorkbookWarning[];
} {
  const reference = getActualReference(worksheet, "METADATA", actualReferences);
  if (!reference) {
    throw workbookError("WORKBOOK_METADATA_INVALID", "Sheet METADATA tidak boleh kosong.");
  }
  const range = decodeRange(
    reference,
    "METADATA",
    PRODUCT_BATCH_IMPORT_METADATA_HEADERS.length,
    PRODUCT_BATCH_IMPORT_LIMITS.workbookMetadataRows,
  );
  assertExactHeaders(worksheet, "METADATA", PRODUCT_BATCH_IMPORT_METADATA_HEADERS);
  assertNoFormulaOrHyperlink(worksheet, "METADATA");

  const metadata: Record<string, string> = {};
  const warnings: ProductBatchWorkbookWarning[] = [];
  for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex += 1) {
    const keyAddress = XLSX.utils.encode_cell({ r: rowIndex, c: 0 });
    const valueAddress = XLSX.utils.encode_cell({ r: rowIndex, c: 1 });
    const key = normalizeText(
      String(cellValue(worksheet[keyAddress] as XLSX.CellObject | undefined, "METADATA", keyAddress) ?? ""),
    );
    const value = normalizeText(
      String(cellValue(worksheet[valueAddress] as XLSX.CellObject | undefined, "METADATA", valueAddress) ?? ""),
    );
    if (!key && !value) continue;
    if (!key) {
      throw workbookError("WORKBOOK_METADATA_INVALID", `Metadata key kosong pada row ${rowIndex + 1}.`);
    }
    if (Object.hasOwn(metadata, key)) {
      throw workbookError("WORKBOOK_METADATA_DUPLICATE", `Metadata key duplicate: ${key}.`);
    }
    metadata[key] = value;
  }

  if (metadata.template_version !== PRODUCT_BATCH_IMPORT_LEGACY_TEMPLATE_VERSION) {
    throw workbookError(
      "WORKBOOK_TEMPLATE_UNSUPPORTED",
      `template_version ${metadata.template_version || "(kosong)"} tidak didukung.`,
    );
  }
  if (metadata.import_type !== PRODUCT_BATCH_IMPORT_LEGACY_TYPE) {
    throw workbookError("WORKBOOK_IMPORT_TYPE_INVALID", "import_type workbook tidak sesuai create-only template v1.");
  }

  const knownKeys = new Set(["template_version", "import_type", "generated_at"]);
  for (const key of Object.keys(metadata)) {
    if (!knownKeys.has(key)) {
      warnings.push({ code: "UNKNOWN_METADATA_KEY", message: `Metadata key tidak dikenal diabaikan: ${key}.` });
    }
  }
  return { metadata, warnings };
}

function assertInstructionsSheet(
  worksheet: XLSX.WorkSheet,
  actualReferences: ReadonlyMap<string, string>,
): void {
  const reference = getActualReference(worksheet, "INSTRUCTIONS", actualReferences);
  if (!reference) {
    throw workbookError("WORKBOOK_INSTRUCTIONS_INVALID", "Sheet INSTRUCTIONS tidak boleh kosong.");
  }
  decodeRange(reference, "INSTRUCTIONS", 2, PRODUCT_BATCH_IMPORT_LIMITS.workbookInstructionRows);
  assertExactHeaders(worksheet, "INSTRUCTIONS", ["bagian", "panduan"]);
  assertNoFormulaOrHyperlink(worksheet, "INSTRUCTIONS");
}

function normalizeV2GroupValue(value: unknown) {
  return normalizeText(String(value ?? ""))
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("id-ID");
}

function parseV2Workbook({
  workbook,
  buffer,
  richValuePlaceholders,
  actualReferences,
}: {
  workbook: XLSX.WorkBook;
  buffer: Buffer;
  richValuePlaceholders: ReadonlySet<string>;
  actualReferences: ReadonlyMap<string, string>;
}): ParsedProductBatchWorkbook {
  if (
    workbook.SheetNames.length !== 1 ||
    workbook.SheetNames[0] !== PRODUCT_BATCH_IMPORT_V2_SHEET_NAME
  ) {
    throw workbookError(
      "WORKBOOK_SHEETS_INVALID",
      `Template v2 harus mempunyai tepat satu worksheet ${PRODUCT_BATCH_IMPORT_V2_SHEET_NAME}.`,
    );
  }
  assertSheetVisibility(workbook, [PRODUCT_BATCH_IMPORT_V2_SHEET_NAME]);

  const productsSheet = workbook.Sheets[PRODUCT_BATCH_IMPORT_V2_SHEET_NAME];
  if (!productsSheet) {
    throw workbookError(
      "WORKBOOK_SHEETS_INVALID",
      `Worksheet ${PRODUCT_BATCH_IMPORT_V2_SHEET_NAME} tidak ditemukan.`,
    );
  }

  const productRows = parseDataRows<ParsedProductBatchItemRow>({
    worksheet: productsSheet,
    sheetName: PRODUCT_BATCH_IMPORT_V2_SHEET_NAME,
    headers: PRODUCT_BATCH_IMPORT_V2_HEADERS,
    maxRows: PRODUCT_BATCH_IMPORT_LIMITS.itemRows,
    richValuePlaceholders,
    actualReferences,
  });

  if (productRows.length === 0) {
    throw workbookError(
      "WORKBOOK_PRODUCTS_EMPTY",
      "Worksheet PRODUCTS harus mempunyai minimal satu data row.",
    );
  }

  const mastersByKey = new Map<string, ParsedProductBatchMasterRow>();
  const itemRows = productRows.map((row): ParsedProductBatchItemRow => {
    const categoryInput = normalizeText(String(row.normalizedPayload.category ?? ""));
    const masterName = normalizeText(
      String(row.normalizedPayload.product_master_name ?? ""),
    );
    const groupKey = createHash("sha256")
      .update(
        `${normalizeV2GroupValue(categoryInput)}\0${normalizeV2GroupValue(masterName)}`,
      )
      .digest("hex")
      .slice(0, 24);
    const masterKey = `V2-MASTER-${groupKey}`;
    const rowKey = `V2-ROW-${row.rowNumber}`;

    if (!mastersByKey.has(masterKey)) {
      const normalizedPayload: ProductBatchRawPayload = {
        master_key: masterKey,
        name: masterName,
        category_code: categoryInput,
        brand: null,
        material: null,
        collection: null,
        description: null,
        primary_image: null,
        status: "active",
        _template_version: PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
        _category_input: categoryInput,
        _product_master_name: masterName,
      };
      mastersByKey.set(masterKey, {
        rowNumber: row.rowNumber,
        rawPayload: row.rawPayload,
        normalizedPayload,
        rowFingerprint: fingerprintPayload(normalizedPayload),
      });
    }

    const normalizedPayload: ProductBatchRawPayload = {
      row_key: rowKey,
      master_key: masterKey,
      display_name: row.normalizedPayload.display_name ?? null,
      outlet_code: row.normalizedPayload.outlet_code ?? null,
      weight_gram: row.normalizedPayload.weight_gram ?? null,
      purity_percent: row.normalizedPayload.purity_percent ?? null,
      exchange_purity_percent:
        row.normalizedPayload.exchange_purity_percent ?? null,
      size: null,
      color: row.normalizedPayload.color ?? null,
      gemstone: null,
      cost_amount: null,
      selling_amount: null,
      price_per_gram: null,
      deduction_per_gram: row.normalizedPayload.deduction_per_gram ?? null,
      condition: row.normalizedPayload.condition ?? null,
      location_code: null,
      physical_image: row.normalizedPayload.physical_image ?? null,
      internal_notes: row.normalizedPayload.internal_notes ?? null,
      initial_availability: "available",
      _template_version: PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
      _category_input: categoryInput,
      _product_master_name: masterName,
    };

    return {
      rowNumber: row.rowNumber,
      rawPayload: row.rawPayload,
      normalizedPayload,
      rowFingerprint: fingerprintPayload(normalizedPayload),
    };
  });

  const masterRows = Array.from(mastersByKey.values());
  if (masterRows.length > PRODUCT_BATCH_IMPORT_LIMITS.masterRows) {
    throw workbookError(
      "WORKBOOK_ROW_LIMIT",
      `Jumlah Product Master unik melebihi batas ${PRODUCT_BATCH_IMPORT_LIMITS.masterRows}.`,
    );
  }

  return {
    workbookSha256: createHash("sha256").update(buffer).digest("hex"),
    templateVersion: PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
    importType: PRODUCT_BATCH_IMPORT_TYPE,
    metadata: {
      template_version: PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
      import_type: PRODUCT_BATCH_IMPORT_TYPE,
    },
    masterRows,
    itemRows,
    warnings: [],
  };
}

function parseV1Workbook({
  workbook,
  buffer,
  richValuePlaceholders,
  actualReferences,
}: {
  workbook: XLSX.WorkBook;
  buffer: Buffer;
  richValuePlaceholders: ReadonlySet<string>;
  actualReferences: ReadonlyMap<string, string>;
}): ParsedProductBatchWorkbook {
  if (
    workbook.SheetNames.length !== PRODUCT_BATCH_IMPORT_SHEET_NAMES.length ||
    workbook.SheetNames.some(
      (name, index) => name !== PRODUCT_BATCH_IMPORT_SHEET_NAMES[index],
    )
  ) {
    throw workbookError(
      "WORKBOOK_SHEETS_INVALID",
      "Nama dan urutan worksheet harus exact sesuai template v1.",
    );
  }
  assertSheetVisibility(workbook, PRODUCT_BATCH_IMPORT_SHEET_NAMES);

  const metadataSheet = workbook.Sheets.METADATA;
  const masterSheet = workbook.Sheets.PRODUCT_MASTERS;
  const itemSheet = workbook.Sheets.PHYSICAL_PRODUCTS;
  const instructionsSheet = workbook.Sheets.INSTRUCTIONS;
  if (!metadataSheet || !masterSheet || !itemSheet || !instructionsSheet) {
    throw workbookError(
      "WORKBOOK_SHEETS_INVALID",
      "Worksheet wajib template v1 tidak lengkap.",
    );
  }

  const { metadata, warnings } = parseMetadata(metadataSheet, actualReferences);
  const masterRows = parseDataRows<ParsedProductBatchMasterRow>({
    worksheet: masterSheet,
    sheetName: "PRODUCT_MASTERS",
    headers: PRODUCT_BATCH_IMPORT_MASTER_HEADERS,
    maxRows: PRODUCT_BATCH_IMPORT_LIMITS.masterRows,
    richValuePlaceholders,
    actualReferences,
  });
  const itemRows = parseDataRows<ParsedProductBatchItemRow>({
    worksheet: itemSheet,
    sheetName: "PHYSICAL_PRODUCTS",
    headers: PRODUCT_BATCH_IMPORT_ITEM_HEADERS,
    maxRows: PRODUCT_BATCH_IMPORT_LIMITS.itemRows,
    richValuePlaceholders,
    actualReferences,
  });
  assertInstructionsSheet(instructionsSheet, actualReferences);

  return {
    workbookSha256: createHash("sha256").update(buffer).digest("hex"),
    templateVersion: metadata.template_version ?? "",
    importType: metadata.import_type ?? "",
    metadata,
    masterRows,
    itemRows,
    warnings,
  };
}

export function parseProductBatchWorkbook(
  buffer: Buffer,
  options: ProductBatchWorkbookParseOptions = {},
): ParsedProductBatchWorkbook {
  const maxBytes = options.allowEmbeddedImages
    ? PRODUCT_BATCH_IMPORT_LIMITS.xlsxUploadBytes
    : PRODUCT_BATCH_IMPORT_LIMITS.workbookBytes;
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw workbookError(
      "WORKBOOK_SIZE_INVALID",
      options.allowEmbeddedImages
        ? "Ukuran XLSX embedded kosong atau melebihi batas 100 MB."
        : "Ukuran workbook XLSX kosong atau melebihi batas 5 MB.",
    );
  }
  const { richValuePlaceholders, actualReferences } = inspectXlsxContainer(buffer, options);

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
      sheetRows: PRODUCT_BATCH_IMPORT_LIMITS.itemRows + 2,
    });
  } catch (error) {
    throw workbookError(
      "WORKBOOK_PARSE_FAILED",
      "Workbook XLSX tidak dapat dibaca atau rusak.",
      error,
    );
  }

  if (
    workbook.SheetNames.length === 1 &&
    workbook.SheetNames[0] === PRODUCT_BATCH_IMPORT_V2_SHEET_NAME
  ) {
    return parseV2Workbook({ workbook, buffer, richValuePlaceholders, actualReferences });
  }

  return parseV1Workbook({ workbook, buffer, richValuePlaceholders, actualReferences });
}

