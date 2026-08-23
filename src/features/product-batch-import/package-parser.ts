import { createHash } from "node:crypto";

import {
  extractProductBatchArchiveEntry,
  inspectProductBatchArchive,
  type ProductBatchArchiveInspection,
} from "./archive-parser";
import {
  PRODUCT_BATCH_IMPORT_LIMITS,
  type ProductBatchImportPackageKind,
} from "./contracts";
import { attachProductBatchEmbeddedImages } from "./embedded-image-parser";
import {
  buildProductBatchImageManifest,
  type ProductBatchImageManifest,
} from "./image-manifest";
import {
  parseProductBatchWorkbook,
  type ParsedProductBatchWorkbook,
} from "./xlsx-parser";
import {
  inspectStrictZipArchive,
  StrictZipError,
} from "./zip-reader";

export type ParsedProductBatchPackage = {
  packageKind: ProductBatchImportPackageKind;
  fileSha256: string;
  archive: ProductBatchArchiveInspection | null;
  workbook: ParsedProductBatchWorkbook;
  images: ProductBatchImageManifest;
};

export class ProductBatchPackageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProductBatchPackageError";
  }
}

function packageError(code: string, message: string, cause?: unknown) {
  return new ProductBatchPackageError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function fileExtension(fileName?: string) {
  if (!fileName) return null;
  const normalized = fileName.normalize("NFKC").trim().toLocaleLowerCase("en-US");
  if (normalized.endsWith(".zip")) return ".zip" as const;
  if (normalized.endsWith(".xlsx")) return ".xlsx" as const;
  return null;
}

function detectPackageKindFromContainer(buffer: Buffer): ProductBatchImportPackageKind {
  let inspection;
  try {
    inspection = inspectStrictZipArchive(buffer, {
      maxArchiveBytes: Math.max(
        PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes,
        PRODUCT_BATCH_IMPORT_LIMITS.xlsxUploadBytes,
      ),
      maxEntries: PRODUCT_BATCH_IMPORT_LIMITS.archiveEntries,
      maxUncompressedBytes: PRODUCT_BATCH_IMPORT_LIMITS.archiveUncompressedBytes,
      maxFileNameBytes: PRODUCT_BATCH_IMPORT_LIMITS.archiveEntryNameBytes,
    });
  } catch (error) {
    if (error instanceof StrictZipError) {
      throw packageError("PACKAGE_CONTAINER_INVALID", error.message, error);
    }
    throw error;
  }

  const paths = new Set(inspection.entries.map((entry) => entry.path));
  if (paths.has("[Content_Types].xml") && paths.has("xl/workbook.xml")) {
    return "xlsx_embedded";
  }
  const rootXlsxFiles = inspection.entries.filter(
    (entry) =>
      !entry.isDirectory &&
      !entry.path.includes("/") &&
      entry.path.toLocaleLowerCase("en-US").endsWith(".xlsx"),
  );
  if (rootXlsxFiles.length === 1) return "zip";
  throw packageError(
    "PACKAGE_TYPE_UNRECOGNIZED",
    "File bukan paket ZIP Product Batch Import atau workbook XLSX embedded yang didukung.",
  );
}

function resolvePackageKind(buffer: Buffer, fileName?: string): ProductBatchImportPackageKind {
  const extension = fileExtension(fileName);
  const detected = detectPackageKindFromContainer(buffer);
  if (extension === ".zip" && detected !== "zip") {
    throw packageError(
      "PACKAGE_EXTENSION_MISMATCH",
      "File berekstensi .zip tetapi isinya bukan paket ZIP Product Batch Import.",
    );
  }
  if (extension === ".xlsx" && detected !== "xlsx_embedded") {
    throw packageError(
      "PACKAGE_EXTENSION_MISMATCH",
      "File berekstensi .xlsx tetapi isinya bukan workbook XLSX Product Batch Import.",
    );
  }
  if (fileName && !extension) {
    throw packageError(
      "PACKAGE_EXTENSION_INVALID",
      "Product Batch Import hanya menerima file .zip atau .xlsx.",
    );
  }
  return detected;
}

export async function parseProductBatchImportPackage(
  inputBuffer: Buffer,
  options: { fileName?: string } = {},
): Promise<ParsedProductBatchPackage> {
  const fileSha256 = createHash("sha256").update(inputBuffer).digest("hex");
  const packageKind = resolvePackageKind(inputBuffer, options.fileName);

  if (packageKind === "zip") {
    const archive = inspectProductBatchArchive(inputBuffer);
    const workbookBuffer = extractProductBatchArchiveEntry(
      inputBuffer,
      archive.workbookEntry,
    );
    const workbook = parseProductBatchWorkbook(workbookBuffer);
    const images = await buildProductBatchImageManifest({
      archiveBuffer: inputBuffer,
      archive,
      workbook,
    });
    return { packageKind, fileSha256, archive, workbook, images };
  }

  const workbook = parseProductBatchWorkbook(inputBuffer, {
    allowEmbeddedImages: true,
  });
  const images = await attachProductBatchEmbeddedImages({
    workbookBuffer: inputBuffer,
    workbook,
  });
  return {
    packageKind,
    fileSha256,
    archive: null,
    workbook,
    images,
  };
}
