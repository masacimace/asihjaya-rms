import assert from "node:assert/strict";
import fs from "node:fs";
import * as XLSX from "xlsx";

import type { BuybackReportRow } from "@/features/buybacks/report-contracts";
import {
  buildBuybackWorkbook,
  describeBuybackWorkbookSummary,
  writeBuybackWorkbook,
} from "@/features/buybacks/buyback-xlsx";

const now = new Date("2026-09-08T03:00:00.000Z");

const rows: BuybackReportRow[] = [
  {
    id: "buyback-1",
    buybackNumber: "AJ-BB-TOKO-BG-20260908-AAAA1111",
    status: "completed",
    totalAmount: "1500000",
    notes: "Buyback campuran",
    completedAt: new Date("2026-09-08T02:00:00.000Z"),
    createdAt: new Date("2026-09-08T02:00:00.000Z"),
    outletCode: "TOKO-BG",
    outletName: "Pasar Bantar Gebang",
    registerCode: "REG-01",
    registerName: "Kasir 1",
    processedByName: "Administrator",
    customerCode: "CUS-001",
    customerName: "Kania Rahma",
    customerPhone: "081234567890",
    payouts: [
      { method: "cash", amount: "1000000", reference: null },
      { method: "customer_deposit", amount: "500000", reference: null },
    ],
    items: [
      {
        id: "item-1",
        lineNumber: 1,
        source: "asihjaya",
        weightGram: "1.5",
        purityPercent: "60",
        finalAmount: "800000",
        snapshot: {
          displayName: "Cincin Spiritualized SP 6K",
          categoryName: "Cincin",
          sku: "AJ-ITEM-0001",
          barcode: "AJ00000001",
          color: "Kuning",
        },
        processingType: "recondition",
        processingStatus: "pending",
      },
      {
        id: "item-2",
        lineNumber: 2,
        source: "external",
        weightGram: "1.2",
        purityPercent: "45",
        finalAmount: "700000",
        snapshot: {
          displayName: "Anting External",
          categoryName: "Anting",
          color: "Kuning",
        },
        processingType: "cleaning",
        processingStatus: "completed",
      },
    ],
  },
  {
    id: "buyback-2",
    buybackNumber: "AJ-BB-TOKO-BG-20260908-BBBB2222",
    status: "completed",
    totalAmount: "2000000",
    notes: null,
    completedAt: new Date("2026-09-08T01:00:00.000Z"),
    createdAt: new Date("2026-09-08T01:00:00.000Z"),
    outletCode: "TOKO-BG",
    outletName: "Pasar Bantar Gebang",
    registerCode: "REG-01",
    registerName: "Kasir 1",
    processedByName: "Administrator",
    customerCode: "CUS-002",
    customerName: "Budi Santoso",
    customerPhone: "081200000002",
    payouts: [
      {
        method: "bank_transfer",
        amount: "2000000",
        reference: "TRX-BCA-001",
      },
    ],
    items: [
      {
        id: "item-3",
        lineNumber: 1,
        source: "external",
        weightGram: "1.4",
        purityPercent: "70",
        finalAmount: "2000000",
        snapshot: {
          displayName: "Gelang External",
          categoryName: "Gelang",
          color: "Putih",
        },
        processingType: "cleaning",
        processingStatus: "completed",
      },
    ],
  },
  {
    id: "buyback-3",
    buybackNumber: "AJ-BB-TOKO-BG-20260908-CCCC3333",
    status: "cancelled",
    totalAmount: "900000",
    notes: "Dibatalkan",
    completedAt: null,
    createdAt: new Date("2026-09-08T00:00:00.000Z"),
    outletCode: "TOKO-BG",
    outletName: "Pasar Bantar Gebang",
    registerCode: "REG-01",
    registerName: "Kasir 1",
    processedByName: "Administrator",
    customerCode: "CUS-003",
    customerName: "Siti",
    customerPhone: null,
    payouts: [],
    items: [],
  },
];

const summary = describeBuybackWorkbookSummary(rows);
assert.equal(summary.totalTransactions, 3);
assert.equal(summary.completedTransactions, 2);
assert.equal(summary.cancelledTransactions, 1);
assert.equal(summary.totalItems, 3);
assert.equal(summary.pendingProcessingItems, 1);
assert.equal(summary.completedProcessingItems, 2);
assert.equal(summary.cashAmount, 1_000_000);
assert.equal(summary.transferAmount, 2_000_000);
assert.equal(summary.customerDepositAmount, 500_000);
assert.equal(summary.externalPayoutAmount, 3_000_000);
assert.equal(summary.totalBuybackAmount, 3_500_000);

const workbook = buildBuybackWorkbook({
  rows,
  filters: {
    search: "",
    dateRange: "all",
    processingFilter: "all",
    payoutFilter: "all",
  },
  auth: {
    organization: { name: "ASIHJAYA", timezone: "Asia/Jakarta" },
    user: { fullName: "Administrator" },
    outlet: {
      id: "outlet-1",
      code: "TOKO-BG",
      name: "Pasar Bantar Gebang",
    },
  },
  generatedAt: now,
});

assert.deepEqual(workbook.SheetNames, [
  "Ringkasan",
  "Transaksi Buyback",
  "Item Buyback",
]);
assert.equal(workbook.Sheets["Transaksi Buyback"]?.["!autofilter"], undefined);
assert.equal(workbook.Sheets["Item Buyback"]?.["!autofilter"], undefined);

const buffer = writeBuybackWorkbook(workbook);
const reloaded = XLSX.read(buffer, {
  type: "buffer",
  cellStyles: true,
  cellNF: true,
});

const summarySheet = reloaded.Sheets.Ringkasan;
const transactionSheet = reloaded.Sheets["Transaksi Buyback"];
const itemSheet = reloaded.Sheets["Item Buyback"];
assert.ok(summarySheet);
assert.ok(transactionSheet);
assert.ok(itemSheet);

function getFillRgb(cell: XLSX.CellObject | undefined) {
  const style = cell?.s as { fgColor?: { rgb?: string } } | undefined;
  return style?.fgColor?.rgb;
}

assert.equal(summarySheet.A1?.v, "LAPORAN BUYBACK ASIHJAYA");
assert.equal(summarySheet.B11?.v, 3);
assert.equal(summarySheet.B12?.v, 2);
assert.equal(summarySheet.B13?.v, 1);
assert.equal(summarySheet.B22?.v, 1_000_000);
assert.equal(summarySheet.B23?.v, 2_000_000);
assert.equal(summarySheet.B24?.v, 500_000);
assert.equal(summarySheet.B25?.v, 3_000_000);
assert.equal(summarySheet.B26?.v, 3_500_000);
assert.equal(summarySheet.A30?.v, "Cash");
assert.equal(summarySheet.A31?.v, "Transfer Bank");
assert.equal(summarySheet.A32?.v, "Dana Titip");
assert.equal(getFillRgb(summarySheet.A1), "404040");
assert.equal(getFillRgb(summarySheet.A26), "000000");

assert.equal(transactionSheet.A1?.v, "DETAIL TRANSAKSI BUYBACK");
assert.equal(transactionSheet.A2?.v, "Payout Eksternal");
assert.equal(transactionSheet.B2?.v, 3_000_000);
assert.equal(transactionSheet.A3?.v, "Payout Dana Titip");
assert.equal(transactionSheet.B3?.v, 500_000);
assert.equal(transactionSheet.A4?.v, "TOTAL NILAI BUYBACK");
assert.equal(transactionSheet.B4?.v, 3_500_000);
assert.equal(transactionSheet.A6?.v, "No. Buyback");
assert.equal(transactionSheet.L7?.v, "Cash + Dana Titip");
assert.equal(transactionSheet.Q8?.v, "TRX-BCA-001");
assert.equal(getFillRgb(transactionSheet.A1), "24483F");
assert.equal(getFillRgb(transactionSheet.A4), "24483F");
assert.equal(getFillRgb(transactionSheet.A6), "24483F");

assert.equal(itemSheet.A1?.v, "No. Buyback");
assert.equal(itemSheet.F2?.v, "ASIHJAYA");
assert.equal(itemSheet.G2?.v, "Cincin Spiritualized SP 6K");
assert.equal(itemSheet.O2?.v, "Rongsok");
assert.equal(itemSheet.P2?.v, "Menunggu Proses");
assert.equal(getFillRgb(itemSheet.A1), "24483F");

const historyPage = fs.readFileSync(
  "src/app/(pos)/pos/buyback/riwayat/page.tsx",
  "utf8",
);
const exportRoute = fs.readFileSync(
  "src/app/(pos)/pos/buyback/riwayat/export/xlsx/route.ts",
  "utf8",
);
const adminHistoryPage = fs.readFileSync(
  "src/app/(admin)/admin/buyback/page.tsx",
  "utf8",
);
const adminExportRoute = fs.readFileSync(
  "src/app/(admin)/admin/buyback/export/xlsx/route.ts",
  "utf8",
);
const adminShell = fs.readFileSync(
  "src/components/layout/admin-shell.tsx",
  "utf8",
);
const historyFilters = fs.readFileSync(
  "src/features/buybacks/history-filters.ts",
  "utf8",
);
const reportQuery = fs.readFileSync(
  "src/features/buybacks/report-queries.ts",
  "utf8",
);
assert.match(historyPage, /Export XLSX/);
assert.match(historyPage, /buyback\/riwayat\/export\/xlsx/);
assert.match(exportRoute, /hasPermission\(auth, "buybacks\.view"\)/);
assert.match(exportRoute, /hasPermission\(auth, "pos\.access"\)/);
assert.match(exportRoute, /getBuybackReportRows/);
assert.match(reportQuery, /processingFilter === "pending"/);
assert.match(reportQuery, /filters\.payoutFilter !== "all"/);
assert.match(reportQuery, /createBuybackHistoryPeriod\(filters\.dateRange, timeZone\)/);
assert.match(historyPage, /name="range"/);
assert.match(historyPage, /buybackHistoryDateRanges\.map/);
assert.match(exportRoute, /normalizeBuybackHistoryDateRange/);
assert.match(adminHistoryPage, /title: "Riwayat Buyback"/);
assert.match(adminHistoryPage, /action="\/admin\/buyback"/);
assert.match(adminHistoryPage, /historyBaseHref="\/admin\/buyback"/);
assert.match(adminHistoryPage, /admin\/buyback\/export\/xlsx/);
assert.match(adminExportRoute, /hasPermission\(auth, "admin\.access"\)/);
assert.match(adminExportRoute, /hasPermission\(auth, "buybacks\.view"\)/);
assert.match(adminShell, /label: "Riwayat Buyback"/);
assert.match(adminShell, /href: "\/admin\/buyback"/);
assert.match(historyFilters, /today: "Hari ini"/);
assert.match(historyFilters, /last7: "7 hari terakhir"/);
assert.match(historyFilters, /thisMonth: "Bulan ini"/);

console.log("Buyback XLSX report contracts: OK");
