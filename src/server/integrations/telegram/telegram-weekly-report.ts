import {
  assertIsoBusinessDate,
} from "@/server/integrations/telegram/telegram-outbox-contract";
import { normalizeBusinessTimeZone } from "@/lib/time/business-time";

export type TelegramWeeklyPeriod = {
  start: string;
  end: string;
};

export type TelegramWeeklyFinanceSnapshot = {
  schemaVersion: 1;
  reportType: "weekly";
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  period: TelegramWeeklyPeriod;
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
    previousPeriod: TelegramWeeklyPeriod;
    previousNetSales: string | null;
    netSalesChangeRate: string | null;
  };
};

export type BuildTelegramWeeklyFinanceSnapshotInput = Omit<
  TelegramWeeklyFinanceSnapshot,
  "schemaVersion" | "reportType" | "timezone"
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
    throw new Error("TELEGRAM_WEEKLY_DATE_INVALID");
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

function addCalendarDays(value: string, days: number): string {
  const date = parseBusinessDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
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
    throw new Error("TELEGRAM_WEEKLY_RATE_INVALID");
  }
  if (!Number.isFinite(Number(normalized))) {
    throw new Error("TELEGRAM_WEEKLY_RATE_INVALID");
  }
  return normalized;
}

function assertCount(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}

function assertSnapshotDays(value: number): number {
  const days = assertCount(value, "TELEGRAM_WEEKLY_SNAPSHOT_DAYS_INVALID");
  if (days < 1 || days > 7) {
    throw new Error("TELEGRAM_WEEKLY_SNAPSHOT_DAYS_INVALID");
  }
  return days;
}

function divideRoundHalfAwayFromZero(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator <= BIGINT_ZERO) {
    throw new Error("TELEGRAM_WEEKLY_COMPARISON_DENOMINATOR_INVALID");
  }

  const negative = numerator < BIGINT_ZERO;
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded =
    remainder * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient;
  return negative ? -rounded : rounded;
}

export function calculateWeeklyNetSalesChangeRate(
  currentNetSales: string,
  previousNetSales: string | null,
): string | null {
  const current = BigInt(
    normalizeNonNegativeIntegerAmount(
      currentNetSales,
      "TELEGRAM_WEEKLY_CURRENT_NET_SALES_INVALID",
    ),
  );
  if (previousNetSales === null) return null;

  const previous = BigInt(
    normalizeNonNegativeIntegerAmount(
      previousNetSales,
      "TELEGRAM_WEEKLY_PREVIOUS_NET_SALES_INVALID",
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

export function getWeeklyPeriodForBusinessDate(
  businessDate: string,
): TelegramWeeklyPeriod {
  const date = parseBusinessDate(businessDate);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const start = addCalendarDays(businessDate, -mondayOffset);
  return { start, end: addCalendarDays(start, 6) };
}

export function getPreviousWeeklyPeriod(
  period: TelegramWeeklyPeriod,
): TelegramWeeklyPeriod {
  assertIsoBusinessDate(period.start);
  assertIsoBusinessDate(period.end);
  if (period.end !== addCalendarDays(period.start, 6)) {
    throw new Error("TELEGRAM_WEEKLY_PERIOD_INVALID");
  }
  const start = addCalendarDays(period.start, -7);
  return { start, end: addCalendarDays(start, 6) };
}

export function getLatestCompletedWeeklyPeriod(
  closingBusinessDate: string,
): TelegramWeeklyPeriod {
  const containing = getWeeklyPeriodForBusinessDate(closingBusinessDate);
  if (closingBusinessDate === containing.end) return containing;
  return getPreviousWeeklyPeriod(containing);
}

export function buildTelegramWeeklyFinanceEventKey(
  outletId: string,
  periodStart: string,
): string {
  const period = getWeeklyPeriodForBusinessDate(periodStart);
  if (period.start !== periodStart) {
    throw new Error("TELEGRAM_WEEKLY_PERIOD_START_MUST_BE_MONDAY");
  }
  return `weekly-finance:${assertNonBlank(outletId, "TELEGRAM_OUTLET_ID_REQUIRED")}:${periodStart}`;
}

export function buildTelegramWeeklyFinanceSnapshot(
  input: BuildTelegramWeeklyFinanceSnapshotInput,
): TelegramWeeklyFinanceSnapshot {
  const period = getWeeklyPeriodForBusinessDate(input.period.start);
  if (period.start !== input.period.start || period.end !== input.period.end) {
    throw new Error("TELEGRAM_WEEKLY_PERIOD_INVALID");
  }
  const previousPeriod = getPreviousWeeklyPeriod(period);
  if (
    input.comparison.previousPeriod.start !== previousPeriod.start ||
    input.comparison.previousPeriod.end !== previousPeriod.end
  ) {
    throw new Error("TELEGRAM_WEEKLY_PREVIOUS_PERIOD_INVALID");
  }

  const costOfGoods = input.sales.costOfGoods === null
    ? null
    : normalizeNonNegativeIntegerAmount(
        input.sales.costOfGoods,
        "TELEGRAM_WEEKLY_COGS_INVALID",
      );
  const grossMargin = input.sales.grossMargin === null
    ? null
    : normalizeIntegerAmount(
        input.sales.grossMargin,
        "TELEGRAM_WEEKLY_GROSS_MARGIN_INVALID",
      );
  const grossMarginRate = normalizeNullableRate(input.sales.grossMarginRate);

  if (
    input.sales.costSnapshotComplete !==
    (costOfGoods !== null && grossMargin !== null && grossMarginRate !== null)
  ) {
    throw new Error("TELEGRAM_WEEKLY_COST_SNAPSHOT_STATE_INVALID");
  }

  const previousNetSales = input.comparison.previousNetSales === null
    ? null
    : normalizeNonNegativeIntegerAmount(
        input.comparison.previousNetSales,
        "TELEGRAM_WEEKLY_PREVIOUS_NET_SALES_INVALID",
      );
  const expectedChangeRate = calculateWeeklyNetSalesChangeRate(
    input.sales.netSales,
    previousNetSales,
  );
  if (input.comparison.netSalesChangeRate !== expectedChangeRate) {
    throw new Error("TELEGRAM_WEEKLY_COMPARISON_INVALID");
  }

  return {
    schemaVersion: 1,
    reportType: "weekly",
    outlet: {
      id: assertNonBlank(input.outlet.id, "TELEGRAM_OUTLET_ID_REQUIRED"),
      code: assertNonBlank(input.outlet.code, "TELEGRAM_OUTLET_CODE_REQUIRED"),
      name: assertNonBlank(input.outlet.name, "TELEGRAM_OUTLET_NAME_REQUIRED"),
    },
    period,
    timezone: normalizeBusinessTimeZone(input.timezone),
    snapshotDays: assertSnapshotDays(input.snapshotDays),
    sales: {
      grossSales: normalizeNonNegativeIntegerAmount(
        input.sales.grossSales,
        "TELEGRAM_WEEKLY_GROSS_SALES_INVALID",
      ),
      discountTotal: normalizeNonNegativeIntegerAmount(
        input.sales.discountTotal,
        "TELEGRAM_WEEKLY_DISCOUNT_INVALID",
      ),
      netSales: normalizeNonNegativeIntegerAmount(
        input.sales.netSales,
        "TELEGRAM_WEEKLY_NET_SALES_INVALID",
      ),
      costSnapshotComplete: input.sales.costSnapshotComplete,
      costOfGoods,
      grossMargin,
      grossMarginRate,
    },
    payments: {
      cashTotal: normalizeNonNegativeIntegerAmount(
        input.payments.cashTotal,
        "TELEGRAM_WEEKLY_CASH_INVALID",
      ),
      bankTransferTotal: normalizeNonNegativeIntegerAmount(
        input.payments.bankTransferTotal,
        "TELEGRAM_WEEKLY_TRANSFER_INVALID",
      ),
      debitCardTotal: normalizeNonNegativeIntegerAmount(
        input.payments.debitCardTotal,
        "TELEGRAM_WEEKLY_DEBIT_INVALID",
      ),
      creditCardTotal: normalizeNonNegativeIntegerAmount(
        input.payments.creditCardTotal,
        "TELEGRAM_WEEKLY_CREDIT_INVALID",
      ),
    },
    customerDeposit: {
      openingBalance: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.openingBalance,
        "TELEGRAM_WEEKLY_DEPOSIT_OPENING_INVALID",
      ),
      depositIn: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.depositIn,
        "TELEGRAM_WEEKLY_DEPOSIT_IN_INVALID",
      ),
      depositUsed: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.depositUsed,
        "TELEGRAM_WEEKLY_DEPOSIT_USED_INVALID",
      ),
      withdrawal: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.withdrawal,
        "TELEGRAM_WEEKLY_DEPOSIT_WITHDRAWAL_INVALID",
      ),
      adjustmentIn: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.adjustmentIn,
        "TELEGRAM_WEEKLY_DEPOSIT_ADJUSTMENT_IN_INVALID",
      ),
      adjustmentOut: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.adjustmentOut,
        "TELEGRAM_WEEKLY_DEPOSIT_ADJUSTMENT_OUT_INVALID",
      ),
      closingBalance: normalizeNonNegativeIntegerAmount(
        input.customerDeposit.closingBalance,
        "TELEGRAM_WEEKLY_DEPOSIT_CLOSING_INVALID",
      ),
    },
    cash: {
      varianceTotal: normalizeIntegerAmount(
        input.cash.varianceTotal,
        "TELEGRAM_WEEKLY_VARIANCE_INVALID",
      ),
    },
    operations: {
      transactionCount: assertCount(
        input.operations.transactionCount,
        "TELEGRAM_WEEKLY_TRANSACTION_COUNT_INVALID",
      ),
      itemsSoldCount: assertCount(
        input.operations.itemsSoldCount,
        "TELEGRAM_WEEKLY_ITEMS_SOLD_INVALID",
      ),
    },
    comparison: {
      previousPeriod,
      previousNetSales,
      netSalesChangeRate: expectedChangeRate,
    },
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

function formatPeriod(period: TelegramWeeklyPeriod): string {
  const start = parseBusinessDate(period.start);
  const end = parseBusinessDate(period.end);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = MONTHS[start.getUTCMonth()];
  const endMonth = MONTHS[end.getUTCMonth()];
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (startYear === endYear && start.getUTCMonth() === end.getUTCMonth()) {
    return `${startDay}–${endDay} ${endMonth} ${endYear}`;
  }
  if (startYear === endYear) {
    return `${startDay} ${startMonth}–${endDay} ${endMonth} ${endYear}`;
  }
  return `${startDay} ${startMonth} ${startYear}–${endDay} ${endMonth} ${endYear}`;
}

function formatRupiah(value: string): string {
  const amount = BigInt(value);
  const absolute = amount < BIGINT_ZERO ? -amount : amount;
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(absolute);
  return amount < BIGINT_ZERO ? `-Rp${formatted}` : `Rp${formatted}`;
}

function formatRate(value: string): string {
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))}%`;
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

export function formatTelegramWeeklyFinanceMessage(
  snapshot: TelegramWeeklyFinanceSnapshot,
): string {
  const marginLines = snapshot.sales.costSnapshotComplete
    ? [
        `Cost of goods: ${formatRupiah(snapshot.sales.costOfGoods!)}`,
        `Gross margin: ${formatRupiah(snapshot.sales.grossMargin!)}`,
        `Gross margin rate: ${formatRate(snapshot.sales.grossMarginRate!)}`,
      ]
    : [
        "Cost of goods: Belum tersedia",
        "Gross margin: Belum tersedia",
        "Gross margin rate: Belum tersedia",
        "Cost snapshot: Tidak lengkap",
      ];

  const depositLines = [
    `Saldo awal: ${formatRupiah(snapshot.customerDeposit.openingBalance)}`,
    `Masuk: ${formatRupiah(snapshot.customerDeposit.depositIn)}`,
    `Digunakan: ${formatRupiah(snapshot.customerDeposit.depositUsed)}`,
    `Dicairkan: ${formatRupiah(snapshot.customerDeposit.withdrawal)}`,
  ];
  if (BigInt(snapshot.customerDeposit.adjustmentIn) !== BIGINT_ZERO) {
    depositLines.push(
      `Adjustment masuk: ${formatRupiah(snapshot.customerDeposit.adjustmentIn)}`,
    );
  }
  if (BigInt(snapshot.customerDeposit.adjustmentOut) !== BIGINT_ZERO) {
    depositLines.push(
      `Adjustment keluar: ${formatRupiah(snapshot.customerDeposit.adjustmentOut)}`,
    );
  }
  depositLines.push(
    `Saldo akhir: ${formatRupiah(snapshot.customerDeposit.closingBalance)}`,
  );

  return [
    "📊 WEEKLY FINANCE REPORT",
    "",
    `Outlet: ${snapshot.outlet.name}`,
    `Periode: ${formatPeriod(snapshot.period)}`,
    `Hari operasional tersnapshot: ${snapshot.snapshotDays}`,
    "",
    "PENJUALAN",
    `Gross sales: ${formatRupiah(snapshot.sales.grossSales)}`,
    `Diskon: ${formatRupiah(snapshot.sales.discountTotal)}`,
    `Net sales: ${formatRupiah(snapshot.sales.netSales)}`,
    "",
    "MARGIN",
    ...marginLines,
    "",
    "TENDER DITERIMA",
    `Cash: ${formatRupiah(snapshot.payments.cashTotal)}`,
    `Bank Transfer: ${formatRupiah(snapshot.payments.bankTransferTotal)}`,
    `EDC Debit: ${formatRupiah(snapshot.payments.debitCardTotal)}`,
    `EDC Credit: ${formatRupiah(snapshot.payments.creditCardTotal)}`,
    "",
    "DANA TITIP",
    ...depositLines,
    "",
    "OPERASIONAL",
    `Transaksi: ${snapshot.operations.transactionCount}`,
    `Produk terjual: ${snapshot.operations.itemsSoldCount}`,
    `Total variance kas: ${formatRupiah(snapshot.cash.varianceTotal)}`,
    "",
    `Vs minggu sebelumnya (Net sales): ${formatComparison(snapshot.comparison.netSalesChangeRate)}`,
  ].join("\n");
}
