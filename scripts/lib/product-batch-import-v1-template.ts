import {
  buildXlsxBuffer,
  type ExportCell,
  type ExportSheet,
} from "../../src/lib/export-files";
import {
  PRODUCT_BATCH_IMPORT_INSTRUCTION_HEADERS,
  PRODUCT_BATCH_IMPORT_ITEM_HEADERS,
  PRODUCT_BATCH_IMPORT_LEGACY_TEMPLATE_VERSION,
  PRODUCT_BATCH_IMPORT_LEGACY_TYPE,
  PRODUCT_BATCH_IMPORT_MASTER_HEADERS,
  PRODUCT_BATCH_IMPORT_METADATA_HEADERS,
} from "../../src/features/product-batch-import/contracts";

export type LegacyProductBatchImportTemplateOptions = {
  generatedAt?: Date;
  includeSampleRows?: boolean;
};

function formatGeneratedDate(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

const masterSampleRows: ExportCell[][] = [
  [
    "MASTER-001",
    "Gelang Rantai Nori",
    "BRACELET",
    "Vancleef",
    "Emas",
    "Nori",
    "Contoh compatibility template v1.",
    "MASTER-001.jpg",
    "active",
  ],
  [
    "MASTER-002",
    "Cincin Polos Aster",
    "RING",
    "",
    "Emas",
    "Aster",
    "Contoh compatibility template v1.",
    "MASTER-002.jpg",
    "",
  ],
];

const itemSampleRows: ExportCell[][] = [
  [
    "ITEM-001",
    "MASTER-001",
    "",
    "OUTLET-01",
    3.125,
    75,
    75,
    "",
    "",
    "",
    "",
    2_500_000,
    "",
    "",
    "good",
    "",
    "ITEM-001.jpg",
    "Contoh item available dengan foto fisik.",
    "available",
  ],
  [
    "ITEM-002",
    "MASTER-001",
    "",
    "OUTLET-01",
    3.08,
    75,
    75,
    "",
    "",
    "",
    "",
    2_450_000,
    "",
    "",
    "good",
    "",
    "",
    "Contoh item available memakai master fallback.",
    "available",
  ],
  [
    "ITEM-003",
    "MASTER-002",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "good",
    "",
    "",
    "Contoh item draft.",
    "draft",
  ],
];

export function buildLegacyProductBatchImportTemplateSheets(
  options: LegacyProductBatchImportTemplateOptions = {},
): ExportSheet[] {
  const generatedAt = options.generatedAt ?? new Date();
  const includeSampleRows = options.includeSampleRows ?? true;

  return [
    {
      name: "METADATA",
      columns: [...PRODUCT_BATCH_IMPORT_METADATA_HEADERS],
      rows: [
        ["template_version", PRODUCT_BATCH_IMPORT_LEGACY_TEMPLATE_VERSION],
        ["import_type", PRODUCT_BATCH_IMPORT_LEGACY_TYPE],
        ["generated_at", formatGeneratedDate(generatedAt)],
      ],
      widths: [{ wch: 22 }, { wch: 36 }],
    },
    {
      name: "PRODUCT_MASTERS",
      columns: [...PRODUCT_BATCH_IMPORT_MASTER_HEADERS],
      rows: includeSampleRows ? masterSampleRows : [],
      widths: PRODUCT_BATCH_IMPORT_MASTER_HEADERS.map(() => ({ wch: 24 })),
    },
    {
      name: "PHYSICAL_PRODUCTS",
      columns: [...PRODUCT_BATCH_IMPORT_ITEM_HEADERS],
      rows: includeSampleRows ? itemSampleRows : [],
      widths: PRODUCT_BATCH_IMPORT_ITEM_HEADERS.map(() => ({ wch: 22 })),
    },
    {
      name: "INSTRUCTIONS",
      columns: [...PRODUCT_BATCH_IMPORT_INSTRUCTION_HEADERS],
      rows: [
        ["Compatibility", "Template v1 tetap didukung untuk file lama."],
        ["Foto", "Folder masters/ dan physical/ tetap mengikuti contract v1."],
      ],
      widths: [{ wch: 24 }, { wch: 72 }],
    },
  ];
}

export function buildLegacyProductBatchImportTemplateBuffer(
  options: LegacyProductBatchImportTemplateOptions = {},
) {
  return buildXlsxBuffer(buildLegacyProductBatchImportTemplateSheets(options));
}
