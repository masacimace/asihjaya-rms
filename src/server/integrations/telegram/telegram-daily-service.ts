import { and, count, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";

import {
  customerDepositLedger,
  financeClosingSnapshots,
  payments,
  posHeldCarts,
  saleItems,
  sales,
} from "@/db/schema";
import {
  enqueueTelegramDelivery,
  findEnabledTelegramDestinationForOutlet,
  type TelegramRepositoryTransaction,
} from "@/server/integrations/telegram/telegram-outbox-repository";
import {
  buildTelegramDailyFinanceEventKey,
  buildTelegramDailyFinanceSnapshot,
  formatTelegramDailyFinanceMessage,
  type TelegramDailyFinanceSnapshot,
} from "@/server/integrations/telegram/telegram-daily-report";

export type FinalizeTelegramDailyFinanceInput = {
  integrationEnabled: boolean;
  maxAttempts: number;
  organizationId: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  shiftId: string;
  businessDate: string;
  cashierId: string;
  cashierName: string;
  openedAt: Date;
  closedAt: Date;
  expectedCash: number;
  actualCash: number;
  cashVariance: number;
};

export type FinalizeTelegramDailyFinanceResult = {
  financeSnapshotId: string;
  financeSnapshotCreated: boolean;
  delivery:
    | { status: "integration_disabled" }
    | { status: "destination_unavailable" }
    | { status: "enqueued"; deliveryId: string }
    | { status: "duplicate"; deliveryId: string };
};

function integerString(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new Error("TELEGRAM_FINANCE_INTEGER_INVALID");
  }
  return String(value);
}

function rateString(grossMargin: number, netSales: number): string {
  if (netSales === 0) return "0.0000";
  return ((grossMargin / netSales) * 100).toFixed(4);
}

async function calculateFinanceMetrics(
  transaction: TelegramRepositoryTransaction,
  input: FinalizeTelegramDailyFinanceInput,
) {
  const [salesRows, itemRows, paymentRows, openingDepositRows, depositRows, heldRows] =
    await Promise.all([
      transaction
        .select({
          grossSales: sql<number>`coalesce(sum(${sales.subtotalAmount}::numeric), 0)`.mapWith(Number),
          discountTotal: sql<number>`coalesce(sum(${sales.discountAmount}::numeric), 0)`.mapWith(Number),
          transactionCount: count(),
        })
        .from(sales)
        .where(and(eq(sales.shiftId, input.shiftId), eq(sales.status, "completed"))),

      transaction
        .select({
          netSales: sql<number>`coalesce(sum(${saleItems.finalPriceAmount}::numeric), 0)`.mapWith(Number),
          costOfGoods: sql<number>`coalesce(sum(${saleItems.costAmountSnapshot}::numeric), 0)`.mapWith(Number),
          itemCount: count(),
          missingCostCount: sql<number>`coalesce(sum(case when ${saleItems.costAmountSnapshot} is null then 1 else 0 end), 0)::integer`.mapWith(Number),
        })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .where(and(eq(sales.shiftId, input.shiftId), eq(sales.status, "completed"))),

      transaction
        .select({
          cashTotal: sql<number>`coalesce(sum(case when ${payments.method} = 'cash' and ${payments.status} = 'paid' then ${payments.amount}::numeric else 0 end), 0)`.mapWith(Number),
          bankTransferTotal: sql<number>`coalesce(sum(case when ${payments.method} = 'bank_transfer' and ${payments.status} = 'paid' then ${payments.amount}::numeric else 0 end), 0)`.mapWith(Number),
          debitCardTotal: sql<number>`coalesce(sum(case when ${payments.method} = 'debit_card' and ${payments.status} = 'paid' then ${payments.amount}::numeric else 0 end), 0)`.mapWith(Number),
          creditCardTotal: sql<number>`coalesce(sum(case when ${payments.method} = 'credit_card' and ${payments.status} = 'paid' then ${payments.amount}::numeric else 0 end), 0)`.mapWith(Number),
        })
        .from(payments)
        .innerJoin(sales, eq(payments.saleId, sales.id))
        .where(and(eq(sales.shiftId, input.shiftId), eq(sales.status, "completed"))),

      transaction
        .select({
          openingBalance: sql<number>`coalesce(sum(case when ${customerDepositLedger.direction} = 'credit' then ${customerDepositLedger.amount}::numeric else -${customerDepositLedger.amount}::numeric end), 0)`.mapWith(Number),
        })
        .from(customerDepositLedger)
        .where(
          and(
            eq(customerDepositLedger.organizationId, input.organizationId),
            eq(customerDepositLedger.outletId, input.outletId),
            lt(customerDepositLedger.occurredAt, input.openedAt),
          ),
        ),

      transaction
        .select({
          depositIn: sql<number>`coalesce(sum(case when ${customerDepositLedger.entryType} = 'deposit_in' and ${customerDepositLedger.direction} = 'credit' then ${customerDepositLedger.amount}::numeric else 0 end), 0)`.mapWith(Number),
          depositUsed: sql<number>`coalesce(sum(case when ${customerDepositLedger.entryType} = 'deposit_used' and ${customerDepositLedger.direction} = 'debit' then ${customerDepositLedger.amount}::numeric else 0 end), 0)`.mapWith(Number),
          withdrawal: sql<number>`coalesce(sum(case when ${customerDepositLedger.entryType} = 'deposit_withdrawal' and ${customerDepositLedger.direction} = 'debit' then ${customerDepositLedger.amount}::numeric else 0 end), 0)`.mapWith(Number),
          adjustmentIn: sql<number>`coalesce(sum(case when ${customerDepositLedger.entryType} = 'adjustment' and ${customerDepositLedger.direction} = 'credit' then ${customerDepositLedger.amount}::numeric else 0 end), 0)`.mapWith(Number),
          adjustmentOut: sql<number>`coalesce(sum(case when ${customerDepositLedger.entryType} = 'adjustment' and ${customerDepositLedger.direction} = 'debit' then ${customerDepositLedger.amount}::numeric else 0 end), 0)`.mapWith(Number),
        })
        .from(customerDepositLedger)
        .where(
          and(
            eq(customerDepositLedger.organizationId, input.organizationId),
            eq(customerDepositLedger.outletId, input.outletId),
            gte(customerDepositLedger.occurredAt, input.openedAt),
            lte(customerDepositLedger.occurredAt, input.closedAt),
          ),
        ),

      transaction
        .select({ total: count() })
        .from(posHeldCarts)
        .where(and(eq(posHeldCarts.shiftId, input.shiftId), eq(posHeldCarts.status, "active"))),

    ]);

  const salesSummary = salesRows[0] ?? {
    grossSales: 0,
    discountTotal: 0,
    transactionCount: 0,
  };
  const itemSummary = itemRows[0] ?? {
    netSales: 0,
    costOfGoods: 0,
    itemCount: 0,
    missingCostCount: 0,
  };
  const paymentSummary = paymentRows[0] ?? {
    cashTotal: 0,
    bankTransferTotal: 0,
    debitCardTotal: 0,
    creditCardTotal: 0,
  };
  const openingDeposit = openingDepositRows[0]?.openingBalance ?? 0;
  const depositSummary = depositRows[0] ?? {
    depositIn: 0,
    depositUsed: 0,
    withdrawal: 0,
    adjustmentIn: 0,
    adjustmentOut: 0,
  };

  const costSnapshotComplete = itemSummary.missingCostCount === 0;
  const grossMargin = costSnapshotComplete
    ? itemSummary.netSales - itemSummary.costOfGoods
    : null;
  const closingDepositBalance =
    openingDeposit +
    depositSummary.depositIn +
    depositSummary.adjustmentIn -
    depositSummary.depositUsed -
    depositSummary.withdrawal -
    depositSummary.adjustmentOut;

  if (closingDepositBalance < 0) {
    throw new Error("TELEGRAM_DEPOSIT_CLOSING_BALANCE_INVALID");
  }

  return {
    grossSales: salesSummary.grossSales,
    discountTotal: salesSummary.discountTotal,
    netSales: itemSummary.netSales,
    costSnapshotComplete,
    costOfGoods: costSnapshotComplete ? itemSummary.costOfGoods : null,
    grossMargin,
    grossMarginRate:
      grossMargin === null ? null : rateString(grossMargin, itemSummary.netSales),
    cashTotal: paymentSummary.cashTotal,
    bankTransferTotal: paymentSummary.bankTransferTotal,
    debitCardTotal: paymentSummary.debitCardTotal,
    creditCardTotal: paymentSummary.creditCardTotal,
    customerDepositOpeningBalance: openingDeposit,
    customerDepositIn: depositSummary.depositIn,
    customerDepositUsed: depositSummary.depositUsed,
    customerDepositWithdrawal: depositSummary.withdrawal,
    customerDepositAdjustmentIn: depositSummary.adjustmentIn,
    customerDepositAdjustmentOut: depositSummary.adjustmentOut,
    customerDepositClosingBalance: closingDepositBalance,
    transactionCount: salesSummary.transactionCount,
    itemsSoldCount: itemSummary.itemCount,
    heldTransactionCount: heldRows[0]?.total ?? 0,
    pendingApprovalCount: 0,
  };
}

async function persistFinanceSnapshot(
  transaction: TelegramRepositoryTransaction,
  input: FinalizeTelegramDailyFinanceInput,
) {
  const currentSnapshot = await transaction.query.financeClosingSnapshots.findFirst({
    where: and(
      eq(financeClosingSnapshots.shiftId, input.shiftId),
      isNull(financeClosingSnapshots.supersededAt),
    ),
  });

  if (currentSnapshot) {
    return { created: false as const, snapshot: currentSnapshot };
  }

  const metrics = await calculateFinanceMetrics(transaction, input);
  const [latestRevision] = await transaction
    .select({ revision: financeClosingSnapshots.revision })
    .from(financeClosingSnapshots)
    .where(eq(financeClosingSnapshots.shiftId, input.shiftId))
    .orderBy(desc(financeClosingSnapshots.revision))
    .limit(1);
  const revision = (latestRevision?.revision ?? 0) + 1;

  const inserted = await transaction
    .insert(financeClosingSnapshots)
    .values({
      shiftId: input.shiftId,
      organizationId: input.organizationId,
      outletId: input.outletId,
      businessDate: input.businessDate,
      revision,
      grossSales: integerString(metrics.grossSales),
      discountTotal: integerString(metrics.discountTotal),
      netSales: integerString(metrics.netSales),
      costSnapshotComplete: metrics.costSnapshotComplete,
      costOfGoods:
        metrics.costOfGoods === null ? null : integerString(metrics.costOfGoods),
      grossMargin:
        metrics.grossMargin === null ? null : integerString(metrics.grossMargin),
      grossMarginRate: metrics.grossMarginRate,
      cashTotal: integerString(metrics.cashTotal),
      bankTransferTotal: integerString(metrics.bankTransferTotal),
      debitCardTotal: integerString(metrics.debitCardTotal),
      creditCardTotal: integerString(metrics.creditCardTotal),
      customerDepositOpeningBalance: integerString(
        metrics.customerDepositOpeningBalance,
      ),
      customerDepositIn: integerString(metrics.customerDepositIn),
      customerDepositUsed: integerString(metrics.customerDepositUsed),
      customerDepositWithdrawal: integerString(metrics.customerDepositWithdrawal),
      customerDepositAdjustmentIn: integerString(
        metrics.customerDepositAdjustmentIn,
      ),
      customerDepositAdjustmentOut: integerString(
        metrics.customerDepositAdjustmentOut,
      ),
      customerDepositClosingBalance: integerString(
        metrics.customerDepositClosingBalance,
      ),
      expectedCash: integerString(input.expectedCash),
      actualCash: integerString(input.actualCash),
      cashVariance: integerString(input.cashVariance),
      transactionCount: metrics.transactionCount,
      itemsSoldCount: metrics.itemsSoldCount,
      heldTransactionCount: metrics.heldTransactionCount,
      pendingApprovalCount: metrics.pendingApprovalCount,
      openedAt: input.openedAt,
      closedAt: input.closedAt,
      cashierId: input.cashierId,
      createdAt: input.closedAt,
    })
    .onConflictDoNothing({
      target: [financeClosingSnapshots.shiftId, financeClosingSnapshots.revision],
    })
    .returning();

  if (inserted[0]) {
    return { created: true as const, snapshot: inserted[0] };
  }

  const existing = await transaction.query.financeClosingSnapshots.findFirst({
    where: and(
      eq(financeClosingSnapshots.shiftId, input.shiftId),
      eq(financeClosingSnapshots.revision, revision),
    ),
  });

  if (!existing) throw new Error("FINANCE_CLOSING_SNAPSHOT_LOOKUP_FAILED");
  return { created: false as const, snapshot: existing };
}

function buildPayloadFromPersistedSnapshot(
  snapshot: Awaited<ReturnType<typeof persistFinanceSnapshot>>["snapshot"],
  input: FinalizeTelegramDailyFinanceInput,
  timezone: string,
): TelegramDailyFinanceSnapshot {
  return buildTelegramDailyFinanceSnapshot({
    shiftId: snapshot.shiftId,
    revision: snapshot.revision,
    outlet: {
      id: input.outletId,
      code: input.outletCode,
      name: input.outletName,
    },
    businessDate: snapshot.businessDate,
    cashier: {
      id: snapshot.cashierId,
      name: input.cashierName,
    },
    openedAt: snapshot.openedAt,
    closedAt: snapshot.closedAt,
    timezone,
    sales: {
      grossSales: snapshot.grossSales,
      discountTotal: snapshot.discountTotal,
      netSales: snapshot.netSales,
      costSnapshotComplete: snapshot.costSnapshotComplete,
      costOfGoods: snapshot.costOfGoods,
      grossMargin: snapshot.grossMargin,
      grossMarginRate: snapshot.grossMarginRate,
    },
    payments: {
      cashTotal: snapshot.cashTotal,
      bankTransferTotal: snapshot.bankTransferTotal,
      debitCardTotal: snapshot.debitCardTotal,
      creditCardTotal: snapshot.creditCardTotal,
    },
    customerDeposit: {
      openingBalance: snapshot.customerDepositOpeningBalance,
      depositIn: snapshot.customerDepositIn,
      depositUsed: snapshot.customerDepositUsed,
      withdrawal: snapshot.customerDepositWithdrawal,
      adjustmentIn: snapshot.customerDepositAdjustmentIn,
      adjustmentOut: snapshot.customerDepositAdjustmentOut,
      closingBalance: snapshot.customerDepositClosingBalance,
    },
    cash: {
      expectedCash: snapshot.expectedCash,
      actualCash: snapshot.actualCash,
      variance: snapshot.cashVariance,
    },
    operations: {
      transactionCount: snapshot.transactionCount,
      itemsSoldCount: snapshot.itemsSoldCount,
      heldTransactionCount: snapshot.heldTransactionCount,
    },
  });
}

export async function finalizeTelegramDailyFinanceInTransaction(
  transaction: TelegramRepositoryTransaction,
  input: FinalizeTelegramDailyFinanceInput,
): Promise<FinalizeTelegramDailyFinanceResult> {
  const persisted = await persistFinanceSnapshot(transaction, input);

  if (!input.integrationEnabled) {
    return {
      financeSnapshotId: persisted.snapshot.id,
      financeSnapshotCreated: persisted.created,
      delivery: { status: "integration_disabled" },
    };
  }

  const destination = await findEnabledTelegramDestinationForOutlet(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    reportType: "closing_daily",
  });

  if (!destination) {
    return {
      financeSnapshotId: persisted.snapshot.id,
      financeSnapshotCreated: persisted.created,
      delivery: { status: "destination_unavailable" },
    };
  }

  const payload = buildPayloadFromPersistedSnapshot(
    persisted.snapshot,
    input,
    destination.timezone,
  );
  const delivery = await enqueueTelegramDelivery(transaction, {
    organizationId: input.organizationId,
    eventKey: buildTelegramDailyFinanceEventKey(
      input.outletId,
      persisted.snapshot.businessDate,
      persisted.snapshot.revision,
    ),
    destinationId: destination.destinationId,
    outletId: input.outletId,
    reportType: "closing_daily",
    businessDate: persisted.snapshot.businessDate,
    payloadSnapshot: payload,
    messageText: formatTelegramDailyFinanceMessage(payload),
    maxAttempts: input.maxAttempts,
  });

  return {
    financeSnapshotId: persisted.snapshot.id,
    financeSnapshotCreated: persisted.created,
    delivery: delivery.created
      ? { status: "enqueued", deliveryId: delivery.delivery.id }
      : { status: "duplicate", deliveryId: delivery.delivery.id },
  };
}
