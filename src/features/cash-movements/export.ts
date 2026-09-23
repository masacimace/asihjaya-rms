import * as XLSX from "xlsx";

import { styleBankInflowWorkbookBuffer } from "@/features/bank-inflows/bank-inflow-xlsx-styles";
import type {
  AdminCashMovementListData,
  AdminCashMovementRow,
  AdminCashMovementType,
  CashMovementType,
} from "./contracts";

const rupiahNumberFormat = '"Rp" #,##0;[Red]-"Rp" #,##0';

const cashMovementTypeLabels: Record<CashMovementType, string> = {
  opening_balance: "Modal Awal",
  cash_sale: "Cash Sale",
  cash_refund: "Refund Cash",
  cash_in: "Kas Masuk",
  cash_out: "Kas Keluar",
  closing_adjustment: "Koreksi Closing",
};

const filterTypeLabels: Record<AdminCashMovementType, string> = {
  all: "Semua tipe",
  ...cashMovementTypeLabels,
};

export type CashMovementWorkbookAuthContext = {
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

  if (/^[=+\-@]/.test(normalizedValue)) {
    return `'${normalizedValue}`;
  }

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

function roundAmount(value: number | string | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);

  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function getSignedCashMovementAmount(
  row: Pick<AdminCashMovementRow, "type" | "amount">,
) {
  const amount = roundAmount(row.amount);

  if (row.type === "cash_out" || row.type === "cash_refund") {
    return -Math.abs(amount);
  }

  return amount;
}

function setNumberFormat(
  worksheet: XLSX.WorkSheet,
  rowIndex: number,
  columnIndex: number,
  format = rupiahNumberFormat,
) {
  const ref = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = worksheet[ref];

  if (cell && cell.t === "n") {
    cell.z = format;
  }
}

function getCashMovementTypeLabel(
  row: Pick<AdminCashMovementRow, "type" | "referenceType">,
) {
  if (
    row.type === "cash_out" &&
    row.referenceType === "customer_deposit_withdrawal"
  ) {
    return "Tarik Dana Titip";
  }

  if (row.type === "cash_out" && row.referenceType === "buyback") {
    return "Payout Buyback";
  }

  return cashMovementTypeLabels[row.type];
}

function getMovementDirection(signedAmount: number) {
  if (signedAmount > 0) return "Masuk";
  if (signedAmount < 0) return "Keluar";
  return "Netral";
}

function getOutletLabel(data: AdminCashMovementListData) {
  if (!data.filters.outletId) {
    return "Semua outlet akses saya";
  }

  const outlet = data.outlets.find(
    (item) => item.id === data.filters.outletId,
  );

  return outlet ? `${outlet.code} — ${outlet.name}` : "Semua outlet akses saya";
}

function buildMovementSummary(rows: AdminCashMovementRow[]) {
  const summary = new Map<
    string,
    {
      count: number;
      cashIn: number;
      cashOut: number;
      net: number;
    }
  >();

  for (const row of rows) {
    const label = getCashMovementTypeLabel(row);
    const signedAmount = roundAmount(getSignedCashMovementAmount(row));
    const current = summary.get(label) ?? {
      count: 0,
      cashIn: 0,
      cashOut: 0,
      net: 0,
    };

    current.count += 1;

    if (signedAmount > 0) {
      current.cashIn += signedAmount;
    } else if (signedAmount < 0) {
      current.cashOut += Math.abs(signedAmount);
    }

    current.net += signedAmount;
    summary.set(label, current);
  }

  return Array.from(summary.entries())
    .map(([label, value]) => ({
      label,
      ...value,
      average:
        value.count > 0
          ? Math.round((value.cashIn + value.cashOut) / value.count)
          : 0,
      grossMovement: value.cashIn + value.cashOut,
    }))
    .sort((a, b) => b.grossMovement - a.grossMovement);
}

function buildSummaryWorksheet({
  data,
  rows,
  auth,
  generatedAt,
}: {
  data: AdminCashMovementListData;
  rows: AdminCashMovementRow[];
  auth: CashMovementWorkbookAuthContext;
  generatedAt: Date;
}) {
  const movementSummary = buildMovementSummary(rows);
  const movementDataStartRow = 18;

  const rowsData: unknown[][] = [
    ["BUKU KAS ASIHJAYA", "", "", "", "", ""],
    ["Periode", data.periodLabel, "", "", "", ""],
    ["Outlet", getOutletLabel(data), "", "", "", ""],
    ["Tipe movement", filterTypeLabels[data.filters.type], "", "", "", ""],
    ["Pencarian", data.filters.search || "—", "", "", "", ""],
    [
      "Dibuat",
      formatDateTime(generatedAt, auth.organization.timezone),
      "",
      "",
      "",
      "",
    ],
    ["Dibuat oleh", auth.user.fullName, "", "", "", ""],
    ["Organisasi", auth.organization.name, "", "", "", ""],
    ["", "", "", "", "", ""],
    ["RINGKASAN NILAI", "", "", "", "", ""],
    ["Total Kas Masuk", 0, "", "", "", ""],
    ["Total Kas Keluar", 0, "", "", "", "", ""],
    ["NET MOVEMENT", roundAmount(data.summary.netMovement), "", "", "", ""],
    ["Jumlah Movement", rows.length, "", "", "", ""],
    ["", "", "", "", "", ""],
    ["RINGKASAN JENIS MOVEMENT", "", "", "", "", ""],
    [
      "Tipe Movement",
      "Kas Masuk",
      "Kas Keluar",
      "Net",
      "Rata-rata",
      "Total Aktivitas",
    ],
  ];

  let totalCashIn = 0;
  let totalCashOut = 0;

  for (const item of movementSummary) {
    totalCashIn += item.cashIn;
    totalCashOut += item.cashOut;

    rowsData.push([
      `${item.label} · ${item.count} movement`,
      item.cashIn,
      item.cashOut,
      item.net,
      item.average,
      item.grossMovement,
    ]);
  }

  if (movementSummary.length === 0) {
    rowsData.push(["Tidak ada data", 0, 0, 0, 0, 0]);
  }

  rowsData[10]![1] = totalCashIn;
  rowsData[11]![1] = totalCashOut;

  const worksheet = XLSX.utils.aoa_to_sheet(rowsData);

  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 5 } },
    { s: { r: 15, c: 0 }, e: { r: 15, c: 5 } },
  ];
  worksheet["!cols"] = [
    { wch: 34 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
  ];

  for (const rowIndex of [10, 11, 12]) {
    setNumberFormat(worksheet, rowIndex, 1);
  }

  const summaryRowCount = Math.max(1, movementSummary.length);
  for (let offset = 0; offset < summaryRowCount; offset += 1) {
    for (let columnIndex = 1; columnIndex <= 5; columnIndex += 1) {
      setNumberFormat(
        worksheet,
        movementDataStartRow - 1 + offset,
        columnIndex,
      );
    }
  }

  return worksheet;
}

function buildCashBookWorksheet({
  rows,
  auth,
}: {
  rows: AdminCashMovementRow[];
  auth: CashMovementWorkbookAuthContext;
}) {
  let totalCashIn = 0;
  let totalCashOut = 0;

  const detailRows = rows.map((row) => {
    const signedAmount = roundAmount(getSignedCashMovementAmount(row));
    const cashIn = signedAmount > 0 ? signedAmount : 0;
    const cashOut = signedAmount < 0 ? Math.abs(signedAmount) : 0;

    totalCashIn += cashIn;
    totalCashOut += cashOut;

    return [
      formatDateTime(row.createdAt, auth.organization.timezone),
      getCashMovementTypeLabel(row),
      sanitizeWorksheetText(`${row.outletCode} — ${row.outletName}`),
      sanitizeWorksheetText(`${row.registerCode} — ${row.registerName}`),
      sanitizeWorksheetText(row.createdByName),
      sanitizeWorksheetText(
        row.referenceLabel ?? row.referenceType ?? "Manual",
      ),
      sanitizeWorksheetText(row.shiftStatus),
      getMovementDirection(signedAmount),
      cashIn || null,
      cashOut || null,
      signedAmount,
      sanitizeWorksheetText(row.reason ?? "—"),
    ];
  });

  const tableHeader = [
    "Tanggal & Waktu",
    "Tipe Movement",
    "Outlet",
    "Register",
    "Dicatat Oleh",
    "Referensi",
    "Shift",
    "Arah",
    "Kas Masuk",
    "Kas Keluar",
    "Net Movement",
    "Catatan",
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([
    ["DETAIL BUKU KAS", "", "", "", "", "", "", "", "", "", "", ""],
    ["Total Kas Masuk", totalCashIn],
    ["Total Kas Keluar", totalCashOut],
    ["NET MOVEMENT", totalCashIn - totalCashOut],
    [""],
    tableHeader,
    ...detailRows,
  ]);

  worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
  worksheet["!cols"] = [
    { wch: 25 },
    { wch: 22 },
    { wch: 31 },
    { wch: 29 },
    { wch: 23 },
    { wch: 27 },
    { wch: 14 },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 44 },
  ];

  for (const rowIndex of [1, 2, 3]) {
    setNumberFormat(worksheet, rowIndex, 1);
  }

  for (let offset = 0; offset < detailRows.length; offset += 1) {
    const rowIndex = 6 + offset;

    for (const columnIndex of [8, 9, 10]) {
      setNumberFormat(worksheet, rowIndex, columnIndex);
    }
  }

  if (detailRows.length > 0) {
    worksheet["!autofilter"] = {
      ref: `A6:L${detailRows.length + 6}`,
    };
  }

  return worksheet;
}

export function buildCashMovementWorkbook({
  data,
  rows,
  auth,
  generatedAt = new Date(),
}: {
  data: AdminCashMovementListData;
  rows: AdminCashMovementRow[];
  auth: CashMovementWorkbookAuthContext;
  generatedAt?: Date;
}) {
  const workbook = XLSX.utils.book_new();

  workbook.Props = {
    Title: "Buku Kas ASIHJAYA",
    Subject: `${data.periodLabel} · ${getOutletLabel(data)}`,
    Author: auth.user.fullName,
    Company: auth.organization.name,
    CreatedDate: generatedAt,
  };

  XLSX.utils.book_append_sheet(
    workbook,
    buildSummaryWorksheet({ data, rows, auth, generatedAt }),
    "Ringkasan",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildCashBookWorksheet({ rows, auth }),
    "Buku Kas",
  );

  return workbook;
}

export function writeCashMovementWorkbook(workbook: XLSX.WorkBook) {
  const raw = XLSX.write(workbook, {
    bookType: "xlsx",
    compression: true,
    type: "buffer",
  }) as Buffer;

  // Buku Kas intentionally follows the same two-sheet finance layout as
  // Pemasukan Bank so the established finance styling/freeze-pane pass
  // can be reused without changing the shared XLSX writer.
  return styleBankInflowWorkbookBuffer(raw);
}

export function buildCashMovementExportFilename(
  generatedAt: Date,
  timeZone: string,
) {
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

  return `buku-kas-${timestamp}.xlsx`;
}
