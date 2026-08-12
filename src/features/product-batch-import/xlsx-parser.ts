import { createHash } from "node:crypto";
import path from "node:path";

import * as XLSX from "xlsx";

import {
  PRODUCT_BATCH_IMPORT_ITEM_HEADERS,
  PRODUCT_BATCH_IMPORT_LIMITS,
  PRODUCT_BATCH_IMPORT_MASTER_HEADERS,
  PRODUCT_BATCH_IMPORT_METADATA_HEADERS,
  PRODUCT_BATCH_IMPORT_SHEET_NAMES,
  PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
  PRODUCT_BATCH_IMPORT_TYPE,
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

function collectRichValuePlaceholderCells({
  buffer,
  inspection,
}: {
  buffer: Buffer;
  inspection: ReturnType<typeof inspectStrictZipArchive>;
}) {
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
    const cellTags = worksheetXml.match(/<(?:[A-Za-z_][\w.-]*:)?c\b[^>]*>/gi) ?? [];
    for (const cellTag of cellTags) {
      const vmText = readXmlAttribute(cellTag, "vm");
      if (vmText === null) continue;
      const vm = Number(vmText);
      const address = readXmlAttribute(cellTag, "r");
      if (!Number.isSafeInteger(vm) || vm <= 0 || !address) {
        throw workbookError(
          "WORKBOOK_RICH_VALUE_INVALID",
          `Rich-value cell tidak valid pada worksheet ${sheetName}.`,
        );
      }
      let decoded: XLSX.CellAddress;
      try {
        decoded = XLSX.utils.decode_cell(address);
      } catch (error) {
        throw workbookError(
          "WORKBOOK_RICH_VALUE_INVALID",
          `Alamat rich-value cell tidak valid pada ${sheetName}!${address}.`,
          error,
        );
      }
      const validTarget =
        (sheetName === "PRODUCT_MASTERS" && decoded.r >= 1 && decoded.c === 7) ||
        (sheetName === "PHYSICAL_PRODUCTS" && decoded.r >= 1 && decoded.c === 16);
      if (!validTarget) {
        throw workbookError(
          "WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID",
          `Picture in Cell hanya boleh berada pada primary_image atau physical_image, bukan ${sheetName}!${address}.`,
        );
      }
      placeholders.add(`${sheetName}!${address.toUpperCase()}`);
    }
  }

  return placeholders;
}

export type ProductBatchWorkbookParseOptions = {
  allowEmbeddedImages?: boolean;
};

function inspectXlsxContainer(
  buffer: Buffer,
  options: ProductBatchWorkbookParseOptions,
): Set<string> {
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

  return options.allowEmbeddedImages
    ? collectRichValuePlaceholderCells({ buffer, inspection })
    : new Set<string>();
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
    throw workbookError("WORKBOOK_RANGE_LIMIT", `Worksheet ${sheetName} melebihi batas row/column template v1.`);
  }
  return range;
}

function assertSheetVisibility(workbook: XLSX.WorkBook): void {
  const sheetMetadata = workbook.Workbook?.Sheets ?? [];
  if (sheetMetadata.length !== PRODUCT_BATCH_IMPORT_SHEET_NAMES.length) {
    throw workbookError("WORKBOOK_SHEETS_INVALID", "Workbook harus mempunyai tepat empat worksheet template v1.");
  }
  for (const sheet of sheetMetadata) {
    if ((sheet.Hidden ?? 0) !== 0) {
      throw workbookError("WORKBOOK_HIDDEN_SHEET", `Hidden worksheet tidak diizinkan: ${sheet.name}.`);
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
    throw workbookError("WORKBOOK_HEADERS_INVALID", `Header ${sheetName} harus exact sesuai template v1.`);
  }
}

function getFullReference(worksheet: XLSX.WorkSheet): string | null {
  const fullReference = (worksheet as XLSX.WorkSheet & { "!fullref"?: unknown })["!fullref"];
  if (typeof fullReference === "string") return fullReference;
  return worksheet["!ref"] ?? null;
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
}: {
  worksheet: XLSX.WorkSheet;
  sheetName: string;
  headers: readonly string[];
  maxRows: number;
  richValuePlaceholders: ReadonlySet<string>;
}): T[] {
  const reference = getFullReference(worksheet);
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

function parseMetadata(worksheet: XLSX.WorkSheet): {
  metadata: Record<string, string>;
  warnings: ProductBatchWorkbookWarning[];
} {
  const reference = getFullReference(worksheet);
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

  if (metadata.template_version !== PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION) {
    throw workbookError(
      "WORKBOOK_TEMPLATE_UNSUPPORTED",
      `template_version ${metadata.template_version || "(kosong)"} tidak didukung.`,
    );
  }
  if (metadata.import_type !== PRODUCT_BATCH_IMPORT_TYPE) {
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

function assertInstructionsSheet(worksheet: XLSX.WorkSheet): void {
  const reference = getFullReference(worksheet);
  if (!reference) {
    throw workbookError("WORKBOOK_INSTRUCTIONS_INVALID", "Sheet INSTRUCTIONS tidak boleh kosong.");
  }
  decodeRange(reference, "INSTRUCTIONS", 2, PRODUCT_BATCH_IMPORT_LIMITS.workbookInstructionRows);
  assertExactHeaders(worksheet, "INSTRUCTIONS", ["bagian", "panduan"]);
  assertNoFormulaOrHyperlink(worksheet, "INSTRUCTIONS");
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
        : "Ukuran products.xlsx kosong atau melebihi batas 5 MB.",
    );
  }
  const richValuePlaceholders = inspectXlsxContainer(buffer, options);

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
    throw workbookError("WORKBOOK_PARSE_FAILED", "Workbook XLSX tidak dapat dibaca atau rusak.", error);
  }

  if (
    workbook.SheetNames.length !== PRODUCT_BATCH_IMPORT_SHEET_NAMES.length ||
    workbook.SheetNames.some((name, index) => name !== PRODUCT_BATCH_IMPORT_SHEET_NAMES[index])
  ) {
    throw workbookError("WORKBOOK_SHEETS_INVALID", "Nama dan urutan worksheet harus exact sesuai template v1.");
  }
  assertSheetVisibility(workbook);

  const metadataSheet = workbook.Sheets.METADATA;
  const masterSheet = workbook.Sheets.PRODUCT_MASTERS;
  const itemSheet = workbook.Sheets.PHYSICAL_PRODUCTS;
  const instructionsSheet = workbook.Sheets.INSTRUCTIONS;
  if (!metadataSheet || !masterSheet || !itemSheet || !instructionsSheet) {
    throw workbookError("WORKBOOK_SHEETS_INVALID", "Worksheet wajib template v1 tidak lengkap.");
  }

  const { metadata, warnings } = parseMetadata(metadataSheet);
  const masterRows = parseDataRows<ParsedProductBatchMasterRow>({
    worksheet: masterSheet,
    sheetName: "PRODUCT_MASTERS",
    headers: PRODUCT_BATCH_IMPORT_MASTER_HEADERS,
    maxRows: PRODUCT_BATCH_IMPORT_LIMITS.masterRows,
    richValuePlaceholders,
  });
  const itemRows = parseDataRows<ParsedProductBatchItemRow>({
    worksheet: itemSheet,
    sheetName: "PHYSICAL_PRODUCTS",
    headers: PRODUCT_BATCH_IMPORT_ITEM_HEADERS,
    maxRows: PRODUCT_BATCH_IMPORT_LIMITS.itemRows,
    richValuePlaceholders,
  });
  assertInstructionsSheet(instructionsSheet);

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
