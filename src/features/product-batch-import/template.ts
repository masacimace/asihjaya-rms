import {
  buildXlsxBuffer,
  type ExportCell,
  type ExportSheet,
} from "../../lib/export-files";

import {
  PRODUCT_BATCH_IMPORT_INSTRUCTION_HEADERS,
  PRODUCT_BATCH_IMPORT_ITEM_HEADERS,
  PRODUCT_BATCH_IMPORT_MASTER_HEADERS,
  PRODUCT_BATCH_IMPORT_METADATA_HEADERS,
  PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
  PRODUCT_BATCH_IMPORT_TYPE,
} from "./contracts";

export type ProductBatchImportTemplateOptions = {
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
    "Contoh saja - ganti atau hapus baris ini sebelum import.",
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
    "Contoh status kosong: sistem akan membaca sebagai active.",
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
    "Contoh item available yang memakai foto Product Master.",
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
    "Contoh item draft tanpa outlet, berat, dan harga.",
    "draft",
  ],
];

const instructionRows: ExportCell[][] = [
  [
    "Mulai di sini",
    "File ini adalah template v1. Ganti atau hapus semua baris contoh pada PRODUCT_MASTERS dan PHYSICAL_PRODUCTS sebelum membuat paket ZIP final.",
  ],
  [
    "Struktur ZIP",
    "Taruh products.xlsx di root ZIP, foto master di images/masters, dan foto item fisik opsional di images/physical.",
  ],
  [
    "Relasi baris",
    "master_key hanya penghubung antar-sheet. Setiap PHYSICAL_PRODUCTS.master_key harus cocok dengan master_key pada PRODUCT_MASTERS.",
  ],
  [
    "Kode & barcode",
    "Jangan membuat Product Master code, SKU, barcode, atau QR. Semua identifier teknis dibuat otomatis oleh server saat commit.",
  ],
  [
    "Barcode lama",
    "Produk lama yang sudah memakai barcode fisik toko tidak dimasukkan lewat template ini. Gunakan workflow Legacy Product Migration.",
  ],
  [
    "Foto Product Master",
    "primary_image wajib dan hanya berisi nama file, misalnya MASTER-001.jpg. Jangan tulis path folder, URL, atau hyperlink.",
  ],
  [
    "Foto item fisik",
    "physical_image boleh kosong. Jika kosong, item memakai foto Product Master sebagai fallback. Jika diisi, file tersebut wajib tersedia dan valid.",
  ],
  [
    "Status master",
    "status hanya draft atau active. Jika kosong, default active. Master draft tidak boleh mempunyai child item available.",
  ],
  [
    "Availability item",
    "initial_availability hanya draft atau available. Jika kosong, default draft.",
  ],
  [
    "Item available",
    "Item available wajib mempunyai master active, outlet aktif yang dapat diakses, berat > 0, selling_amount > 0, condition good, dan effective image.",
  ],
  [
    "Angka decimal",
    "weight_gram dan percentage boleh memakai titik atau koma sebagai separator decimal. Jangan gunakan formula atau scientific notation.",
  ],
  [
    "Nominal Rupiah",
    "Gunakan nilai Rupiah tanpa formula. Parser tahap import akan menerima angka integer dan format manual yang didukung contract seperti Rp 1.500.000.",
  ],
  [
    "Nama file foto",
    "Gunakan basename saja. Nama foto dibandingkan case-insensitive, sehingga MASTER-001.JPG dan master-001.jpg dianggap nama yang sama.",
  ],
  [
    "File ekstra",
    "Foto valid yang tidak direferensikan hanya menjadi warning. File berbahaya, path tidak diizinkan, duplicate entry, atau image invalid akan menolak batch.",
  ],
  [
    "Preview dahulu",
    "Upload nantinya selalu melalui preview. Sistem tidak membuat Product Master/Product Item dan tidak mengambil barcode final sebelum Commit Import.",
  ],
];

export function buildProductBatchImportTemplateSheets(
  options: ProductBatchImportTemplateOptions = {},
): ExportSheet[] {
  const generatedAt = options.generatedAt ?? new Date();
  const includeSampleRows = options.includeSampleRows ?? true;

  return [
    {
      name: "METADATA",
      columns: [...PRODUCT_BATCH_IMPORT_METADATA_HEADERS],
      rows: [
        ["template_version", PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION],
        ["import_type", PRODUCT_BATCH_IMPORT_TYPE],
        ["generated_at", formatGeneratedDate(generatedAt)],
      ],
      widths: [{ wch: 22 }, { wch: 36 }],
    },
    {
      name: "PRODUCT_MASTERS",
      columns: [...PRODUCT_BATCH_IMPORT_MASTER_HEADERS],
      rows: includeSampleRows ? masterSampleRows : [],
      widths: [
        { wch: 18 },
        { wch: 30 },
        { wch: 20 },
        { wch: 18 },
        { wch: 16 },
        { wch: 18 },
        { wch: 54 },
        { wch: 24 },
        { wch: 14 },
      ],
    },
    {
      name: "PHYSICAL_PRODUCTS",
      columns: [...PRODUCT_BATCH_IMPORT_ITEM_HEADERS],
      rows: includeSampleRows ? itemSampleRows : [],
      widths: [
        { wch: 16 },
        { wch: 18 },
        { wch: 28 },
        { wch: 18 },
        { wch: 15 },
        { wch: 18 },
        { wch: 24 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 22 },
        { wch: 14 },
        { wch: 18 },
        { wch: 24 },
        { wch: 50 },
        { wch: 22 },
      ],
    },
    {
      name: "INSTRUCTIONS",
      columns: [...PRODUCT_BATCH_IMPORT_INSTRUCTION_HEADERS],
      rows: instructionRows,
      widths: [{ wch: 24 }, { wch: 110 }],
    },
  ];
}

export function buildProductBatchImportTemplateBuffer(
  options: ProductBatchImportTemplateOptions = {},
) {
  return buildXlsxBuffer(buildProductBatchImportTemplateSheets(options));
}
