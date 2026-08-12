import { createHash } from "node:crypto";
import path from "node:path";

import {
  PRODUCT_BATCH_IMPORT_LIMITS,
  PRODUCT_BATCH_IMPORT_SHEET_NAMES,
} from "./contracts";
import {
  ProductBatchImageError,
  type ProductBatchImageManifest,
  type ProductBatchImageManifestEntry,
  validateProductBatchImageBytes,
} from "./image-manifest";
import type {
  ParsedProductBatchItemRow,
  ParsedProductBatchMasterRow,
  ParsedProductBatchWorkbook,
} from "./xlsx-parser";
import {
  ProductBatchRichValueImageError,
  resolveProductBatchRichValueImages,
} from "./rich-value-image-parser";
import {
  extractStrictZipEntry,
  inspectStrictZipArchive,
  StrictZipError,
  type StrictZipEntry,
} from "./zip-reader";

const RELATIONSHIP_TYPE_WORKSHEET_SUFFIX = "/worksheet";
const RELATIONSHIP_TYPE_DRAWING_SUFFIX = "/drawing";
const RELATIONSHIP_TYPE_IMAGE_SUFFIX = "/image";
const SUPPORTED_MEDIA_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const IMAGE_TARGETS = {
  PRODUCT_MASTERS: {
    entityKind: "master" as const,
    columnIndex: 7,
    field: "primary_image" as const,
    keyField: "master_key" as const,
  },
  PHYSICAL_PRODUCTS: {
    entityKind: "physical" as const,
    columnIndex: 16,
    field: "physical_image" as const,
    keyField: "row_key" as const,
  },
} as const;

type SupportedImageSheetName = keyof typeof IMAGE_TARGETS;

type Relationship = {
  id: string;
  type: string;
  target: string;
  targetMode: string | null;
};

type EmbeddedPicture = {
  sheetName: SupportedImageSheetName;
  rowNumber: number;
  columnIndex: number;
  relationshipId: string;
};

export class ProductBatchEmbeddedImageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProductBatchEmbeddedImageError";
  }
}

function embeddedError(code: string, message: string, cause?: unknown) {
  return new ProductBatchEmbeddedImageError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function readXmlAttribute(tag: string, attributeName: string): string | null {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(
    new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*["']([^"']*)["']`, "i"),
  );
  return match?.[1] ?? null;
}

function parseRelationships(xml: string, sourcePath: string): Relationship[] {
  const tags = xml.match(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b[^>]*>/gi) ?? [];
  return tags.map((tag) => {
    const id = readXmlAttribute(tag, "Id");
    const type = readXmlAttribute(tag, "Type");
    const target = readXmlAttribute(tag, "Target");
    if (!id || !type || !target) {
      throw embeddedError(
        "WORKBOOK_RELATIONSHIP_INVALID",
        `Relationship OOXML tidak lengkap pada ${sourcePath}.`,
      );
    }
    return {
      id,
      type,
      target,
      targetMode: readXmlAttribute(tag, "TargetMode"),
    };
  });
}

function relationshipsById(xml: string, sourcePath: string) {
  const map = new Map<string, Relationship>();
  for (const relationship of parseRelationships(xml, sourcePath)) {
    if (map.has(relationship.id)) {
      throw embeddedError(
        "WORKBOOK_RELATIONSHIP_INVALID",
        `Relationship Id duplicate pada ${sourcePath}: ${relationship.id}.`,
      );
    }
    if (relationship.targetMode?.toLocaleLowerCase("en-US") === "external") {
      throw embeddedError(
        "WORKBOOK_ACTIVE_CONTENT_REJECTED",
        `External relationship tidak diizinkan: ${sourcePath} -> ${relationship.target}.`,
      );
    }
    map.set(relationship.id, relationship);
  }
  return map;
}

function normalizeRelationshipTarget(sourcePartPath: string, target: string): string {
  if (!target || target.includes("\\") || target.includes("\0")) {
    throw embeddedError(
      "WORKBOOK_RELATIONSHIP_INVALID",
      `Target relationship tidak valid pada ${sourcePartPath}.`,
    );
  }
  if (target.startsWith("/") || /^[A-Za-z]:/.test(target) || /^[a-z][a-z0-9+.-]*:/i.test(target)) {
    throw embeddedError(
      "WORKBOOK_RELATIONSHIP_INVALID",
      `Target relationship absolute/external ditolak pada ${sourcePartPath}: ${target}.`,
    );
  }

  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePartPath), target));
  if (
    !resolved ||
    resolved === "." ||
    resolved === ".." ||
    resolved.startsWith("../") ||
    resolved.includes("/../")
  ) {
    throw embeddedError(
      "WORKBOOK_RELATIONSHIP_INVALID",
      `Target relationship keluar dari package OOXML: ${sourcePartPath} -> ${target}.`,
    );
  }
  return resolved;
}

function relationshipPartPath(sourcePartPath: string) {
  return path.posix.join(
    path.posix.dirname(sourcePartPath),
    "_rels",
    `${path.posix.basename(sourcePartPath)}.rels`,
  );
}

function getEntry(
  entriesByPath: Map<string, StrictZipEntry>,
  entryPath: string,
  code: string,
  message: string,
) {
  const entry = entriesByPath.get(entryPath);
  if (!entry || entry.isDirectory) throw embeddedError(code, message);
  return entry;
}

function extractText(
  workbookBuffer: Buffer,
  entriesByPath: Map<string, StrictZipEntry>,
  entryPath: string,
  code: string,
  message: string,
) {
  const entry = getEntry(entriesByPath, entryPath, code, message);
  try {
    return extractStrictZipEntry(workbookBuffer, entry).toString("utf8");
  } catch (error) {
    if (error instanceof StrictZipError) {
      throw embeddedError("WORKBOOK_CONTAINER_INVALID", error.message, error);
    }
    throw error;
  }
}

function extractBytes(
  workbookBuffer: Buffer,
  entriesByPath: Map<string, StrictZipEntry>,
  entryPath: string,
) {
  const entry = getEntry(
    entriesByPath,
    entryPath,
    "WORKBOOK_EMBEDDED_IMAGE_MISSING",
    `Media embedded tidak ditemukan: ${entryPath}.`,
  );
  try {
    return extractStrictZipEntry(workbookBuffer, entry);
  } catch (error) {
    if (error instanceof StrictZipError) {
      throw embeddedError("WORKBOOK_CONTAINER_INVALID", error.message, error);
    }
    throw error;
  }
}

function parseWorkbookSheetRelationshipIds(workbookXml: string) {
  const result = new Map<string, string>();
  const sheetTags = workbookXml.match(/<(?:[A-Za-z_][\w.-]*:)?sheet\b[^>]*>/gi) ?? [];
  for (const tag of sheetTags) {
    const name = readXmlAttribute(tag, "name");
    const relationshipId = readXmlAttribute(tag, "r:id");
    if (!name || !relationshipId) {
      throw embeddedError(
        "WORKBOOK_OOXML_INVALID",
        "Definisi worksheet pada xl/workbook.xml tidak lengkap.",
      );
    }
    result.set(name, relationshipId);
  }
  return result;
}

function parseWorksheetDrawingRelationshipId(worksheetXml: string, sheetName: string) {
  const drawingTags = worksheetXml.match(/<(?:[A-Za-z_][\w.-]*:)?drawing\b[^>]*\/?\s*>/gi) ?? [];
  if (drawingTags.length > 1) {
    throw embeddedError(
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Worksheet ${sheetName} mempunyai lebih dari satu drawing relationship.`,
    );
  }
  if (!drawingTags.length) return null;
  const relationshipId = readXmlAttribute(drawingTags[0]!, "r:id");
  if (!relationshipId) {
    throw embeddedError(
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Drawing worksheet ${sheetName} tidak mempunyai r:id valid.`,
    );
  }
  return relationshipId;
}

function integerTagValue(xml: string, localName: string, label: string) {
  const regex = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${localName}\\b[^>]*>\\s*(\\d+)\\s*</(?:[A-Za-z_][\\w.-]*:)?${localName}>`,
    "i",
  );
  const match = xml.match(regex);
  if (!match) {
    throw embeddedError(
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Anchor drawing tidak mempunyai ${label} yang valid.`,
    );
  }
  const value = Number(match[1]);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw embeddedError(
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Anchor drawing mempunyai ${label} tidak valid.`,
    );
  }
  return value;
}

function parseDrawingPictures(
  drawingXml: string,
  sheetName: SupportedImageSheetName,
): EmbeddedPicture[] {
  if (/<(?:[A-Za-z_][\w.-]*:)?absoluteAnchor\b/i.test(drawingXml)) {
    throw embeddedError(
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Absolute-position drawing tidak didukung pada ${sheetName}. Gunakan satu gambar yang di-anchor ke cell image row.`,
    );
  }

  const pictures: EmbeddedPicture[] = [];
  const anchorPattern = /<(?:[A-Za-z_][\w.-]*:)?(twoCellAnchor|oneCellAnchor)\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(drawingXml))) {
    const body = match[2] ?? "";
    if (!/<(?:[A-Za-z_][\w.-]*:)?pic\b/i.test(body)) {
      throw embeddedError(
        "WORKBOOK_DRAWING_UNSUPPORTED",
        `Drawing non-picture tidak didukung pada ${sheetName}.`,
      );
    }
    if (
      /<(?:[A-Za-z_][\w.-]*:)?(?:sp|cxnSp|graphicFrame|grpSp|contentPart)\b/i.test(
        body,
      )
    ) {
      throw embeddedError(
        "WORKBOOK_DRAWING_UNSUPPORTED",
        `Shape/chart/object lain tidak boleh digabung dengan picture pada ${sheetName}.`,
      );
    }
    const fromMatch = body.match(
      /<(?:[A-Za-z_][\w.-]*:)?from\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?from>/i,
    );
    if (!fromMatch) {
      throw embeddedError(
        "WORKBOOK_DRAWING_UNSUPPORTED",
        `Picture pada ${sheetName} tidak mempunyai anchor cell awal.`,
      );
    }
    const columnIndex = integerTagValue(fromMatch[1] ?? "", "col", "column");
    const rowIndex = integerTagValue(fromMatch[1] ?? "", "row", "row");
    const blipTags = body.match(/<(?:[A-Za-z_][\w.-]*:)?blip\b[^>]*>/gi) ?? [];
    if (blipTags.length !== 1) {
      throw embeddedError(
        "WORKBOOK_DRAWING_UNSUPPORTED",
        `Picture pada ${sheetName} harus mempunyai tepat satu embedded image relationship.`,
      );
    }
    const relationshipId = readXmlAttribute(blipTags[0]!, "r:embed");
    if (!relationshipId) {
      throw embeddedError(
        "WORKBOOK_DRAWING_UNSUPPORTED",
        `Picture pada ${sheetName} harus embedded, bukan linked/external.`,
      );
    }
    pictures.push({
      sheetName,
      rowNumber: rowIndex + 1,
      columnIndex,
      relationshipId,
    });
  }

  const anchorTagCount = (drawingXml.match(/<(?:[A-Za-z_][\w.-]*:)?(?:twoCellAnchor|oneCellAnchor)\b/gi) ?? []).length;
  if (anchorTagCount !== pictures.length) {
    throw embeddedError(
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Drawing ${sheetName} mengandung anchor yang tidak dapat dipetakan secara deterministic.`,
    );
  }

  return pictures;
}

function rowKey(row: ParsedProductBatchMasterRow | ParsedProductBatchItemRow, field: string) {
  const value = row.normalizedPayload[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function setEmbeddedReference(
  row: ParsedProductBatchMasterRow | ParsedProductBatchItemRow,
  field: "primary_image" | "physical_image",
  syntheticFileName: string,
) {
  const existing = row.normalizedPayload[field];
  if (existing !== null && existing !== undefined && String(existing).trim()) {
    throw embeddedError(
      "WORKBOOK_EMBEDDED_IMAGE_TEXT_CONFLICT",
      `Cell ${field} row ${row.rowNumber} harus kosong untuk metode XLSX embedded; jangan campur nama file text dengan gambar embedded.`,
    );
  }
  row.rawPayload[field] = syntheticFileName;
  row.normalizedPayload[field] = syntheticFileName;
  row.rowFingerprint = createHash("sha256")
    .update(JSON.stringify(row.normalizedPayload))
    .digest("hex");
}

function fileExtension(mediaPath: string) {
  const extension = path.posix.extname(mediaPath).toLocaleLowerCase("en-US");
  return extension === ".jpeg" ? ".jpg" : extension;
}

function syntheticEmbeddedImageName(
  entityKind: "master" | "physical",
  rowNumber: number,
  extension: string,
) {
  const prefix = entityKind === "master" ? "EMBEDDED-MASTER" : "EMBEDDED-PHYSICAL";
  return `${prefix}-ROW-${String(rowNumber).padStart(4, "0")}${extension}`;
}

function drawingHasAnchoredContent(drawingXml: string) {
  return /<(?:[A-Za-z_][\w.-]*:)?(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)\b/i.test(
    drawingXml,
  );
}

function assertNoUnexpectedWorkbookDrawings(
  workbookBuffer: Buffer,
  entriesByPath: Map<string, StrictZipEntry>,
  workbookSheetIds: Map<string, string>,
  workbookRelationships: Map<string, Relationship>,
) {
  for (const sheetName of PRODUCT_BATCH_IMPORT_SHEET_NAMES) {
    if (sheetName === "PRODUCT_MASTERS" || sheetName === "PHYSICAL_PRODUCTS") continue;
    const relationshipId = workbookSheetIds.get(sheetName);
    if (!relationshipId) continue;
    const relationship = workbookRelationships.get(relationshipId);
    if (!relationship || !relationship.type.endsWith(RELATIONSHIP_TYPE_WORKSHEET_SUFFIX)) continue;
    const worksheetPath = normalizeRelationshipTarget("xl/workbook.xml", relationship.target);
    const worksheetXml = extractText(
      workbookBuffer,
      entriesByPath,
      worksheetPath,
      "WORKBOOK_OOXML_INVALID",
      `Worksheet ${sheetName} tidak ditemukan.`,
    );
    const drawingRelationshipId = parseWorksheetDrawingRelationshipId(
      worksheetXml,
      sheetName,
    );
    if (!drawingRelationshipId) continue;

    const worksheetRelationshipsPath = relationshipPartPath(worksheetPath);
    const worksheetRelationshipsXml = extractText(
      workbookBuffer,
      entriesByPath,
      worksheetRelationshipsPath,
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Relationship drawing untuk ${sheetName} tidak ditemukan.`,
    );
    const worksheetRelationships = relationshipsById(
      worksheetRelationshipsXml,
      worksheetRelationshipsPath,
    );
    const drawingRelationship = worksheetRelationships.get(drawingRelationshipId);
    if (
      !drawingRelationship ||
      !drawingRelationship.type.endsWith(RELATIONSHIP_TYPE_DRAWING_SUFFIX)
    ) {
      throw embeddedError(
        "WORKBOOK_DRAWING_UNSUPPORTED",
        `Relationship drawing ${sheetName} tidak valid.`,
      );
    }

    const drawingPath = normalizeRelationshipTarget(
      worksheetPath,
      drawingRelationship.target,
    );
    const drawingXml = extractText(
      workbookBuffer,
      entriesByPath,
      drawingPath,
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Drawing ${sheetName} tidak ditemukan.`,
    );

    // Google Sheets may export an empty drawing part for worksheets that contain
    // no actual drawing objects. The relationship itself is harmless; only
    // anchored drawing content on non-image sheets is rejected.
    if (drawingHasAnchoredContent(drawingXml)) {
      throw embeddedError(
        "WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID",
        `Gambar embedded hanya boleh berada pada kolom primary_image atau physical_image, bukan worksheet ${sheetName}.`,
      );
    }
  }
}

export async function attachProductBatchEmbeddedImages({
  workbookBuffer,
  workbook,
}: {
  workbookBuffer: Buffer;
  workbook: ParsedProductBatchWorkbook;
}): Promise<ProductBatchImageManifest> {
  let inspection;
  try {
    inspection = inspectStrictZipArchive(workbookBuffer, {
      maxArchiveBytes: PRODUCT_BATCH_IMPORT_LIMITS.xlsxUploadBytes,
      maxEntries: PRODUCT_BATCH_IMPORT_LIMITS.embeddedWorkbookArchiveEntries,
      maxUncompressedBytes: PRODUCT_BATCH_IMPORT_LIMITS.embeddedWorkbookUncompressedBytes,
      maxFileNameBytes: PRODUCT_BATCH_IMPORT_LIMITS.archiveEntryNameBytes,
    });
  } catch (error) {
    if (error instanceof StrictZipError) {
      throw embeddedError("WORKBOOK_CONTAINER_INVALID", error.message, error);
    }
    throw error;
  }

  const entriesByPath = new Map(inspection.entries.map((entry) => [entry.path, entry]));
  const workbookXml = extractText(
    workbookBuffer,
    entriesByPath,
    "xl/workbook.xml",
    "WORKBOOK_OOXML_INVALID",
    "xl/workbook.xml tidak ditemukan.",
  );
  const workbookRelationshipsXml = extractText(
    workbookBuffer,
    entriesByPath,
    "xl/_rels/workbook.xml.rels",
    "WORKBOOK_OOXML_INVALID",
    "Relationship workbook tidak ditemukan.",
  );
  const workbookSheetIds = parseWorkbookSheetRelationshipIds(workbookXml);
  const workbookRelationships = relationshipsById(
    workbookRelationshipsXml,
    "xl/_rels/workbook.xml.rels",
  );

  assertNoUnexpectedWorkbookDrawings(
    workbookBuffer,
    entriesByPath,
    workbookSheetIds,
    workbookRelationships,
  );

  const manifestEntries: ProductBatchImageManifestEntry[] = [];
  const usedMediaPaths = new Set<string>();
  const usedTargetCells = new Set<string>();

  const attachResolvedEmbeddedImage = async ({
    sheetName,
    rowNumber,
    columnIndex,
    mediaPath,
  }: {
    sheetName: SupportedImageSheetName;
    rowNumber: number;
    columnIndex: number;
    mediaPath: string;
  }) => {
    const target = IMAGE_TARGETS[sheetName];
    if (columnIndex !== target.columnIndex || rowNumber <= 1) {
      throw embeddedError(
        "WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID",
        `Gambar ${sheetName} harus berada tepat pada kolom ${target.field} di data row yang sesuai.`,
      );
    }

    const targetCell = `${sheetName}:${rowNumber}:${columnIndex}`;
    if (usedTargetCells.has(targetCell)) {
      throw embeddedError(
        "WORKBOOK_EMBEDDED_IMAGE_DUPLICATE",
        `Hanya satu gambar diperbolehkan pada ${sheetName} row ${rowNumber}.`,
      );
    }
    usedTargetCells.add(targetCell);

    const rows = sheetName === "PRODUCT_MASTERS" ? workbook.masterRows : workbook.itemRows;
    const row = rows.find((candidate) => candidate.rowNumber === rowNumber);
    if (!row) {
      throw embeddedError(
        "WORKBOOK_EMBEDDED_IMAGE_ROW_INVALID",
        `Gambar pada ${sheetName} row ${rowNumber} tidak mempunyai data row yang valid.`,
      );
    }

    if (!mediaPath.startsWith("xl/media/")) {
      throw embeddedError(
        "WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID",
        `Media picture harus berada di xl/media/: ${mediaPath}.`,
      );
    }
    const originalExtension = path.posix.extname(mediaPath).toLocaleLowerCase("en-US");
    if (!SUPPORTED_MEDIA_EXTENSIONS.has(originalExtension)) {
      throw embeddedError(
        "WORKBOOK_EMBEDDED_IMAGE_FORMAT_UNSUPPORTED",
        `Format embedded image tidak didukung: ${mediaPath}. Gunakan JPG/JPEG, PNG, atau WebP.`,
      );
    }
    if (usedMediaPaths.has(mediaPath)) {
      throw embeddedError(
        "WORKBOOK_EMBEDDED_IMAGE_REUSED",
        `Satu embedded media tidak boleh dipakai oleh lebih dari satu row: ${mediaPath}.`,
      );
    }
    usedMediaPaths.add(mediaPath);

    const bytes = extractBytes(workbookBuffer, entriesByPath, mediaPath);
    const extension = fileExtension(mediaPath);
    const syntheticFileName = syntheticEmbeddedImageName(
      target.entityKind,
      rowNumber,
      extension,
    );
    const normalizedFileName = syntheticFileName.toLocaleLowerCase("en-US");
    const validated = await validateProductBatchImageBytes({
      buffer: bytes,
      archivePath: mediaPath,
      entityKind: target.entityKind,
      fileName: syntheticFileName,
      normalizedFileName,
    });

    setEmbeddedReference(row, target.field, syntheticFileName);
    manifestEntries.push({
      ...validated,
      sourceBytes: bytes,
      references: [
        {
          entityKind: target.entityKind,
          rowNumber,
          rowKey: rowKey(row, target.keyField),
        },
      ],
    });
  };

  const richValueImages = resolveProductBatchRichValueImages(workbookBuffer);
  for (const picture of richValueImages) {
    await attachResolvedEmbeddedImage(picture);
  }

  for (const sheetName of ["PRODUCT_MASTERS", "PHYSICAL_PRODUCTS"] as const) {
    const relationshipId = workbookSheetIds.get(sheetName);
    if (!relationshipId) {
      throw embeddedError(
        "WORKBOOK_OOXML_INVALID",
        `Relationship worksheet ${sheetName} tidak ditemukan.`,
      );
    }
    const worksheetRelationship = workbookRelationships.get(relationshipId);
    if (!worksheetRelationship || !worksheetRelationship.type.endsWith(RELATIONSHIP_TYPE_WORKSHEET_SUFFIX)) {
      throw embeddedError(
        "WORKBOOK_OOXML_INVALID",
        `Relationship worksheet ${sheetName} tidak valid.`,
      );
    }
    const worksheetPath = normalizeRelationshipTarget(
      "xl/workbook.xml",
      worksheetRelationship.target,
    );
    const worksheetXml = extractText(
      workbookBuffer,
      entriesByPath,
      worksheetPath,
      "WORKBOOK_OOXML_INVALID",
      `Worksheet ${sheetName} tidak ditemukan.`,
    );
    const drawingRelationshipId = parseWorksheetDrawingRelationshipId(
      worksheetXml,
      sheetName,
    );
    if (!drawingRelationshipId) continue;

    const worksheetRelationshipsPath = relationshipPartPath(worksheetPath);
    const worksheetRelationshipsXml = extractText(
      workbookBuffer,
      entriesByPath,
      worksheetRelationshipsPath,
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Relationship drawing untuk ${sheetName} tidak ditemukan.`,
    );
    const worksheetRelationships = relationshipsById(
      worksheetRelationshipsXml,
      worksheetRelationshipsPath,
    );
    const drawingRelationship = worksheetRelationships.get(drawingRelationshipId);
    if (!drawingRelationship || !drawingRelationship.type.endsWith(RELATIONSHIP_TYPE_DRAWING_SUFFIX)) {
      throw embeddedError(
        "WORKBOOK_DRAWING_UNSUPPORTED",
        `Relationship drawing ${sheetName} tidak valid.`,
      );
    }
    const drawingPath = normalizeRelationshipTarget(
      worksheetPath,
      drawingRelationship.target,
    );
    const drawingXml = extractText(
      workbookBuffer,
      entriesByPath,
      drawingPath,
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Drawing ${sheetName} tidak ditemukan.`,
    );
    const pictures = parseDrawingPictures(drawingXml, sheetName);
    const drawingRelationshipsPath = relationshipPartPath(drawingPath);
    const drawingRelationshipsXml = extractText(
      workbookBuffer,
      entriesByPath,
      drawingRelationshipsPath,
      "WORKBOOK_DRAWING_UNSUPPORTED",
      `Relationship media untuk drawing ${sheetName} tidak ditemukan.`,
    );
    const drawingRelationships = relationshipsById(
      drawingRelationshipsXml,
      drawingRelationshipsPath,
    );

    for (const picture of pictures) {
      const mediaRelationship = drawingRelationships.get(picture.relationshipId);
      if (!mediaRelationship || !mediaRelationship.type.endsWith(RELATIONSHIP_TYPE_IMAGE_SUFFIX)) {
        throw embeddedError(
          "WORKBOOK_DRAWING_UNSUPPORTED",
          `Relationship picture ${sheetName} row ${picture.rowNumber} bukan embedded image.`,
        );
      }
      const mediaPath = normalizeRelationshipTarget(
        drawingPath,
        mediaRelationship.target,
      );
      await attachResolvedEmbeddedImage({
        sheetName,
        rowNumber: picture.rowNumber,
        columnIndex: picture.columnIndex,
        mediaPath,
      });
    }
  }

  const workbookMediaPaths = inspection.entries
    .filter((entry) => !entry.isDirectory && entry.path.startsWith("xl/media/"))
    .map((entry) => entry.path);
  const unexpectedMedia = workbookMediaPaths.filter((mediaPath) => !usedMediaPaths.has(mediaPath));
  if (unexpectedMedia.length > 0) {
    throw embeddedError(
      "WORKBOOK_EMBEDDED_IMAGE_UNREFERENCED",
      `Workbook mempunyai media embedded yang tidak dapat dipetakan ke kolom image: ${unexpectedMedia.slice(0, 5).join(", ")}.`,
    );
  }

  return { entries: manifestEntries, warnings: [] };
}

export function isProductBatchEmbeddedImageError(error: unknown) {
  return (
    error instanceof ProductBatchEmbeddedImageError ||
    error instanceof ProductBatchRichValueImageError ||
    error instanceof ProductBatchImageError
  );
}
