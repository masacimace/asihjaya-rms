import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  approvals,
  customers,
  outlets,
  payments,
  productCategories,
  productItems,
  productMasters,
  registers,
  saleItems,
  sales,
  users,
} from "@/db/schema";
import {
  ADMIN_CUSTOMERS_PAGE_SIZE,
  type AdminCustomerDepositBalanceRow,
  type AdminCustomerDepositLedgerRow,
  type AdminCustomerDetailData,
  type AdminCustomerFilters,
  type AdminCustomerFormData,
  type AdminCustomerListData,
  type AdminCustomerListRow,
  type AdminCustomerTransactionRow,
} from "@/features/customers/contracts";
import {
  getCustomerDepositBalancesForCustomer,
  getCustomerDepositLedgerEntries,
} from "@/features/customer-deposits/queries";
import type { AuthContext } from "@/lib/auth/session";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function getJakartaDateParts(date: Date) {
  const shiftedDate = new Date(date.getTime() + JAKARTA_OFFSET_MS);

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth(),
    day: shiftedDate.getUTCDate(),
  };
}

function getJakartaMonthStartUtc(date: Date, monthOffset = 0) {
  const parts = getJakartaDateParts(date);

  return new Date(
    Date.UTC(parts.year, parts.month + monthOffset, 1) - JAKARTA_OFFSET_MS,
  );
}

function parseAmount(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getAccessibleOutletIds(auth: AuthContext, requestedOutletId: string | null) {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (!requestedOutletId) {
    return outletIds;
  }

  return outletIds.includes(requestedOutletId) ? [requestedOutletId] : [];
}

function createCustomerSearchCondition(search: string) {
  if (!search) {
    return null;
  }

  const pattern = `%${search}%`;

  return or(
    ilike(customers.customerCode, pattern),
    ilike(customers.fullName, pattern),
    ilike(customers.phone, pattern),
    ilike(customers.email, pattern),
    ilike(customers.address, pattern),
  );
}

function createCustomerConditions({
  organizationId,
  filters,
}: {
  organizationId: string;
  filters: AdminCustomerFilters;
}) {
  const conditions: SQL[] = [eq(customers.organizationId, organizationId)];

  if (filters.status === "active") {
    conditions.push(eq(customers.isActive, true));
  }

  if (filters.status === "inactive") {
    conditions.push(eq(customers.isActive, false));
  }

  const searchCondition = createCustomerSearchCondition(filters.search);

  if (searchCondition) {
    conditions.push(searchCondition);
  }

  return conditions;
}

function createCompletedSaleConditions({
  organizationId,
  outletIds,
}: {
  organizationId: string;
  outletIds: string[];
}) {
  if (outletIds.length === 0) {
    return [sql`false`] satisfies SQL[];
  }

  return [
    eq(sales.organizationId, organizationId),
    eq(sales.status, "completed"),
    inArray(sales.outletId, outletIds),
  ] satisfies SQL[];
}

function mapLastTransactionRow(
  sale: {
    id: string;
    invoiceNumber: string;
    completedAt: Date | null;
    createdAt: Date;
    totalAmount: string;
    outletName: string;
    cashierName: string;
  } | null,
): AdminCustomerListRow["lastTransaction"] {
  if (!sale) {
    return null;
  }

  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    completedAt: sale.completedAt,
    createdAt: sale.createdAt,
    totalAmount: sale.totalAmount,
    outletName: sale.outletName,
    cashierName: sale.cashierName,
  };
}

function getTransactionTime(value: { completedAt: Date | null; createdAt: Date }) {
  return value.completedAt ?? value.createdAt;
}

function getLatestDate(values: Array<Date | null>) {
  const validTimes = values
    .filter((value): value is Date => Boolean(value))
    .map((value) => value.getTime());

  if (validTimes.length === 0) {
    return null;
  }

  return new Date(Math.max(...validTimes));
}

function sortDepositLedgerEntries(
  entries: AdminCustomerDepositLedgerRow[],
) {
  return [...entries].sort((firstEntry, secondEntry) => {
    const occurredDelta =
      secondEntry.occurredAt.getTime() - firstEntry.occurredAt.getTime();

    if (occurredDelta !== 0) {
      return occurredDelta;
    }

    return secondEntry.createdAt.getTime() - firstEntry.createdAt.getTime();
  });
}

function createEmptyCustomerDepositData() {
  return {
    totalBalance: 0,
    outletsWithBalance: 0,
    lastLedgerEntryAt: null,
    balances: [] satisfies AdminCustomerDepositBalanceRow[],
    recentEntries: [] satisfies AdminCustomerDepositLedgerRow[],
  };
}

export async function getAdminCustomerListData(
  auth: AuthContext,
  filters: AdminCustomerFilters,
): Promise<AdminCustomerListData> {
  const outletIds = getAccessibleOutletIds(auth, filters.outletId);
  const customerConditions = createCustomerConditions({
    organizationId: auth.organization.id,
    filters,
  });
  const customerWhereClause = and(...customerConditions);

  if (!customerWhereClause) {
    return createEmptyCustomerListData(auth, filters);
  }

  const completedSaleConditions = createCompletedSaleConditions({
    organizationId: auth.organization.id,
    outletIds,
  });
  const completedSaleWhereClause = and(...completedSaleConditions);
  const thisMonthStart = getJakartaMonthStartUtc(new Date());

  const [totalRows, activeRows, inactiveRows, newRows, transactionSummaryRows] =
    await Promise.all([
      db.select({ total: count() }).from(customers).where(customerWhereClause),

      db
        .select({ total: count() })
        .from(customers)
        .where(
          and(
            eq(customers.organizationId, auth.organization.id),
            eq(customers.isActive, true),
          ),
        ),

      db
        .select({ total: count() })
        .from(customers)
        .where(
          and(
            eq(customers.organizationId, auth.organization.id),
            eq(customers.isActive, false),
          ),
        ),

      db
        .select({ total: count() })
        .from(customers)
        .where(
          and(
            eq(customers.organizationId, auth.organization.id),
            gte(customers.createdAt, thisMonthStart),
          ),
        ),

      db
        .select({
          customersWithTransactions: sql<number>`count(distinct ${sales.customerId})`.mapWith(Number),
          totalSpent: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        })
        .from(sales)
        .where(completedSaleWhereClause),
    ]);

  const total = Number(totalRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_CUSTOMERS_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const customerRows = await db
    .select({
      id: customers.id,
      customerCode: customers.customerCode,
      fullName: customers.fullName,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      notes: customers.notes,
      isActive: customers.isActive,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
    })
    .from(customers)
    .where(customerWhereClause)
    .orderBy(desc(customers.updatedAt), asc(customers.fullName))
    .limit(ADMIN_CUSTOMERS_PAGE_SIZE)
    .offset((page - 1) * ADMIN_CUSTOMERS_PAGE_SIZE);

  const customerIds = customerRows.map((customer) => customer.id);

  const [saleMetricRows, itemMetricRows, saleRows] =
    customerIds.length > 0
      ? await Promise.all([
          db
            .select({
              customerId: sales.customerId,
              totalTransactions: count(sales.id),
              totalSpent: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
            })
            .from(sales)
            .where(
              and(
                completedSaleWhereClause,
                inArray(sales.customerId, customerIds),
              ),
            )
            .groupBy(sales.customerId),

          db
            .select({
              customerId: sales.customerId,
              totalItems: count(saleItems.id),
            })
            .from(saleItems)
            .innerJoin(sales, eq(saleItems.saleId, sales.id))
            .where(
              and(
                completedSaleWhereClause,
                inArray(sales.customerId, customerIds),
              ),
            )
            .groupBy(sales.customerId),

          db
            .select({
              id: sales.id,
              customerId: sales.customerId,
              invoiceNumber: sales.invoiceNumber,
              totalAmount: sales.totalAmount,
              completedAt: sales.completedAt,
              createdAt: sales.createdAt,
              outletName: outlets.name,
              cashierName: users.fullName,
            })
            .from(sales)
            .innerJoin(outlets, eq(sales.outletId, outlets.id))
            .innerJoin(users, eq(sales.cashierId, users.id))
            .where(
              and(
                completedSaleWhereClause,
                inArray(sales.customerId, customerIds),
              ),
            )
            .orderBy(desc(sales.completedAt), desc(sales.createdAt)),
        ])
      : [[], [], []];

  const metricsByCustomerId = new Map<
    string,
    {
      totalTransactions: number;
      totalSpent: number;
      totalItems: number;
      lastTransaction: AdminCustomerListRow["lastTransaction"];
    }
  >();

  for (const customer of customerRows) {
    metricsByCustomerId.set(customer.id, {
      totalTransactions: 0,
      totalSpent: 0,
      totalItems: 0,
      lastTransaction: null,
    });
  }

  for (const saleMetric of saleMetricRows) {
    if (!saleMetric.customerId) {
      continue;
    }

    const current = metricsByCustomerId.get(saleMetric.customerId);

    if (!current) {
      continue;
    }

    current.totalTransactions = Number(saleMetric.totalTransactions ?? 0);
    current.totalSpent = Number(saleMetric.totalSpent ?? 0);
  }

  for (const itemMetric of itemMetricRows) {
    if (!itemMetric.customerId) {
      continue;
    }

    const current = metricsByCustomerId.get(itemMetric.customerId);

    if (!current) {
      continue;
    }

    current.totalItems = Number(itemMetric.totalItems ?? 0);
  }

  for (const sale of saleRows) {
    if (!sale.customerId) {
      continue;
    }

    const current = metricsByCustomerId.get(sale.customerId);

    if (!current || current.lastTransaction) {
      continue;
    }

    current.lastTransaction = mapLastTransactionRow(sale);
  }

  const rows = customerRows.map((customer): AdminCustomerListRow => {
    const metrics = metricsByCustomerId.get(customer.id) ?? {
      totalTransactions: 0,
      totalSpent: 0,
      totalItems: 0,
      lastTransaction: null,
    };

    return {
      ...customer,
      totalTransactions: metrics.totalTransactions,
      totalSpent: metrics.totalSpent,
      totalItems: metrics.totalItems,
      lastTransaction: metrics.lastTransaction,
    };
  });

  return {
    filters,
    outlets: auth.outlets,
    rows,
    summary: {
      totalCustomers: total,
      activeCustomers: Number(activeRows[0]?.total ?? 0),
      inactiveCustomers: Number(inactiveRows[0]?.total ?? 0),
      customersWithTransactions: Number(
        transactionSummaryRows[0]?.customersWithTransactions ?? 0,
      ),
      newCustomersThisMonth: Number(newRows[0]?.total ?? 0),
      totalSpent: Number(transactionSummaryRows[0]?.totalSpent ?? 0),
    },
    total,
    page,
    pageCount,
    pageSize: ADMIN_CUSTOMERS_PAGE_SIZE,
  };
}

function createEmptyCustomerListData(
  auth: AuthContext,
  filters: AdminCustomerFilters,
): AdminCustomerListData {
  return {
    filters,
    outlets: auth.outlets,
    rows: [],
    summary: {
      totalCustomers: 0,
      activeCustomers: 0,
      inactiveCustomers: 0,
      customersWithTransactions: 0,
      newCustomersThisMonth: 0,
      totalSpent: 0,
    },
    total: 0,
    page: 1,
    pageCount: 1,
    pageSize: ADMIN_CUSTOMERS_PAGE_SIZE,
  };
}

export async function getAdminCustomerFormData({
  organizationId,
  customerId,
}: {
  organizationId: string;
  customerId: string;
}): Promise<AdminCustomerFormData | null> {
  const rows = await db
    .select({
      id: customers.id,
      customerCode: customers.customerCode,
      fullName: customers.fullName,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      notes: customers.notes,
      isActive: customers.isActive,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
    })
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, organizationId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getAdminCustomerDetailData(
  auth: AuthContext,
  customerId: string,
): Promise<AdminCustomerDetailData | null> {
  const customer = await getAdminCustomerFormData({
    organizationId: auth.organization.id,
    customerId,
  });

  if (!customer) {
    return null;
  }

  const outletIds = getAccessibleOutletIds(auth, null);

  if (outletIds.length === 0) {
    return {
      customer,
      summary: {
        totalTransactions: 0,
        totalSpent: 0,
        totalItems: 0,
        averageTransactionAmount: 0,
        lastTransactionAt: null,
        lastOutletName: null,
        lastCashierName: null,
        lastItemName: null,
      },
      transactions: [],
      customerDeposits: createEmptyCustomerDepositData(),
    };
  }

  const [
    saleRows,
    depositBalances,
    depositLedgerEntriesByOutlet,
    pendingWithdrawalApprovalRows,
  ] = await Promise.all([
    db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      status: sales.status,
      totalAmount: sales.totalAmount,
      subtotalAmount: sales.subtotalAmount,
      discountAmount: sales.discountAmount,
      completedAt: sales.completedAt,
      createdAt: sales.createdAt,
      outletName: outlets.name,
      registerName: registers.name,
      cashierName: users.fullName,
    })
    .from(sales)
    .innerJoin(outlets, eq(sales.outletId, outlets.id))
    .innerJoin(registers, eq(sales.registerId, registers.id))
    .innerJoin(users, eq(sales.cashierId, users.id))
    .where(
      and(
        eq(sales.organizationId, auth.organization.id),
        eq(sales.customerId, customerId),
        inArray(sales.outletId, outletIds),
      ),
    )
    .orderBy(desc(sales.completedAt), desc(sales.createdAt))
    .limit(50),

    getCustomerDepositBalancesForCustomer({
      organizationId: auth.organization.id,
      customerId,
      outletIds,
    }),

    Promise.all(
      outletIds.map((outletId) =>
        getCustomerDepositLedgerEntries({
          organizationId: auth.organization.id,
          customerId,
          outletId,
          limit: 8,
        }),
      ),
    ),

    db
      .select({
        id: approvals.id,
        outletId: approvals.outletId,
        requestData: approvals.requestData,
        requestedByName: users.fullName,
        createdAt: approvals.createdAt,
      })
      .from(approvals)
      .innerJoin(users, eq(approvals.requestedBy, users.id))
      .where(
        and(
          eq(approvals.organizationId, auth.organization.id),
          eq(approvals.type, "customer_deposit_withdrawal"),
          eq(approvals.status, "pending"),
          eq(approvals.referenceType, "customer"),
          eq(approvals.referenceId, customerId),
          inArray(approvals.outletId, outletIds),
        ),
      )
      .orderBy(desc(approvals.createdAt)),
  ]);

  const saleIds = saleRows.map((sale) => sale.id);

  const [itemRows, paymentRows] =
    saleIds.length > 0
      ? await Promise.all([
          db
            .select({
              saleId: saleItems.saleId,
              productItemId: saleItems.productItemId,
              sku: productItems.sku,
              productName: sql<string>`coalesce(${saleItems.snapshot}->>'productName', ${productItems.displayName}, ${productMasters.name})`,
              categoryName: productCategories.name,
              finalPriceAmount: saleItems.finalPriceAmount,
            })
            .from(saleItems)
            .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
            .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
            .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
            .where(inArray(saleItems.saleId, saleIds))
            .orderBy(asc(saleItems.lineNumber)),

          db
            .select({
              saleId: payments.saleId,
              method: payments.method,
              status: payments.status,
            })
            .from(payments)
            .where(inArray(payments.saleId, saleIds))
            .orderBy(asc(payments.createdAt)),
        ])
      : [[], []];

  const itemsBySaleId = new Map<string, typeof itemRows>();
  const paymentsBySaleId = new Map<string, typeof paymentRows>();

  for (const item of itemRows) {
    const currentItems = itemsBySaleId.get(item.saleId) ?? [];
    currentItems.push(item);
    itemsBySaleId.set(item.saleId, currentItems);
  }

  for (const payment of paymentRows) {
    const currentPayments = paymentsBySaleId.get(payment.saleId) ?? [];
    currentPayments.push(payment);
    paymentsBySaleId.set(payment.saleId, currentPayments);
  }

  const transactions = saleRows.map((sale): AdminCustomerTransactionRow => {
    const items = itemsBySaleId.get(sale.id) ?? [];
    const paidPayments = (paymentsBySaleId.get(sale.id) ?? []).filter(
      (payment) => payment.status === "paid",
    );

    return {
      ...sale,
      totalItems: items.length,
      itemSummary: items.slice(0, 4).map((item) => item.productName),
      paymentMethods: Array.from(new Set(paidPayments.map((payment) => payment.method))),
    };
  });

  const completedTransactions = transactions.filter(
    (transaction) => transaction.status === "completed",
  );
  const totalSpent = completedTransactions.reduce(
    (total, transaction) => total + parseAmount(transaction.totalAmount),
    0,
  );
  const totalItems = completedTransactions.reduce(
    (total, transaction) => total + transaction.totalItems,
    0,
  );
  const lastCompletedTransaction = completedTransactions[0] ?? null;
  const lastCompletedItems = lastCompletedTransaction
    ? itemsBySaleId.get(lastCompletedTransaction.id) ?? []
    : [];
  const pendingWithdrawalApprovalByOutletId = new Map<
    string,
    AdminCustomerDepositBalanceRow["pendingWithdrawalApproval"]
  >();

  for (const approval of pendingWithdrawalApprovalRows) {
    if (!approval.outletId || pendingWithdrawalApprovalByOutletId.has(approval.outletId)) {
      continue;
    }

    const amount = parseAmount(String(approval.requestData.withdrawalAmount ?? "0"));

    pendingWithdrawalApprovalByOutletId.set(approval.outletId, {
      id: approval.id,
      amount,
      requestedByName: approval.requestedByName,
      createdAt: approval.createdAt,
    });
  }

  const customerDepositBalances = depositBalances.map(
    (balance): AdminCustomerDepositBalanceRow => ({
      outletId: balance.outletId,
      outletCode: balance.outletCode,
      outletName: balance.outletName,
      balanceAmount: balance.balanceAmount,
      balance: balance.balance,
      lastLedgerEntryAt: balance.lastLedgerEntryAt,
      pendingWithdrawalApproval:
        pendingWithdrawalApprovalByOutletId.get(balance.outletId) ?? null,
    }),
  );
  const recentDepositEntries = sortDepositLedgerEntries(
    depositLedgerEntriesByOutlet.flat(),
  ).slice(0, 8);
  const totalDepositBalance = customerDepositBalances.reduce(
    (total, balance) => total + balance.balance,
    0,
  );

  return {
    customer,
    summary: {
      totalTransactions: completedTransactions.length,
      totalSpent,
      totalItems,
      averageTransactionAmount:
        completedTransactions.length > 0
          ? Math.round(totalSpent / completedTransactions.length)
          : 0,
      lastTransactionAt: lastCompletedTransaction
        ? getTransactionTime(lastCompletedTransaction)
        : null,
      lastOutletName: lastCompletedTransaction?.outletName ?? null,
      lastCashierName: lastCompletedTransaction?.cashierName ?? null,
      lastItemName: lastCompletedItems[0]?.productName ?? null,
    },
    transactions,
    customerDeposits: {
      totalBalance: totalDepositBalance,
      outletsWithBalance: customerDepositBalances.filter(
        (balance) => balance.balance > 0,
      ).length,
      lastLedgerEntryAt: getLatestDate(
        customerDepositBalances.map((balance) => balance.lastLedgerEntryAt),
      ),
      balances: customerDepositBalances,
      recentEntries: recentDepositEntries,
    },
  };
}
