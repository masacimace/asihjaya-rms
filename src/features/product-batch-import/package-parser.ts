import {
  extractProductBatchArchiveEntry,
  inspectProductBatchArchive,
  type ProductBatchArchiveInspection,
} from "./archive-parser";
import {
  buildProductBatchImageManifest,
  type ProductBatchImageManifest,
} from "./image-manifest";
import {
  parseProductBatchWorkbook,
  type ParsedProductBatchWorkbook,
} from "./xlsx-parser";

export type ParsedProductBatchPackage = {
  archive: ProductBatchArchiveInspection;
  workbook: ParsedProductBatchWorkbook;
  images: ProductBatchImageManifest;
};

export async function parseProductBatchImportPackage(
  archiveBuffer: Buffer,
): Promise<ParsedProductBatchPackage> {
  const archive = inspectProductBatchArchive(archiveBuffer);
  const workbookBuffer = extractProductBatchArchiveEntry(
    archiveBuffer,
    archive.workbookEntry,
  );
  const workbook = parseProductBatchWorkbook(workbookBuffer);
  const images = await buildProductBatchImageManifest({
    archiveBuffer,
    archive,
    workbook,
  });

  return { archive, workbook, images };
}
