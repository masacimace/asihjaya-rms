import * as XLSX from "xlsx";

import type {
  BankInflowFilters,
  BankInflowMovement,
  BankInflowPeriod,
  BankInflowReportData,
} from "@/features/bank-inflows/contracts";
import { styleBankInflowWorkbookBuffer } from "@/features/bank-inflows/bank-inflow-xlsx-styles";

const rupiahNumberFormat = '"Rp" #,##0;[Red]-"Rp" #,##0';

export type BankInflowWorkbookAuthContext = {
  organization: {
    name: string;
    timezone: string;
  };
  user: {
    fullName: string;
  };
};

function sanitizeWorksheetText(value: string | number | null | undefined) {
  const normalizedValue = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();
  if (/^[=+\-@]/.test(normalizedValue)) return `'${normalizedValue}`;
  return normalizedValue;
}

function formatDateTime(value: Date, timeZone: string) {
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

function getOutletLabel(data: Pick<BankInflowReportData, "filters" | "outlets">) {
  if (!data.filters.outletId) return "Semua outlet";
  const outlet = data.outlets.find((item) => item.id === data.filters.outletId);
  return outlet ? `${outlet.code} — ${outlet.name}` : "Semua outlet";
}

function getMethodLabel(filters: BankInflowFilters) {
  if (filters.method === "debit_card") return "EDC";
  if (filters.method === "bank_transfer") return "Transfer Bank";
  return "Semua metode";
}

function getProviderLabel(filters: BankInflowFilters) {
  return filters.provider || "Semua bank";
}

function buildSummaryWorksheet({
  data,
  auth,
  generatedAt,
}: {
  data: Pick<
    BankInflowReportData,
    "filters" | "period" | "outlets" | "summary" | "bankSummary"
  >;
  auth: BankInflowWorkbookAuthContext;
  generatedAt: Date;
}) {
  const summaryStartRow = 10;
  const bankSectionRow = 16;
  const bankHeaderRow = 17;
  const bankDataStartRow = 18;

  const rows: unknown[][] = [
    ["LAPORAN PEMASUKAN BANK ASIHJAYA", "", "", "", "", ""],
    ["Periode", data.period.label, "", "", "", ""],
    ["Outlet", getOutletLabel(data), "", "", "", ""],
    ["Bank", getProviderLabel(data.filters), "", "", "", ""],
    ["Metode", getMethodLabel(data.filters), "", "", "", ""],
    ["Pencarian", data.filters.search || "—", "", "", "", ""],
    ["Dibuat", formatDateTime(generatedAt, auth.organization.timezone), "", "", "", ""],
    ["Dibuat oleh", auth.user.fullName, "", "", "", ""],
    ["", "", "", "", "", ""],
    ["RINGKASAN NILAI", "", "", "", "", ""],
    ["Penerimaan Bank", data.summary.receiptAmount, "", "", "", ""],
    ["Refund Bank", data.summary.refundAmount, "", "", "", ""],
    ["PEMASUKAN BANK BERSIH", data.summary.netAmount, "", "", "", ""],
    ["Jumlah Mutasi", data.summary.movementCount, "", "", "", ""],
    ["", "", "", "", "", ""],
    ["RINGKASAN BANK", "", "", "", "", ""],
    ["Bank", "EDC", "Transfer", "Penerimaan", "Refund", "Bersih"],
  ];

  if (data.bankSummary.length === 0) {
    rows.push(["Tidak ada data", 0, 0, 0, 0, 0]);
  } else {
    for (const bank of data.bankSummary) {
      rows.push([
        sanitizeWorksheetText(bank.provider),
        bank.edcAmount,
        bank.transferAmount,
        bank.receiptAmount,
        bank.refundAmount,
        bank.netAmount,
      ]);
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: summaryStartRow - 1, c: 0 }, e: { r: summaryStartRow - 1, c: 5 } },
    { s: { r: bankSectionRow - 1, c: 0 }, e: { r: bankSectionRow - 1, c: 5 } },
  ];
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
  ];

  for (const rowIndex of [10, 11, 12]) setNumberFormat(worksheet, rowIndex, 1);
  const bankRowCount = Math.max(1, data.bankSummary.length);
  for (let offset = 0; offset < bankRowCount; offset += 1) {
    for (let columnIndex = 1; columnIndex <= 5; columnIndex += 1) {
      setNumberFormat(worksheet, bankDataStartRow - 1 + offset, columnIndex);
    }
  }

  // Deliberately no AutoFilter: finance worksheet should stay visually clean.
  return worksheet;
}

function buildMovementWorksheet({
  rows,
  summary,
  auth,
}: {
  rows: BankInflowMovement[];
  summary: BankInflowReportData["summary"];
  auth: BankInflowWorkbookAuthContext;
}) {
  const dataRows = rows.map((row) => {
    const receipt = row.kind === "receipt" ? row.amount : 0;
    const refund = row.kind === "refund" ? row.amount : 0;
    const net = receipt - refund;

    return [
      formatDateTime(row.occurredAt, auth.organization.timezone),
      sanitizeWorksheetText(row.invoiceNumber),
      sanitizeWorksheetText(row.customerName ?? "Walk-in"),
      sanitizeWorksheetText(row.customerCode ?? row.customerPhone ?? ""),
      sanitizeWorksheetText(`${row.outletCode} — ${row.outletName}`),
      sanitizeWorksheetText(row.provider),
      row.method === "debit_card" ? "EDC" : "Transfer Bank",
      row.kind === "receipt" ? "Penerimaan" : "Refund",
      receipt,
      refund,
      net,
      sanitizeWorksheetText(row.providerReference ?? ""),
    ];
  });

  const tableHeader = [
    "Tanggal",
    "Invoice",
    "Customer",
    "Kode / Telepon",
    "Outlet",
    "Bank",
    "Metode",
    "Jenis",
    "Penerimaan",
    "Refund",
    "Bersih",
    "Referensi / Profil",
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([
    ["DETAIL MUTASI BANK", "", "", "", "", "", "", "", "", "", "", ""],
    ["Penerimaan Bank", summary.receiptAmount],
    ["Refund Bank", summary.refundAmount],
    ["PEMASUKAN BANK BERSIH", summary.netAmount],
    [""],
    tableHeader,
    ...dataRows,
  ]);

  worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 20 },
    { wch: 25 },
    { wch: 20 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24 },
  ];

  for (const rowIndex of [1, 2, 3]) setNumberFormat(worksheet, rowIndex, 1);
  for (let offset = 0; offset < dataRows.length; offset += 1) {
    const rowIndex = 6 + offset;
    for (const columnIndex of [8, 9, 10]) setNumberFormat(worksheet, rowIndex, columnIndex);
  }

  // No AutoFilter by design. Freeze pane is applied by the styling pass.
  return worksheet;
}

export function buildBankInflowWorkbook({
  data,
  auth,
  generatedAt,
}: {
  data: Pick<
    BankInflowReportData,
    "filters" | "period" | "outlets" | "allRows" | "summary" | "bankSummary"
  >;
  auth: BankInflowWorkbookAuthContext;
  generatedAt: Date;
}) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    buildSummaryWorksheet({ data, auth, generatedAt }),
    "Ringkasan",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildMovementWorksheet({ rows: data.allRows, summary: data.summary, auth }),
    "Mutasi Bank",
  );
  return workbook;
}

export function writeBankInflowWorkbook(workbook: XLSX.WorkBook) {
  const raw = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return styleBankInflowWorkbookBuffer(raw);
}

export function buildBankInflowExportFilename(
  generatedAt: Date,
  timeZone: string,
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(generatedAt)
    .filter((part) => part.type !== "literal")
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

  return `laporan-pemasukan-bank-${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}.xlsx`;
}
