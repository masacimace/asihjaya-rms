import type { ExportSheet } from "@/lib/export-files";
import type {
  ReportInventoryMovementType,
  ReportPaymentMethod,
  ReportSaleStatus,
  ReportSalesData,
  ReportStockData,
} from "./contracts";

const paymentMethodLabels: Record<ReportPaymentMethod, string> = {
  cash: "Cash",
  debit_card: "Debit Card",
  credit_card: "Credit Card",
  bank_transfer: "Transfer Bank",
  qris_manual: "QRIS Manual",
  qris_gateway: "QRIS Gateway",
  other: "Lainnya",
};

const saleStatusLabels: Record<ReportSaleStatus, string> = {
  draft: "Draft",
  awaiting_payment: "Menunggu bayar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  voided: "Void",
  partially_refunded: "Refund parsial",
  refunded: "Refund",
};

const movementTypeLabels: Record<ReportInventoryMovementType, string> = {
  goods_receipt: "Barang masuk",
  sale: "Terjual",
  sale_return: "Retur penjualan",
  transfer_out: "Transfer keluar",
  transfer_in: "Transfer masuk",
  reservation: "Reservasi",
  reservation_release: "Lepas reservasi",
  adjustment: "Adjustment",
  damaged: "Rusak",
  lost: "Hilang",
  repair_out: "Keluar repair",
  repair_in: "Masuk repair",
  reversal: "Reversal/Void",
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function roundAmount(value: number | string | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);

  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function roundGram(value: number | string | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);

  return Number.isFinite(amount) ? Number(amount.toFixed(3)) : 0;
}

function outletLabel(
  selectedOutlet: { code: string; name: string } | null,
  fallback = "Semua outlet akses saya",
) {
  return selectedOutlet ? `${selectedOutlet.code} - ${selectedOutlet.name}` : fallback;
}

export function buildSalesReportSheets(data: ReportSalesData): ExportSheet[] {
  return [
    {
      name: "Ringkasan Penjualan",
      columns: ["Metrik", "Nilai", "Keterangan"],
      rows: [
        ["Periode", data.period.label, data.period.description],
        ["Outlet", outletLabel(data.selectedOutlet), ""],
        ["Search", data.filters.query || "-", ""],
        ["Status filter", data.filters.status, ""],
        ["Metode bayar filter", data.filters.paymentMethod, ""],
        ["Omzet transaksi selesai", roundAmount(data.summary.grossRevenue), "Transaksi completed"],
        ["Nota selesai", data.summary.completedTransactionCount, ""],
        ["Semua transaksi di tabel", data.summary.allTransactionCount, "Mengikuti filter list"],
        ["Item terjual", data.summary.itemSold, ""],
        ["Gramasi terjual", roundGram(data.summary.weightSoldGram), "Gram"],
        ["Laba kotor estimasi", roundAmount(data.summary.grossProfit), "Final price - cost amount"],
        ["Diskon", roundAmount(data.summary.discountAmount), ""],
        ["Rata-rata transaksi", roundAmount(data.summary.averageTransactionAmount), ""],
        ["Cash revenue", roundAmount(data.summary.cashRevenue), "Pembayaran cash paid"],
        ["Non-cash revenue", roundAmount(data.summary.nonCashRevenue), "Omzet selesai - cash revenue"],
        ["Void/refund impact", roundAmount(data.summary.voidRefundImpact), `${data.summary.voidRefundCount} transaksi`],
      ],
      widths: [{ wch: 28 }, { wch: 22 }, { wch: 48 }],
    },
    {
      name: "Tren Harian",
      columns: ["Tanggal", "Omzet", "Jumlah Transaksi", "Item Terjual", "Laba Kotor"],
      rows: data.dailySales.map((point) => [
        point.label,
        roundAmount(point.revenue),
        point.transactionCount,
        point.itemSold,
        roundAmount(point.grossProfit),
      ]),
      widths: [{ wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 }],
    },
    {
      name: "Metode Bayar",
      columns: ["Metode", "Nominal", "Jumlah Transaksi", "Persentase"],
      rows: data.paymentBreakdown.map((row) => [
        paymentMethodLabels[row.method],
        roundAmount(row.amount),
        row.transactionCount,
        `${row.percentage.toFixed(2)}%`,
      ]),
      widths: [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 16 }],
    },
    {
      name: "Status Transaksi",
      columns: ["Status", "Jumlah Transaksi", "Nominal"],
      rows: data.statusBreakdown.map((row) => [
        saleStatusLabels[row.status],
        row.transactionCount,
        roundAmount(row.amount),
      ]),
      widths: [{ wch: 20 }, { wch: 18 }, { wch: 18 }],
    },
    {
      name: "Leaderboard Outlet",
      columns: ["Kode Outlet", "Outlet", "Omzet", "Jumlah Transaksi", "Item Terjual"],
      rows: data.topOutlets.map((row) => [
        row.outletCode,
        row.outletName,
        roundAmount(row.revenue),
        row.transactionCount,
        row.itemSold,
      ]),
      widths: [{ wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 16 }],
    },
    {
      name: "Transaksi",
      columns: [
        "Invoice",
        "Tanggal Aktivitas",
        "Outlet Code",
        "Outlet",
        "Customer",
        "Kasir",
        "Status",
        "Metode Bayar",
        "Subtotal",
        "Diskon",
        "Total",
        "Jumlah Item",
        "Gramasi",
        "Laba Kotor",
        "Completed At",
        "Cancelled At",
        "Created At",
      ],
      rows: data.sales.map((row) => [
        row.invoiceNumber,
        formatDateTime(row.completedAt ?? row.cancelledAt ?? row.createdAt),
        row.outletCode,
        row.outletName,
        row.customerName ?? "Walk-in Customer",
        row.cashierName,
        saleStatusLabels[row.status],
        row.paymentMethods.length > 0
          ? row.paymentMethods.map((method) => paymentMethodLabels[method]).join(" + ")
          : "Belum bayar",
        roundAmount(row.subtotalAmount),
        roundAmount(row.discountAmount),
        roundAmount(row.totalAmount),
        row.itemCount,
        roundGram(row.weightSoldGram),
        roundAmount(row.grossProfit),
        formatDateTime(row.completedAt),
        formatDateTime(row.cancelledAt),
        formatDateTime(row.createdAt),
      ]),
      widths: [
        { wch: 26 },
        { wch: 22 },
        { wch: 14 },
        { wch: 24 },
        { wch: 26 },
        { wch: 22 },
        { wch: 18 },
        { wch: 24 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
      ],
    },
  ];
}

export function buildStockReportSheets(data: ReportStockData): ExportSheet[] {
  return [
    {
      name: "Ringkasan Stok",
      columns: ["Metrik", "Nilai", "Keterangan"],
      rows: [
        ["Periode", data.period.label, data.period.description],
        ["Outlet", outletLabel(data.selectedOutlet), ""],
        ["Search", data.filters.query || "-", ""],
        ["Movement filter", data.filters.movementType, ""],
        ["Stok tersedia", data.summary.availableItemCount, "Item available"],
        ["Gramasi tersedia", roundGram(data.summary.availableWeightGram), "Gram"],
        ["Estimasi nilai inventory", roundAmount(data.summary.availableCostValue), "Harga modal"],
        ["Movement periode", data.summary.movementCount, ""],
        ["Barang masuk", data.summary.stockInCount, ""],
        ["Barang keluar", data.summary.stockOutCount, ""],
        ["Item terjual", data.summary.saleCount, ""],
        ["Item kembali", data.summary.returnCount, "Sale return/reversal"],
        ["Adjustment risiko", data.summary.adjustmentCount, "Adjustment/rusak/hilang"],
      ],
      widths: [{ wch: 28 }, { wch: 20 }, { wch: 44 }],
    },
    {
      name: "Tren Mutasi",
      columns: ["Tanggal", "Masuk", "Keluar", "Kembali"],
      rows: data.movementTrend.map((point) => [
        point.label,
        point.stockInCount,
        point.stockOutCount,
        point.returnCount,
      ]),
      widths: [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }],
    },
    {
      name: "Stok per Outlet",
      columns: ["Kode Outlet", "Outlet", "Item Tersedia", "Gramasi", "Nilai Modal"],
      rows: data.outletStock.map((row) => [
        row.outletCode,
        row.outletName,
        row.availableItemCount,
        roundGram(row.availableWeightGram),
        roundAmount(row.availableCostValue),
      ]),
      widths: [{ wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 18 }],
    },
    {
      name: "Stok per Kategori",
      columns: ["Kategori", "Item", "Gramasi", "Nilai Modal"],
      rows: data.categoryStock.map((row) => [
        row.categoryName,
        row.itemCount,
        roundGram(row.weightGram),
        roundAmount(row.costValue),
      ]),
      widths: [{ wch: 26 }, { wch: 12 }, { wch: 16 }, { wch: 18 }],
    },
    {
      name: "Fast Moving",
      columns: ["Product Code", "Produk", "Kategori", "Terjual", "Gramasi Terjual", "Revenue", "Stok Tersedia"],
      rows: data.fastMovingProducts.map((row) => [
        row.productCode,
        row.productName,
        row.categoryName,
        row.soldCount,
        roundGram(row.soldWeightGram),
        roundAmount(row.revenue),
        row.availableCount,
      ]),
      widths: [{ wch: 18 }, { wch: 34 }, { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 16 }],
    },
    {
      name: "Slow Moving",
      columns: ["SKU", "Barcode", "Produk", "Outlet", "Gramasi", "Harga Label", "Umur Stok Hari", "Created At"],
      rows: data.slowMovingItems.map((row) => [
        row.sku,
        row.barcode,
        row.productName,
        row.outletName ?? "-",
        roundGram(row.weightGram),
        roundAmount(row.sellingAmount),
        row.stockAgeDays,
        formatDate(row.createdAt),
      ]),
      widths: [{ wch: 18 }, { wch: 22 }, { wch: 34 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 }],
    },
    {
      name: "Ledger Movement",
      columns: [
        "Tanggal",
        "SKU",
        "Barcode",
        "Produk",
        "Kategori",
        "Movement",
        "Dari Outlet",
        "Ke Outlet",
        "Outlet Saat Ini",
        "Operator",
        "Reference Type",
        "Invoice",
        "Alasan",
        "Gramasi",
        "Harga Modal",
        "Harga Label",
      ],
      rows: data.movements.map((row) => [
        formatDateTime(row.occurredAt),
        row.sku,
        row.barcode,
        row.productName,
        row.categoryName,
        movementTypeLabels[row.movementType],
        row.fromOutletName ?? "-",
        row.toOutletName ?? "-",
        row.currentOutletName ?? "-",
        row.performerName,
        row.referenceType ?? "-",
        row.invoiceNumber ?? "-",
        row.reason ?? "-",
        roundGram(row.weightGram),
        roundAmount(row.costAmount),
        roundAmount(row.sellingAmount),
      ]),
      widths: [
        { wch: 22 },
        { wch: 18 },
        { wch: 22 },
        { wch: 34 },
        { wch: 22 },
        { wch: 20 },
        { wch: 24 },
        { wch: 24 },
        { wch: 24 },
        { wch: 22 },
        { wch: 18 },
        { wch: 24 },
        { wch: 36 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
      ],
    },
  ];
}
