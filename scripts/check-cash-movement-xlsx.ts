import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as XLSX from "xlsx";

import type {
  AdminCashMovementListData,
  AdminCashMovementRow,
} from "../src/features/cash-movements/contracts";
import {
  buildCashMovementWorkbook,
  writeCashMovementWorkbook,
} from "../src/features/cash-movements/export";

const generatedAt = new Date("2026-09-23T03:30:00.000Z");

const rows: AdminCashMovementRow[] = [
  {
    id: "movement-1",
    shiftId: "shift-1",
    type: "opening_balance",
    amount: "1000000",
    referenceType: "shift_opening",
    referenceId: null,
    referenceLabel: "Modal awal shift",
    reason: "Modal awal kasir",
    createdAt: new Date("2026-09-23T01:00:00.000Z"),
    createdByName: "Administrator",
    outletId: "outlet-1",
    outletCode: "BG",
    outletName: "Pasar Bantar Gebang",
    registerId: "register-1",
    registerCode: "POS-01",
    registerName: "Kasir 01",
    shiftStatus: "open",
    shiftOpenedAt: new Date("2026-09-23T01:00:00.000Z"),
  },
  {
    id: "movement-2",
    shiftId: "shift-1",
    type: "cash_sale",
    amount: "2700000",
    referenceType: "sale",
    referenceId: "sale-1",
    referenceLabel: "AJ-SALE-001",
    reason: "Pembayaran tunai POS",
    createdAt: new Date("2026-09-23T02:00:00.000Z"),
    createdByName: "Fahri",
    outletId: "outlet-1",
    outletCode: "BG",
    outletName: "Pasar Bantar Gebang",
    registerId: "register-1",
    registerCode: "POS-01",
    registerName: "Kasir 01",
    shiftStatus: "open",
    shiftOpenedAt: new Date("2026-09-23T01:00:00.000Z"),
  },
  {
    id: "movement-3",
    shiftId: "shift-1",
    type: "cash_out",
    amount: "500000",
    referenceType: "buyback",
    referenceId: "buyback-1",
    referenceLabel: "BB-001",
    reason: "Payout Buyback",
    createdAt: new Date("2026-09-23T03:00:00.000Z"),
    createdByName: "Fahri",
    outletId: "outlet-1",
    outletCode: "BG",
    outletName: "Pasar Bantar Gebang",
    registerId: "register-1",
    registerCode: "POS-01",
    registerName: "Kasir 01",
    shiftStatus: "open",
    shiftOpenedAt: new Date("2026-09-23T01:00:00.000Z"),
  },
];

const data: AdminCashMovementListData = {
  filters: {
    search: "",
    outletId: null,
    type: "all",
    range: "today",
    page: 1,
  },
  outlets: [
    {
      id: "outlet-1",
      code: "BG",
      name: "Pasar Bantar Gebang",
      isPrimary: true,
    },
  ],
  activeShifts: [],
  rows,
  summary: {
    totalMovements: 3,
    openingBalance: 1_000_000,
    cashSales: 2_700_000,
    manualCashIn: 0,
    manualCashOut: 0,
    buybackCashPayouts: 500_000,
    cashRefunds: 0,
    customerDepositCashWithdrawals: 0,
    closingAdjustments: 0,
    netMovement: 3_200_000,
    activeShiftCount: 1,
  },
  customerDepositSummary: {
    openingBalance: 0,
    depositIn: 0,
    depositUsed: 0,
    depositWithdrawals: 0,
    adjustmentIn: 0,
    adjustmentOut: 0,
    closingBalance: 0,
    netChange: 0,
    ledgerEntryCount: 0,
  },
  total: 3,
  page: 1,
  pageCount: 1,
  pageSize: 20,
  periodLabel: "Hari ini",
};

const auth = {
  organization: {
    name: "ASIHJAYA",
    timezone: "Asia/Jakarta",
  },
  user: {
    fullName: "Administrator",
  },
};

const workbook = buildCashMovementWorkbook({
  data,
  rows,
  auth,
  generatedAt,
});

assert.deepEqual(workbook.SheetNames, ["Ringkasan", "Buku Kas"]);

const buffer = writeCashMovementWorkbook(workbook);
const reopened = XLSX.read(buffer, {
  type: "buffer",
  cellStyles: true,
  cellNF: true,
});

const summarySheet = reopened.Sheets.Ringkasan!;
const cashBookSheet = reopened.Sheets["Buku Kas"]!;

function getFillRgb(cell: XLSX.CellObject | undefined) {
  const style = cell?.s as { fgColor?: { rgb?: string } } | undefined;

  return style?.fgColor?.rgb;
}

assert.equal(summarySheet.A1?.v, "BUKU KAS ASIHJAYA");
assert.equal(getFillRgb(summarySheet.A1), "404040");
assert.equal(getFillRgb(cashBookSheet.A1), "24483F");
assert.equal(getFillRgb(cashBookSheet.A6), "24483F");
assert.equal(summarySheet.A11?.v, "Total Kas Masuk");
assert.equal(summarySheet.B11?.v, 3_700_000);
assert.equal(summarySheet.A12?.v, "Total Kas Keluar");
assert.equal(summarySheet.B12?.v, 500_000);
assert.equal(summarySheet.A13?.v, "NET MOVEMENT");
assert.equal(summarySheet.B13?.v, 3_200_000);
assert.equal(typeof summarySheet.B11?.v, "number");
assert.match(String(summarySheet.B11?.z ?? ""), /Rp/);

assert.equal(cashBookSheet.A1?.v, "DETAIL BUKU KAS");
assert.equal(cashBookSheet.A6?.v, "Tanggal & Waktu");
assert.equal(cashBookSheet.I6?.v, "Kas Masuk");
assert.equal(cashBookSheet.J6?.v, "Kas Keluar");
assert.equal(cashBookSheet.K6?.v, "Net Movement");
assert.equal(cashBookSheet.I8?.v, 2_700_000);
assert.equal(typeof cashBookSheet.I8?.v, "number");
assert.match(String(cashBookSheet.I8?.z ?? ""), /Rp/);
assert.equal(cashBookSheet.J9?.v, 500_000);
assert.equal(cashBookSheet.K9?.v, -500_000);
assert.ok(cashBookSheet["!autofilter"]);

const pageSource = readFileSync(
  new URL(
    "../src/app/(admin)/admin/operasional/kas/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const routeSource = readFileSync(
  new URL(
    "../src/app/(admin)/admin/operasional/kas/export/xlsx/route.ts",
    import.meta.url,
  ),
  "utf8",
);

const styleSource = readFileSync(
  new URL(
    "../src/features/bank-inflows/bank-inflow-xlsx-styles.ts",
    import.meta.url,
  ),
  "utf8",
);

assert.match(pageSource, />\s*Export Excel\s*</);
assert.doesNotMatch(pageSource, />\s*XLSX\s*</);
assert.match(routeSource, /buildCashMovementWorkbook/);
assert.match(routeSource, /writeCashMovementWorkbook/);
assert.match(routeSource, /auth\.organization\.timezone/);
assert.match(styleSource, /<name val=\"Arial\"\/>/);
assert.match(styleSource, /state=\"frozen\"/);
assert.match(styleSource, /showGridLines=\"0\"/);

console.log(
  "Cash Movement XLSX contracts: OK — styled summary, numeric Rupiah, frozen detail header, AutoFilter.",
);
