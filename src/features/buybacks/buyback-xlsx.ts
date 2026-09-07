import * as XLSX from "xlsx";

import type {
  BuybackHistoryPayoutFilter,
  BuybackHistoryProcessingFilter,
  BuybackPayoutMethod,
  BuybackProcessingStatus,
  BuybackProcessingType,
} from "@/features/buybacks/contracts";
import type {
  BuybackReportFilters,
  BuybackReportItem,
  BuybackReportRow,
} from "@/features/buybacks/report-contracts";
import { styleBuybackWorkbookBuffer } from "@/features/buybacks/buyback-xlsx-styles";

const rupiahNumberFormat = '"Rp" #,##0;[Red]-"Rp" #,##0';

export type BuybackWorkbookAuthContext = {
  organization: {
    name: string;
    timezone: string;
  };
  user: {
    fullName: string;
  };
  outlet: {
    id: string;
    code: string;
    name: string;
  };
};

const transactionStatusLabels: Record<BuybackReportRow["status"], string> = {
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const payoutMethodLabels: Record<BuybackPayoutMethod, string> = {
  cash: "Cash",
  bank_transfer: "Transfer Bank",
  customer_deposit: "Dana Titip",
};

const processingTypeLabels: Record<BuybackProcessingType, string> = {
  cleaning: "Cuci",
  recondition: "Rongsok",
};

const processingStatusLabels: Record<BuybackProcessingStatus, string> = {
  pending: "Menunggu Proses",
  completed: "Selesai Diproses",
};

const processingFilterLabels: Record<BuybackHistoryProcessingFilter, string> = {
  all: "Semua status proses",
  pending: "Menunggu proses",
  clear: "Tidak ada antrean",
};

const payoutFilterLabels: Record<BuybackHistoryPayoutFilter, string> = {
  all: "Semua metode payout",
  cash: "Cash",
  bank_transfer: "Transfer Bank",
  customer_deposit: "Dana Titip",
};

function toNumericAmount(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function toNumericDecimal(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function sanitizeWorksheetText(value: string | number | null | undefined) {
  const normalizedValue = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();
  if (/^[=+\-@]/.test(normalizedValue)) return `'${normalizedValue}`;
  return normalizedValue;
}

function formatDateTime(value: Date | null, timeZone: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  }).format(value);
}

function readSnapshotText(snapshot: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function getItemDisplayName(item: BuybackReportItem) {
  return (
    readSnapshotText(item.snapshot, "displayName", "originalDisplayName", "originalProductMasterName") ||
    "Item Buyback"
  );
}

function getItemCategoryName(item: BuybackReportItem) {
  return readSnapshotText(item.snapshot, "categoryName", "originalCategoryName");
}

function getItemSku(item: BuybackReportItem) {
  return readSnapshotText(item.snapshot, "sku");
}

function getItemBarcode(item: BuybackReportItem) {
  return readSnapshotText(item.snapshot, "barcode");
}

function getItemColor(item: BuybackReportItem) {
  return readSnapshotText(item.snapshot, "color", "storedColor");
}

function getPayoutAmount(row: BuybackReportRow, method: BuybackPayoutMethod) {
  return row.payouts
    .filter((payout) => payout.method === method)
    .reduce((total, payout) => total + toNumericAmount(payout.amount), 0);
}

function getPayoutMethodsLabel(row: BuybackReportRow) {
  const methods = row.payouts.map((payout) => payoutMethodLabels[payout.method]);
  return methods.length > 0 ? Array.from(new Set(methods)).join(" + ") : "—";
}

function getTransferReferences(row: BuybackReportRow) {
  const references = row.payouts
    .filter((payout) => payout.method === "bank_transfer")
    .map((payout) => payout.reference?.trim())
    .filter((value): value is string => Boolean(value));
  return references.length > 0 ? Array.from(new Set(references)).join(" · ") : "";
}

function getTransactionProcessingLabel(row: BuybackReportRow) {
  if (row.status === "cancelled") return "Dibatalkan";
  if (row.items.length === 0) return "Tidak ada item";

  const pendingCount = row.items.filter(
    (item) => item.processingStatus === "pending",
  ).length;
  if (pendingCount > 0) return `Menunggu Proses (${pendingCount} item)`;
  return "Selesai Diproses";
}

function getWorkbookSummary(rows: BuybackReportRow[]) {
  const completedRows = rows.filter((row) => row.status === "completed");
  const completedItems = completedRows.flatMap((row) => row.items);

  const cashAmount = completedRows.reduce(
    (total, row) => total + getPayoutAmount(row, "cash"),
    0,
  );
  const transferAmount = completedRows.reduce(
    (total, row) => total + getPayoutAmount(row, "bank_transfer"),
    0,
  );
  const customerDepositAmount = completedRows.reduce(
    (total, row) => total + getPayoutAmount(row, "customer_deposit"),
    0,
  );

  return {
    totalTransactions: rows.length,
    completedTransactions: completedRows.length,
    cancelledTransactions: rows.filter((row) => row.status === "cancelled").length,
    totalItems: completedItems.length,
    asihjayaItems: completedItems.filter((item) => item.source === "asihjaya").length,
    externalItems: completedItems.filter((item) => item.source === "external").length,
    pendingProcessingItems: completedItems.filter(
      (item) => item.processingStatus === "pending",
    ).length,
    completedProcessingItems: completedItems.filter(
      (item) => item.processingStatus === "completed",
    ).length,
    totalWeightGram: completedItems.reduce(
      (total, item) => total + toNumericDecimal(item.weightGram),
      0,
    ),
    cashAmount,
    transferAmount,
    customerDepositAmount,
    externalPayoutAmount: cashAmount + transferAmount,
    totalBuybackAmount: completedRows.reduce(
      (total, row) => total + toNumericAmount(row.totalAmount),
      0,
    ),
  };
}

function getPayoutSummary(rows: BuybackReportRow[]) {
  const completedRows = rows.filter((row) => row.status === "completed");
  const methods: BuybackPayoutMethod[] = [
    "cash",
    "bank_transfer",
    "customer_deposit",
  ];

  return methods.map((method) => ({
    method,
    label: payoutMethodLabels[method],
    transactionCount: completedRows.filter((row) =>
      row.payouts.some((payout) => payout.method === method),
    ).length,
    amount: completedRows.reduce(
      (total, row) => total + getPayoutAmount(row, method),
      0,
    ),
  }));
}

function getFilterDescription(
  auth: BuybackWorkbookAuthContext,
  filters: BuybackReportFilters,
) {
  const parts = [
    "Periode: Semua waktu",
    `Outlet: ${auth.outlet.code} — ${auth.outlet.name}`,
    `Status proses: ${processingFilterLabels[filters.processingFilter]}`,
    `Payout: ${payoutFilterLabels[filters.payoutFilter]}`,
  ];
  if (filters.search) parts.push(`Pencarian: ${filters.search}`);
  return parts.join(" · ");
}

function setNumberFormat(
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
  columnIndex: number,
  format = rupiahNumberFormat,
) {
  const ref = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = worksheet[ref];
  if (cell && cell.t === "n") cell.z = format;
}

function setAmountColumnFormats(
  worksheet: XLSX.WorkSheet,
  firstDataRowIndex: number,
  rowCount: number,
  amountColumnIndexes: number[],
) {
  for (let offset = 0; offset < rowCount; offset += 1) {
    for (const columnIndex of amountColumnIndexes) {
      setNumberFormat(worksheet, firstDataRowIndex + offset, columnIndex);
    }
  }
}

function buildSummaryWorksheet({
  rows,
  filters,
  auth,
  generatedAt,
}: {
  rows: BuybackReportRow[];
  filters: BuybackReportFilters;
  auth: BuybackWorkbookAuthContext;
  generatedAt: Date;
}) {
  const summary = getWorkbookSummary(rows);
  const payoutSummary = getPayoutSummary(rows);
  const payoutDataStartRowIndex = 29;
  const data: unknown[][] = [
    ["LAPORAN BUYBACK ASIHJAYA", "", ""],
    ["Periode", "Semua waktu"],
    ["Outlet", `${auth.outlet.code} — ${auth.outlet.name}`],
    ["Status proses", processingFilterLabels[filters.processingFilter]],
    ["Payout filter", payoutFilterLabels[filters.payoutFilter]],
    ["Pencarian", filters.search || "—"],
    ["Dibuat", formatDateTime(generatedAt, auth.organization.timezone)],
    ["Dibuat oleh", auth.user.fullName],
    [],
    ["RINGKASAN TRANSAKSI", "", ""],
    ["Jumlah transaksi", summary.totalTransactions],
    ["Transaksi selesai", summary.completedTransactions],
    ["Dibatalkan", summary.cancelledTransactions],
    ["Jumlah item Buyback", summary.totalItems],
    ["Item ASIHJAYA", summary.asihjayaItems],
    ["Item Eksternal", summary.externalItems],
    ["Menunggu proses", summary.pendingProcessingItems],
    ["Proses selesai", summary.completedProcessingItems],
    ["Total berat Buyback (gr)", summary.totalWeightGram],
    [],
    ["RINGKASAN NILAI", "", ""],
    ["Payout Cash", summary.cashAmount],
    ["Payout Transfer", summary.transferAmount],
    ["Payout Dana Titip", summary.customerDepositAmount],
    ["Payout Eksternal", summary.externalPayoutAmount],
    ["TOTAL NILAI BUYBACK", summary.totalBuybackAmount],
    [],
    ["RINGKASAN METODE PAYOUT", "", ""],
    ["Metode", "Jumlah Transaksi", "Nominal"],
    ...payoutSummary.map((payout) => [
      payout.label,
      payout.transactionCount,
      payout.amount,
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet["!cols"] = [{ wch: 45 }, { wch: 42 }, { wch: 22 }];
  worksheet["!rows"] = [{ hpt: 30 }];

  setNumberFormat(worksheet, 21, 1);
  setNumberFormat(worksheet, 22, 1);
  setNumberFormat(worksheet, 23, 1);
  setNumberFormat(worksheet, 24, 1);
  setNumberFormat(worksheet, 25, 1);

  for (let offset = 0; offset < payoutSummary.length; offset += 1) {
    const rowIndex = payoutDataStartRowIndex + offset;
    setNumberFormat(worksheet, rowIndex, 2);
  }

  return { worksheet, summary };
}

function buildTransactionRows(rows: BuybackReportRow[], timeZone: string) {
  return rows.map((row) => [
    sanitizeWorksheetText(row.buybackNumber),
    formatDateTime(row.completedAt ?? row.createdAt, timeZone),
    sanitizeWorksheetText(row.outletName),
    sanitizeWorksheetText(row.registerName),
    sanitizeWorksheetText(row.processedByName),
    sanitizeWorksheetText(row.customerCode ?? ""),
    sanitizeWorksheetText(row.customerName),
    sanitizeWorksheetText(row.customerPhone ?? ""),
    row.items.length,
    transactionStatusLabels[row.status],
    getTransactionProcessingLabel(row),
    sanitizeWorksheetText(getPayoutMethodsLabel(row)),
    toNumericAmount(row.totalAmount),
    getPayoutAmount(row, "cash"),
    getPayoutAmount(row, "bank_transfer"),
    getPayoutAmount(row, "customer_deposit"),
    sanitizeWorksheetText(getTransferReferences(row)),
    sanitizeWorksheetText(row.notes ?? ""),
  ]);
}

function buildItemRows(rows: BuybackReportRow[], timeZone: string) {
  return rows.flatMap((row) =>
    row.items.map((item) => [
      sanitizeWorksheetText(row.buybackNumber),
      formatDateTime(row.completedAt ?? row.createdAt, timeZone),
      transactionStatusLabels[row.status],
      sanitizeWorksheetText(row.customerName),
      item.lineNumber,
      item.source === "asihjaya" ? "ASIHJAYA" : "Eksternal",
      sanitizeWorksheetText(getItemDisplayName(item)),
      sanitizeWorksheetText(getItemCategoryName(item)),
      sanitizeWorksheetText(getItemSku(item)),
      sanitizeWorksheetText(getItemBarcode(item)),
      toNumericDecimal(item.weightGram),
      toNumericDecimal(item.purityPercent),
      sanitizeWorksheetText(getItemColor(item)),
      toNumericAmount(item.finalAmount),
      item.processingType ? processingTypeLabels[item.processingType] : "—",
      item.processingStatus
        ? processingStatusLabels[item.processingStatus]
        : "—",
    ]),
  );
}

function createDetailWorksheet({
  rows,
  headers,
  widths,
  amountColumnIndexes,
  summary,
}: {
  rows: unknown[][];
  headers: string[];
  widths: number[];
  amountColumnIndexes: number[];
  summary: ReturnType<typeof getWorkbookSummary>;
}) {
  const lastColumnIndex = Math.max(headers.length - 1, 0);
  const fillRow = (value: unknown) => [
    value,
    ...Array.from({ length: lastColumnIndex }, () => ""),
  ];
  const topRows: unknown[][] = [
    fillRow("DETAIL TRANSAKSI BUYBACK"),
    ["Payout Eksternal", summary.externalPayoutAmount],
    ["Payout Dana Titip", summary.customerDepositAmount],
    ["TOTAL NILAI BUYBACK", summary.totalBuybackAmount],
    [],
    headers,
  ];
  const firstDataRowIndex = topRows.length;
  const worksheet = XLSX.utils.aoa_to_sheet([...topRows, ...rows]);

  worksheet["!cols"] = widths.map((wch) => ({ wch }));
  worksheet["!rows"] = [
    { hpt: 30 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 24 },
    { hpt: 8 },
    { hpt: 34 },
  ];

  setAmountColumnFormats(
    worksheet,
    firstDataRowIndex,
    rows.length,
    amountColumnIndexes,
  );
  setNumberFormat(worksheet, 1, 1);
  setNumberFormat(worksheet, 2, 1);
  setNumberFormat(worksheet, 3, 1);

  return worksheet;
}

function createItemWorksheet(rows: unknown[][]) {
  const headers = [
    "No. Buyback",
    "Tanggal",
    "Status Transaksi",
    "Customer",
    "Line",
    "Sumber",
    "Produk",
    "Kategori",
    "SKU",
    "Barcode",
    "Berat (gr)",
    "Kadar (%)",
    "Warna",
    "Total Buyback Item",
    "Jenis Proses",
    "Status Proses",
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = [
    { wch: 34 },
    { wch: 24 },
    { wch: 18 },
    { wch: 30 },
    { wch: 8 },
    { wch: 13 },
    { wch: 52 },
    { wch: 24 },
    { wch: 22 },
    { wch: 22 },
    { wch: 13 },
    { wch: 13 },
    { wch: 16 },
    { wch: 21 },
    { wch: 17 },
    { wch: 20 },
  ];
  worksheet["!rows"] = [{ hpt: 34 }, ...rows.map(() => ({ hpt: 24 }))];
  setAmountColumnFormats(worksheet, 1, rows.length, [13]);
  return worksheet;
}

export function buildBuybackWorkbook({
  rows,
  filters,
  auth,
  generatedAt = new Date(),
}: {
  rows: BuybackReportRow[];
  filters: BuybackReportFilters;
  auth: BuybackWorkbookAuthContext;
  generatedAt?: Date;
}) {
  const workbook = XLSX.utils.book_new();
  const { worksheet: summaryWorksheet, summary } = buildSummaryWorksheet({
    rows,
    filters,
    auth,
    generatedAt,
  });

  const transactionHeaders = [
    "No. Buyback",
    "Tanggal",
    "Outlet",
    "Register",
    "Staff",
    "Customer Code",
    "Customer",
    "Telepon",
    "Jumlah Item",
    "Status Transaksi",
    "Status Proses",
    "Metode Payout",
    "Total Buyback",
    "Payout Cash",
    "Payout Transfer",
    "Payout Dana Titip",
    "Referensi Transfer",
    "Catatan",
  ];
  const transactionWorksheet = createDetailWorksheet({
    headers: transactionHeaders,
    rows: buildTransactionRows(rows, auth.organization.timezone),
    widths: [
      34, 24, 32, 22, 25, 24, 30, 22, 13, 18, 24, 28, 19, 19, 19, 21, 28,
      40,
    ],
    amountColumnIndexes: [12, 13, 14, 15],
    summary,
  });

  const itemWorksheet = createItemWorksheet(
    buildItemRows(rows, auth.organization.timezone),
  );

  workbook.Props = {
    Title: "Laporan Buyback ASIHJAYA",
    Subject: getFilterDescription(auth, filters),
    Author: auth.user.fullName,
    Company: auth.organization.name,
    CreatedDate: generatedAt,
  };

  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Ringkasan");
  XLSX.utils.book_append_sheet(workbook, transactionWorksheet, "Transaksi Buyback");
  XLSX.utils.book_append_sheet(workbook, itemWorksheet, "Item Buyback");

  return workbook;
}

export function writeBuybackWorkbook(workbook: XLSX.WorkBook) {
  const workbookBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    compression: true,
    type: "buffer",
  }) as Buffer;
  return styleBuybackWorkbookBuffer(workbookBuffer);
}

export function buildBuybackExportFilename(generatedAt: Date, timeZone: string) {
  const timestamp = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  })
    .format(generatedAt)
    .replace(/[-: ]/g, "")
    .slice(0, 12);
  return `laporan-buyback-${timestamp}.xlsx`;
}

export function describeBuybackWorkbookSummary(rows: BuybackReportRow[]) {
  return getWorkbookSummary(rows);
}
