import type { ExportSheet } from "@/lib/export-files";
import type {
  AdminCashMovementListData,
  AdminCashMovementRow,
  CashMovementType,
} from "./contracts";
import { getCashMovementSignedAmount } from "./queries";

const cashMovementTypeLabels: Record<CashMovementType, string> = {
  opening_balance: "Modal awal",
  cash_sale: "Penjualan cash",
  cash_refund: "Refund cash",
  cash_in: "Kas masuk manual",
  cash_out: "Kas keluar manual",
  closing_adjustment: "Koreksi closing",
};

function getCashMovementTypeLabel(row: Pick<AdminCashMovementRow, "type" | "referenceType">) {
  if (row.type === "cash_out" && row.referenceType === "customer_deposit_withdrawal") {
    return "Penarikan Dana Titip";
  }

  return cashMovementTypeLabels[row.type];
}

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

function roundAmount(value: number | string | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);

  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function outletLabel(
  outletId: string | null,
  outlets: AdminCashMovementListData["outlets"],
) {
  const outlet = outletId ? outlets.find((item) => item.id === outletId) : null;

  return outlet ? `${outlet.code} - ${outlet.name}` : "Semua outlet akses saya";
}

export function buildCashMovementSheets({
  data,
  rows,
}: {
  data: AdminCashMovementListData;
  rows: AdminCashMovementRow[];
}): ExportSheet[] {
  return [
    {
      name: "Ringkasan Kas",
      columns: ["Metrik", "Nilai", "Keterangan"],
      rows: [
        ["Periode", data.periodLabel, "Filter aktif"],
        ["Outlet", outletLabel(data.filters.outletId, data.outlets), ""],
        ["Search", data.filters.search || "-", ""],
        ["Tipe movement", data.filters.type, ""],
        ["Total movement", rows.length, "Jumlah baris export"],
        ["Modal awal", roundAmount(data.summary.openingBalance), ""],
        ["Penjualan cash", roundAmount(data.summary.cashSales), ""],
        ["Kas masuk manual", roundAmount(data.summary.manualCashIn), ""],
        ["Kas keluar manual", roundAmount(data.summary.manualCashOut), ""],
        [
          "Tarik tunai Dana Titip",
          roundAmount(data.summary.customerDepositCashWithdrawals),
          "Kas keluar dari approval penarikan Dana Titip",
        ],
        ["Refund cash", roundAmount(data.summary.cashRefunds), ""],
        ["Koreksi closing", roundAmount(data.summary.closingAdjustments), ""],
        [
          "Saldo awal Dana Titip",
          roundAmount(data.customerDepositSummary.openingBalance),
          "Saldo liability sebelum periode aktif",
        ],
        [
          "Deposit Saldo",
          roundAmount(data.customerDepositSummary.depositIn),
          "Penambahan saldo Dana Titip customer",
        ],
        [
          "Gunakan saldo",
          roundAmount(data.customerDepositSummary.depositUsed),
          "Penggunaan Dana Titip untuk transaksi",
        ],
        [
          "Penarikan Dana Titip",
          roundAmount(data.customerDepositSummary.depositWithdrawals),
          "Pengurangan saldo karena tarik tunai approved",
        ],
        [
          "Koreksi Dana Titip masuk",
          roundAmount(data.customerDepositSummary.adjustmentIn),
          "Adjustment credit",
        ],
        [
          "Koreksi Dana Titip keluar",
          roundAmount(data.customerDepositSummary.adjustmentOut),
          "Adjustment debit",
        ],
        [
          "Saldo akhir Dana Titip",
          roundAmount(data.customerDepositSummary.closingBalance),
          "Estimasi liability akhir berdasarkan ledger",
        ],
        ["Net movement", roundAmount(data.summary.netMovement), "Signed cash movement"],
        ["Shift aktif", data.summary.activeShiftCount, ""],
      ],
      widths: [{ wch: 28 }, { wch: 22 }, { wch: 44 }],
    },
    {
      name: "Buku Kas",
      columns: [
        "Tanggal",
        "Outlet Code",
        "Outlet",
        "Register Code",
        "Register",
        "Shift Status",
        "Tipe",
        "Nominal",
        "Nominal Signed",
        "Reference",
        "Dicatat Oleh",
        "Catatan",
        "Shift Dibuka",
      ],
      rows: rows.map((row) => [
        formatDateTime(row.createdAt),
        row.outletCode,
        row.outletName,
        row.registerCode,
        row.registerName,
        row.shiftStatus,
        getCashMovementTypeLabel(row),
        roundAmount(row.amount),
        roundAmount(getCashMovementSignedAmount(row)),
        row.referenceLabel ?? row.referenceType ?? "-",
        row.createdByName,
        row.reason ?? "-",
        formatDateTime(row.shiftOpenedAt),
      ]),
      widths: [
        { wch: 22 },
        { wch: 14 },
        { wch: 24 },
        { wch: 14 },
        { wch: 22 },
        { wch: 14 },
        { wch: 22 },
        { wch: 18 },
        { wch: 18 },
        { wch: 24 },
        { wch: 22 },
        { wch: 42 },
        { wch: 22 },
      ],
    },
  ];
}
