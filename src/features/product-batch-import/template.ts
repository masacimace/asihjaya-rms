import {
  buildXlsxBuffer,
  type ExportCell,
  type ExportSheet,
} from "../../lib/export-files";

import {
  PRODUCT_BATCH_IMPORT_V2_HEADERS,
  PRODUCT_BATCH_IMPORT_V2_SHEET_NAME,
} from "./contracts";

export type ProductBatchImportTemplateOptions = {
  generatedAt?: Date;
  includeSampleRows?: boolean;
};

const sampleRows: ExportCell[][] = [
  [
    "Cincin",
    "Cincin Anak",
    "Cincin Anak Dora",
    "OUTLET-01",
    0.9,
    30,
    35,
    "Poles",
    "good",
    0,
    "",
    "Contoh saja. Hapus baris ini sebelum import.",
  ],
];

export function buildProductBatchImportTemplateSheets(
  options: ProductBatchImportTemplateOptions = {},
): ExportSheet[] {
  const includeSampleRows = options.includeSampleRows ?? false;

  return [
    {
      name: PRODUCT_BATCH_IMPORT_V2_SHEET_NAME,
      columns: [...PRODUCT_BATCH_IMPORT_V2_HEADERS],
      rows: includeSampleRows ? sampleRows : [],
      widths: [
        { wch: 22 },
        { wch: 34 },
        { wch: 34 },
        { wch: 20 },
        { wch: 16 },
        { wch: 18 },
        { wch: 24 },
        { wch: 16 },
        { wch: 16 },
        { wch: 22 },
        { wch: 28 },
        { wch: 52 },
      ],
    },
  ];
}

export function buildProductBatchImportTemplateBuffer(
  options: ProductBatchImportTemplateOptions = {},
) {
  return buildXlsxBuffer(buildProductBatchImportTemplateSheets(options));
}
