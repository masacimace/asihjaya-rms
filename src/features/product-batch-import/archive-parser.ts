import { createHash } from "node:crypto";

import {
  PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT,
  PRODUCT_BATCH_IMPORT_LIMITS,
} from "./contracts";
import {
  extractStrictZipEntry,
  inspectStrictZipArchive,
  StrictZipError,
  type StrictZipEntry,
} from "./zip-reader";

const IMAGE_PATH_PATTERN = /^(masters|physical)\/([^/]+)$/;
const ALLOWED_DIRECTORY_PATHS = new Set<string>([
  PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.masterDirectory,
  PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.physicalDirectory,
]);
const ARCHIVE_STRUCTURE_GUIDANCE =
  "Struktur ZIP harus menaruh products.xlsx, masters/, dan physical/ langsung di root ZIP. Jangan ZIP folder induknya.";
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export type ProductBatchArchiveImageKind = "master" | "physical";

export type ProductBatchArchiveImageEntry = StrictZipEntry & {
  imageKind: ProductBatchArchiveImageKind;
  fileName: string;
  normalizedFileName: string;
};

export type ProductBatchArchiveInspection = {
  archiveSha256: string;
  byteSize: number;
  workbookEntry: StrictZipEntry;
  imageEntries: ProductBatchArchiveImageEntry[];
  totalEntries: number;
  totalUncompressedBytes: number;
};

export class ProductBatchArchiveError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProductBatchArchiveError";
  }
}

function archiveError(code: string, message: string, cause?: unknown) {
  return new ProductBatchArchiveError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function normalizeImageLookupName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex < 0
    ? ""
    : fileName.slice(dotIndex).toLocaleLowerCase("en-US");
}

function assertSafeImageFileName(fileName: string, archivePath: string): void {
  const normalized = fileName.normalize("NFKC").trim();
  if (!normalized || normalized !== fileName || normalized.startsWith(".")) {
    throw archiveError(
      "ARCHIVE_IMAGE_NAME_INVALID",
      `Nama image tidak valid: ${archivePath}.`,
    );
  }
  if (!ALLOWED_IMAGE_EXTENSIONS.has(getExtension(normalized))) {
    throw archiveError(
      "ARCHIVE_FILE_UNSUPPORTED",
      `File tidak didukung pada archive: ${archivePath}.`,
    );
  }
}

export function inspectProductBatchArchive(
  buffer: Buffer,
): ProductBatchArchiveInspection {
  let zip;
  try {
    zip = inspectStrictZipArchive(buffer, {
      maxArchiveBytes: PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes,
      maxEntries: PRODUCT_BATCH_IMPORT_LIMITS.archiveEntries,
      maxUncompressedBytes:
        PRODUCT_BATCH_IMPORT_LIMITS.archiveUncompressedBytes,
      maxFileNameBytes: PRODUCT_BATCH_IMPORT_LIMITS.archiveEntryNameBytes,
    });
  } catch (error) {
    if (error instanceof StrictZipError) {
      throw archiveError(error.code, error.message, error);
    }
    throw error;
  }

  let workbookEntry: StrictZipEntry | null = null;
  const imageEntries: ProductBatchArchiveImageEntry[] = [];
  const normalizedImagePaths = new Set<string>();

  for (const entry of zip.entries) {
    if (entry.isDirectory) {
      if (!ALLOWED_DIRECTORY_PATHS.has(entry.path)) {
        throw archiveError(
          "ARCHIVE_PATH_UNSUPPORTED",
          `Folder tidak didukung: ${entry.path}. ${ARCHIVE_STRUCTURE_GUIDANCE}`,
        );
      }
      continue;
    }

    if (entry.path === PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT.workbookPath) {
      if (workbookEntry) {
        throw archiveError(
          "ARCHIVE_WORKBOOK_DUPLICATE",
          "Archive hanya boleh mempunyai satu products.xlsx.",
        );
      }
      if (entry.uncompressedSize > PRODUCT_BATCH_IMPORT_LIMITS.workbookBytes) {
        throw archiveError(
          "ARCHIVE_WORKBOOK_TOO_LARGE",
          "products.xlsx melebihi batas 5 MB.",
        );
      }
      workbookEntry = entry;
      continue;
    }

    const imageMatch = entry.path.match(IMAGE_PATH_PATTERN);
    if (!imageMatch) {
      throw archiveError(
        "ARCHIVE_PATH_UNSUPPORTED",
        `File/path tidak didukung: ${entry.path}. ${ARCHIVE_STRUCTURE_GUIDANCE}`,
      );
    }

    const folder = imageMatch[1];
    const fileName = imageMatch[2] ?? "";
    assertSafeImageFileName(fileName, entry.path);
    if (entry.uncompressedSize === 0) {
      throw archiveError(
        "ARCHIVE_IMAGE_EMPTY",
        `Image kosong ditolak: ${entry.path}.`,
      );
    }
    if (entry.uncompressedSize > PRODUCT_BATCH_IMPORT_LIMITS.imageBytes) {
      throw archiveError(
        "ARCHIVE_IMAGE_TOO_LARGE",
        `Image melebihi batas 5 MB: ${entry.path}.`,
      );
    }

    const normalizedFileName = normalizeImageLookupName(fileName);
    const normalizedPath = `${folder}/${normalizedFileName}`;
    if (normalizedImagePaths.has(normalizedPath)) {
      throw archiveError(
        "ARCHIVE_IMAGE_DUPLICATE_NORMALIZED",
        `Nama image duplicate setelah normalization/case-fold: ${entry.path}.`,
      );
    }
    normalizedImagePaths.add(normalizedPath);

    imageEntries.push({
      ...entry,
      imageKind: folder === "masters" ? "master" : "physical",
      fileName,
      normalizedFileName,
    });
  }

  if (!workbookEntry) {
    throw archiveError(
      "ARCHIVE_WORKBOOK_MISSING",
      `products.xlsx wajib tersedia tepat di root ZIP. ${ARCHIVE_STRUCTURE_GUIDANCE}`,
    );
  }

  return {
    archiveSha256: createHash("sha256").update(buffer).digest("hex"),
    byteSize: buffer.length,
    workbookEntry,
    imageEntries,
    totalEntries: zip.entries.length,
    totalUncompressedBytes: zip.entries.reduce(
      (total, entry) => total + entry.uncompressedSize,
      0,
    ),
  };
}

export function extractProductBatchArchiveEntry(
  buffer: Buffer,
  entry: StrictZipEntry,
): Buffer {
  try {
    return extractStrictZipEntry(buffer, entry);
  } catch (error) {
    if (error instanceof StrictZipError) {
      throw archiveError(error.code, error.message, error);
    }
    throw error;
  }
}
