import {
  getBusinessDateTimeParts,
  normalizeBusinessTimeZone,
} from "@/lib/time/business-time";
import { assertIsoBusinessDate } from "@/server/integrations/telegram/telegram-outbox-contract";
import {
  TELEGRAM_MESSAGE_FORMAT_HTML,
  escapeTelegramHtml,
  formatTelegramRate,
  formatTelegramRupiah,
  telegramBold,
} from "@/server/integrations/telegram/telegram-message-format";
import type { TelegramReportSummary } from "@/server/integrations/telegram/telegram-report-summary";

export type TelegramDailyFinanceSnapshot = {
  schemaVersion: 2;
  reportType: "closing_daily";
  messageFormat: typeof TELEGRAM_MESSAGE_FORMAT_HTML;
  shiftId: string;
  revision: number;
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  businessDate: string;
  cashier: {
    id: string;
    name: string;
  };
  openedAt: string;
  closedAt: string;
  timezone: string;
  sales: {
    grossSales: string;
    discountTotal: string;
    netSales: string;
    costSnapshotComplete: boolean;
    costOfGoods: string | null;
    grossMargin: string | null;
    grossMarginRate: string | null;
  };
  payments: {
    cashTotal: string;
    bankTransferTotal: string;
    debitCardTotal: string;
    creditCardTotal: string;
  };
  customerDeposit: {
    openingBalance: string;
    depositIn: string;
    depositUsed: string;
    withdrawal: string;
    adjustmentIn: string;
    adjustmentOut: string;
    closingBalance: string;
  };
  cash: {
    expectedCash: string;
    actualCash: string;
    variance: string;
  };
  operations: {
    transactionCount: number;
    itemsSoldCount: number;
    heldTransactionCount: number;
  };
  summary: TelegramReportSummary;
};

export type BuildTelegramDailyFinanceSnapshotInput = Omit<
  TelegramDailyFinanceSnapshot,
  "schemaVersion" | "reportType" | "messageFormat" | "openedAt" | "closedAt" | "timezone"
> & {
  openedAt: Date;
  closedAt: Date;
  timezone: string;
};

function assertNonBlank(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function normalizeIntegerAmount(value: string, code: string): string {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) throw new Error(code);
  return BigInt(normalized).toString();
}

function normalizeNullableIntegerAmount(
  value: string | null,
  code: string,
): string | null {
  return value === null ? null : normalizeIntegerAmount(value, code);
}

function normalizeRate(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(normalized)) {
    throw new Error("TELEGRAM_GROSS_MARGIN_RATE_INVALID");
  }
  return normalized;
}

function assertCount(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}

function formatBusinessDate(value: string): string {
  assertIsoBusinessDate(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("TELEGRAM_BUSINESS_DATE_INVALID");

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTimezoneLabel(date: Date, timeZone: string): string {
  if (timeZone === "Asia/Jakarta") return "WIB";
  if (timeZone === "Asia/Makassar") return "WITA";
  if (timeZone === "Asia/Jayapura") return "WIT";

  const zonePart = new Intl.DateTimeFormat("id-ID", {
    timeZone,
    timeZoneName: "short",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  return zonePart?.trim() || timeZone;
}

function formatTime(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("TELEGRAM_DAILY_TIME_INVALID");

  const parts = getBusinessDateTimeParts(date, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")} ${formatTimezoneLabel(date, timeZone)}`;
}

const BIGINT_ZERO = BigInt(0);

export function buildTelegramDailyFinanceEventKey(
  outletId: string,
  businessDate: string,
  revision = 1,
): string {
  assertIsoBusinessDate(businessDate);
  const normalizedRevision = assertCount(revision, "TELEGRAM_DAILY_REVISION_INVALID");
  if (normalizedRevision < 1) throw new Error("TELEGRAM_DAILY_REVISION_INVALID");
  const base = `daily-finance:${assertNonBlank(outletId, "TELEGRAM_OUTLET_ID_REQUIRED")}:${businessDate}`;
  return normalizedRevision === 1 ? base : `${base}:r${normalizedRevision}`;
}

export function buildTelegramDailyFinanceSnapshot(
  input: BuildTelegramDailyFinanceSnapshotInput,
): TelegramDailyFinanceSnapshot {
  assertIsoBusinessDate(input.businessDate);
  if (Number.isNaN(input.openedAt.getTime()) || Number.isNaN(input.closedAt.getTime())) {
    throw new Error("TELEGRAM_DAILY_TIME_INVALID");
  }
  if (input.closedAt < input.openedAt) {
    throw new Error("TELEGRAM_DAILY_TIME_RANGE_INVALID");
  }

  const costOfGoods = normalizeNullableIntegerAmount(
    input.sales.costOfGoods,
    "TELEGRAM_COST_OF_GOODS_INVALID",
  );
  const grossMargin = normalizeNullableIntegerAmount(
    input.sales.grossMargin,
    "TELEGRAM_GROSS_MARGIN_INVALID",
  );
  const grossMarginRate = normalizeRate(input.sales.grossMarginRate);

  if (
    input.sales.costSnapshotComplete !==
    (costOfGoods !== null && grossMargin !== null && grossMarginRate !== null)
  ) {
    throw new Error("TELEGRAM_COST_SNAPSHOT_STATE_INVALID");
  }

  const revision = assertCount(input.revision, "TELEGRAM_DAILY_REVISION_INVALID");
  if (revision < 1) throw new Error("TELEGRAM_DAILY_REVISION_INVALID");

  return {
    schemaVersion: 2,
    reportType: "closing_daily",
    messageFormat: TELEGRAM_MESSAGE_FORMAT_HTML,
    shiftId: assertNonBlank(input.shiftId, "TELEGRAM_SHIFT_ID_REQUIRED"),
    revision,
    outlet: {
      id: assertNonBlank(input.outlet.id, "TELEGRAM_OUTLET_ID_REQUIRED"),
      code: assertNonBlank(input.outlet.code, "TELEGRAM_OUTLET_CODE_REQUIRED"),
      name: assertNonBlank(input.outlet.name, "TELEGRAM_OUTLET_NAME_REQUIRED"),
    },
    businessDate: input.businessDate,
    cashier: {
      id: assertNonBlank(input.cashier.id, "TELEGRAM_CASHIER_ID_REQUIRED"),
      name: assertNonBlank(input.cashier.name, "TELEGRAM_CASHIER_NAME_REQUIRED"),
    },
    openedAt: input.openedAt.toISOString(),
    closedAt: input.closedAt.toISOString(),
    timezone: normalizeBusinessTimeZone(input.timezone),
    sales: {
      grossSales: normalizeIntegerAmount(
        input.sales.grossSales,
        "TELEGRAM_GROSS_SALES_INVALID",
      ),
      discountTotal: normalizeIntegerAmount(
        input.sales.discountTotal,
        "TELEGRAM_DISCOUNT_TOTAL_INVALID",
      ),
      netSales: normalizeIntegerAmount(
        input.sales.netSales,
        "TELEGRAM_NET_SALES_INVALID",
      ),
      costSnapshotComplete: input.sales.costSnapshotComplete,
      costOfGoods,
      grossMargin,
      grossMarginRate,
    },
    payments: {
      cashTotal: normalizeIntegerAmount(
        input.payments.cashTotal,
        "TELEGRAM_CASH_TOTAL_INVALID",
      ),
      bankTransferTotal: normalizeIntegerAmount(
        input.payments.bankTransferTotal,
        "TELEGRAM_BANK_TRANSFER_TOTAL_INVALID",
      ),
      debitCardTotal: normalizeIntegerAmount(
        input.payments.debitCardTotal,
        "TELEGRAM_DEBIT_CARD_TOTAL_INVALID",
      ),
      creditCardTotal: normalizeIntegerAmount(
        input.payments.creditCardTotal,
        "TELEGRAM_CREDIT_CARD_TOTAL_INVALID",
      ),
    },
    customerDeposit: {
      openingBalance: normalizeIntegerAmount(
        input.customerDeposit.openingBalance,
        "TELEGRAM_DEPOSIT_OPENING_INVALID",
      ),
      depositIn: normalizeIntegerAmount(
        input.customerDeposit.depositIn,
        "TELEGRAM_DEPOSIT_IN_INVALID",
      ),
      depositUsed: normalizeIntegerAmount(
        input.customerDeposit.depositUsed,
        "TELEGRAM_DEPOSIT_USED_INVALID",
      ),
      withdrawal: normalizeIntegerAmount(
        input.customerDeposit.withdrawal,
        "TELEGRAM_DEPOSIT_WITHDRAWAL_INVALID",
      ),
      adjustmentIn: normalizeIntegerAmount(
        input.customerDeposit.adjustmentIn,
        "TELEGRAM_DEPOSIT_ADJUSTMENT_IN_INVALID",
      ),
      adjustmentOut: normalizeIntegerAmount(
        input.customerDeposit.adjustmentOut,
        "TELEGRAM_DEPOSIT_ADJUSTMENT_OUT_INVALID",
      ),
      closingBalance: normalizeIntegerAmount(
        input.customerDeposit.closingBalance,
        "TELEGRAM_DEPOSIT_CLOSING_INVALID",
      ),
    },
    cash: {
      expectedCash: normalizeIntegerAmount(
        input.cash.expectedCash,
        "TELEGRAM_EXPECTED_CASH_INVALID",
      ),
      actualCash: normalizeIntegerAmount(
        input.cash.actualCash,
        "TELEGRAM_ACTUAL_CASH_INVALID",
      ),
      variance: normalizeIntegerAmount(
        input.cash.variance,
        "TELEGRAM_CASH_VARIANCE_INVALID",
      ),
    },
    operations: {
      transactionCount: assertCount(
        input.operations.transactionCount,
        "TELEGRAM_TRANSACTION_COUNT_INVALID",
      ),
      itemsSoldCount: assertCount(
        input.operations.itemsSoldCount,
        "TELEGRAM_ITEMS_SOLD_COUNT_INVALID",
      ),
      heldTransactionCount: assertCount(
        input.operations.heldTransactionCount,
        "TELEGRAM_HELD_COUNT_INVALID",
      ),
    },
    summary: input.summary,
  };
}

export function formatTelegramDailyFinanceMessage(
  snapshot: TelegramDailyFinanceSnapshot,
): string {
  const timeZone = normalizeBusinessTimeZone(snapshot.timezone);
  const summary = snapshot.summary;
  const hasVariance = BigInt(snapshot.cash.variance) !== BIGINT_ZERO;
  const revisionLabel = snapshot.revision > 1 ? ` · REVISI ${snapshot.revision}` : "";

  const bankLines = summary.banks.length
    ? summary.banks.slice(0, 6).map(
        (bank) => `${escapeTelegramHtml(bank.provider)}: ${formatTelegramRupiah(bank.netReceived)}`,
      )
    : ["Tidak ada pemasukan bank"];
  if (summary.banks.length > 6) {
    const remainder = summary.banks
      .slice(6)
      .reduce((total, bank) => total + BigInt(bank.netReceived), BigInt(0));
    bankLines.push(`Lainnya: ${formatTelegramRupiah(remainder.toString())}`);
  }
  const bankNet = summary.banks.reduce(
    (total, bank) => total + BigInt(bank.netReceived),
    BigInt(0),
  );

  const marginLines = snapshot.sales.costSnapshotComplete
    ? [
        `Laba kotor: ${telegramBold(formatTelegramRupiah(snapshot.sales.grossMargin!))}`,
        `Margin: ${formatTelegramRate(snapshot.sales.grossMarginRate!)}`,
      ]
    : ["Belum tersedia — cost snapshot belum lengkap"];

  const buybackLines =
    summary.buyback.transactionCount > 0
      ? [
          `${summary.buyback.transactionCount} transaksi · ${summary.buyback.itemCount} item · ${telegramBold(formatTelegramRupiah(summary.buyback.totalAmount))}`,
          `Cash ${formatTelegramRupiah(summary.buyback.cashTotal)} · Transfer ${formatTelegramRupiah(summary.buyback.bankTransferTotal)} · Dana Titip ${formatTelegramRupiah(summary.buyback.customerDepositTotal)}`,
        ]
      : ["Tidak ada transaksi Buyback"];

  const lines = [
    `🔴 ${telegramBold(`LAPORAN HARIAN${revisionLabel}`)}`,
    telegramBold(snapshot.outlet.name),
    formatBusinessDate(snapshot.businessDate),
    "",
    `👤 Kasir: ${escapeTelegramHtml(snapshot.cashier.name)}`,
    `🕘 ${formatTime(snapshot.openedAt, timeZone)} – ${formatTime(snapshot.closedAt, timeZone)}`,
    "",
    `💰 ${telegramBold("PENJUALAN")}`,
    `Penjualan kotor: ${formatTelegramRupiah(summary.sales.grossSales)}`,
    `Refund: ${formatTelegramRupiah(summary.sales.refundTotal)}`,
    `Penjualan bersih: ${telegramBold(formatTelegramRupiah(summary.sales.netSales))}`,
    "",
    `🧾 ${telegramBold("OPERASIONAL")}`,
    `${summary.sales.transactionCount} transaksi · ${summary.sales.itemsSoldCount} produk terjual`,
    ...(snapshot.operations.heldTransactionCount > 0
      ? [`Hold cart tersisa: ${snapshot.operations.heldTransactionCount}`]
      : []),
    "",
    `🏦 ${telegramBold("PEMASUKAN BANK")}`,
    ...bankLines,
    `Bank bersih: ${telegramBold(formatTelegramRupiah(bankNet.toString()))}`,
    "",
    `💵 ${telegramBold("KAS")}`,
    `Cash bersih: ${telegramBold(formatTelegramRupiah(summary.cash.netReceived))}`,
    `Selisih kas: ${formatTelegramRupiah(snapshot.cash.variance)}`,
    "",
    `💳 ${telegramBold("DANA TITIP")}`,
    `Masuk: ${formatTelegramRupiah(snapshot.customerDeposit.depositIn)}`,
    `Digunakan: ${formatTelegramRupiah(snapshot.customerDeposit.depositUsed)}`,
    `Saldo akhir: ${telegramBold(formatTelegramRupiah(snapshot.customerDeposit.closingBalance))}`,
    "",
    `📈 ${telegramBold("MARGIN")}`,
    ...marginLines,
    "",
    `♻️ ${telegramBold("BUYBACK")}`,
    ...buybackLines,
  ];

  if (hasVariance) {
    lines.push("", `⚠️ ${telegramBold("Selisih kas perlu diperiksa")}`);
  } else if (snapshot.revision > 1) {
    lines.push("", `✅ ${telegramBold("Laporan final setelah reopen")}`);
  }

  return lines.join("\n");
}
