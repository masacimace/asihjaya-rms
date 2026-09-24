import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  customerDepositLedger,
  customers,
  payments,
  productCategories,
  productItems,
  productMasters,
  registers,
  saleItems,
  sales,
  users,
} from "@/db/schema";
import type {
  PosTransactionListData,
  PosTransactionListItem,
  PosTransactionRange,
} from "@/features/pos/contracts";
import { getPosTransactionListData } from "@/features/pos/queries";
import { getStartOfBusinessDay } from "@/lib/time/business-time";

export const POS_TRANSACTION_HISTORY_PAGE_SIZE = 10;

export type PosTransactionHistoryPageData = PosTransactionListData & {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

function normalizeRange(range?: string | null): PosTransactionRange {
  if (range === "7d" || range === "30d" || range === "all") {
    return range;
  }

  return "today";
}

function normalizePage(page?: number | null) {
  return typeof page === "number" && Number.isSafeInteger(page) && page > 0
    ? page
    : 1;
}

function getRangeStart(range: PosTransactionRange, timeZone: string) {
  const now = new Date();

  if (range === "all") return null;
  if (range === "7d") return getStartOfBusinessDay(now, timeZone, -6);
  if (range === "30d") return getStartOfBusinessDay(now, timeZone, -29);

  return getStartOfBusinessDay(now, timeZone);
}

function getRangeEnd(range: PosTransactionRange, timeZone: string) {
  if (range === "all") return null;
  return getStartOfBusinessDay(new Date(), timeZone, 1);
}

function parseAmount(value: string | number | null) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPaymentStatus(totalAmount: number, paidAmount: number) {
  if (paidAmount >= totalAmount) return "paid" as const;
  if (paidAmount > 0) return "partial" as const;
  return "pending" as const;
}

export async function getPosTransactionHistoryPageData({
  organizationId,
  outletId,
  query,
  range,
  shiftId,
  timeZone,
  page,
}: {
  organizationId: string;
  outletId?: string | null;
  query?: string | null;
  range?: string | null;
  shiftId?: string | null;
  timeZone: string;
  page?: number | null;
}): Promise<PosTransactionHistoryPageData> {
  const normalizedQuery = query?.trim() ?? "";
  const normalizedRange = normalizeRange(range);
  const normalizedShiftId = shiftId?.trim() || null;
  const requestedPage = normalizePage(page);

  // Reuse the existing analytics/outlet pipeline so sales KPIs and chart semantics
  // remain exactly the same. The transaction rows below are fetched separately
  // with proper count + offset pagination.
  const baseData = await getPosTransactionListData({
    organizationId,
    outletId,
    query: null,
    range: normalizedRange,
    shiftId: normalizedShiftId,
    timeZone,
  });

  if (!baseData.outlet) {
    return {
      ...baseData,
      query: normalizedQuery,
      transactions: [],
      summary: {
        totalTransactions: 0,
        totalAmount: 0,
        paidAmount: 0,
        totalItems: 0,
      },
      pagination: {
        page: 1,
        pageSize: POS_TRANSACTION_HISTORY_PAGE_SIZE,
        total: 0,
        pageCount: 1,
      },
    };
  }

  const filters: SQL[] = [
    eq(sales.organizationId, organizationId),
    eq(sales.outletId, baseData.outlet.id),
    eq(sales.status, "completed"),
  ];

  const rangeStart = getRangeStart(normalizedRange, timeZone);
  const rangeEnd = getRangeEnd(normalizedRange, timeZone);

  if (rangeStart) filters.push(gte(sales.completedAt, rangeStart));
  if (rangeEnd) filters.push(lt(sales.completedAt, rangeEnd));
  if (normalizedShiftId) filters.push(eq(sales.shiftId, normalizedShiftId));

  if (normalizedQuery) {
    const searchPattern = `%${normalizedQuery}%`;
    const itemSaleRows = await db
      .selectDistinct({ saleId: saleItems.saleId })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
      .innerJoin(
        productMasters,
        eq(productItems.productMasterId, productMasters.id),
      )
      .where(
        and(
          eq(sales.organizationId, organizationId),
          eq(sales.outletId, baseData.outlet.id),
          or(
            sql`${saleItems.snapshot}->>'sku' ilike ${searchPattern}`,
            sql`${saleItems.snapshot}->>'barcode' ilike ${searchPattern}`,
            sql`${saleItems.snapshot}->>'serialNumber' ilike ${searchPattern}`,
            sql`${saleItems.snapshot}->>'itemDisplayName' ilike ${searchPattern}`,
            sql`${saleItems.snapshot}->>'productName' ilike ${searchPattern}`,
            sql`${saleItems.snapshot}->>'productCode' ilike ${searchPattern}`,
            sql`${saleItems.snapshot}->>'categoryName' ilike ${searchPattern}`,
            ilike(productItems.sku, searchPattern),
            ilike(productItems.barcode, searchPattern),
            ilike(productItems.serialNumber, searchPattern),
            ilike(productItems.displayName, searchPattern),
            ilike(productMasters.code, searchPattern),
            ilike(productMasters.name, searchPattern),
          ),
        ),
      );

    const matchingSaleIds = itemSaleRows.map((row) => row.saleId);
    const searchFilters: SQL[] = [
      ilike(sales.invoiceNumber, searchPattern),
      ilike(customers.customerCode, searchPattern),
      ilike(customers.fullName, searchPattern),
      ilike(customers.phone, searchPattern),
      ilike(customers.email, searchPattern),
    ];

    if (matchingSaleIds.length > 0) {
      searchFilters.push(inArray(sales.id, matchingSaleIds));
    }

    const searchCondition = or(...searchFilters);
    if (searchCondition) filters.push(searchCondition);
  }

  const totalRows = await db
    .select({ value: count() })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(and(...filters));

  const total = Number(totalRows[0]?.value ?? 0);
  const pageCount = Math.max(
    1,
    Math.ceil(total / POS_TRANSACTION_HISTORY_PAGE_SIZE),
  );
  const currentPage = Math.min(requestedPage, pageCount);
  const offset = (currentPage - 1) * POS_TRANSACTION_HISTORY_PAGE_SIZE;

  const saleRows = await db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      status: sales.status,
      subtotalAmount: sales.subtotalAmount,
      discountAmount: sales.discountAmount,
      additionalFeeAmount: sales.additionalFeeAmount,
      totalAmount: sales.totalAmount,
      completedAt: sales.completedAt,
      createdAt: sales.createdAt,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      cashierName: users.fullName,
      registerName: registers.name,
      shiftId: sales.shiftId,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .innerJoin(users, eq(sales.cashierId, users.id))
    .innerJoin(registers, eq(sales.registerId, registers.id))
    .where(and(...filters))
    .orderBy(desc(sales.completedAt), desc(sales.createdAt))
    .limit(POS_TRANSACTION_HISTORY_PAGE_SIZE)
    .offset(offset);

  const saleIds = saleRows.map((sale) => sale.id);
  const [paymentRows, itemRows, customerDepositUsedRows] =
    saleIds.length > 0
      ? await Promise.all([
          db
            .select({
              saleId: payments.saleId,
              method: payments.method,
              provider: payments.provider,
              amount: payments.amount,
              status: payments.status,
              providerReference: payments.providerReference,
            })
            .from(payments)
            .where(inArray(payments.saleId, saleIds))
            .orderBy(asc(payments.createdAt)),
          db
            .select({
              saleId: saleItems.saleId,
              productItemId: saleItems.productItemId,
              sku: sql<string>`coalesce(nullif(${saleItems.snapshot}->>'sku', ''), ${productItems.sku})`,
              productName: sql<string>`coalesce(nullif(${saleItems.snapshot}->>'itemDisplayName', ''), nullif(${saleItems.snapshot}->>'productName', ''), ${productItems.displayName}, ${productMasters.name})`,
              categoryName: sql<string>`coalesce(nullif(${saleItems.snapshot}->>'categoryName', ''), ${productCategories.name})`,
              imageKey: sql<string | null>`coalesce(nullif(${saleItems.snapshot}->>'imageKey', ''), nullif(${saleItems.snapshot}->>'productImageKey', ''), ${productItems.imageKey}, ${productMasters.imageKey})`,
              finalPriceAmount: saleItems.finalPriceAmount,
            })
            .from(saleItems)
            .innerJoin(
              productItems,
              eq(saleItems.productItemId, productItems.id),
            )
            .innerJoin(
              productMasters,
              eq(productItems.productMasterId, productMasters.id),
            )
            .innerJoin(
              productCategories,
              eq(productMasters.categoryId, productCategories.id),
            )
            .where(inArray(saleItems.saleId, saleIds))
            .orderBy(asc(saleItems.lineNumber)),
          db
            .select({
              saleId: customerDepositLedger.saleId,
              amount: customerDepositLedger.amount,
            })
            .from(customerDepositLedger)
            .where(
              and(
                inArray(customerDepositLedger.saleId, saleIds),
                eq(customerDepositLedger.entryType, "deposit_used"),
                eq(customerDepositLedger.direction, "debit"),
              ),
            )
            .orderBy(asc(customerDepositLedger.occurredAt)),
        ])
      : [[], [], []];

  const paymentsBySaleId = new Map<string, typeof paymentRows>();
  const itemsBySaleId = new Map<string, typeof itemRows>();
  const customerDepositUsedBySaleId = new Map<string, number>();

  for (const payment of paymentRows) {
    const current = paymentsBySaleId.get(payment.saleId) ?? [];
    current.push(payment);
    paymentsBySaleId.set(payment.saleId, current);
  }

  for (const item of itemRows) {
    const current = itemsBySaleId.get(item.saleId) ?? [];
    current.push(item);
    itemsBySaleId.set(item.saleId, current);
  }

  for (const entry of customerDepositUsedRows) {
    if (!entry.saleId) continue;
    customerDepositUsedBySaleId.set(
      entry.saleId,
      (customerDepositUsedBySaleId.get(entry.saleId) ?? 0) +
        parseAmount(entry.amount),
    );
  }

  const transactions: PosTransactionListItem[] = saleRows.map((sale) => {
    const transactionPayments = paymentsBySaleId.get(sale.id) ?? [];
    const transactionItems = itemsBySaleId.get(sale.id) ?? [];
    const totalAmount = parseAmount(sale.totalAmount);
    const externalPaidAmount = transactionPayments.reduce(
      (sum, payment) =>
        payment.status === "paid" ? sum + parseAmount(payment.amount) : sum,
      0,
    );
    const customerDepositUsedAmount =
      customerDepositUsedBySaleId.get(sale.id) ?? 0;
    const paidAmount = externalPaidAmount + customerDepositUsedAmount;

    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      status: sale.status,
      subtotalAmount: sale.subtotalAmount,
      discountAmount: sale.discountAmount,
      additionalFeeAmount: sale.additionalFeeAmount,
      totalAmount: sale.totalAmount,
      paidAmount,
      customerDepositUsedAmount,
      paymentStatus: getPaymentStatus(totalAmount, paidAmount),
      completedAt: sale.completedAt,
      createdAt: sale.createdAt,
      customerCode: sale.customerCode,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      customerEmail: sale.customerEmail,
      cashierName: sale.cashierName,
      registerName: sale.registerName,
      shiftId: sale.shiftId,
      totalItems: transactionItems.length,
      items: transactionItems.map((item) => ({
        productItemId: item.productItemId,
        sku: item.sku,
        productName: item.productName,
        categoryName: item.categoryName,
        imageKey: item.imageKey,
        finalPriceAmount: item.finalPriceAmount,
      })),
      payments: transactionPayments.map((payment) => ({
        method: payment.method,
        provider: payment.provider,
        amount: payment.amount,
        status: payment.status,
        providerReference: payment.providerReference,
      })),
    };
  });

  return {
    ...baseData,
    query: normalizedQuery,
    range: normalizedRange,
    shiftId: normalizedShiftId,
    transactions,
    summary: {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce(
        (sum, transaction) => sum + parseAmount(transaction.totalAmount),
        0,
      ),
      paidAmount: transactions.reduce(
        (sum, transaction) => sum + transaction.paidAmount,
        0,
      ),
      totalItems: transactions.reduce(
        (sum, transaction) => sum + transaction.totalItems,
        0,
      ),
    },
    pagination: {
      page: currentPage,
      pageSize: POS_TRANSACTION_HISTORY_PAGE_SIZE,
      total,
      pageCount,
    },
  };
}
