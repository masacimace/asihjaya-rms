import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { financeClosingSnapshots } from "@/db/schema";
import {
  enqueueTelegramDelivery,
  findEnabledTelegramDestinationForOutlet,
  type TelegramRepositoryTransaction,
} from "@/server/integrations/telegram/telegram-outbox-repository";
import {
  buildTelegramMonthlyFinanceEventKey,
  buildTelegramMonthlyFinanceSnapshot,
  calculateMonthlyNetSalesChangeRate,
  formatTelegramMonthlyFinanceMessage,
  getLatestCompletedMonthlyPeriod,
  getPreviousMonthlyPeriod,
  type TelegramMonthlyPeriod,
} from "@/server/integrations/telegram/telegram-monthly-report";

export type FinalizeTelegramMonthlyAfterClosingInput = {
  integrationEnabled: boolean;
  maxAttempts: number;
  organizationId: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  closingBusinessDate: string;
};

export type EnqueueTelegramMonthlyPeriodInput = Omit<
  FinalizeTelegramMonthlyAfterClosingInput,
  "integrationEnabled" | "closingBusinessDate"
> & {
  period: TelegramMonthlyPeriod;
};

export type FinalizeTelegramMonthlyAfterClosingResult =
  | { status: "integration_disabled" }
  | { status: "destination_unavailable" }
  | { status: "no_data"; period: TelegramMonthlyPeriod }
  | { status: "enqueued"; deliveryId: string; period: TelegramMonthlyPeriod }
  | { status: "duplicate"; deliveryId: string; period: TelegramMonthlyPeriod };

type MonthlyAggregate = {
  snapshotDays: number;
  grossSales: string;
  discountTotal: string;
  netSales: string;
  incompleteCostDays: number;
  costOfGoods: string;
  grossMargin: string;
  grossMarginRate: string;
  cashTotal: string;
  bankTransferTotal: string;
  debitCardTotal: string;
  creditCardTotal: string;
  customerDepositIn: string;
  customerDepositUsed: string;
  customerDepositWithdrawal: string;
  customerDepositAdjustmentIn: string;
  customerDepositAdjustmentOut: string;
  cashVariance: string;
  transactionCount: number;
  itemsSoldCount: number;
};

async function aggregateMonthlyPeriod(
  transaction: TelegramRepositoryTransaction,
  input: {
    organizationId: string;
    outletId: string;
    period: TelegramMonthlyPeriod;
  },
): Promise<MonthlyAggregate> {
  const rows = await transaction
    .select({
      snapshotDays: sql<number>`count(*)::integer`.mapWith(Number),
      grossSales: sql<string>`coalesce(sum(${financeClosingSnapshots.grossSales}::numeric), 0)`,
      discountTotal: sql<string>`coalesce(sum(${financeClosingSnapshots.discountTotal}::numeric), 0)`,
      netSales: sql<string>`coalesce(sum(${financeClosingSnapshots.netSales}::numeric), 0)`,
      incompleteCostDays: sql<number>`coalesce(sum(case when ${financeClosingSnapshots.costSnapshotComplete} = false then 1 else 0 end), 0)::integer`.mapWith(Number),
      costOfGoods: sql<string>`coalesce(sum(${financeClosingSnapshots.costOfGoods}::numeric), 0)`,
      grossMargin: sql<string>`coalesce(sum(${financeClosingSnapshots.grossMargin}::numeric), 0)`,
      grossMarginRate: sql<string>`case when coalesce(sum(${financeClosingSnapshots.netSales}::numeric), 0) = 0 then '0.0000' else round((coalesce(sum(${financeClosingSnapshots.grossMargin}::numeric), 0) / sum(${financeClosingSnapshots.netSales}::numeric)) * 100, 4)::text end`,
      cashTotal: sql<string>`coalesce(sum(${financeClosingSnapshots.cashTotal}::numeric), 0)`,
      bankTransferTotal: sql<string>`coalesce(sum(${financeClosingSnapshots.bankTransferTotal}::numeric), 0)`,
      debitCardTotal: sql<string>`coalesce(sum(${financeClosingSnapshots.debitCardTotal}::numeric), 0)`,
      creditCardTotal: sql<string>`coalesce(sum(${financeClosingSnapshots.creditCardTotal}::numeric), 0)`,
      customerDepositIn: sql<string>`coalesce(sum(${financeClosingSnapshots.customerDepositIn}::numeric), 0)`,
      customerDepositUsed: sql<string>`coalesce(sum(${financeClosingSnapshots.customerDepositUsed}::numeric), 0)`,
      customerDepositWithdrawal: sql<string>`coalesce(sum(${financeClosingSnapshots.customerDepositWithdrawal}::numeric), 0)`,
      customerDepositAdjustmentIn: sql<string>`coalesce(sum(${financeClosingSnapshots.customerDepositAdjustmentIn}::numeric), 0)`,
      customerDepositAdjustmentOut: sql<string>`coalesce(sum(${financeClosingSnapshots.customerDepositAdjustmentOut}::numeric), 0)`,
      cashVariance: sql<string>`coalesce(sum(${financeClosingSnapshots.cashVariance}::numeric), 0)`,
      transactionCount: sql<number>`coalesce(sum(${financeClosingSnapshots.transactionCount}), 0)::integer`.mapWith(Number),
      itemsSoldCount: sql<number>`coalesce(sum(${financeClosingSnapshots.itemsSoldCount}), 0)::integer`.mapWith(Number),
    })
    .from(financeClosingSnapshots)
    .where(
      and(
        eq(financeClosingSnapshots.organizationId, input.organizationId),
        eq(financeClosingSnapshots.outletId, input.outletId),
        gte(financeClosingSnapshots.businessDate, input.period.start),
        lte(financeClosingSnapshots.businessDate, input.period.end),
      ),
    );

  return rows[0] ?? {
    snapshotDays: 0,
    grossSales: "0",
    discountTotal: "0",
    netSales: "0",
    incompleteCostDays: 0,
    costOfGoods: "0",
    grossMargin: "0",
    grossMarginRate: "0.0000",
    cashTotal: "0",
    bankTransferTotal: "0",
    debitCardTotal: "0",
    creditCardTotal: "0",
    customerDepositIn: "0",
    customerDepositUsed: "0",
    customerDepositWithdrawal: "0",
    customerDepositAdjustmentIn: "0",
    customerDepositAdjustmentOut: "0",
    cashVariance: "0",
    transactionCount: 0,
    itemsSoldCount: 0,
  };
}

async function getMonthlyDepositBoundary(
  transaction: TelegramRepositoryTransaction,
  input: {
    organizationId: string;
    outletId: string;
    period: TelegramMonthlyPeriod;
  },
): Promise<{ openingBalance: string; closingBalance: string } | null> {
  const where = and(
    eq(financeClosingSnapshots.organizationId, input.organizationId),
    eq(financeClosingSnapshots.outletId, input.outletId),
    gte(financeClosingSnapshots.businessDate, input.period.start),
    lte(financeClosingSnapshots.businessDate, input.period.end),
  );

  const [firstRows, lastRows] = await Promise.all([
    transaction
      .select({ balance: financeClosingSnapshots.customerDepositOpeningBalance })
      .from(financeClosingSnapshots)
      .where(where)
      .orderBy(
        asc(financeClosingSnapshots.businessDate),
        asc(financeClosingSnapshots.openedAt),
      )
      .limit(1),
    transaction
      .select({ balance: financeClosingSnapshots.customerDepositClosingBalance })
      .from(financeClosingSnapshots)
      .where(where)
      .orderBy(
        desc(financeClosingSnapshots.businessDate),
        desc(financeClosingSnapshots.closedAt),
      )
      .limit(1),
  ]);

  if (!firstRows[0] || !lastRows[0]) return null;
  return {
    openingBalance: firstRows[0].balance,
    closingBalance: lastRows[0].balance,
  };
}

export async function enqueueTelegramMonthlyPeriodInTransaction(
  transaction: TelegramRepositoryTransaction,
  input: EnqueueTelegramMonthlyPeriodInput,
): Promise<FinalizeTelegramMonthlyAfterClosingResult> {
  const destination = await findEnabledTelegramDestinationForOutlet(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    reportType: "monthly",
  });
  if (!destination) return { status: "destination_unavailable" };

  const period = input.period;
  const previousPeriod = getPreviousMonthlyPeriod(period);
  const [current, previous, depositBoundary] = await Promise.all([
    aggregateMonthlyPeriod(transaction, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      period,
    }),
    aggregateMonthlyPeriod(transaction, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      period: previousPeriod,
    }),
    getMonthlyDepositBoundary(transaction, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      period,
    }),
  ]);

  if (current.snapshotDays === 0 || !depositBoundary) {
    return { status: "no_data", period };
  }

  const costSnapshotComplete = current.incompleteCostDays === 0;
  const previousNetSales = previous.snapshotDays === 0 ? null : previous.netSales;
  const comparisonRate = calculateMonthlyNetSalesChangeRate(
    current.netSales,
    previousNetSales,
  );
  const snapshot = buildTelegramMonthlyFinanceSnapshot({
    outlet: {
      id: input.outletId,
      code: input.outletCode,
      name: input.outletName,
    },
    period,
    timezone: destination.timezone,
    snapshotDays: current.snapshotDays,
    sales: {
      grossSales: current.grossSales,
      discountTotal: current.discountTotal,
      netSales: current.netSales,
      costSnapshotComplete,
      costOfGoods: costSnapshotComplete ? current.costOfGoods : null,
      grossMargin: costSnapshotComplete ? current.grossMargin : null,
      grossMarginRate: costSnapshotComplete ? current.grossMarginRate : null,
    },
    payments: {
      cashTotal: current.cashTotal,
      bankTransferTotal: current.bankTransferTotal,
      debitCardTotal: current.debitCardTotal,
      creditCardTotal: current.creditCardTotal,
    },
    customerDeposit: {
      openingBalance: depositBoundary.openingBalance,
      depositIn: current.customerDepositIn,
      depositUsed: current.customerDepositUsed,
      withdrawal: current.customerDepositWithdrawal,
      adjustmentIn: current.customerDepositAdjustmentIn,
      adjustmentOut: current.customerDepositAdjustmentOut,
      closingBalance: depositBoundary.closingBalance,
    },
    cash: {
      varianceTotal: current.cashVariance,
    },
    operations: {
      transactionCount: current.transactionCount,
      itemsSoldCount: current.itemsSoldCount,
    },
    comparison: {
      previousPeriod,
      previousNetSales,
      netSalesChangeRate: comparisonRate,
    },
  });

  const delivery = await enqueueTelegramDelivery(transaction, {
    organizationId: input.organizationId,
    eventKey: buildTelegramMonthlyFinanceEventKey(input.outletId, period.start),
    destinationId: destination.destinationId,
    outletId: input.outletId,
    reportType: "monthly",
    periodStart: period.start,
    periodEnd: period.end,
    payloadSnapshot: snapshot,
    messageText: formatTelegramMonthlyFinanceMessage(snapshot),
    maxAttempts: input.maxAttempts,
  });

  return delivery.created
    ? { status: "enqueued", deliveryId: delivery.delivery.id, period }
    : { status: "duplicate", deliveryId: delivery.delivery.id, period };
}

export async function finalizeTelegramMonthlyAfterClosingInTransaction(
  transaction: TelegramRepositoryTransaction,
  input: FinalizeTelegramMonthlyAfterClosingInput,
): Promise<FinalizeTelegramMonthlyAfterClosingResult> {
  if (!input.integrationEnabled) {
    return { status: "integration_disabled" };
  }

  return enqueueTelegramMonthlyPeriodInTransaction(transaction, {
    maxAttempts: input.maxAttempts,
    organizationId: input.organizationId,
    outletId: input.outletId,
    outletCode: input.outletCode,
    outletName: input.outletName,
    period: getLatestCompletedMonthlyPeriod(input.closingBusinessDate),
  });
}
