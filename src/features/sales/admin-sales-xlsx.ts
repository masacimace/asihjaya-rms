import * as XLSX from "xlsx";

import type {
  AdminPaymentMethod,
  AdminSalesDateRange,
  AdminSalesExportPayment,
  AdminSalesExportRefund,
  AdminSalesExportRow,
  AdminSalesFilters,
  AdminSaleStatus,
} from "@/features/sales/admin-contracts";

const rupiahNumberFormat = '"Rp" #,##0;[Red]-"Rp" #,##0';

export type AdminSalesWorkbookAuthContext = {
  organization: {
    name: string;
    timezone: string;
  };
  user: {
    fullName: string;
  };
  outlets: Array<{
    id: string;
    code: string;
    name: string;
  }>;
};

const saleStatusLabels: Record<AdminSaleStatus, string> = {
  draft: "Draft",
  awaiting_payment: "Menunggu Bayar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  voided: "Void",
  partially_refunded: "Refund Parsial",
  refunded: "Refund Penuh",
};

const paymentMethodLabels: Record<AdminPaymentMethod, string> = {
  cash: "Cash",
  debit_card: "EDC",
  credit_card: "Credit",
  bank_transfer: "Transfer",
  qris_manual: "QRIS Manual",
  qris_gateway: "QRIS Gateway",
  other: "Lainnya",
};

const dateRangeLabels: Record<AdminSalesDateRange, string> = {
  today: "Hari ini",
  yesterday: "Kemarin",
  last7: "7 hari terakhir",
  last30: "30 hari terakhir",
  thisMonth: "Bulan ini",
  all: "Semua waktu",
};

const recognizedSaleStatuses = new Set<AdminSaleStatus>([
  "completed",
  "partially_refunded",
  "refunded",
]);

function toNumericAmount(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function sanitizeWorksheetText(value: string | number | null | undefined) {
  const normalizedValue = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();

  if (/^[=+\-@]/.test(normalizedValue)) {
    return `'${normalizedValue}`;
  }

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

function formatMoneyForText(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeProvider(value: string | null | undefined) {
  const provider = String(value ?? "").trim();
  const normalized = provider.toLocaleLowerCase("id-ID");

  if (!provider || normalized === "manual" || normalized === "cash") {
    return null;
  }

  return provider;
}

function getTransactionPaymentLabel(payment: AdminSalesExportPayment) {
  const provider = normalizeProvider(payment.provider);
  const profileName = payment.profileName?.trim() || null;

  if (payment.method === "cash") return "Cash";

  if (payment.method === "debit_card") {
    return provider ?? profileName ?? "EDC";
  }

  if (payment.method === "bank_transfer") {
    return provider ? `Transfer ${provider}` : profileName ?? "Transfer";
  }

  if (payment.method === "credit_card") {
    return provider ?? profileName ?? "Credit";
  }

  return provider ?? profileName ?? paymentMethodLabels[payment.method];
}

function getPaymentSummaryIdentity(
  payment: Pick<AdminSalesExportPayment, "method" | "provider" | "profileName">,
) {
  const provider = normalizeProvider(payment.provider);
  const profileName = payment.profileName?.trim() || null;
  const providerIdentity = provider ?? profileName ?? "";

  if (payment.method === "cash") {
    return { key: "cash", label: "Cash", order: 0 };
  }

  if (payment.method === "debit_card") {
    const bank = providerIdentity || "EDC";
    return {
      key: `debit_card:${bank.toLocaleLowerCase("id")}`,
      label: `${bank} (EDC)`,
      order: 1,
    };
  }

  if (payment.method === "bank_transfer") {
    const bank = providerIdentity || "Transfer";
    return {
      key: `bank_transfer:${bank.toLocaleLowerCase("id")}`,
      label: bank === "Transfer" ? bank : `${bank} (Transfer)`,
      order: 2,
    };
  }

  if (payment.method === "credit_card") {
    const bank = providerIdentity || "Credit";
    return {
      key: `credit_card:${bank.toLocaleLowerCase("id")}`,
      label: `${bank} (Credit)`,
      order: 3,
    };
  }

  const fallback = providerIdentity || paymentMethodLabels[payment.method];
  return {
    key: `${payment.method}:${fallback.toLocaleLowerCase("id")}`,
    label: fallback,
    order: 4,
  };
}

function getRefundSummaryIdentity(refund: AdminSalesExportRefund) {
  return getPaymentSummaryIdentity({
    method: refund.method,
    provider: refund.provider,
    profileName: null,
  });
}

export function getAdminSalesPaymentStatusLabel(row: AdminSalesExportRow) {
  if (row.status === "voided") return "Direversal / Void";
  if (row.status === "refunded") return "Refund Penuh";
  if (row.status === "partially_refunded") return "Refund Parsial";
  if (row.status === "cancelled") return "Dibatalkan";
  if (row.status === "draft") return "Draft / Belum Dibayar";

  if (row.paymentStatus === "paid") return "Lunas";
  if (row.paymentStatus === "partial") return "Bayar Sebagian";

  return row.status === "awaiting_payment" ? "Menunggu Bayar" : "Belum Dibayar";
}

export function getAdminSalesPaymentMethodLabel(row: AdminSalesExportRow) {
  const labels = Array.from(
    new Set(row.payments.map((payment) => getTransactionPaymentLabel(payment))),
  );

  if (row.customerDepositUsedAmount > 0) labels.push("Dana Titip");
  if (row.customerDepositInAmount > 0) labels.push("Deposit Saldo Masuk");

  if (labels.length > 0) return labels.join(" + ");
  if (row.status === "voided") return "Pembayaran direversal";
  if (row.status === "refunded") return "Refund penuh";
  if (row.status === "partially_refunded") return "Refund parsial";

  return "Belum bayar";
}

function getGrossExternalPaymentAmount(row: AdminSalesExportRow) {
  return row.payments.reduce(
    (total, payment) => total + toNumericAmount(payment.amount),
    0,
  );
}

export function getAdminSalesNetAmount(row: AdminSalesExportRow) {
  if (!recognizedSaleStatuses.has(row.status)) return 0;

  return Math.max(
    toNumericAmount(row.totalAmount) - toNumericAmount(row.refundedAmount),
    0,
  );
}

function getWorkbookSummary(rows: AdminSalesExportRow[]) {
  const recognizedRows = rows.filter((row) => recognizedSaleStatuses.has(row.status));
  const grossSales = recognizedRows.reduce(
    (total, row) => total + toNumericAmount(row.totalAmount),
    0,
  );
  const refundAmount = recognizedRows.reduce(
    (total, row) => total + toNumericAmount(row.refundedAmount),
    0,
  );
  const netSales = Math.max(grossSales - refundAmount, 0);

  return {
    totalTransactions: rows.length,
    completedTransactions: rows.filter((row) => row.status === "completed").length,
    refundedTransactions: rows.filter((row) => row.status === "refunded").length,
    partiallyRefundedTransactions: rows.filter(
      (row) => row.status === "partially_refunded",
    ).length,
    voidedTransactions: rows.filter((row) => row.status === "voided").length,
    cancelledTransactions: rows.filter((row) => row.status === "cancelled").length,
    awaitingPaymentTransactions: rows.filter(
      (row) => row.status === "awaiting_payment",
    ).length,
    draftTransactions: rows.filter((row) => row.status === "draft").length,
    recognizedTransactionCount: recognizedRows.length,
    grossSales,
    refundAmount,
    netSales,
    totalItems: recognizedRows.reduce((total, row) => total + row.totalItems, 0),
    customerDepositUsedAmount: recognizedRows.reduce(
      (total, row) => total + row.customerDepositUsedAmount,
      0,
    ),
    customerDepositInAmount: recognizedRows.reduce(
      (total, row) => total + row.customerDepositInAmount,
      0,
    ),
  };
}

type PaymentSummaryRow = {
  key: string;
  label: string;
  order: number;
  receivedAmount: number;
  refundAmount: number;
};

function buildPaymentSummary(rows: AdminSalesExportRow[]) {
  const summary = new Map<string, PaymentSummaryRow>();
  const recognizedRows = rows.filter((row) => recognizedSaleStatuses.has(row.status));

  const ensureRow = (identity: { key: string; label: string; order: number }) => {
    const existing = summary.get(identity.key);
    if (existing) return existing;

    const created: PaymentSummaryRow = {
      ...identity,
      receivedAmount: 0,
      refundAmount: 0,
    };
    summary.set(identity.key, created);
    return created;
  };

  for (const row of recognizedRows) {
    for (const payment of row.payments) {
      const target = ensureRow(getPaymentSummaryIdentity(payment));
      target.receivedAmount += toNumericAmount(payment.amount);
    }

    if (row.refunds.length > 0) {
      for (const refund of row.refunds) {
        const target = ensureRow(getRefundSummaryIdentity(refund));
        target.refundAmount += toNumericAmount(refund.amount);
      }
    } else if (row.refundedAmount > 0) {
      // Compatibility fallback untuk transaksi refund lama sebelum ledger refund lengkap.
      for (const payment of row.payments.filter(
        (candidate) => candidate.status === "refunded",
      )) {
        const target = ensureRow(getPaymentSummaryIdentity(payment));
        target.refundAmount += toNumericAmount(payment.amount);
      }
    }
  }

  return Array.from(summary.values()).sort(
    (left, right) =>
      left.order - right.order || left.label.localeCompare(right.label, "id"),
  );
}

function getOutletFilterLabel(auth: AdminSalesWorkbookAuthContext, filters: AdminSalesFilters) {
  if (!filters.outletId) return "Semua outlet yang dapat diakses";

  const outlet = auth.outlets.find((candidate) => candidate.id === filters.outletId);
  return outlet ? `${outlet.code} — ${outlet.name}` : "Outlet terpilih";
}

function getFilterDescription(auth: AdminSalesWorkbookAuthContext, filters: AdminSalesFilters) {
  const parts = [
    `Periode: ${dateRangeLabels[filters.dateRange]}`,
    `Outlet: ${getOutletFilterLabel(auth, filters)}`,
  ];

  if (filters.status) parts.push(`Status: ${saleStatusLabels[filters.status]}`);
  if (filters.paymentMethod) {
    parts.push(`Metode: ${paymentMethodLabels[filters.paymentMethod]}`);
  }
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

function createDetailWorksheet({
  title,
  filterDescription,
  rows,
  headers,
  widths,
  amountColumnIndexes,
  summary,
}: {
  title: string;
  filterDescription: string;
  rows: unknown[][];
  headers: string[];
  widths: number[];
  amountColumnIndexes: number[];
  summary?: { grossSales: number; refundAmount: number; netSales: number };
}) {
  const lastColumnIndex = Math.max(headers.length - 1, 0);
  const lastColumn = XLSX.utils.encode_col(lastColumnIndex);
  const topRows: unknown[][] = summary
    ? [
        [title],
        [
          "Penjualan Kotor",
          summary.grossSales,
          "Total Refund",
          summary.refundAmount,
          "GRAND TOTAL PENJUALAN",
          summary.netSales,
        ],
        [filterDescription],
        [],
        headers,
      ]
    : [[title], [filterDescription], [], headers];
  const headerRowIndex = topRows.length - 1;
  const firstDataRowIndex = topRows.length;
  const worksheet = XLSX.utils.aoa_to_sheet([...topRows, ...rows]);
  const lastDataRowNumber = Math.max(firstDataRowIndex + rows.length, headerRowIndex + 1);

  worksheet["!cols"] = widths.map((wch) => ({ wch }));
  worksheet["!rows"] = summary
    ? [{ hpt: 28 }, { hpt: 22 }, { hpt: 20 }, { hpt: 8 }, { hpt: 24 }]
    : [{ hpt: 28 }, { hpt: 20 }, { hpt: 8 }, { hpt: 24 }];
  worksheet["!merges"] = [
    XLSX.utils.decode_range(`A1:${lastColumn}1`),
    XLSX.utils.decode_range(`A${summary ? 3 : 2}:${lastColumn}${summary ? 3 : 2}`),
  ];
  worksheet["!autofilter"] = {
    ref: `A${headerRowIndex + 1}:${lastColumn}${lastDataRowNumber}`,
  };

  setAmountColumnFormats(
    worksheet,
    firstDataRowIndex,
    rows.length,
    amountColumnIndexes,
  );

  if (summary) {
    setNumberFormat(worksheet, 1, 1);
    setNumberFormat(worksheet, 1, 3);
    setNumberFormat(worksheet, 1, 5);
  }

  return worksheet;
}

function buildSummaryWorksheet({
  rows,
  filters,
  auth,
  generatedAt,
}: {
  rows: AdminSalesExportRow[];
  filters: AdminSalesFilters;
  auth: AdminSalesWorkbookAuthContext;
  generatedAt: Date;
}) {
  const summary = getWorkbookSummary(rows);
  const paymentSummary = buildPaymentSummary(rows);
  const filterDescription = getFilterDescription(auth, filters);
  const paymentSectionRowIndex = 29;
  const paymentDataStartRowIndex = 31;
  const noteTitleRowIndex = paymentDataStartRowIndex + paymentSummary.length + 1;
  const noteFirstRowIndex = noteTitleRowIndex + 1;
  const noteSecondRowIndex = noteTitleRowIndex + 2;
  const noteFilterRowIndex = noteTitleRowIndex + 3;
  const data: unknown[][] = [
    ["LAPORAN PENJUALAN ASIHJAYA"],
    [auth.organization.name],
    [],
    ["Periode", dateRangeLabels[filters.dateRange]],
    ["Outlet", getOutletFilterLabel(auth, filters)],
    ["Status filter", filters.status ? saleStatusLabels[filters.status] : "Semua status"],
    [
      "Metode filter",
      filters.paymentMethod ? paymentMethodLabels[filters.paymentMethod] : "Semua metode",
    ],
    ["Pencarian", filters.search || "—"],
    ["Dibuat", formatDateTime(generatedAt, auth.organization.timezone)],
    ["Dibuat oleh", auth.user.fullName],
    [],
    ["RINGKASAN TRANSAKSI"],
    ["Jumlah transaksi", summary.totalTransactions],
    ["Transaksi selesai", summary.completedTransactions],
    ["Refund penuh", summary.refundedTransactions],
    ["Refund parsial", summary.partiallyRefundedTransactions],
    ["Void", summary.voidedTransactions],
    ["Dibatalkan", summary.cancelledTransactions],
    ["Menunggu bayar", summary.awaitingPaymentTransactions],
    ["Draft", summary.draftTransactions],
    ["Jumlah item pada transaksi", summary.totalItems],
    [],
    ["RINGKASAN NILAI"],
    ["Penjualan Kotor", summary.grossSales],
    ["Total Refund", summary.refundAmount],
    ["GRAND TOTAL PENJUALAN", summary.netSales],
    ["Dana Titip Digunakan", summary.customerDepositUsedAmount],
    ["Deposit Saldo Masuk", summary.customerDepositInAmount],
    [],
    ["RINGKASAN METODE PEMBAYARAN"],
    ["Metode", "Penerimaan", "Refund", "Bersih"],
    ...paymentSummary.map((payment) => [
      payment.label,
      payment.receivedAmount,
      payment.refundAmount,
      payment.receivedAmount - payment.refundAmount,
    ]),
    [],
    ["CATATAN"],
    [
      "Grand Total Penjualan = Penjualan Kotor - Total Refund. Void, pembatalan, draft, dan transaksi menunggu bayar tidak dihitung sebagai penjualan.",
    ],
    [
      "Penerimaan metode pembayaran menunjukkan payment eksternal asli pada transaksi penjualan; Deposit Saldo Masuk ditampilkan terpisah karena bukan omzet penjualan.",
    ],
    [filterDescription],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet["!cols"] = [{ wch: 34 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
  worksheet["!rows"] = [
    { hpt: 30 },
    { hpt: 22 },
    { hpt: 8 },
  ];
  worksheet["!merges"] = [
    XLSX.utils.decode_range("A1:D1"),
    XLSX.utils.decode_range("A2:D2"),
    XLSX.utils.decode_range("A12:D12"),
    XLSX.utils.decode_range("A23:D23"),
    XLSX.utils.decode_range(
      `A${paymentSectionRowIndex + 1}:D${paymentSectionRowIndex + 1}`,
    ),
    XLSX.utils.decode_range(`A${noteTitleRowIndex + 1}:D${noteTitleRowIndex + 1}`),
    XLSX.utils.decode_range(`A${noteFirstRowIndex + 1}:D${noteFirstRowIndex + 1}`),
    XLSX.utils.decode_range(`A${noteSecondRowIndex + 1}:D${noteSecondRowIndex + 1}`),
    XLSX.utils.decode_range(`A${noteFilterRowIndex + 1}:D${noteFilterRowIndex + 1}`),
  ];

  for (const rowIndex of [23, 24, 25, 26, 27]) {
    setNumberFormat(worksheet, rowIndex, 1);
  }

  for (let offset = 0; offset < paymentSummary.length; offset += 1) {
    const rowIndex = paymentDataStartRowIndex + offset;
    setNumberFormat(worksheet, rowIndex, 1);
    setNumberFormat(worksheet, rowIndex, 2);
    setNumberFormat(worksheet, rowIndex, 3);
  }

  return { worksheet, summary };
}

function buildTransactionRows(rows: AdminSalesExportRow[], timeZone: string) {
  return rows.map((row) => [
    sanitizeWorksheetText(row.invoiceNumber),
    formatDateTime(row.completedAt ?? row.createdAt, timeZone),
    sanitizeWorksheetText(row.outletName),
    sanitizeWorksheetText(row.registerName),
    sanitizeWorksheetText(row.cashierName),
    sanitizeWorksheetText(row.customerCode ?? ""),
    sanitizeWorksheetText(row.customerName ?? "Walk-in Customer"),
    sanitizeWorksheetText(row.customerPhone ?? ""),
    row.totalItems,
    saleStatusLabels[row.status],
    getAdminSalesPaymentStatusLabel(row),
    sanitizeWorksheetText(getAdminSalesPaymentMethodLabel(row)),
    toNumericAmount(row.subtotalAmount),
    toNumericAmount(row.discountAmount),
    toNumericAmount(row.additionalFeeAmount),
    toNumericAmount(row.totalAmount),
    toNumericAmount(row.refundedAmount),
    getAdminSalesNetAmount(row),
    getGrossExternalPaymentAmount(row),
    row.customerDepositUsedAmount,
    row.customerDepositInAmount,
    row.receivedAmount,
    row.changeAmount,
  ]);
}

function buildItemRows(rows: AdminSalesExportRow[], timeZone: string) {
  return rows.flatMap((row) =>
    row.items.map((item) => [
      sanitizeWorksheetText(row.invoiceNumber),
      formatDateTime(row.completedAt ?? row.createdAt, timeZone),
      saleStatusLabels[row.status],
      getAdminSalesPaymentStatusLabel(row),
      sanitizeWorksheetText(row.outletName),
      sanitizeWorksheetText(row.customerName ?? "Walk-in Customer"),
      item.lineNumber,
      sanitizeWorksheetText(item.productName),
      sanitizeWorksheetText(item.categoryName),
      sanitizeWorksheetText(item.sku),
      sanitizeWorksheetText(item.barcode),
      toNumericAmount(item.finalPriceAmount),
      toNumericAmount(row.totalAmount),
      toNumericAmount(row.refundedAmount),
      getAdminSalesNetAmount(row),
    ]),
  );
}

export function buildAdminSalesWorkbook({
  rows,
  filters,
  auth,
  generatedAt = new Date(),
}: {
  rows: AdminSalesExportRow[];
  filters: AdminSalesFilters;
  auth: AdminSalesWorkbookAuthContext;
  generatedAt?: Date;
}) {
  const workbook = XLSX.utils.book_new();
  const { worksheet: summaryWorksheet, summary } = buildSummaryWorksheet({
    rows,
    filters,
    auth,
    generatedAt,
  });
  const filterDescription = getFilterDescription(auth, filters);

  const transactionHeaders = [
    "Invoice",
    "Tanggal Transaksi",
    "Outlet",
    "Register",
    "Kasir",
    "Customer Code",
    "Customer",
    "Telepon Customer",
    "Jumlah Item",
    "Status Transaksi",
    "Status Pembayaran",
    "Metode Pembayaran",
    "Subtotal",
    "Diskon",
    "Biaya Tambahan",
    "Total Transaksi",
    "Refund",
    "Penjualan Bersih",
    "Penerimaan Eksternal",
    "Dana Titip Digunakan",
    "Deposit Saldo Masuk",
    "Uang Cash Diterima",
    "Kembalian",
  ];
  const transactionWorksheet = createDetailWorksheet({
    title: "DETAIL TRANSAKSI PENJUALAN",
    filterDescription,
    headers: transactionHeaders,
    rows: buildTransactionRows(rows, auth.organization.timezone),
    widths: [
      30, 22, 26, 20, 22, 20, 26, 19, 12, 18, 20, 32, 18, 18, 18, 18, 18,
      20, 22, 21, 21, 21, 18,
    ],
    amountColumnIndexes: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    summary,
  });

  const itemHeaders = [
    "Invoice",
    "Tanggal Transaksi",
    "Status Transaksi",
    "Status Pembayaran",
    "Outlet",
    "Customer",
    "Line",
    "Produk",
    "Kategori",
    "SKU",
    "Barcode",
    "Harga Item",
    "Total Transaksi",
    "Refund Transaksi",
    "Penjualan Bersih Transaksi",
  ];
  const itemWorksheet = createDetailWorksheet({
    title: "ITEM PENJUALAN",
    filterDescription,
    headers: itemHeaders,
    rows: buildItemRows(rows, auth.organization.timezone),
    widths: [30, 22, 18, 20, 26, 26, 8, 38, 22, 20, 20, 18, 18, 20, 24],
    amountColumnIndexes: [11, 12, 13, 14],
  });

  workbook.Props = {
    Title: "Laporan Penjualan ASIHJAYA",
    Subject: filterDescription,
    Author: auth.user.fullName,
    Company: auth.organization.name,
    CreatedDate: generatedAt,
  };

  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Ringkasan");
  XLSX.utils.book_append_sheet(workbook, transactionWorksheet, "Transaksi");
  XLSX.utils.book_append_sheet(workbook, itemWorksheet, "Item Penjualan");

  return workbook;
}

export function buildAdminSalesExportFilename(generatedAt: Date, timeZone: string) {
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

  return `laporan-penjualan-${timestamp}.xlsx`;
}

export function describeAdminSalesWorkbookSummary(rows: AdminSalesExportRow[]) {
  const summary = getWorkbookSummary(rows);
  return {
    ...summary,
    grandTotalLabel: formatMoneyForText(summary.netSales),
  };
}
