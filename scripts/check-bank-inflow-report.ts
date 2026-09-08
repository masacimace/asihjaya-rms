import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

import {
  buildBankInflowWorkbook,
  writeBankInflowWorkbook,
} from "../src/features/bank-inflows/bank-inflow-xlsx";
import {
  BANK_INFLOW_PAGE_SIZE,
  type BankInflowReportData,
} from "../src/features/bank-inflows/contracts";

const root = process.cwd();
const read = (relativePath: string) =>
  readFile(path.join(root, relativePath), "utf8");

const generatedAt = new Date("2026-09-08T01:00:00.000Z");
const movementRows = [
  {
    id: "payment:1",
    kind: "receipt" as const,
    occurredAt: new Date("2026-09-07T02:00:00.000Z"),
    saleId: "11111111-1111-4111-8111-111111111111",
    invoiceNumber: "AJ-SALE-001",
    customerCode: "CUS-001",
    customerName: "Kania Rahma",
    customerPhone: "08123456789",
    outletId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    outletCode: "BG",
    outletName: "Pasar Bantar Gebang",
    method: "debit_card" as const,
    provider: "BCA",
    amount: 5_000_000,
    providerReference: "BCA-EDC-001",
  },
  {
    id: "payment:2",
    kind: "receipt" as const,
    occurredAt: new Date("2026-09-07T03:00:00.000Z"),
    saleId: "22222222-2222-4222-8222-222222222222",
    invoiceNumber: "AJ-SALE-002",
    customerCode: "CUS-002",
    customerName: "Customer Dua",
    customerPhone: null,
    outletId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    outletCode: "BG",
    outletName: "Pasar Bantar Gebang",
    method: "bank_transfer" as const,
    provider: "Mandiri",
    amount: 3_000_000,
    providerReference: "TRF-002",
  },
  {
    id: "refund:1",
    kind: "refund" as const,
    occurredAt: new Date("2026-09-08T00:30:00.000Z"),
    saleId: "11111111-1111-4111-8111-111111111111",
    invoiceNumber: "AJ-SALE-001",
    customerCode: "CUS-001",
    customerName: "Kania Rahma",
    customerPhone: "08123456789",
    outletId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    outletCode: "BG",
    outletName: "Pasar Bantar Gebang",
    method: "debit_card" as const,
    provider: "BCA",
    amount: 1_000_000,
    providerReference: null,
  },
];

const data: Pick<
  BankInflowReportData,
  "filters" | "period" | "outlets" | "allRows" | "summary" | "bankSummary"
> = {
  filters: {
    search: "",
    outletId: null,
    provider: null,
    method: "all",
    dateRange: "custom",
    startDate: "2026-09-01",
    endDate: "2026-09-08",
    page: 1,
  },
  period: {
    range: "custom",
    label: "01 Sep 2026 – 08 Sep 2026",
    start: new Date("2026-08-31T17:00:00.000Z"),
    end: new Date("2026-09-08T17:00:00.000Z"),
    startDate: "2026-09-01",
    endDate: "2026-09-08",
  },
  outlets: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      code: "BG",
      name: "Pasar Bantar Gebang",
    },
  ],
  allRows: movementRows,
  summary: {
    receiptAmount: 8_000_000,
    refundAmount: 1_000_000,
    netAmount: 7_000_000,
    movementCount: 3,
  },
  bankSummary: [
    {
      provider: "BCA",
      edcAmount: 5_000_000,
      transferAmount: 0,
      receiptAmount: 5_000_000,
      refundAmount: 1_000_000,
      netAmount: 4_000_000,
    },
    {
      provider: "Mandiri",
      edcAmount: 0,
      transferAmount: 3_000_000,
      receiptAmount: 3_000_000,
      refundAmount: 0,
      netAmount: 3_000_000,
    },
  ],
};

const auth = {
  organization: { name: "Asihjaya", timezone: "Asia/Jakarta" },
  user: { fullName: "Administrator" },
};

const workbook = buildBankInflowWorkbook({ data, auth, generatedAt });
const buffer = writeBankInflowWorkbook(workbook);
const reopened = XLSX.read(buffer, { type: "buffer" });

assert.deepEqual(reopened.SheetNames, ["Ringkasan", "Mutasi Bank"]);
const summarySheet = reopened.Sheets["Ringkasan"]!;
const movementSheet = reopened.Sheets["Mutasi Bank"]!;
assert.equal(summarySheet.A1?.v, "LAPORAN PEMASUKAN BANK ASIHJAYA");
assert.equal(summarySheet.A11?.v, "Penerimaan Bank");
assert.equal(summarySheet.B11?.v, 8_000_000);
assert.equal(summarySheet.A13?.v, "PEMASUKAN BANK BERSIH");
assert.equal(summarySheet.B13?.v, 7_000_000);
assert.equal(summarySheet.A18?.v, "BCA");
assert.equal(summarySheet.F18?.v, 4_000_000);
assert.equal(movementSheet.A1?.v, "DETAIL MUTASI BANK");
assert.equal(movementSheet.A6?.v, "Tanggal");
assert.equal(movementSheet.H6?.v, "Jenis");
assert.equal(movementSheet["!autofilter"], undefined);
assert.match(buffer.toString("latin1"), /Arial/);

const [pageSource, querySource, navSource, routeSource] = await Promise.all([
  read("src/app/(admin)/admin/operasional/pemasukan-bank/page.tsx"),
  read("src/features/bank-inflows/queries.ts"),
  read("src/components/layout/admin-shell.tsx"),
  read("src/app/(admin)/admin/operasional/pemasukan-bank/export/xlsx/route.ts"),
]);

assert.match(pageSource, /Laporan Pemasukan Bank/);
assert.match(pageSource, /Kembali ke Dashboard/);
assert.match(pageSource, /Pemasukan bank bersih/);
assert.doesNotMatch(pageSource, /RefreshCw/);
assert.doesNotMatch(pageSource, />\s*Refresh\s*</);
assert.match(pageSource, /<details className=/);
assert.match(pageSource, /Buka \/ tutup filter/);
assert.equal(BANK_INFLOW_PAGE_SIZE, 5);
assert.match(pageSource, /Pemasukan Bank Bersih/);
assert.match(pageSource, /Ringkasan Bank/);
assert.match(pageSource, /Detail Mutasi Bank/);
assert.match(pageSource, /Tanggal Mulai/);
assert.match(pageSource, /Tanggal Selesai/);
assert.match(querySource, /"debit_card"/);
assert.match(querySource, /"bank_transfer"/);
assert.match(querySource, /eq\(paymentRefunds\.status, "confirmed"\)/);
assert.match(querySource, /paymentRefunds\.confirmedAt/);
assert.match(navSource, /Pemasukan Bank/);
assert.match(navSource, /\/admin\/operasional\/pemasukan-bank/);
assert.match(routeSource, /hasPermission\(auth, "admin\.access"\)/);

console.log("Bank Inflow report contracts: OK");
