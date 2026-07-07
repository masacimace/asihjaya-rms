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
  printing: "Sedang print",
  completed: "Print selesai",
  failed: "Print gagal",
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
  "Subtotal",
  "Diskon",
  "Biaya Tambahan",
  "Total",
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

function toDisplayAmount(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function sanitizeWorksheetText(value: string | number | null | undefined) {
  const normalizedValue = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();

  if (/^[=+\-@]/.test(normalizedValue)) {
    return `'${normalizedValue}`;
  }

  return normalizedValue;
}

function getPaymentMethodLabel(methods: AdminPaymentMethod[]) {
  if (methods.length === 0) {
    return "Belum bayar";
  }

  return methods.map((method) => paymentMethodLabels[method]).join(" + ");
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
    getPaymentMethodLabel(row.paymentMethods),
    toDisplayAmount(row.subtotalAmount),
    toDisplayAmount(row.discountAmount),
    toDisplayAmount(row.additionalFeeAmount),
    toDisplayAmount(row.totalAmount),
    toDisplayAmount(row.paidAmount),
    toDisplayAmount(row.receivedAmount),
    toDisplayAmount(row.changeAmount),
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
      toDisplayAmount(item.finalPriceAmount),
    ]),
  );
}

function createWorksheet(data: unknown[][], columnWidths: Array<{ wch: number }>) {
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const lastColumn = XLSX.utils.encode_col(Math.max((data[0]?.length ?? 1) - 1, 0));
  const lastRow = Math.max(data.length, 1);

  worksheet["!cols"] = columnWidths;
  worksheet["!autofilter"] = {
    ref: `A1:${lastColumn}${lastRow}`,
  };

  return worksheet;
}

function buildWorkbook(rows: Awaited<ReturnType<typeof getAdminSalesExportRows>>) {
  const workbook = XLSX.utils.book_new();
  const transactionRows = buildTransactionRows(rows);
  const itemRows = buildItemRows(rows);

  const transactionWorksheet = createWorksheet(
    [transactionHeaders, ...transactionRows],
    [
      { wch: 26 },
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
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
    ],
  );

  const itemWorksheet = createWorksheet(
    [itemHeaders, ...itemRows],
    [
      { wch: 26 },
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 8 },
      { wch: 36 },
      { wch: 20 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
    ],
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
