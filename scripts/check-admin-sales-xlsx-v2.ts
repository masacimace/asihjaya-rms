import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as XLSX from "xlsx";

import type { AdminSalesExportRow } from "../src/features/sales/admin-contracts";
import {
  buildAdminSalesWorkbook,
  describeAdminSalesWorkbookSummary,
  getAdminSalesPaymentMethodLabel,
  getAdminSalesPaymentStatusLabel,
} from "../src/features/sales/admin-sales-xlsx";

const now = new Date("2026-09-08T01:00:00+07:00");

const querySource = readFileSync(
  new URL("../src/features/sales/admin-queries.ts", import.meta.url),
  "utf8",
);
assert.match(querySource, /paymentRefunds/);
assert.match(querySource, /provider: payments\.provider/);
assert.match(querySource, /profileName: profile\.name \?\? null/);
assert.match(querySource, /refunds: saleRefundRows\.map/);

function sale(
  overrides: Partial<AdminSalesExportRow> &
    Pick<AdminSalesExportRow, "id" | "invoiceNumber" | "status" | "totalAmount">,
): AdminSalesExportRow {
  return {
    subtotalAmount: overrides.totalAmount,
    discountAmount: "0",
    additionalFeeAmount: "0",
    paidAmount: Number(overrides.totalAmount),
    externalPaidAmount: Number(overrides.totalAmount),
    refundedAmount: 0,
    customerDepositUsedAmount: 0,
    customerDepositInAmount: 0,
    paymentStatus: "paid",
    receivedAmount: 0,
    changeAmount: 0,
    completedAt: now,
    createdAt: now,
    outletCode: "TOKO-BG",
    outletName: "Pasar Bantar Gebang",
    registerCode: "POS-BGA",
    registerName: "Kasir Bantar Gebang",
    cashierName: "Administrator",
    customerCode: "CUST-001",
    customerName: "Customer Test",
    customerPhone: "08123456789",
    totalItems: 1,
    items: [
      {
        lineNumber: 1,
        productName: "Cincin Test",
        sku: "AJ-ITEM-001",
        barcode: "AJ00000001",
        categoryName: "Cincin",
        finalPriceAmount: overrides.totalAmount,
      },
    ],
    payments: [],
    refunds: [],
    paymentMethods: [],
    printStatus: "completed",
    ...overrides,
  };
}

const rows: AdminSalesExportRow[] = [
  sale({
    id: "sale-bca",
    invoiceNumber: "INV-BCA",
    status: "completed",
    totalAmount: "1000000",
    payments: [
      {
        method: "debit_card",
        provider: "BCA",
        profileName: "BCA EDC — Kasir 1",
        amount: "1000000",
        status: "paid",
        providerReference: null,
      },
    ],
    paymentMethods: ["debit_card"],
  }),
  sale({
    id: "sale-refund",
    invoiceNumber: "INV-REFUND",
    status: "refunded",
    totalAmount: "500000",
    paidAmount: 0,
    externalPaidAmount: 0,
    refundedAmount: 500000,
    paymentStatus: "pending",
    payments: [
      {
        method: "cash",
        provider: "cash",
        profileName: null,
        amount: "500000",
        status: "refunded",
        providerReference: null,
      },
    ],
    refunds: [
      {
        method: "cash",
        provider: "cash",
        amount: "500000",
        status: "confirmed",
      },
    ],
    paymentMethods: ["cash"],
  }),
  sale({
    id: "sale-transfer",
    invoiceNumber: "INV-TRANSFER",
    status: "completed",
    totalAmount: "2000000",
    payments: [
      {
        method: "bank_transfer",
        provider: "Mandiri",
        profileName: "Mandiri Transfer",
        amount: "2000000",
        status: "paid",
        providerReference: "REF-001",
      },
    ],
    paymentMethods: ["bank_transfer"],
  }),
];

assert.equal(getAdminSalesPaymentMethodLabel(rows[0]!), "BCA");
assert.equal(getAdminSalesPaymentStatusLabel(rows[1]!), "Refund Penuh");
assert.notEqual(getAdminSalesPaymentStatusLabel(rows[1]!), "Belum Dibayar");

const summary = describeAdminSalesWorkbookSummary(rows);
assert.equal(summary.grossSales, 3_500_000);
assert.equal(summary.refundAmount, 500_000);
assert.equal(summary.netSales, 3_000_000);

const workbook = buildAdminSalesWorkbook({
  rows,
  filters: {
    search: "",
    outletId: null,
    status: null,
    paymentMethod: null,
    dateRange: "today",
    page: 1,
  },
  auth: {
    organization: {
      name: "ASIHJAYA",
      timezone: "Asia/Jakarta",
    },
    user: {
      fullName: "Administrator",
    },
    outlets: [
      {
        id: "outlet-1",
        code: "TOKO-BG",
        name: "Pasar Bantar Gebang",
      },
    ],
  },
  generatedAt: now,
});

assert.deepEqual(workbook.SheetNames, ["Ringkasan", "Transaksi", "Item Penjualan"]);

const buffer = XLSX.write(workbook, {
  bookType: "xlsx",
  type: "buffer",
  compression: true,
}) as Buffer;
const reloaded = XLSX.read(buffer, { type: "buffer" });

const summarySheet = reloaded.Sheets.Ringkasan;
const transactionSheet = reloaded.Sheets.Transaksi;
const itemSheet = reloaded.Sheets["Item Penjualan"];

assert.ok(summarySheet);
assert.ok(transactionSheet);
assert.ok(itemSheet);

assert.equal(summarySheet.A1?.v, "LAPORAN PENJUALAN ASIHJAYA");
assert.equal(summarySheet.B24?.v, 3_500_000);
assert.equal(summarySheet.B25?.v, 500_000);
assert.equal(summarySheet.B26?.v, 3_000_000);

assert.equal(transactionSheet.L6?.v, "BCA");
assert.equal(transactionSheet.K7?.v, "Refund Penuh");
assert.equal(transactionSheet.R7?.v, 0);
assert.equal(itemSheet.C6?.v, "Refund Penuh");
assert.equal(itemSheet.D6?.v, "Refund Penuh");

const summaryRows = XLSX.utils.sheet_to_json<Array<string | number>>(summarySheet, {
  header: 1,
  raw: true,
});
const paymentLabels = summaryRows.flatMap((row) =>
  typeof row?.[0] === "string" ? [row[0]] : [],
);
assert.ok(paymentLabels.includes("BCA (EDC)"));
assert.ok(paymentLabels.includes("Cash"));
assert.ok(paymentLabels.includes("Mandiri (Transfer)"));

console.log("Admin Sales XLSX V2 contracts: OK");
