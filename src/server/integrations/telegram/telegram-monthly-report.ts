import { normalizeBusinessTimeZone } from "@/lib/time/business-time";
import {
  TELEGRAM_MESSAGE_FORMAT_HTML,
  escapeTelegramHtml,
  formatTelegramRate,
  formatTelegramRupiah,
  telegramBold,
} from "@/server/integrations/telegram/telegram-message-format";
import type { TelegramReportSummary } from "@/server/integrations/telegram/telegram-report-summary";
import { assertIsoBusinessDate } from "@/server/integrations/telegram/telegram-outbox-contract";

export type TelegramMonthlyPeriod = {
  start: string;
  end: string;
};

export type TelegramMonthlyFinanceSnapshot = {
  schemaVersion: 1;
  reportType: "monthly";
  messageFormat: typeof TELEGRAM_MESSAGE_FORMAT_HTML;
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  period: TelegramMonthlyPeriod;
  timezone: string;
  snapshotDays: number;
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
    varianceTotal: string;
  };
  operations: {
    transactionCount: number;
    itemsSoldCount: number;
  };
  comparison: {
    previousPeriod: TelegramMonthlyPeriod;
    previousNetSales: string | null;
    netSalesChangeRate: string | null;
  };
  summary: TelegramReportSummary;
};

export type BuildTelegramMonthlyFinanceSnapshotInput = Omit<
  TelegramMonthlyFinanceSnapshot,
  "schemaVersion" | "reportType" | "messageFormat" | "timezone"
> & {
  timezone: string;
};

const BIGINT_ZERO = BigInt(0);
const BIGINT_TEN = BigInt(10);
const BIGINT_ONE_THOUSAND = BigInt(1000);

function assertNonBlank(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function parseBusinessDate(value: string): Date {
  assertIsoBusinessDate(value);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error("TELEGRAM_MONTHLY_DATE_INVALID");
  }
  return date;
}

function dateKey(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeIntegerAmount(value: string, code: string): string {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) throw new Error(code);
  return BigInt(normalized).toString();
}

function normalizeNonNegativeIntegerAmount(value: string, code: string): string {
  const normalized = normalizeIntegerAmount(value, code);
  if (BigInt(normalized) < BIGINT_ZERO) throw new Error(code);
  return normalized;
}

function normalizeNullableRate(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(normalized)) {
    throw new Error("TELEGRAM_MONTHLY_RATE_INVALID");
  }
  if (!Number.isFinite(Number(normalized))) {
    throw new Error("TELEGRAM_MONTHLY_RATE_INVALID");
  }
  return normalized;
}

function assertCount(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}

function assertSnapshotDays(value: number, period: TelegramMonthlyPeriod): number {
  const days = assertCount(value, "TELEGRAM_MONTHLY_SNAPSHOT_DAYS_INVALID");
  const maxDays = parseBusinessDate(period.end).getUTCDate();
  if (days < 1 || days > maxDays) {
    throw new Error("TELEGRAM_MONTHLY_SNAPSHOT_DAYS_INVALID");
  }
  return days;
}

function divideRoundHalfAwayFromZero(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator <= BIGINT_ZERO) {
    throw new Error("TELEGRAM_MONTHLY_COMPARISON_DENOMINATOR_INVALID");
  }

  const negative = numerator < BIGINT_ZERO;
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded =
    remainder * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient;
  return negative ? -rounded : rounded;
}

export function calculateMonthlyNetSalesChangeRate(
  currentNetSales: string,
  previousNetSales: string | null,
): string | null {
  const current = BigInt(
    normalizeNonNegativeIntegerAmount(
      currentNetSales,
      "TELEGRAM_MONTHLY_CURRENT_NET_SALES_INVALID",
    ),
  );
  if (previousNetSales === null) return null;

  const previous = BigInt(
    normalizeNonNegativeIntegerAmount(
      previousNetSales,
      "TELEGRAM_MONTHLY_PREVIOUS_NET_SALES_INVALID",
    ),
  );
  if (previous === BIGINT_ZERO) return null;

  // One decimal percent: ((current - previous) / previous) * 100 * 10.
  const tenthsPercent = divideRoundHalfAwayFromZero(
    (current - previous) * BIGINT_ONE_THOUSAND,
    previous,
  );
  const negative = tenthsPercent < BIGINT_ZERO;
  const absolute = negative ? -tenthsPercent : tenthsPercent;
  const whole = absolute / BIGINT_TEN;
  const fraction = absolute % BIGINT_TEN;
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function getMonthlyPeriodForBusinessDate(
  businessDate: string,
): TelegramMonthlyPeriod {
  const date = parseBusinessDate(businessDate);
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const start = dateKey(new Date(Date.UTC(year, monthIndex, 1)));
  const end = dateKey(new Date(Date.UTC(year, monthIndex + 1, 0)));
  return { start, end };
}

export function getPreviousMonthlyPeriod(
  period: TelegramMonthlyPeriod,
): TelegramMonthlyPeriod {
  const normalized = getMonthlyPeriodForBusinessDate(period.start);
  if (normalized.start !== period.start || normalized.end !== period.end) {
    throw new Error("TELEGRAM_MONTHLY_PERIOD_INVALID");
  }

  const startDate = parseBusinessDate(period.start);
  const previousMonthLastDay = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 0),
  );
  return getMonthlyPeriodForBusinessDate(dateKey(previousMonthLastDay));
}

export function getLatestCompletedMonthlyPeriod(
  closingBusinessDate: string,
): TelegramMonthlyPeriod {
  const containing = getMonthlyPeriodForBusinessDate(closingBusinessDate);
  if (closingBusinessDate === containing.end) return containing;
  return getPreviousMonthlyPeriod(containing);
}

export function buildTelegramMonthlyFinanceEventKey(
  outletId: string,
  periodStart: string,
): string {
  const period = getMonthlyPeriodForBusinessDate(periodStart);
  if (period.start !== periodStart) {
    throw new Error("TELEGRAM_MONTHLY_PERIOD_START_MUST_BE_FIRST_DAY");
  }
  const yearMonth = periodStart.slice(0, 7);
  return `monthly-finance:${assertNonBlank(outletId, "TELEGRAM_OUTLET_ID_REQUIRED")}:${yearMonth}`;
}

export function buildTelegramMonthlyFinanceSnapshot(
  input: BuildTelegramMonthlyFinanceSnapshotInput,
): TelegramMonthlyFinanceSnapshot {
  const period = getMonthlyPeriodForBusinessDate(input.period.start);
  if (period.start !== input.period.start || period.end !== input.period.end) {
    throw new Error("TELEGRAM_MONTHLY_PERIOD_INVALID");
  }
  const previousPeriod = getPreviousMonthlyPeriod(period);
  if (
    input.comparison.previousPeriod.start !== previousPeriod.start ||
    input.comparison.previousPeriod.end !== previousPeriod.end
  ) {
    throw new Error("TELEGRAM_MONTHLY_PREVIOUS_PERIOD_INVALID");
  }

  const costOfGoods = input.sales.costOfGoods === null
    ? null
    : normalizeNonNegativeIntegerAmount(
        input.sales.costOfGoods,
        "TELEGRAM_MONTHLY_COGS_INVALID",
      );
  const grossMargin = input.sales.grossMargin === null
    ? null
    : normalizeIntegerAmount(
        input.sales.grossMargin,
        "TELEGRAM_MONTHLY_GROSS_MARGIN_INVALID",
      );
  const grossMarginRate = normalizeNullableRate(input.sales.grossMarginRate);

  if (
    input.sales.costSnapshotComplete !==
    (costOfGoods !== null && grossMargin !== null && grossMarginRate !== null)
  ) {
    throw new Error("TELEGRAM_MONTHLY_COST_SNAPSHOT_STATE_INVALID");
  }

  const previousNetSales = input.comparison.previousNetSales === null
    ? null
    : normalizeNonNegativeIntegerAmount(
        input.comparison.previousNetSales,
        "TELEGRAM_MONTHLY_PREVIOUS_NET_SALES_INVALID",
      );
  const expectedChangeRate = calculateMonthlyNetSalesChangeRate(
    input.summary.sales.netSales,
    previousNetSales,
  );
  if (input.comparison.netSalesChangeRate !== expectedChangeRate) {
    throw new Error("TELEGRAM_MONTHLY_COMPARISON_INVALID");
  }

  return {
    schemaVersion: 1,
    reportType: "monthly",
    messageFormat: TELEGRAM_MESSAGE_FORMAT_HTML,
    outlet: {
      id: assertNonBlank(input.outlet.id, "TELEGRAM_OUTLET_ID_REQUIRED"),
      code: assertNonBlank(input.outlet.code, "TELEGRAM_OUTLET_CODE_REQUIRED"),
      name: assertNonBlank(input.outlet.name, "TELEGRAM_OUTLET_NAME_REQUIRED"),
    },
    period,
    timezone: normalizeBusinessTimeZone(input.timezone),
    snapshotDays: assertSnapshotDays(input.snapshotDays, period),
    sales: {
      grossSales: normalizeNonNegativeIntegerAmount(
        input.sales.grossSales,
        "TELEGRAM_MONTHLY_GROSS_SALES_INVALID",
      ),
      discountTotal: normalizeNonNegativeIntegerAmount(
        input.sales.discountTotal,
        "TELEGRAM_MONTHLY_DISCOUNT_INVALID",
      ),
      netSales: normalizeNonNegativeIntegerAmount(
        input.sales.netSales,
        "TELEGRAM_MONTHLY_NET_SALES_INVALID",
      ),
      costSnapshotComplete: input.sales.costSnapshotComplete,
      costOfGoods,
      grossMargin,
      grossMarginRate,
    },
    payments: {
      cashTotal: normalizeNonNegativeIntegerAmount(
        input.payments.cashTotal,
        "TELEGRAM_MONTHLY_CASH_INVALID",
      ),
      bankTransferTotal: normalizeNonNegativeIntegerAmount(
        input.payments.bankTransferTotal,
        "TELEGRAM_MONTHLY_TRANSFER_INVALID",
      ),
      debitCardTotal: normalizeNonNegativeIntegerAmount(
        input.payments.debitCardTotal,
        "TELEGRAM_MONTHLY_DEBIT_INVALID",
      ),
      creditCardTotal: normalizeNonNegativeIntegerAmount(
        input.payments.creditCardTotal,
        "TELEGRAM_MONTHLY_CREDIT_INVALID",
      ),
    },
    customerDeposit: {
      openingBalance: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.openingBalance,
        "TELEGRAM_MONTHLY_DEPOSIT_OPENING_INVALID",
      ),
      depositIn: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.depositIn,
        "TELEGRAM_MONTHLY_DEPOSIT_IN_INVALID",
      ),
      depositUsed: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.depositUsed,
        "TELEGRAM_MONTHLY_DEPOSIT_USED_INVALID",
      ),
      withdrawal: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.withdrawal,
        "TELEGRAM_MONTHLY_DEPOSIT_WITHDRAWAL_INVALID",
      ),
      adjustmentIn: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.adjustmentIn,
        "TELEGRAM_MONTHLY_DEPOSIT_ADJUSTMENT_IN_INVALID",
      ),
      adjustmentOut: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.adjustmentOut,
        "TELEGRAM_MONTHLY_DEPOSIT_ADJUSTMENT_OUT_INVALID",
      ),
      closingBalance: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.closingBalance,
        "TELEGRAM_MONTHLY_DEPOSIT_CLOSING_INVALID",
      ),
    },
    cash: {
      varianceTotal: normalizeIntegerAmount(
        input.cash.varianceTotal,
        "TELEGRAM_MONTHLY_VARIANCE_INVALID",
      ),
    },
    operations: {
      transactionCount: assertCount(
        input.operations.transactionCount,
        "TELEGRAM_MONTHLY_TRANSACTION_COUNT_INVALID",
      ),
      itemsSoldCount: assertCount(
        input.operations.itemsSoldCount,
        "TELEGRAM_MONTHLY_ITEMS_SOLD_INVALID",
      ),
    },
    comparison: {
      previousPeriod,
      previousNetSales,
      netSalesChangeRate: expectedChangeRate,
    },
    summary: input.summary,
  };
}

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function formatPeriod(period: TelegramMonthlyPeriod): string {
  const start = parseBusinessDate(period.start);
  return `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
}

function formatComparison(value: string | null): string {
  if (value === null) return "Belum tersedia";
  const numeric = Number(value);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(numeric)}%`;
}

export function formatTelegramMonthlyFinanceMessage(
  snapshot: TelegramMonthlyFinanceSnapshot,
): string {
  const summary = snapshot.summary;
  const bankLines = summary.banks.length
    ? summary.banks.slice(0, 6).map(
        (bank) => `${escapeTelegramHtml(bank.provider)}: ${formatTelegramRupiah(bank.netReceived)}`,
      )
    : ["Tidak ada pemasukan bank"];
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
  const buybackLines = summary.buyback.transactionCount > 0
    ? [
        `${summary.buyback.transactionCount} transaksi · ${summary.buyback.itemCount} item · ${telegramBold(formatTelegramRupiah(summary.buyback.totalAmount))}`,
      ]
    : ["Tidak ada transaksi Buyback"];

  return [
    `📈 ${telegramBold("LAPORAN BULANAN")}`,
    telegramBold(snapshot.outlet.name),
    formatPeriod(snapshot.period),
    "",
    `💰 ${telegramBold("PENJUALAN")}`,
    `Penjualan kotor: ${formatTelegramRupiah(summary.sales.grossSales)}`,
    `Refund: ${formatTelegramRupiah(summary.sales.refundTotal)}`,
    `Penjualan bersih: ${telegramBold(formatTelegramRupiah(summary.sales.netSales))}`,
    `Vs bulan lalu: ${telegramBold(formatComparison(snapshot.comparison.netSalesChangeRate))}`,
    "",
    `🧾 ${telegramBold("OPERASIONAL")}`,
    `${summary.sales.transactionCount} transaksi · ${summary.sales.itemsSoldCount} produk terjual`,
    `${snapshot.snapshotDays} hari operasional tersnapshot`,
    "",
    `🏦 ${telegramBold("PEMASUKAN BANK")}`,
    ...bankLines,
    `Bank bersih: ${telegramBold(formatTelegramRupiah(bankNet.toString()))}`,
    "",
    `💵 ${telegramBold("KAS & DANA TITIP")}`,
    `Cash bersih: ${formatTelegramRupiah(summary.cash.netReceived)}`,
    `Selisih kas: ${formatTelegramRupiah(snapshot.cash.varianceTotal)}`,
    `Dana Titip masuk: ${formatTelegramRupiah(snapshot.customerDeposit.depositIn)}`,
    `Dana Titip digunakan: ${formatTelegramRupiah(snapshot.customerDeposit.depositUsed)}`,
    `Saldo Dana Titip: ${formatTelegramRupiah(snapshot.customerDeposit.closingBalance)}`,
    "",
    `📈 ${telegramBold("MARGIN")}`,
    ...marginLines,
    "",
    `♻️ ${telegramBold("BUYBACK")}`,
    ...buybackLines,
  ].join("\n");
}
