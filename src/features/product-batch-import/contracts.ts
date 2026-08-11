export const PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION = "1" as const;
export const PRODUCT_BATCH_IMPORT_TYPE = "master_and_physical_create" as const;
export const PRODUCT_BATCH_IMPORT_TEMPLATE_FILENAME =
  "asihjaya-product-batch-template-v1.xlsx";

export const PRODUCT_BATCH_IMPORT_ARCHIVE_LAYOUT = {
  workbookPath: "products.xlsx",
  masterDirectory: "masters/",
  physicalDirectory: "physical/",
} as const;

export const PRODUCT_BATCH_IMPORT_SHEET_NAMES = [
  "METADATA",
  "PRODUCT_MASTERS",
  "PHYSICAL_PRODUCTS",
  "INSTRUCTIONS",
] as const;

export const PRODUCT_BATCH_IMPORT_MASTER_HEADERS = [
  "master_key",
  "name",
  "category_code",
  "brand",
  "material",
  "collection",
  "description",
  "primary_image",
  "status",
] as const;

export const PRODUCT_BATCH_IMPORT_ITEM_HEADERS = [
  "row_key",
  "master_key",
  "display_name",
  "outlet_code",
  "weight_gram",
  "purity_percent",
  "exchange_purity_percent",
  "size",
  "color",
  "gemstone",
  "cost_amount",
  "selling_amount",
  "price_per_gram",
  "deduction_per_gram",
  "condition",
  "location_code",
  "physical_image",
  "internal_notes",
  "initial_availability",
] as const;

export const PRODUCT_BATCH_IMPORT_METADATA_HEADERS = ["key", "value"] as const;
export const PRODUCT_BATCH_IMPORT_INSTRUCTION_HEADERS = [
  "bagian",
  "panduan",
] as const;

export const PRODUCT_BATCH_IMPORT_MASTER_STATUSES = ["draft", "active"] as const;
export const PRODUCT_BATCH_IMPORT_ITEM_CONDITIONS = ["good", "damaged"] as const;
export const PRODUCT_BATCH_IMPORT_ITEM_AVAILABILITIES = [
  "draft",
  "available",
] as const;

export const PRODUCT_BATCH_IMPORT_SESSION_TTL_MS = 48 * 60 * 60 * 1000;

export const PRODUCT_BATCH_IMPORT_MAINTENANCE = {
  expireBatchSize: 100,
  maxExpireSessionsPerRun: 1_000,
  maxStorageObjectsPerOrganization: 10_000,
  orphanStorageGraceMs: 2 * 60 * 60 * 1000,
  staleCommittingMs: 30 * 60 * 1000,
  stagingWarningBytes: 512 * 1024 * 1024,
  stagingCriticalBytes: 1024 * 1024 * 1024,
  diskWarningPercent: 80,
  diskCriticalPercent: 90,
} as const;

export const PRODUCT_BATCH_IMPORT_LIMITS = {
  zipUploadBytes: 100 * 1024 * 1024,
  workbookBytes: 5 * 1024 * 1024,
  masterRows: 250,
  itemRows: 500,
  imageBytes: 5 * 1024 * 1024,
  archiveEntries: 2_000,
  archiveUncompressedBytes: 250 * 1024 * 1024,
  archiveEntryNameBytes: 512,
  workbookArchiveEntries: 256,
  workbookUncompressedBytes: 32 * 1024 * 1024,
  workbookCellTextChars: 16_384,
  workbookMetadataRows: 20,
  workbookInstructionRows: 100,
  imageInputPixels: 40_000_000,
} as const;

export const PRODUCT_BATCH_IMPORT_FORBIDDEN_OPERATOR_HEADERS = [
  "master_code",
  "product_master_id",
  "product_item_id",
  "sku",
  "barcode",
  "qr",
  "qr_value",
  "sequence",
  "sequence_number",
  "storage_key",
] as const;
