import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";

import {
  parseAdminSalesFilters,
  type AdminPaymentMethod,
  type AdminSalePrintStatus,
  type AdminSaleStatus,
} from "@/features/sales/admin-contracts";
import { getAdminSalesExportRows } from "@/features/sales/admin-queries";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";

const saleStatusLabels: Record<AdminSaleStatus, string> = {
  draft: "Draft",
  awaiting_payment: "Menunggu Bayar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  voided: "Void",
  partially_refunded: "Refund Parsial",
  refunded: "Refund",
};

const paymentMethodLabels: Record<AdminPaymentMethod, string> = {
  cash: "Cash",
  debit_card: "Debit",
  credit_card: "Credit",
  bank_transfer: "Transfer",
  qris_manual: "QRIS Manual",
  qris_gateway: "QRIS Gateway",
  other: "Lainnya",
};

const printStatusLabels: Record<AdminSalePrintStatus, string> = {
  not_queued: "Belum dicetak",
  pending: "Print pending",
  claimed: "Diklaim agent",
  processing: "Sedang diproses",
  printing: "Sedang print",
  submitted: "Dikirim ke spooler",
  completed: "Print selesai",
  failed: "Print gagal",
  unknown_outcome: "Hasil print belum pasti",
  expired: "Print kedaluwarsa",
  cancelled: "Print batal",
};

const transactionHeaders = [
  "Invoice",
  "Tanggal Transaksi",
  "Status",
  "Outlet Code",
  "Outlet",
  "Register Code",
  "Register",
  "Kasir",
  "Customer Code",
  "Customer",
  "Telepon Customer",
  "Jumlah Item",
  "Payment Method",
  "Status Pembayaran",
  "Subtotal",
  "Diskon",
  "Biaya Tambahan",
  "Total",
  "Pembayaran Eksternal",
  "Gunakan Saldo",
  "Deposit Saldo",
  "Dibayar",
  "Uang Cash Diterima",
  "Kembalian",
  "Status Print",
  "Created At",
  "Completed At",
];

const itemHeaders = [
  "Invoice",
  "Tanggal Transaksi",
  "Outlet",
  "Customer",
  "Line",
  "Product",
  "Category",
  "SKU",
  "Barcode",
  "Harga Item",
];

function formatDateTime(value: Date | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

const rupiahNumberFormat = '[$Rp-421] #,##0';

function toNumericAmount(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount);
}

function sanitizeWorksheetText(value: string | number | null | undefined) {
  const normalizedValue = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();

  if (/^[=+\-@]/.test(normalizedValue)) {
    return `'${normalizedValue}`;
  }

  return normalizedValue;
}

function getPaymentMethodLabel(row: Awaited<ReturnType<typeof getAdminSalesExportRows>>[number]) {
  const paymentLabels = row.paymentMethods.map((method) => paymentMethodLabels[method]);

  if (row.customerDepositUsedAmount > 0) {
    paymentLabels.push("Dana Titip");
  }

  if (row.customerDepositInAmount > 0) {
    paymentLabels.push("Deposit Saldo");
  }

  if (paymentLabels.length > 0) {
    return paymentLabels.join(" + ");
  }

  if (row.status === "voided") {
    return "Pembayaran dibatalkan";
  }

  if (row.status === "refunded") {
    return "Refund penuh";
  }

  if (row.status === "partially_refunded") {
    return "Refund parsial";
  }

  return "Belum bayar";
}

function getPaymentStatusLabel(
  status: Awaited<ReturnType<typeof getAdminSalesExportRows>>[number]["paymentStatus"],
) {
  if (status === "paid") {
    return "Lunas";
  }

  if (status === "partial") {
    return "Bayar sebagian";
  }

  return "Belum bayar";
}

function buildTransactionRows(rows: Awaited<ReturnType<typeof getAdminSalesExportRows>>) {
  return rows.map((row) => [
    sanitizeWorksheetText(row.invoiceNumber),
    formatDateTime(row.completedAt ?? row.createdAt),
    saleStatusLabels[row.status],
    sanitizeWorksheetText(row.outletCode),
    sanitizeWorksheetText(row.outletName),
    sanitizeWorksheetText(row.registerCode),
    sanitizeWorksheetText(row.registerName),
    sanitizeWorksheetText(row.cashierName),
    sanitizeWorksheetText(row.customerCode ?? ""),
    sanitizeWorksheetText(row.customerName ?? "Walk-in Customer"),
    sanitizeWorksheetText(row.customerPhone ?? ""),
    row.totalItems,
    getPaymentMethodLabel(row),
    getPaymentStatusLabel(row.paymentStatus),
    toNumericAmount(row.subtotalAmount),
    toNumericAmount(row.discountAmount),
    toNumericAmount(row.additionalFeeAmount),
    toNumericAmount(row.totalAmount),
    toNumericAmount(row.externalPaidAmount),
    toNumericAmount(row.customerDepositUsedAmount),
    toNumericAmount(row.customerDepositInAmount),
    toNumericAmount(row.paidAmount),
    toNumericAmount(row.receivedAmount),
    toNumericAmount(row.changeAmount),
    printStatusLabels[row.printStatus],
    formatDateTime(row.createdAt),
    formatDateTime(row.completedAt),
  ]);
}

function buildItemRows(rows: Awaited<ReturnType<typeof getAdminSalesExportRows>>) {
  return rows.flatMap((row) =>
    row.items.map((item, index) => [
      sanitizeWorksheetText(row.invoiceNumber),
      formatDateTime(row.completedAt ?? row.createdAt),
      sanitizeWorksheetText(row.outletName),
      sanitizeWorksheetText(row.customerName ?? "Walk-in Customer"),
      index + 1,
      sanitizeWorksheetText(item.productName),
      sanitizeWorksheetText(item.categoryName),
      sanitizeWorksheetText(item.sku),
      sanitizeWorksheetText(item.barcode),
      toNumericAmount(item.finalPriceAmount),
    ]),
  );
}

function createWorksheet(
  data: unknown[][],
  columnWidths: Array<{ wch: number }>,
  amountColumnIndexes: number[] = [],
) {
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const lastColumn = XLSX.utils.encode_col(Math.max((data[0]?.length ?? 1) - 1, 0));
  const lastRow = Math.max(data.length, 1);

  worksheet["!cols"] = columnWidths;
  worksheet["!autofilter"] = {
    ref: `A1:${lastColumn}${lastRow}`,
  };

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    for (const columnIndex of amountColumnIndexes) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellRef];

      if (cell && cell.t === "n") {
        cell.z = rupiahNumberFormat;
      }
    }
  }

  return worksheet;
}

function buildWorkbook(rows: Awaited<ReturnType<typeof getAdminSalesExportRows>>) {
  const workbook = XLSX.utils.book_new();
  const transactionRows = buildTransactionRows(rows);
  const itemRows = buildItemRows(rows);

  const transactionWorksheet = createWorksheet(
    [transactionHeaders, ...transactionRows],
    [
      { wch: 28 },
      { wch: 22 },
      { wch: 18 },
      { wch: 14 },
      { wch: 24 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 12 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
    ],
    [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  );

  const itemWorksheet = createWorksheet(
    [itemHeaders, ...itemRows],
    [
      { wch: 28 },
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 8 },
      { wch: 36 },
      { wch: 20 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
    ],
    [9],
  );

  XLSX.utils.book_append_sheet(workbook, transactionWorksheet, "Transaksi");
  XLSX.utils.book_append_sheet(workbook, itemWorksheet, "Item Terjual");

  return workbook;
}

function buildExportFilename() {
  const timestamp = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })
    .format(new Date())
    .replace(/[-: ]/g, "")
    .slice(0, 12);

  return `admin-sales-${timestamp}.xlsx`;
}

function parseSearchParams(request: NextRequest) {
  const searchParams: Record<string, string> = {};

  request.nextUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });

  return parseAdminSalesFilters(searchParams);
}

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasPermission(auth, "sales.view")) {
    return new Response("Forbidden", { status: 403 });
  }

  const filters = parseSearchParams(request);
  const rows = await getAdminSalesExportRows(auth, filters);
  const workbook = buildWorkbook(rows);
  const workbookBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    compression: true,
    type: "buffer",
  }) as Buffer;
  const responseBody = new Uint8Array(workbookBuffer.length);
  responseBody.set(workbookBuffer);
  const filename = buildExportFilename();

  return new Response(responseBody.buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
