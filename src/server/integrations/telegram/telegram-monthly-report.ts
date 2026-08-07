import { normalizeBusinessTimeZone } from "@/lib/time/business-time";
import { assertIsoBusinessDate } from "@/server/integrations/telegram/telegram-outbox-contract";

export type TelegramMonthlyPeriod = {
  start: string;
  end: string;
};

export type TelegramMonthlyFinanceSnapshot = {
  schemaVersion: 1;
  reportType: "monthly";
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
};

export type BuildTelegramMonthlyFinanceSnapshotInput = Omit<
  TelegramMonthlyFinanceSnapshot,
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
    input.sales.netSales,
    previousNetSales,
  );
  if (input.comparison.netSalesChangeRate !== expectedChangeRate) {
    throw new Error("TELEGRAM_MONTHLY_COMPARISON_INVALID");
  }

  return {
    schemaVersion: 1,
    reportType: "monthly",
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

export function formatTelegramMonthlyFinanceMessage(
  snapshot: TelegramMonthlyFinanceSnapshot,
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
    "📈 MONTHLY FINANCE REPORT",
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
    `Vs bulan sebelumnya (Net sales): ${formatComparison(snapshot.comparison.netSalesChangeRate)}`,
  ].join("\n");
}
