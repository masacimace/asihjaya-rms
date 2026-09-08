import {
  and,
  count,
  eq,
  gte,
  inArray,
  lt,
  sql,
} from "drizzle-orm";

import {
  buybackItems,
  buybackPayouts,
  buybacks,
  paymentRefunds,
  payments,
  saleItems,
  sales,
} from "@/db/schema";
import {
  addBusinessDays,
  getStartOfBusinessDateKey,
  normalizeBusinessTimeZone,
} from "@/lib/time/business-time";
import type { TelegramRepositoryTransaction } from "@/server/integrations/telegram/telegram-outbox-repository";

const SALE_REPORT_STATUSES = [
  "completed",
  "partially_refunded",
  "refunded",
] as const;
const PAYMENT_RECEIVED_STATUSES = [
  "paid",
  "partially_refunded",
  "refunded",
] as const;
const BANK_METHODS = ["debit_card", "bank_transfer"] as const;

type TelegramReportScope =
  | {
      kind: "shift";
      shiftId: string;
      openedAt: Date;
      closedAt: Date;
    }
  | {
      kind: "period";
      periodStart: string;
      periodEnd: string;
      timezone: string;
    };

export type TelegramReportBankSummary = {
  provider: string;
  grossReceived: string;
  refundTotal: string;
  netReceived: string;
};

export type TelegramReportSummary = {
  sales: {
    grossSales: string;
    refundTotal: string;
    netSales: string;
    transactionCount: number;
    itemsSoldCount: number;
  };
  cash: {
    grossReceived: string;
    refundTotal: string;
    netReceived: string;
  };
  banks: TelegramReportBankSummary[];
  buyback: {
    transactionCount: number;
    itemCount: number;
    totalAmount: string;
    cashTotal: string;
    bankTransferTotal: string;
    customerDepositTotal: string;
  };
};

export type LoadTelegramReportSummaryInput = {
  organizationId: string;
  outletId: string;
  scope: TelegramReportScope;
};

function integerString(value: unknown): string {
  const normalized = String(value ?? "0").trim();
  if (!/^-?\d+$/.test(normalized)) {
    throw new Error("TELEGRAM_REPORT_SUMMARY_INTEGER_INVALID");
  }
  return BigInt(normalized).toString();
}

function safeCount(value: unknown): number {
  const countValue = Number(value ?? 0);
  if (!Number.isSafeInteger(countValue) || countValue < 0) {
    throw new Error("TELEGRAM_REPORT_SUMMARY_COUNT_INVALID");
  }
  return countValue;
}

function providerLabel(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === "manual") return "Bank / EDC";
  return normalized.toUpperCase();
}

function resolvePeriodRange(scope: Extract<TelegramReportScope, { kind: "period" }>) {
  const timezone = normalizeBusinessTimeZone(scope.timezone);
  const start = getStartOfBusinessDateKey(scope.periodStart, timezone);
  const endStart = getStartOfBusinessDateKey(scope.periodEnd, timezone);
  if (!start || !endStart || endStart < start) {
    throw new Error("TELEGRAM_REPORT_SUMMARY_PERIOD_INVALID");
  }
  return { start, end: addBusinessDays(endStart, 1, timezone) };
}

function saleScopeCondition(scope: TelegramReportScope) {
  if (scope.kind === "shift") return eq(sales.shiftId, scope.shiftId);
  const range = resolvePeriodRange(scope);
  return and(gte(sales.completedAt, range.start), lt(sales.completedAt, range.end));
}

function paymentScopeCondition(scope: TelegramReportScope) {
  if (scope.kind === "shift") return eq(sales.shiftId, scope.shiftId);
  const range = resolvePeriodRange(scope);
  return and(gte(payments.paidAt, range.start), lt(payments.paidAt, range.end));
}

function refundScopeCondition(scope: TelegramReportScope) {
  const range =
    scope.kind === "shift"
      ? { start: scope.openedAt, end: scope.closedAt }
      : resolvePeriodRange(scope);
  return and(
    gte(paymentRefunds.confirmedAt, range.start),
    lt(paymentRefunds.confirmedAt, range.end),
  );
}

function buybackScopeCondition(scope: TelegramReportScope) {
  if (scope.kind === "shift") return eq(buybacks.shiftId, scope.shiftId);
  const range = resolvePeriodRange(scope);
  return and(
    gte(buybacks.completedAt, range.start),
    lt(buybacks.completedAt, range.end),
  );
}

export async function loadTelegramReportSummary(
  transaction: TelegramRepositoryTransaction,
  input: LoadTelegramReportSummaryInput,
): Promise<TelegramReportSummary> {
  const saleCondition = saleScopeCondition(input.scope);
  const paymentCondition = paymentScopeCondition(input.scope);
  const refundCondition = refundScopeCondition(input.scope);
  const buybackCondition = buybackScopeCondition(input.scope);

  const [
    saleRows,
    saleItemRows,
    cashPaymentRows,
    cashRefundRows,
    bankPaymentRows,
    bankRefundRows,
    refundTotalRows,
    buybackRows,
    buybackItemRows,
    buybackPayoutRows,
  ] = await Promise.all([
    transaction
      .select({
        grossSales: sql<string>`coalesce(sum(${sales.totalAmount}::numeric), 0)::text`,
        transactionCount: count(),
      })
      .from(sales)
      .where(
        and(
          eq(sales.organizationId, input.organizationId),
          eq(sales.outletId, input.outletId),
          inArray(sales.status, [...SALE_REPORT_STATUSES]),
          saleCondition,
        ),
      ),

    transaction
      .select({ total: count() })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(
        and(
          eq(sales.organizationId, input.organizationId),
          eq(sales.outletId, input.outletId),
          inArray(sales.status, [...SALE_REPORT_STATUSES]),
          saleCondition,
        ),
      ),

    transaction
      .select({
        amount: sql<string>`coalesce(sum(${payments.amount}::numeric), 0)::text`,
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .where(
        and(
          eq(sales.organizationId, input.organizationId),
          eq(sales.outletId, input.outletId),
          eq(payments.method, "cash"),
          inArray(payments.status, [...PAYMENT_RECEIVED_STATUSES]),
          paymentCondition,
        ),
      ),

    transaction
      .select({
        amount: sql<string>`coalesce(sum(${paymentRefunds.amount}::numeric), 0)::text`,
      })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.organizationId, input.organizationId),
          eq(paymentRefunds.outletId, input.outletId),
          eq(paymentRefunds.status, "confirmed"),
          eq(paymentRefunds.method, "cash"),
          refundCondition,
        ),
      ),

    transaction
      .select({
        method: payments.method,
        provider: payments.provider,
        amount: sql<string>`coalesce(sum(${payments.amount}::numeric), 0)::text`,
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .where(
        and(
          eq(sales.organizationId, input.organizationId),
          eq(sales.outletId, input.outletId),
          inArray(payments.method, [...BANK_METHODS]),
          inArray(payments.status, [...PAYMENT_RECEIVED_STATUSES]),
          paymentCondition,
        ),
      )
      .groupBy(payments.method, payments.provider),

    transaction
      .select({
        method: paymentRefunds.method,
        provider: paymentRefunds.provider,
        amount: sql<string>`coalesce(sum(${paymentRefunds.amount}::numeric), 0)::text`,
      })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.organizationId, input.organizationId),
          eq(paymentRefunds.outletId, input.outletId),
          eq(paymentRefunds.status, "confirmed"),
          inArray(paymentRefunds.method, [...BANK_METHODS]),
          refundCondition,
        ),
      )
      .groupBy(paymentRefunds.method, paymentRefunds.provider),

    transaction
      .select({
        amount: sql<string>`coalesce(sum(${paymentRefunds.amount}::numeric), 0)::text`,
      })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.organizationId, input.organizationId),
          eq(paymentRefunds.outletId, input.outletId),
          eq(paymentRefunds.status, "confirmed"),
          refundCondition,
        ),
      ),

    transaction
      .select({
        totalAmount: sql<string>`coalesce(sum(${buybacks.totalAmount}::numeric), 0)::text`,
        transactionCount: count(),
      })
      .from(buybacks)
      .where(
        and(
          eq(buybacks.organizationId, input.organizationId),
          eq(buybacks.outletId, input.outletId),
          eq(buybacks.status, "completed"),
          buybackCondition,
        ),
      ),

    transaction
      .select({ total: count() })
      .from(buybackItems)
      .innerJoin(buybacks, eq(buybackItems.buybackId, buybacks.id))
      .where(
        and(
          eq(buybacks.organizationId, input.organizationId),
          eq(buybacks.outletId, input.outletId),
          eq(buybacks.status, "completed"),
          buybackCondition,
        ),
      ),

    transaction
      .select({
        method: buybackPayouts.method,
        amount: sql<string>`coalesce(sum(${buybackPayouts.amount}::numeric), 0)::text`,
      })
      .from(buybackPayouts)
      .innerJoin(buybacks, eq(buybackPayouts.buybackId, buybacks.id))
      .where(
        and(
          eq(buybacks.organizationId, input.organizationId),
          eq(buybacks.outletId, input.outletId),
          eq(buybacks.status, "completed"),
          buybackCondition,
        ),
      )
      .groupBy(buybackPayouts.method),
  ]);

  const grossSales = BigInt(integerString(saleRows[0]?.grossSales ?? "0"));
  const refundTotal = BigInt(integerString(refundTotalRows[0]?.amount ?? "0"));
  const cashGross = BigInt(integerString(cashPaymentRows[0]?.amount ?? "0"));
  const cashRefund = BigInt(integerString(cashRefundRows[0]?.amount ?? "0"));

  const bankMap = new Map<
    string,
    { provider: string; grossReceived: bigint; refundTotal: bigint }
  >();
  for (const row of bankPaymentRows) {
    const provider = providerLabel(row.provider);
    const current = bankMap.get(provider) ?? {
      provider,
      grossReceived: BigInt(0),
      refundTotal: BigInt(0),
    };
    current.grossReceived += BigInt(integerString(row.amount));
    bankMap.set(provider, current);
  }
  for (const row of bankRefundRows) {
    const provider = providerLabel(row.provider);
    const current = bankMap.get(provider) ?? {
      provider,
      grossReceived: BigInt(0),
      refundTotal: BigInt(0),
    };
    current.refundTotal += BigInt(integerString(row.amount));
    bankMap.set(provider, current);
  }

  const payoutTotals = new Map<string, bigint>();
  for (const row of buybackPayoutRows) {
    payoutTotals.set(row.method, BigInt(integerString(row.amount)));
  }

  return {
    sales: {
      grossSales: grossSales.toString(),
      refundTotal: refundTotal.toString(),
      netSales: (grossSales - refundTotal).toString(),
      transactionCount: safeCount(saleRows[0]?.transactionCount),
      itemsSoldCount: safeCount(saleItemRows[0]?.total),
    },
    cash: {
      grossReceived: cashGross.toString(),
      refundTotal: cashRefund.toString(),
      netReceived: (cashGross - cashRefund).toString(),
    },
    banks: [...bankMap.values()]
      .map((row) => ({
        provider: row.provider,
        grossReceived: row.grossReceived.toString(),
        refundTotal: row.refundTotal.toString(),
        netReceived: (row.grossReceived - row.refundTotal).toString(),
      }))
      .sort((left, right) => {
        const amountOrder =
          BigInt(right.netReceived) > BigInt(left.netReceived)
            ? 1
            : BigInt(right.netReceived) < BigInt(left.netReceived)
              ? -1
              : 0;
        return amountOrder || left.provider.localeCompare(right.provider, "id-ID");
      }),
    buyback: {
      transactionCount: safeCount(buybackRows[0]?.transactionCount),
      itemCount: safeCount(buybackItemRows[0]?.total),
      totalAmount: integerString(buybackRows[0]?.totalAmount ?? "0"),
      cashTotal: (payoutTotals.get("cash") ?? BigInt(0)).toString(),
      bankTransferTotal: (payoutTotals.get("bank_transfer") ?? BigInt(0)).toString(),
      customerDepositTotal: (payoutTotals.get("customer_deposit") ?? BigInt(0)).toString(),
    },
  };
}
