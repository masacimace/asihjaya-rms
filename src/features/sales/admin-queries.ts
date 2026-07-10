import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  ilike,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  approvals,
  auditLogs,
  customers,
  hardwareJobs,
  outlets,
  payments,
  productCategories,
  productItems,
  productMasters,
  registers,
  saleItems,
  sales,
  shifts,
  users,
} from "@/db/schema";
import {
  ADMIN_SALES_PAGE_SIZE,
  type AdminSaleDetailData,
  type AdminSaleListRow,
  type AdminSalePrintStatus,
  type AdminSalesExportRow,
  type AdminSalesFilters,
  type AdminSalesListData,
  type AdminSalesPeriod,
} from "@/features/sales/admin-contracts";
import { createReceiptVerificationUrl } from "@/features/sales/verification/receipt-token";
import type { AuthContext } from "@/lib/auth/session";

const approvalRequestedByUsers = alias(users, "sales_detail_approval_requested_by_users");
const approvalApprovedByUsers = alias(users, "sales_detail_approval_approved_by_users");

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function getJakartaDateParts(date: Date) {
  const shiftedDate = new Date(date.getTime() + JAKARTA_OFFSET_MS);

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth(),
    day: shiftedDate.getUTCDate(),
  };
}

function getJakartaDayStartUtc(date: Date, dayOffset = 0) {
  const parts = getJakartaDateParts(date);

  return new Date(
    Date.UTC(parts.year, parts.month, parts.day + dayOffset) -
      JAKARTA_OFFSET_MS,
  );
}

function getJakartaMonthStartUtc(date: Date, monthOffset = 0) {
  const parts = getJakartaDateParts(date);

  return new Date(
    Date.UTC(parts.year, parts.month + monthOffset, 1) - JAKARTA_OFFSET_MS,
  );
}

function createSalesPeriod(range: AdminSalesFilters["dateRange"], now = new Date()): AdminSalesPeriod {
  const todayStart = getJakartaDayStartUtc(now);
  const tomorrowStart = getJakartaDayStartUtc(now, 1);

  if (range === "yesterday") {
    return {
      range,
      label: "Kemarin",
      start: getJakartaDayStartUtc(now, -1),
      end: todayStart,
    };
  }

  if (range === "last7") {
    return {
      range,
      label: "7 hari terakhir",
      start: getJakartaDayStartUtc(now, -6),
      end: tomorrowStart,
    };
  }

  if (range === "last30") {
    return {
      range,
      label: "30 hari terakhir",
      start: getJakartaDayStartUtc(now, -29),
      end: tomorrowStart,
    };
  }

  if (range === "thisMonth") {
    return {
      range,
      label: "Bulan ini",
      start: getJakartaMonthStartUtc(now),
      end: tomorrowStart,
    };
  }

  if (range === "all") {
    return {
      range,
      label: "Semua waktu",
      start: null,
      end: null,
    };
  }

  return {
    range: "today",
    label: "Hari ini",
    start: todayStart,
    end: tomorrowStart,
  };
}

function parseAmount(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getPaymentStatusFromAmounts(totalAmount: number, paidAmount: number) {
  if (paidAmount >= totalAmount && totalAmount > 0) {
    return "paid" as const;
  }

  if (paidAmount > 0) {
    return "partial" as const;
  }

  return "pending" as const;
}

type PaymentMetadata = Record<string, unknown> | null;

function getPaymentMetadataNumber(metadata: PaymentMetadata, key: string) {
  if (!metadata) {
    return null;
  }

  const value = metadata[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}


function getApprovalRequestDataString(
  requestData: Record<string, unknown>,
  key: string,
) {
  const value = requestData[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getSensitiveApprovalExecutionStatus(requestData: Record<string, unknown>) {
  const value = getApprovalRequestDataString(requestData, "executionStatus");

  if (
    value === "awaiting_r3c_2" ||
    value === "void_executed" ||
    value === "refund_executed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return null;
}

function getSensitiveApprovalExecutedAt(requestData: Record<string, unknown>) {
  const value = getApprovalRequestDataString(requestData, "executedAt");

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getPaymentMetadataString(metadata: PaymentMetadata, key: string) {
  if (!metadata) {
    return null;
  }

  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getAccessibleOutletIds(auth: AuthContext, requestedOutletId: string | null) {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (!requestedOutletId) {
    return outletIds;
  }

  return outletIds.includes(requestedOutletId) ? [requestedOutletId] : [];
}

function createSearchCondition(search: string) {
  if (!search) {
    return null;
  }

  const pattern = `%${search}%`;

  return or(
    ilike(sales.invoiceNumber, pattern),
    ilike(customers.customerCode, pattern),
    ilike(customers.fullName, pattern),
    ilike(customers.phone, pattern),
    ilike(customers.email, pattern),
    ilike(users.fullName, pattern),
    ilike(registers.name, pattern),
    ilike(outlets.name, pattern),
    sql`exists (
      select 1
      from ${saleItems}
      inner join ${productItems} on ${saleItems.productItemId} = ${productItems.id}
      inner join ${productMasters} on ${productItems.productMasterId} = ${productMasters.id}
      where ${saleItems.saleId} = ${sales.id}
        and (
          ${productItems.sku} ilike ${pattern}
          or ${productItems.barcode} ilike ${pattern}
          or ${productItems.serialNumber} ilike ${pattern}
          or ${productItems.displayName} ilike ${pattern}
          or ${productMasters.code} ilike ${pattern}
          or ${productMasters.name} ilike ${pattern}
        )
    )`,
    sql`exists (
      select 1
      from ${payments}
      where ${payments.saleId} = ${sales.id}
        and ${payments.providerReference} ilike ${pattern}
    )`,
  );
}

function createSalesConditions({
  auth,
  filters,
  period,
}: {
  auth: AuthContext;
  filters: AdminSalesFilters;
  period: AdminSalesPeriod;
}) {
  const outletIds = getAccessibleOutletIds(auth, filters.outletId);

  if (outletIds.length === 0) {
    return {
      outletIds,
      conditions: [sql`false`] satisfies SQL[],
    };
  }

  const conditions: SQL[] = [
    eq(sales.organizationId, auth.organization.id),
    inArray(sales.outletId, outletIds),
  ];

  if (filters.status) {
    conditions.push(eq(sales.status, filters.status));
  }

  if (filters.paymentMethod) {
    conditions.push(
      sql`exists (
        select 1
        from ${payments}
        where ${payments.saleId} = ${sales.id}
          and ${payments.method} = ${filters.paymentMethod}::payment_method
      )`,
    );
  }

  if (period.start) {
    conditions.push(gte(sales.createdAt, period.start));
  }

  if (period.end) {
    conditions.push(lt(sales.createdAt, period.end));
  }

  const searchCondition = createSearchCondition(filters.search);

  if (searchCondition) {
    conditions.push(searchCondition);
  }

  return { outletIds, conditions };
}

function createEmptySalesListData({
  filters,
  period,
  auth,
}: {
  filters: AdminSalesFilters;
  period: AdminSalesPeriod;
  auth: AuthContext;
}): AdminSalesListData {
  return {
    filters,
    period,
    outlets: auth.outlets,
    rows: [],
    summary: {
      totalTransactions: 0,
      totalAmount: 0,
      paidAmount: 0,
      averageTransactionAmount: 0,
      totalItems: 0,
      cashAmount: 0,
      nonCashAmount: 0,
    },
    paymentSummary: [],
    total: 0,
    page: 1,
    pageCount: 1,
    pageSize: ADMIN_SALES_PAGE_SIZE,
  };
}

function normalizePrintStatus(status: string | null | undefined): AdminSalePrintStatus {
  if (
    status === "pending" ||
    status === "claimed" ||
    status === "printing" ||
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    return status;
  }

  return "not_queued";
}

export async function getAdminSalesListData(
  auth: AuthContext,
  filters: AdminSalesFilters,
): Promise<AdminSalesListData> {
  const period = createSalesPeriod(filters.dateRange);
  const { outletIds, conditions } = createSalesConditions({
    auth,
    filters,
    period,
  });

  if (outletIds.length === 0) {
    return createEmptySalesListData({ filters, period, auth });
  }

  const whereClause = and(...conditions);

  if (!whereClause) {
    return createEmptySalesListData({ filters, period, auth });
  }

  const [summaryRows, itemSummaryRows, paymentSummaryRows] = await Promise.all([
    db
      .select({
        total: count(),
        totalAmount: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        paidAmount: sql<number>`coalesce(sum(
          (
            select coalesce(sum(${payments.amount}), 0)
            from ${payments}
            where ${payments.saleId} = ${sales.id}
              and ${payments.status} = 'paid'::payment_status
          )
        ), 0)`.mapWith(Number),
        averageTransactionAmount: sql<number>`coalesce(avg(${sales.totalAmount}), 0)`.mapWith(Number),
      })
      .from(sales)
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .innerJoin(registers, eq(sales.registerId, registers.id))
      .innerJoin(users, eq(sales.cashierId, users.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(whereClause),

    db
      .select({
        totalItems: count(saleItems.id),
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .innerJoin(registers, eq(sales.registerId, registers.id))
      .innerJoin(users, eq(sales.cashierId, users.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(whereClause),

    db
      .select({
        method: payments.method,
        amount: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number),
        paymentCount: count(payments.id),
        transactionCount: countDistinct(payments.saleId),
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .innerJoin(registers, eq(sales.registerId, registers.id))
      .innerJoin(users, eq(sales.cashierId, users.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(and(whereClause, eq(payments.status, "paid")))
      .groupBy(payments.method),
  ]);

  const summary = summaryRows[0] ?? {
    total: 0,
    totalAmount: 0,
    paidAmount: 0,
    averageTransactionAmount: 0,
  };
  const total = Number(summary.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_SALES_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const itemSummary = itemSummaryRows[0] ?? { totalItems: 0 };
  const cashAmount = paymentSummaryRows
    .filter((payment) => payment.method === "cash")
    .reduce((totalAmount, payment) => totalAmount + payment.amount, 0);
  const nonCashAmount = paymentSummaryRows
    .filter((payment) => payment.method !== "cash")
    .reduce((totalAmount, payment) => totalAmount + payment.amount, 0);

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
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
      registerName: registers.name,
      cashierName: users.fullName,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      customerPhone: customers.phone,
    })
    .from(sales)
    .innerJoin(outlets, eq(sales.outletId, outlets.id))
    .innerJoin(registers, eq(sales.registerId, registers.id))
    .innerJoin(users, eq(sales.cashierId, users.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(sales.completedAt), desc(sales.createdAt))
    .limit(ADMIN_SALES_PAGE_SIZE)
    .offset((page - 1) * ADMIN_SALES_PAGE_SIZE);

  const saleIds = saleRows.map((sale) => sale.id);

  const [paymentRows, itemRows, hardwareJobRows] =
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
              sku: productItems.sku,
              barcode: productItems.barcode,
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
              sourceId: hardwareJobs.sourceId,
              status: hardwareJobs.status,
              createdAt: hardwareJobs.createdAt,
            })
            .from(hardwareJobs)
            .where(
              and(
                eq(hardwareJobs.organizationId, auth.organization.id),
                eq(hardwareJobs.sourceType, "sale"),
                eq(hardwareJobs.jobType, "print_receipt_certificate"),
                inArray(hardwareJobs.sourceId, saleIds),
              ),
            )
            .orderBy(desc(hardwareJobs.createdAt)),
        ])
      : [[], [], []];

  const paymentsBySaleId = new Map<string, typeof paymentRows>();
  const itemsBySaleId = new Map<string, typeof itemRows>();
  const printStatusBySaleId = new Map<string, AdminSalePrintStatus>();

  for (const payment of paymentRows) {
    const currentPayments = paymentsBySaleId.get(payment.saleId) ?? [];
    currentPayments.push(payment);
    paymentsBySaleId.set(payment.saleId, currentPayments);
  }

  for (const item of itemRows) {
    const currentItems = itemsBySaleId.get(item.saleId) ?? [];
    currentItems.push(item);
    itemsBySaleId.set(item.saleId, currentItems);
  }

  for (const job of hardwareJobRows) {
    if (job.sourceId && !printStatusBySaleId.has(job.sourceId)) {
      printStatusBySaleId.set(job.sourceId, normalizePrintStatus(job.status));
    }
  }

  const rows = saleRows.map((sale): AdminSaleListRow => {
    const salePayments = paymentsBySaleId.get(sale.id) ?? [];
    const saleItemsRows = itemsBySaleId.get(sale.id) ?? [];
    const totalAmount = parseAmount(sale.totalAmount);
    const paidAmount = salePayments.reduce(
      (paymentTotal, payment) =>
        payment.status === "paid"
          ? paymentTotal + parseAmount(payment.amount)
          : paymentTotal,
      0,
    );
    const refundedAmount = salePayments.reduce(
      (paymentTotal, payment) =>
        payment.status === "refunded"
          ? paymentTotal + parseAmount(payment.amount)
          : paymentTotal,
      0,
    );
    const paymentMethods = Array.from(
      new Set(
        salePayments
          .filter((payment) =>
            payment.status === "paid" || payment.status === "refunded",
          )
          .map((payment) => payment.method),
      ),
    );

    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      status: sale.status,
      subtotalAmount: sale.subtotalAmount,
      discountAmount: sale.discountAmount,
      additionalFeeAmount: sale.additionalFeeAmount,
      totalAmount: sale.totalAmount,
      paidAmount,
      refundedAmount,
      paymentStatus: getPaymentStatusFromAmounts(totalAmount, paidAmount),
      completedAt: sale.completedAt,
      createdAt: sale.createdAt,
      outletId: sale.outletId,
      outletCode: sale.outletCode,
      outletName: sale.outletName,
      registerName: sale.registerName,
      cashierName: sale.cashierName,
      customerCode: sale.customerCode,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      totalItems: saleItemsRows.length,
      items: saleItemsRows.slice(0, 3).map((item) => ({
        productItemId: item.productItemId,
        sku: item.sku,
        barcode: item.barcode,
        productName: item.productName,
        categoryName: item.categoryName,
        finalPriceAmount: item.finalPriceAmount,
      })),
      payments: salePayments.map((payment) => ({
        method: payment.method,
        provider: payment.provider,
        amount: payment.amount,
        status: payment.status,
        providerReference: payment.providerReference,
      })),
      paymentMethods,
      printStatus: printStatusBySaleId.get(sale.id) ?? "not_queued",
    };
  });

  return {
    filters,
    period,
    outlets: auth.outlets,
    rows,
    summary: {
      totalTransactions: total,
      totalAmount: summary.totalAmount,
      paidAmount: summary.paidAmount,
      averageTransactionAmount: summary.averageTransactionAmount,
      totalItems: Number(itemSummary.totalItems ?? 0),
      cashAmount,
      nonCashAmount,
    },
    paymentSummary: paymentSummaryRows.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      paymentCount: Number(payment.paymentCount),
      transactionCount: Number(payment.transactionCount),
    })),
    total,
    page,
    pageCount,
    pageSize: ADMIN_SALES_PAGE_SIZE,
  };
}


export async function getAdminSalesExportRows(
  auth: AuthContext,
  filters: AdminSalesFilters,
): Promise<AdminSalesExportRow[]> {
  const period = createSalesPeriod(filters.dateRange);
  const { outletIds, conditions } = createSalesConditions({
    auth,
    filters,
    period,
  });

  if (outletIds.length === 0) {
    return [];
  }

  const whereClause = and(...conditions);

  if (!whereClause) {
    return [];
  }

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
      outletCode: outlets.code,
      outletName: outlets.name,
      registerCode: registers.code,
      registerName: registers.name,
      cashierName: users.fullName,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      customerPhone: customers.phone,
    })
    .from(sales)
    .innerJoin(outlets, eq(sales.outletId, outlets.id))
    .innerJoin(registers, eq(sales.registerId, registers.id))
    .innerJoin(users, eq(sales.cashierId, users.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(sales.completedAt), desc(sales.createdAt));

  const saleIds = saleRows.map((sale) => sale.id);

  if (saleIds.length === 0) {
    return [];
  }

  const [paymentRows, itemRows, hardwareJobRows] = await Promise.all([
    db
      .select({
        saleId: payments.saleId,
        method: payments.method,
        amount: payments.amount,
        status: payments.status,
        metadata: payments.metadata,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(inArray(payments.saleId, saleIds))
      .orderBy(asc(payments.createdAt)),

    db
      .select({
        saleId: saleItems.saleId,
        lineNumber: saleItems.lineNumber,
        sku: productItems.sku,
        barcode: productItems.barcode,
        productName: sql<string>`coalesce(${saleItems.snapshot}->>'itemDisplayName', ${saleItems.snapshot}->>'productName', ${productItems.displayName}, ${productMasters.name})`,
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
        sourceId: hardwareJobs.sourceId,
        status: hardwareJobs.status,
        createdAt: hardwareJobs.createdAt,
      })
      .from(hardwareJobs)
      .where(
        and(
          eq(hardwareJobs.organizationId, auth.organization.id),
          eq(hardwareJobs.sourceType, "sale"),
          eq(hardwareJobs.jobType, "print_receipt_certificate"),
          inArray(hardwareJobs.sourceId, saleIds),
        ),
      )
      .orderBy(desc(hardwareJobs.createdAt)),
  ]);

  const paymentsBySaleId = new Map<string, typeof paymentRows>();
  const itemsBySaleId = new Map<string, typeof itemRows>();
  const printStatusBySaleId = new Map<string, AdminSalePrintStatus>();

  for (const payment of paymentRows) {
    const currentPayments = paymentsBySaleId.get(payment.saleId) ?? [];
    currentPayments.push(payment);
    paymentsBySaleId.set(payment.saleId, currentPayments);
  }

  for (const item of itemRows) {
    const currentItems = itemsBySaleId.get(item.saleId) ?? [];
    currentItems.push(item);
    itemsBySaleId.set(item.saleId, currentItems);
  }

  for (const job of hardwareJobRows) {
    if (job.sourceId && !printStatusBySaleId.has(job.sourceId)) {
      printStatusBySaleId.set(job.sourceId, normalizePrintStatus(job.status));
    }
  }

  return saleRows.map((sale): AdminSalesExportRow => {
    const salePayments = paymentsBySaleId.get(sale.id) ?? [];
    const saleItemsRows = itemsBySaleId.get(sale.id) ?? [];
    const paidPayments = salePayments.filter((payment) => payment.status === "paid");
    const refundedPayments = salePayments.filter(
      (payment) => payment.status === "refunded",
    );
    const displayPayments = salePayments.filter(
      (payment) => payment.status === "paid" || payment.status === "refunded",
    );
    const paidAmount = paidPayments.reduce(
      (paymentTotal, payment) => paymentTotal + parseAmount(payment.amount),
      0,
    );
    const refundedAmount = refundedPayments.reduce(
      (paymentTotal, payment) => paymentTotal + parseAmount(payment.amount),
      0,
    );
    const receivedAmount = paidPayments.reduce(
      (paymentTotal, payment) =>
        paymentTotal + (getPaymentMetadataNumber(payment.metadata, "receivedAmount") ?? 0),
      0,
    );
    const changeAmount = paidPayments.reduce(
      (paymentTotal, payment) =>
        paymentTotal + (getPaymentMetadataNumber(payment.metadata, "changeAmount") ?? 0),
      0,
    );
    const paymentMethods = Array.from(
      new Set(displayPayments.map((payment) => payment.method)),
    );

    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      status: sale.status,
      subtotalAmount: sale.subtotalAmount,
      discountAmount: sale.discountAmount,
      additionalFeeAmount: sale.additionalFeeAmount,
      totalAmount: sale.totalAmount,
      paidAmount,
      refundedAmount,
      receivedAmount,
      changeAmount,
      completedAt: sale.completedAt,
      createdAt: sale.createdAt,
      outletCode: sale.outletCode,
      outletName: sale.outletName,
      registerCode: sale.registerCode,
      registerName: sale.registerName,
      cashierName: sale.cashierName,
      customerCode: sale.customerCode,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      totalItems: saleItemsRows.length,
      items: saleItemsRows.map((item) => ({
        productName: item.productName,
        sku: item.sku,
        barcode: item.barcode,
        categoryName: item.categoryName,
        finalPriceAmount: item.finalPriceAmount,
      })),
      paymentMethods,
      printStatus: printStatusBySaleId.get(sale.id) ?? "not_queued",
    };
  });
}

export async function getAdminSaleDetailData({
  auth,
  saleId,
}: {
  auth: AuthContext;
  saleId: string;
}): Promise<AdminSaleDetailData | null> {
  const outletIds = getAccessibleOutletIds(auth, null);

  if (outletIds.length === 0) {
    return null;
  }

  const saleRows = await db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      status: sales.status,
      subtotalAmount: sales.subtotalAmount,
      discountAmount: sales.discountAmount,
      discountReason: sales.discountReason,
      additionalFeeAmount: sales.additionalFeeAmount,
      totalAmount: sales.totalAmount,
      completedAt: sales.completedAt,
      cancelledAt: sales.cancelledAt,
      createdAt: sales.createdAt,
      notes: sales.notes,
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
      registerId: registers.id,
      registerCode: registers.code,
      registerName: registers.name,
      shiftId: shifts.id,
      shiftOpenedAt: shifts.openedAt,
      shiftClosedAt: shifts.closedAt,
      shiftStatus: shifts.status,
      cashierId: users.id,
      cashierName: users.fullName,
      customerId: customers.id,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      customerAddress: customers.address,
    })
    .from(sales)
    .innerJoin(outlets, eq(sales.outletId, outlets.id))
    .innerJoin(registers, eq(sales.registerId, registers.id))
    .innerJoin(users, eq(sales.cashierId, users.id))
    .leftJoin(shifts, eq(sales.shiftId, shifts.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(
      and(
        eq(sales.id, saleId),
        eq(sales.organizationId, auth.organization.id),
        inArray(sales.outletId, outletIds),
      ),
    )
    .limit(1);

  const sale = saleRows[0] ?? null;

  if (!sale) {
    return null;
  }

  const [paymentRows, itemRows, hardwareJobRows, approvalRows, auditLogRows] = await Promise.all([
    db
      .select({
        id: payments.id,
        method: payments.method,
        provider: payments.provider,
        amount: payments.amount,
        status: payments.status,
        providerReference: payments.providerReference,
        paidAt: payments.paidAt,
        verifiedAt: payments.verifiedAt,
        metadata: payments.metadata,
      })
      .from(payments)
      .where(eq(payments.saleId, sale.id))
      .orderBy(asc(payments.createdAt)),

    db
      .select({
        id: saleItems.id,
        productItemId: saleItems.productItemId,
        lineNumber: saleItems.lineNumber,
        sku: productItems.sku,
        barcode: productItems.barcode,
        serialNumber: productItems.serialNumber,
        productName: sql<string>`coalesce(${saleItems.snapshot}->>'productName', ${productItems.displayName}, ${productMasters.name})`,
        categoryName: productCategories.name,
        weightGram: productItems.weightGram,
        purityPercent: productItems.purityPercent,
        exchangePurityPercent: productItems.exchangePurityPercent,
        size: productItems.size,
        color: productItems.color,
        gemstone: productItems.gemstone,
        listPriceAmount: saleItems.listPriceAmount,
        discountAmount: saleItems.discountAmount,
        finalPriceAmount: saleItems.finalPriceAmount,
      })
      .from(saleItems)
      .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
      .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
      .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
      .where(eq(saleItems.saleId, sale.id))
      .orderBy(asc(saleItems.lineNumber)),

    db
      .select({
        id: hardwareJobs.id,
        jobType: hardwareJobs.jobType,
        deviceType: hardwareJobs.deviceType,
        status: hardwareJobs.status,
        attempts: hardwareJobs.attempts,
        maxAttempts: hardwareJobs.maxAttempts,
        error: hardwareJobs.error,
        createdAt: hardwareJobs.createdAt,
        updatedAt: hardwareJobs.updatedAt,
        completedAt: hardwareJobs.completedAt,
        failedAt: hardwareJobs.failedAt,
        cancelledAt: hardwareJobs.cancelledAt,
      })
      .from(hardwareJobs)
      .where(
        and(
          eq(hardwareJobs.organizationId, auth.organization.id),
          eq(hardwareJobs.sourceType, "sale"),
          eq(hardwareJobs.sourceId, sale.id),
          eq(hardwareJobs.jobType, "print_receipt_certificate"),
        ),
      )
      .orderBy(desc(hardwareJobs.createdAt))
      .limit(12),

    db
      .select({
        id: approvals.id,
        type: approvals.type,
        status: approvals.status,
        requestedByName: approvalRequestedByUsers.fullName,
        approvedByName: approvalApprovedByUsers.fullName,
        notes: approvals.notes,
        responseNotes: approvals.responseNotes,
        createdAt: approvals.createdAt,
        resolvedAt: approvals.resolvedAt,
        requestData: approvals.requestData,
      })
      .from(approvals)
      .innerJoin(
        approvalRequestedByUsers,
        eq(approvals.requestedBy, approvalRequestedByUsers.id),
      )
      .leftJoin(
        approvalApprovedByUsers,
        eq(approvals.approvedBy, approvalApprovedByUsers.id),
      )
      .where(
        and(
          eq(approvals.organizationId, auth.organization.id),
          eq(approvals.referenceType, "sale"),
          eq(approvals.referenceId, sale.id),
          inArray(approvals.type, ["void_receipt", "refund_transaction"]),
        ),
      )
      .orderBy(desc(approvals.createdAt))
      .limit(8),

    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        reason: auditLogs.reason,
        actorName: users.fullName,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(
        and(
          eq(auditLogs.organizationId, auth.organization.id),
          eq(auditLogs.entityId, sale.id),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(12),
  ]);

  const totalAmount = parseAmount(sale.totalAmount);
  const paidAmount = paymentRows.reduce(
    (paymentTotal, payment) =>
      payment.status === "paid"
        ? paymentTotal + parseAmount(payment.amount)
        : paymentTotal,
    0,
  );
  const receiptUrl =
    sale.status === "completed" ? createReceiptVerificationUrl(sale.id).url : null;
  const paymentStatus = getPaymentStatusFromAmounts(totalAmount, paidAmount);
  const timeline = [
    {
      id: "created",
      label: "Transaksi dibuat",
      description: `${sale.invoiceNumber} dibuat oleh ${sale.cashierName}.`,
      createdAt: sale.createdAt,
      tone: "neutral" as const,
    },
    ...(paymentRows.length > 0
      ? paymentRows.map((payment) => ({
          id: `payment-${payment.id}`,
          label: payment.status === "paid" ? "Pembayaran diterima" : "Pembayaran tercatat",
          description: `${payment.method.replaceAll("_", " ")} sebesar ${payment.amount}.`,
          createdAt: payment.paidAt ?? payment.verifiedAt ?? sale.createdAt,
          tone: payment.status === "paid" ? ("success" as const) : ("warning" as const),
        }))
      : []),
    ...(sale.completedAt
      ? [
          {
            id: "completed",
            label: "Transaksi selesai",
            description: "Stok item sudah keluar dan transaksi masuk ke riwayat penjualan.",
            createdAt: sale.completedAt,
            tone: "success" as const,
          },
        ]
      : []),
    ...(sale.status === "voided" && sale.cancelledAt
      ? [
          {
            id: "voided",
            label: "Transaksi void",
            description: "Transaksi sudah dibatalkan penuh setelah approval void disetujui.",
            createdAt: sale.cancelledAt,
            tone: "danger" as const,
          },
        ]
      : []),
    ...(sale.status === "refunded" && sale.cancelledAt
      ? [
          {
            id: "refunded",
            label: "Refund penuh dieksekusi",
            description: "Transaksi sudah direfund penuh setelah approval refund disetujui.",
            createdAt: sale.cancelledAt,
            tone: "warning" as const,
          },
        ]
      : []),
    ...(hardwareJobRows.length > 0
      ? hardwareJobRows.slice(0, 3).map((job) => ({
          id: `hardware-${job.id}`,
          label: "Print job dokumen",
          description: `${job.jobType.replaceAll("_", " ")} berstatus ${job.status}.`,
          createdAt: job.createdAt,
          tone:
            job.status === "completed"
              ? ("success" as const)
              : job.status === "failed"
                ? ("danger" as const)
                : ("warning" as const),
        }))
      : []),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    status: sale.status,
    subtotalAmount: sale.subtotalAmount,
    discountAmount: sale.discountAmount,
    discountReason: sale.discountReason,
    additionalFeeAmount: sale.additionalFeeAmount,
    totalAmount: sale.totalAmount,
    paidAmount,
    paymentStatus,
    completedAt: sale.completedAt,
    cancelledAt: sale.cancelledAt,
    createdAt: sale.createdAt,
    notes: sale.notes,
    outlet: {
      id: sale.outletId,
      code: sale.outletCode,
      name: sale.outletName,
    },
    register: {
      id: sale.registerId,
      code: sale.registerCode,
      name: sale.registerName,
    },
    shift: {
      id: sale.shiftId ?? "",
      status: sale.shiftStatus,
      openedAt: sale.shiftOpenedAt,
      closedAt: sale.shiftClosedAt,
    },
    cashier: {
      id: sale.cashierId,
      name: sale.cashierName,
    },
    customer: sale.customerId
      ? {
          id: sale.customerId,
          code: sale.customerCode,
          name: sale.customerName ?? "Customer tanpa nama",
          phone: sale.customerPhone,
          email: sale.customerEmail,
          address: sale.customerAddress,
        }
      : null,
    items: itemRows.map((item) => ({
      id: item.id,
      productItemId: item.productItemId,
      lineNumber: item.lineNumber,
      sku: item.sku,
      barcode: item.barcode,
      serialNumber: item.serialNumber,
      productName: item.productName,
      categoryName: item.categoryName,
      weightGram: item.weightGram,
      purityPercent: item.purityPercent,
      exchangePurityPercent: item.exchangePurityPercent,
      size: item.size,
      color: item.color,
      gemstone: item.gemstone,
      listPriceAmount: item.listPriceAmount,
      discountAmount: item.discountAmount,
      finalPriceAmount: item.finalPriceAmount,
    })),
    payments: paymentRows.map((payment) => ({
      id: payment.id,
      method: payment.method,
      provider: payment.provider,
      amount: payment.amount,
      status: payment.status,
      providerReference: payment.providerReference,
      paidAt: payment.paidAt,
      verifiedAt: payment.verifiedAt,
      receivedAmount: getPaymentMetadataNumber(payment.metadata, "receivedAmount"),
      changeAmount: getPaymentMetadataNumber(payment.metadata, "changeAmount"),
      note: getPaymentMetadataString(payment.metadata, "note"),
    })),
    hardwareJobs: hardwareJobRows.map((job) => ({
      id: job.id,
      jobType: job.jobType,
      deviceType: job.deviceType,
      status: normalizePrintStatus(job.status),
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
      cancelledAt: job.cancelledAt,
    })),
    auditLogs: auditLogRows,
    sensitiveApprovals: approvalRows.map((approval) => ({
      id: approval.id,
      type: approval.type as "void_receipt" | "refund_transaction",
      status: approval.status,
      requestedByName: approval.requestedByName,
      approvedByName: approval.approvedByName,
      notes: approval.notes,
      responseNotes: approval.responseNotes,
      createdAt: approval.createdAt,
      resolvedAt: approval.resolvedAt,
      requestData: approval.requestData,
      executionStatus: getSensitiveApprovalExecutionStatus(approval.requestData),
      executedAt: getSensitiveApprovalExecutedAt(approval.requestData),
      executedByName: getApprovalRequestDataString(
        approval.requestData,
        "executedByName",
      ),
    })),
    timeline,
    receiptCertificate: {
      isReady: sale.status === "completed",
      downloadHref: `/api/sales/${sale.id}/receipt-certificate`,
      htmlHref: `/documents/sales/${sale.id}/receipt-certificate-html`,
      verificationUrl: receiptUrl,
    },
  } satisfies AdminSaleDetailData;
}
