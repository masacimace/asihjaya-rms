import { createHash } from "node:crypto";

import sharp from "sharp";

import { PRODUCT_BATCH_IMPORT_LIMITS } from "./contracts";
import {
  extractProductBatchArchiveEntry,
  type ProductBatchArchiveImageEntry,
  type ProductBatchArchiveInspection,
} from "./archive-parser";
import type { ParsedProductBatchWorkbook } from "./xlsx-parser";

export type ProductBatchImageContentType = "image/jpeg" | "image/png" | "image/webp";

export type ProductBatchImageReference = {
  entityKind: "master" | "physical";
  rowNumber: number;
  rowKey: string | null;
};

export type ProductBatchImageManifestEntry = {
  archivePath: string;
  entityKind: "master" | "physical";
  fileName: string;
  normalizedFileName: string;
  sha256: string;
  contentType: ProductBatchImageContentType;
  byteSize: number;
  width: number;
  height: number;
  references: ProductBatchImageReference[];
};

export type ProductBatchImageManifestWarning = {
  code: "UNUSED_IMAGE";
  archivePath: string;
  message: string;
};

export type ProductBatchImageManifest = {
  entries: ProductBatchImageManifestEntry[];
  warnings: ProductBatchImageManifestWarning[];
};

export class ProductBatchImageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProductBatchImageError";
  }
}

function imageError(code: string, message: string, cause?: unknown) {
  return new ProductBatchImageError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

export function normalizeProductBatchImageReference(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw imageError("IMAGE_REFERENCE_INVALID", "Reference image harus berupa nama file text.");
  }

  const normalized = value.normalize("NFKC").trim();
  if (
    !normalized ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith(".") ||
    /^[A-Za-z]:/.test(normalized) ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized)
  ) {
    throw imageError(
      "IMAGE_REFERENCE_INVALID",
      `Reference image harus basename saja, bukan path/URL: ${value}.`,
    );
  }

  return normalized.toLocaleLowerCase("en-US");
}

function detectImageContentType(buffer: Buffer): ProductBatchImageContentType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function expectedContentType(fileName: string): ProductBatchImageContentType | null {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLocaleLowerCase("en-US");
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return null;
}

async function validateImageBytes(
  buffer: Buffer,
  entry: ProductBatchArchiveImageEntry,
): Promise<Omit<ProductBatchImageManifestEntry, "references">> {
  if (buffer.length === 0 || buffer.length > PRODUCT_BATCH_IMPORT_LIMITS.imageBytes) {
    throw imageError("IMAGE_SIZE_INVALID", `Ukuran image tidak valid: ${entry.path}.`);
  }

  const detected = detectImageContentType(buffer);
  const expected = expectedContentType(entry.fileName);
  if (!detected || !expected || detected !== expected) {
    throw imageError(
      "IMAGE_MIME_MISMATCH",
      `Extension dan bytes image tidak cocok/unsupported: ${entry.path}.`,
    );
  }

  try {
    const decoder = sharp(buffer, {
      failOn: "error",
      limitInputPixels: PRODUCT_BATCH_IMPORT_LIMITS.imageInputPixels,
      animated: false,
    });
    const metadata = await decoder.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!width || !height || width * height > PRODUCT_BATCH_IMPORT_LIMITS.imageInputPixels) {
      throw imageError("IMAGE_DIMENSIONS_INVALID", `Dimensi image tidak valid/terlalu besar: ${entry.path}.`);
    }
    if ((metadata.pages ?? 1) > 1) {
      throw imageError("IMAGE_ANIMATED_UNSUPPORTED", `Animated/multi-page image tidak didukung: ${entry.path}.`);
    }

    await sharp(buffer, {
      failOn: "error",
      limitInputPixels: PRODUCT_BATCH_IMPORT_LIMITS.imageInputPixels,
      animated: false,
    })
      .rotate()
      .resize({ width: 1, height: 1, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    return {
      archivePath: entry.path,
      entityKind: entry.imageKind,
      fileName: entry.fileName,
      normalizedFileName: entry.normalizedFileName,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      contentType: detected,
      byteSize: buffer.length,
      width,
      height,
    };
  } catch (error) {
    if (error instanceof ProductBatchImageError) throw error;
    throw imageError("IMAGE_DECODE_FAILED", `Image rusak/tidak dapat didecode: ${entry.path}.`, error);
  }
}

function rowString(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectWorkbookReferences(workbook: ParsedProductBatchWorkbook) {
  const masterReferences = new Map<string, ProductBatchImageReference[]>();
  const physicalReferences = new Map<string, ProductBatchImageReference[]>();

  for (const row of workbook.masterRows) {
    const reference = normalizeProductBatchImageReference(row.normalizedPayload.primary_image);
    if (!reference) continue;
    const current = masterReferences.get(reference) ?? [];
    current.push({
      entityKind: "master",
      rowNumber: row.rowNumber,
      rowKey: rowString(row.normalizedPayload, "master_key"),
    });
    masterReferences.set(reference, current);
  }

  for (const row of workbook.itemRows) {
    const reference = normalizeProductBatchImageReference(row.normalizedPayload.physical_image);
    if (!reference) continue;
    const current = physicalReferences.get(reference) ?? [];
    current.push({
      entityKind: "physical",
      rowNumber: row.rowNumber,
      rowKey: rowString(row.normalizedPayload, "row_key"),
    });
    physicalReferences.set(reference, current);
  }

  return { masterReferences, physicalReferences };
}

export async function buildProductBatchImageManifest({
  archiveBuffer,
  archive,
  workbook,
}: {
  archiveBuffer: Buffer;
  archive: ProductBatchArchiveInspection;
  workbook: ParsedProductBatchWorkbook;
}): Promise<ProductBatchImageManifest> {
  const { masterReferences, physicalReferences } = collectWorkbookReferences(workbook);
  const availableMasters = new Set(
    archive.imageEntries.filter((entry) => entry.imageKind === "master").map((entry) => entry.normalizedFileName),
  );
  const availablePhysical = new Set(
    archive.imageEntries.filter((entry) => entry.imageKind === "physical").map((entry) => entry.normalizedFileName),
  );

  for (const reference of masterReferences.keys()) {
    if (!availableMasters.has(reference)) {
      throw imageError("IMAGE_REFERENCE_MISSING", `Master image direferensikan tetapi tidak ditemukan: ${reference}.`);
    }
  }
  for (const reference of physicalReferences.keys()) {
    if (!availablePhysical.has(reference)) {
      throw imageError("IMAGE_REFERENCE_MISSING", `Physical image direferensikan tetapi tidak ditemukan: ${reference}.`);
    }
  }

  const entries: ProductBatchImageManifestEntry[] = [];
  const warnings: ProductBatchImageManifestWarning[] = [];

  for (const entry of archive.imageEntries) {
    const bytes = extractProductBatchArchiveEntry(archiveBuffer, entry);
    const validated = await validateImageBytes(bytes, entry);
    const references =
      entry.imageKind === "master"
        ? masterReferences.get(entry.normalizedFileName) ?? []
        : physicalReferences.get(entry.normalizedFileName) ?? [];

    entries.push({ ...validated, references });
    if (references.length === 0) {
      warnings.push({
        code: "UNUSED_IMAGE",
        archivePath: entry.path,
        message: `Image valid tidak direferensikan workbook: ${entry.path}.`,
      });
    }
  }

  return { entries, warnings };
}
