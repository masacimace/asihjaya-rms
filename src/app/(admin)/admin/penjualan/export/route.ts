import type { NextRequest } from "next/server";

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

const csvHeaders = [
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
  "Item Terjual",
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

function toCsvAmount(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function sanitizeCsvText(value: string) {
  const normalizedValue = value.replace(/\r?\n|\r/g, " ").trim();

  if (/^[=+\-@]/.test(normalizedValue)) {
    return `'${normalizedValue}`;
  }

  return normalizedValue;
}

function escapeCsvCell(value: string | number | null | undefined) {
  const stringValue = sanitizeCsvText(String(value ?? ""));

  if (
    stringValue.includes('"') ||
    stringValue.includes(",") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function getPaymentMethodLabel(row: Awaited<ReturnType<typeof getAdminSalesExportRows>>[number]) {
  if (row.paymentMethods.length > 0) {
    return row.paymentMethods.map((method) => paymentMethodLabels[method]).join(" + ");
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

function buildCsv(rows: Awaited<ReturnType<typeof getAdminSalesExportRows>>) {
  const csvRows = [csvHeaders];

  for (const row of rows) {
    csvRows.push([
      row.invoiceNumber,
      formatDateTime(row.completedAt ?? row.createdAt),
      saleStatusLabels[row.status],
      row.outletCode,
      row.outletName,
      row.registerCode,
      row.registerName,
      row.cashierName,
      row.customerCode ?? "",
      row.customerName ?? "Walk-in Customer",
      row.customerPhone ?? "",
      String(row.totalItems),
      row.items
        .map(
          (item, index) =>
            `${index + 1}. ${item.productName} (${item.sku}/${item.barcode}) - ${toCsvAmount(item.finalPriceAmount)}`,
        )
        .join("; "),
      getPaymentMethodLabel(row),
      toCsvAmount(row.subtotalAmount),
      toCsvAmount(row.discountAmount),
      toCsvAmount(row.additionalFeeAmount),
      toCsvAmount(row.totalAmount),
      toCsvAmount(row.paidAmount),
      toCsvAmount(row.receivedAmount),
      toCsvAmount(row.changeAmount),
      printStatusLabels[row.printStatus],
      formatDateTime(row.createdAt),
      formatDateTime(row.completedAt),
    ]);
  }

  return csvRows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
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

  return `admin-sales-${timestamp}.csv`;
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
  const csv = `\ufeff${buildCsv(rows)}`;
  const filename = buildExportFilename();

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
