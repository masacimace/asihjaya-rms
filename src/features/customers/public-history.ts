import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  buybackItems,
  buybackPayouts,
  buybacks,
  customerDepositLedger,
  customers,
  outlets,
  payments,
  productCategories,
  productItems,
  productMasters,
  saleItems,
  sales,
} from "@/db/schema";
import { getCustomerDepositBalancesForCustomer } from "@/features/customer-deposits/queries";
import {
  verifyPublicHistoryVerificationToken,
  type PublicHistoryTokenVersion,
  type PublicHistoryTransactionKind,
} from "@/features/sales/verification/receipt-token";

const PUBLIC_HISTORY_LIMIT = 50;
const PUBLIC_HISTORY_SALE_STATUSES = [
  "completed",
  "partially_refunded",
  "refunded",
] as const;

type PublicSaleStatus = (typeof PUBLIC_HISTORY_SALE_STATUSES)[number];

export type PublicCustomerHistoryItem = {
  lineNumber: number;
  source: "asihjaya" | "external" | null;
  productName: string;
  productCode: string;
  categoryName: string | null;
  finalAmount: string;
  weightGram: string | null;
  purityPercent: string | null;
  exchangePurityPercent: string | null;
  imageKey: string | null;
};

type PublicCustomerHistoryTransactionBase = {
  id: string;
  transactionNumber: string;
  totalAmount: string;
  completedAt: Date | null;
  createdAt: Date;
  isScannedTransaction: boolean;
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  totalItems: number;
  itemSummary: PublicCustomerHistoryItem[];
  customerDeposit: {
    usedAmount: string;
    inAmount: string;
    balanceAfterAmount: string | null;
    externalPaymentDueAmount: string;
  };
};

export type PublicCustomerHistorySaleTransaction =
  PublicCustomerHistoryTransactionBase & {
    kind: "sale";
    status: PublicSaleStatus;
    subtotalAmount: string;
    discountAmount: string;
    paymentMethods: string[];
  };

export type PublicCustomerHistoryBuybackTransaction =
  PublicCustomerHistoryTransactionBase & {
    kind: "buyback";
    status: "completed";
    baseAmount: string;
    deductionAmount: string;
    payoutMethods: string[];
  };

export type PublicCustomerHistoryTransaction =
  | PublicCustomerHistorySaleTransaction
  | PublicCustomerHistoryBuybackTransaction;

export type PublicCustomerDepositOutletBalance = {
  outletId: string;
  outletCode: string;
  outletName: string;
  balanceAmount: string;
  balance: number;
  lastLedgerEntryAt: Date | null;
};

export type PublicCustomerHistoryData =
  | {
      status: "valid";
      token: string;
      organizationId: string;
      outlet: {
        id: string;
        name: string;
        code: string;
        phone: string | null;
      };
      customer: {
        id: string;
        customerCode: string | null;
        name: string;
        phone: string | null;
      };
      scannedTransaction: PublicCustomerHistoryTransaction;
      summary: {
        totalTransactions: number;
        totalSaleTransactions: number;
        totalBuybackTransactions: number;
        totalPurchases: number;
        totalBuybacks: number;
        totalItems: number;
        lastTransactionAt: Date | null;
      };
      customerDeposit: {
        withdrawalScope: "outlet_only";
        totalBalanceAmount: string;
        totalBalance: number;
        balances: PublicCustomerDepositOutletBalance[];
      };
      transactions: PublicCustomerHistoryTransaction[];
    }
  | {
      status: "no_customer";
      message: string;
      transaction: {
        kind: PublicHistoryTransactionKind;
        transactionNumber: string;
        completedAt: Date | null;
        createdAt: Date;
      };
      outlet: {
        name: string;
        code: string;
        phone: string | null;
      };
    }
  | {
      status: "invalid";
      message: string;
    };

export type PublicCustomerHistoryAccessContext =
  | {
      status: "valid";
      token: string;
      tokenVersion: PublicHistoryTokenVersion;
      organizationId: string;
      outlet: {
        id: string;
        name: string;
        code: string;
        phone: string | null;
      };
      customer: {
        id: string;
        customerCode: string | null;
        name: string;
      };
      transaction: {
        kind: PublicHistoryTransactionKind;
        id: string;
        transactionNumber: string;
        completedAt: Date | null;
        createdAt: Date;
      };
    }
  | Extract<PublicCustomerHistoryData, { status: "invalid" | "no_customer" }>;

type TransactionItemSnapshot = {
  barcode?: unknown;
  qrValue?: unknown;
  serialNumber?: unknown;
  sku?: unknown;
  productCode?: unknown;
  originalProductCode?: unknown;
  productName?: unknown;
  displayName?: unknown;
  originalDisplayName?: unknown;
  itemDisplayName?: unknown;
  masterProductName?: unknown;
  productMasterName?: unknown;
  originalProductMasterName?: unknown;
  categoryName?: unknown;
  weightGram?: unknown;
  purityPercent?: unknown;
  exchangePurityPercent?: unknown;
  imageKey?: unknown;
  productImageKey?: unknown;
};

type PublicHistoryBaseTransaction = {
  tokenVersion: PublicHistoryTokenVersion;
  kind: PublicHistoryTransactionKind;
  id: string;
  organizationId: string;
  outletId: string;
  customerId: string | null;
  transactionNumber: string;
  status: string;
  totalAmount: string;
  subtotalAmount: string | null;
  discountAmount: string | null;
  completedAt: Date | null;
  createdAt: Date;
  outletName: string;
  outletCode: string;
  outletPhone: string | null;
  customerCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

function parseAmount(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getTransactionTime(value: { completedAt: Date | null; createdAt: Date }) {
  return value.completedAt ?? value.createdAt;
}

function hasSameTransactionIdentity(
  firstTransaction: Pick<PublicCustomerHistoryTransactionBase, "id"> & {
    kind: PublicHistoryTransactionKind;
  },
  secondTransaction: Pick<PublicCustomerHistoryTransactionBase, "id"> & {
    kind: PublicHistoryTransactionKind;
  },
) {
  return (
    firstTransaction.kind === secondTransaction.kind &&
    firstTransaction.id === secondTransaction.id
  );
}

function readSnapshotString(
  snapshot: unknown,
  key: keyof TransactionItemSnapshot,
) {
  const value = (snapshot as TransactionItemSnapshot | null)?.[key];

  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || null;
}

function maskPhone(value: string | null | undefined) {
  const phone = value?.replace(/\D/g, "") ?? "";

  if (phone.length < 7) {
    return value ? "***" : null;
  }

  return `${phone.slice(0, 4)}${"*".repeat(Math.max(phone.length - 8, 3))}${phone.slice(-4)}`;
}

function readProductCode({
  fallbackSku,
  snapshot,
}: {
  fallbackSku: string | null;
  snapshot: unknown;
}) {
  return (
    readSnapshotString(snapshot, "barcode") ??
    readSnapshotString(snapshot, "qrValue") ??
    readSnapshotString(snapshot, "serialNumber") ??
    readSnapshotString(snapshot, "sku") ??
    readSnapshotString(snapshot, "productCode") ??
    readSnapshotString(snapshot, "originalProductCode") ??
    fallbackSku ??
    "-"
  );
}

function getPaymentMethodLabel(method: string) {
  const methodLabels: Record<string, string> = {
    bank_transfer: "Transfer",
    cash: "Cash",
    credit_card: "Credit EDC",
    debit_card: "Debit EDC",
    other: "Pembayaran Lain",
    qris_gateway: "QRIS",
    qris_manual: "QRIS",
  };

  return methodLabels[method] ?? method.replaceAll("_", " ");
}

function getBuybackPayoutMethodLabel(method: string) {
  const methodLabels: Record<string, string> = {
    bank_transfer: "Transfer",
    cash: "Cash",
    customer_deposit: "Dana Titip",
  };

  return methodLabels[method] ?? method.replaceAll("_", " ");
}

function isPublicSaleStatus(value: string): value is PublicSaleStatus {
  return PUBLIC_HISTORY_SALE_STATUSES.includes(value as PublicSaleStatus);
}

function createNoCustomerData(
  baseTransaction: PublicHistoryBaseTransaction,
): Extract<PublicCustomerHistoryData, { status: "no_customer" }> {
  return {
    status: "no_customer",
    message:
      "Riwayat transaksi pelanggan tidak tersedia karena transaksi ini dibuat tanpa customer terdaftar.",
    transaction: {
      kind: baseTransaction.kind,
      transactionNumber: baseTransaction.transactionNumber,
      completedAt: baseTransaction.completedAt,
      createdAt: baseTransaction.createdAt,
    },
    outlet: {
      name: baseTransaction.outletName,
      code: baseTransaction.outletCode,
      phone: baseTransaction.outletPhone,
    },
  };
}

async function findPublicHistoryBaseTransaction(
  token: string,
): Promise<PublicHistoryBaseTransaction | null | undefined> {
  const parsedToken = verifyPublicHistoryVerificationToken(token);

  if (!parsedToken) {
    return null;
  }

  if (parsedToken.transactionKind === "buyback") {
    const [baseBuyback] = await db
      .select({
        id: buybacks.id,
        organizationId: buybacks.organizationId,
        outletId: buybacks.outletId,
        customerId: buybacks.customerId,
        transactionNumber: buybacks.buybackNumber,
        status: buybacks.status,
        totalAmount: buybacks.totalAmount,
        completedAt: buybacks.completedAt,
        createdAt: buybacks.createdAt,
        outletName: outlets.name,
        outletCode: outlets.code,
        outletPhone: outlets.phone,
        customerCode: customers.customerCode,
        customerName: customers.fullName,
        customerPhone: customers.phone,
      })
      .from(buybacks)
      .innerJoin(outlets, eq(buybacks.outletId, outlets.id))
      .leftJoin(customers, eq(buybacks.customerId, customers.id))
      .where(eq(buybacks.id, parsedToken.transactionId))
      .limit(1);

    if (!baseBuyback) {
      return undefined;
    }

    return {
      tokenVersion: parsedToken.version,
      kind: "buyback",
      ...baseBuyback,
      subtotalAmount: null,
      discountAmount: null,
    };
  }

  const [baseSale] = await db
    .select({
      id: sales.id,
      organizationId: sales.organizationId,
      outletId: sales.outletId,
      customerId: sales.customerId,
      transactionNumber: sales.invoiceNumber,
      status: sales.status,
      totalAmount: sales.totalAmount,
      subtotalAmount: sales.subtotalAmount,
      discountAmount: sales.discountAmount,
      completedAt: sales.completedAt,
      createdAt: sales.createdAt,
      outletName: outlets.name,
      outletCode: outlets.code,
      outletPhone: outlets.phone,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      customerPhone: customers.phone,
    })
    .from(sales)
    .innerJoin(outlets, eq(sales.outletId, outlets.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(eq(sales.id, parsedToken.transactionId))
    .limit(1);

  if (!baseSale) {
    return undefined;
  }

  return {
    tokenVersion: parsedToken.version,
    kind: "sale",
    ...baseSale,
  };
}

export async function getPublicCustomerHistoryAccessContext(
  token: string,
): Promise<PublicCustomerHistoryAccessContext> {
  const baseTransaction = await findPublicHistoryBaseTransaction(token);

  if (baseTransaction === null) {
    return {
      status: "invalid",
      message: "Kode QR nota tidak valid atau sudah berubah.",
    };
  }

  if (!baseTransaction) {
    return {
      status: "invalid",
      message: "Transaksi tidak ditemukan di sistem Asihjaya.",
    };
  }

  if (!baseTransaction.customerId || !baseTransaction.customerName) {
    return createNoCustomerData(baseTransaction);
  }

  return {
    status: "valid",
    token,
    tokenVersion: baseTransaction.tokenVersion,
    organizationId: baseTransaction.organizationId,
    outlet: {
      id: baseTransaction.outletId,
      name: baseTransaction.outletName,
      code: baseTransaction.outletCode,
      phone: baseTransaction.outletPhone,
    },
    customer: {
      id: baseTransaction.customerId,
      customerCode: baseTransaction.customerCode,
      name: baseTransaction.customerName,
    },
    transaction: {
      kind: baseTransaction.kind,
      id: baseTransaction.id,
      transactionNumber: baseTransaction.transactionNumber,
      completedAt: baseTransaction.completedAt,
      createdAt: baseTransaction.createdAt,
    },
  };
}

export async function getPublicCustomerHistoryData(
  token: string,
  authorizedCustomerId: string,
): Promise<PublicCustomerHistoryData> {
  const baseTransaction = await findPublicHistoryBaseTransaction(token);

  if (baseTransaction === null) {
    return {
      status: "invalid",
      message: "Kode QR nota tidak valid atau sudah berubah.",
    };
  }

  if (!baseTransaction) {
    return {
      status: "invalid",
      message: "Transaksi tidak ditemukan di sistem Asihjaya.",
    };
  }

  if (!baseTransaction.customerId || !baseTransaction.customerName) {
    return createNoCustomerData(baseTransaction);
  }

  if (baseTransaction.customerId !== authorizedCustomerId) {
    return {
      status: "invalid",
      message: "Sesi pelanggan tidak sesuai dengan nota yang dipindai.",
    };
  }

  const [saleRows, buybackRows, organizationOutletRows] = await Promise.all([
    db
      .select({
        id: sales.id,
        transactionNumber: sales.invoiceNumber,
        status: sales.status,
        totalAmount: sales.totalAmount,
        subtotalAmount: sales.subtotalAmount,
        discountAmount: sales.discountAmount,
        completedAt: sales.completedAt,
        createdAt: sales.createdAt,
        outletId: outlets.id,
        outletCode: outlets.code,
        outletName: outlets.name,
      })
      .from(sales)
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .where(
        and(
          eq(sales.organizationId, baseTransaction.organizationId),
          eq(sales.customerId, baseTransaction.customerId),
          inArray(sales.status, [...PUBLIC_HISTORY_SALE_STATUSES]),
        ),
      )
      .orderBy(desc(sales.completedAt), desc(sales.createdAt))
      .limit(PUBLIC_HISTORY_LIMIT),

    db
      .select({
        id: buybacks.id,
        transactionNumber: buybacks.buybackNumber,
        status: buybacks.status,
        totalAmount: buybacks.totalAmount,
        completedAt: buybacks.completedAt,
        createdAt: buybacks.createdAt,
        outletId: outlets.id,
        outletCode: outlets.code,
        outletName: outlets.name,
      })
      .from(buybacks)
      .innerJoin(outlets, eq(buybacks.outletId, outlets.id))
      .where(
        and(
          eq(buybacks.organizationId, baseTransaction.organizationId),
          eq(buybacks.customerId, baseTransaction.customerId),
          eq(buybacks.status, "completed"),
        ),
      )
      .orderBy(desc(buybacks.completedAt), desc(buybacks.createdAt))
      .limit(PUBLIC_HISTORY_LIMIT),

    db
      .select({ id: outlets.id })
      .from(outlets)
      .where(eq(outlets.organizationId, baseTransaction.organizationId)),
  ]);

  if (
    baseTransaction.kind === "sale" &&
    isPublicSaleStatus(baseTransaction.status) &&
    !saleRows.some((sale) => sale.id === baseTransaction.id)
  ) {
    saleRows.push({
      id: baseTransaction.id,
      transactionNumber: baseTransaction.transactionNumber,
      status: baseTransaction.status,
      totalAmount: baseTransaction.totalAmount,
      subtotalAmount: baseTransaction.subtotalAmount ?? "0",
      discountAmount: baseTransaction.discountAmount ?? "0",
      completedAt: baseTransaction.completedAt,
      createdAt: baseTransaction.createdAt,
      outletId: baseTransaction.outletId,
      outletCode: baseTransaction.outletCode,
      outletName: baseTransaction.outletName,
    });
  }

  if (
    baseTransaction.kind === "buyback" &&
    baseTransaction.status === "completed" &&
    !buybackRows.some((buyback) => buyback.id === baseTransaction.id)
  ) {
    buybackRows.push({
      id: baseTransaction.id,
      transactionNumber: baseTransaction.transactionNumber,
      status: "completed",
      totalAmount: baseTransaction.totalAmount,
      completedAt: baseTransaction.completedAt,
      createdAt: baseTransaction.createdAt,
      outletId: baseTransaction.outletId,
      outletCode: baseTransaction.outletCode,
      outletName: baseTransaction.outletName,
    });
  }

  const saleIds = saleRows.map((sale) => sale.id);
  const buybackIds = buybackRows.map((buyback) => buyback.id);

  const [
    saleItemRows,
    paymentRows,
    saleDepositRows,
    buybackItemRows,
    payoutRows,
    buybackDepositRows,
    outletBalances,
  ] = await Promise.all([
    saleIds.length > 0
      ? db
          .select({
            saleId: saleItems.saleId,
            lineNumber: saleItems.lineNumber,
            finalAmount: saleItems.finalPriceAmount,
            snapshot: saleItems.snapshot,
            sku: productItems.sku,
            productItemImageKey: productItems.imageKey,
            productMasterImageKey: productMasters.imageKey,
            productName: sql<string>`coalesce(nullif(${saleItems.snapshot}->>'itemDisplayName', ''), nullif(${saleItems.snapshot}->>'productName', ''), nullif(${saleItems.snapshot}->>'masterProductName', ''), ${productItems.displayName}, ${productMasters.name})`,
            categoryName: sql<string | null>`coalesce(nullif(${saleItems.snapshot}->>'categoryName', ''), ${productCategories.name})`,
          })
          .from(saleItems)
          .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
          .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
          .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
          .where(inArray(saleItems.saleId, saleIds))
          .orderBy(asc(saleItems.lineNumber))
      : [],

    saleIds.length > 0
      ? db
          .select({
            saleId: payments.saleId,
            method: payments.method,
            status: payments.status,
          })
          .from(payments)
          .where(inArray(payments.saleId, saleIds))
          .orderBy(asc(payments.createdAt))
      : [],

    saleIds.length > 0
      ? db
          .select({
            saleId: customerDepositLedger.saleId,
            entryType: customerDepositLedger.entryType,
            direction: customerDepositLedger.direction,
            amount: customerDepositLedger.amount,
            balanceAfter: customerDepositLedger.balanceAfter,
            occurredAt: customerDepositLedger.occurredAt,
            createdAt: customerDepositLedger.createdAt,
          })
          .from(customerDepositLedger)
          .where(
            and(
              eq(
                customerDepositLedger.organizationId,
                baseTransaction.organizationId,
              ),
              eq(customerDepositLedger.customerId, baseTransaction.customerId),
              inArray(customerDepositLedger.saleId, saleIds),
            ),
          )
          .orderBy(
            asc(customerDepositLedger.occurredAt),
            asc(customerDepositLedger.createdAt),
          )
      : [],

    buybackIds.length > 0
      ? db
          .select({
            buybackId: buybackItems.buybackId,
            lineNumber: buybackItems.lineNumber,
            source: buybackItems.source,
            baseAmount: buybackItems.baseAmount,
            deductionAmount: buybackItems.deductionAmount,
            finalAmount: buybackItems.finalAmount,
            weightGram: buybackItems.weightGram,
            purityPercent: buybackItems.purityPercent,
            exchangePurityPercent: buybackItems.exchangePurityPercent,
            snapshot: buybackItems.snapshot,
            sku: productItems.sku,
            productItemImageKey: productItems.imageKey,
            productMasterImageKey: productMasters.imageKey,
            productName: sql<string>`coalesce(nullif(${buybackItems.snapshot}->>'displayName', ''), nullif(${buybackItems.snapshot}->>'productMasterName', ''), nullif(${buybackItems.snapshot}->>'originalProductMasterName', ''), nullif(${buybackItems.snapshot}->>'originalDisplayName', ''), ${productItems.displayName}, ${productMasters.name}, 'Barang Buyback')`,
            categoryName: sql<string | null>`coalesce(nullif(${buybackItems.snapshot}->>'categoryName', ''), ${productCategories.name})`,
          })
          .from(buybackItems)
          .leftJoin(productItems, eq(buybackItems.productItemId, productItems.id))
          .leftJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
          .leftJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
          .where(inArray(buybackItems.buybackId, buybackIds))
          .orderBy(asc(buybackItems.lineNumber))
      : [],

    buybackIds.length > 0
      ? db
          .select({
            buybackId: buybackPayouts.buybackId,
            method: buybackPayouts.method,
            amount: buybackPayouts.amount,
            createdAt: buybackPayouts.createdAt,
          })
          .from(buybackPayouts)
          .where(inArray(buybackPayouts.buybackId, buybackIds))
          .orderBy(asc(buybackPayouts.createdAt))
      : [],

    buybackIds.length > 0
      ? db
          .select({
            buybackId: customerDepositLedger.referenceId,
            entryType: customerDepositLedger.entryType,
            direction: customerDepositLedger.direction,
            amount: customerDepositLedger.amount,
            balanceAfter: customerDepositLedger.balanceAfter,
            occurredAt: customerDepositLedger.occurredAt,
            createdAt: customerDepositLedger.createdAt,
          })
          .from(customerDepositLedger)
          .where(
            and(
              eq(
                customerDepositLedger.organizationId,
                baseTransaction.organizationId,
              ),
              eq(customerDepositLedger.customerId, baseTransaction.customerId),
              eq(customerDepositLedger.referenceType, "buyback"),
              eq(customerDepositLedger.entryType, "deposit_in"),
              eq(customerDepositLedger.direction, "credit"),
              inArray(customerDepositLedger.referenceId, buybackIds),
            ),
          )
          .orderBy(
            asc(customerDepositLedger.occurredAt),
            asc(customerDepositLedger.createdAt),
          )
      : [],

    getCustomerDepositBalancesForCustomer({
      organizationId: baseTransaction.organizationId,
      customerId: baseTransaction.customerId,
      outletIds: organizationOutletRows.map((outlet) => outlet.id),
    }),
  ]);

  const saleItemsBySaleId = new Map<string, typeof saleItemRows>();
  const paymentsBySaleId = new Map<string, typeof paymentRows>();
  const saleDepositsBySaleId = new Map<string, typeof saleDepositRows>();
  const buybackItemsByBuybackId = new Map<string, typeof buybackItemRows>();
  const payoutsByBuybackId = new Map<string, typeof payoutRows>();
  const buybackDepositsByBuybackId = new Map<string, typeof buybackDepositRows>();

  for (const item of saleItemRows) {
    const currentItems = saleItemsBySaleId.get(item.saleId) ?? [];
    currentItems.push(item);
    saleItemsBySaleId.set(item.saleId, currentItems);
  }

  for (const payment of paymentRows) {
    const currentPayments = paymentsBySaleId.get(payment.saleId) ?? [];
    currentPayments.push(payment);
    paymentsBySaleId.set(payment.saleId, currentPayments);
  }

  for (const deposit of saleDepositRows) {
    if (!deposit.saleId) {
      continue;
    }

    const currentDeposits = saleDepositsBySaleId.get(deposit.saleId) ?? [];
    currentDeposits.push(deposit);
    saleDepositsBySaleId.set(deposit.saleId, currentDeposits);
  }

  for (const item of buybackItemRows) {
    const currentItems = buybackItemsByBuybackId.get(item.buybackId) ?? [];
    currentItems.push(item);
    buybackItemsByBuybackId.set(item.buybackId, currentItems);
  }

  for (const payout of payoutRows) {
    const currentPayouts = payoutsByBuybackId.get(payout.buybackId) ?? [];
    currentPayouts.push(payout);
    payoutsByBuybackId.set(payout.buybackId, currentPayouts);
  }

  for (const deposit of buybackDepositRows) {
    if (!deposit.buybackId) {
      continue;
    }

    const currentDeposits =
      buybackDepositsByBuybackId.get(deposit.buybackId) ?? [];
    currentDeposits.push(deposit);
    buybackDepositsByBuybackId.set(deposit.buybackId, currentDeposits);
  }

  const saleTransactions = saleRows.map(
    (sale): PublicCustomerHistorySaleTransaction => {
      const items = saleItemsBySaleId.get(sale.id) ?? [];
      const paidPayments = (paymentsBySaleId.get(sale.id) ?? []).filter(
        (payment) => payment.status === "paid",
      );
      const depositEntries = saleDepositsBySaleId.get(sale.id) ?? [];
      const customerDepositUsedAmount = depositEntries
        .filter(
          (entry) =>
            entry.entryType === "deposit_used" && entry.direction === "debit",
        )
        .reduce((total, entry) => total + parseAmount(entry.amount), 0);
      const customerDepositInAmount = depositEntries
        .filter(
          (entry) =>
            entry.entryType === "deposit_in" && entry.direction === "credit",
        )
        .reduce((total, entry) => total + parseAmount(entry.amount), 0);
      const lastCustomerDepositEntry = depositEntries.at(-1) ?? null;
      const externalPaymentDueAmount = Math.max(
        parseAmount(sale.totalAmount) -
          customerDepositUsedAmount +
          customerDepositInAmount,
        0,
      );
      const paymentMethods = Array.from(
        new Set(
          paidPayments.map((payment) => getPaymentMethodLabel(payment.method)),
        ),
      );

      if (customerDepositUsedAmount > 0) {
        paymentMethods.push("Dana Titip");
      }

      return {
        kind: "sale",
        id: sale.id,
        transactionNumber: sale.transactionNumber,
        status: sale.status as PublicSaleStatus,
        totalAmount: sale.totalAmount,
        subtotalAmount: sale.subtotalAmount,
        discountAmount: sale.discountAmount,
        completedAt: sale.completedAt,
        createdAt: sale.createdAt,
        isScannedTransaction:
          baseTransaction.kind === "sale" && sale.id === baseTransaction.id,
        outlet: {
          id: sale.outletId,
          code: sale.outletCode,
          name: sale.outletName,
        },
        totalItems: items.length,
        itemSummary: items.map((item) => ({
          lineNumber: item.lineNumber,
          source: null,
          productName: item.productName,
          productCode: readProductCode({
            fallbackSku: item.sku,
            snapshot: item.snapshot,
          }),
          categoryName: item.categoryName,
          finalAmount: item.finalAmount,
          weightGram: readSnapshotString(item.snapshot, "weightGram"),
          purityPercent: readSnapshotString(item.snapshot, "purityPercent"),
          exchangePurityPercent: readSnapshotString(
            item.snapshot,
            "exchangePurityPercent",
          ),
          imageKey:
            readSnapshotString(item.snapshot, "imageKey") ??
            readSnapshotString(item.snapshot, "productImageKey") ??
            item.productItemImageKey ??
            item.productMasterImageKey,
        })),
        paymentMethods,
        customerDeposit: {
          usedAmount: String(customerDepositUsedAmount),
          inAmount: String(customerDepositInAmount),
          balanceAfterAmount: lastCustomerDepositEntry?.balanceAfter ?? null,
          externalPaymentDueAmount: String(externalPaymentDueAmount),
        },
      };
    },
  );

  const buybackTransactions = buybackRows.map(
    (buyback): PublicCustomerHistoryBuybackTransaction => {
      const items = buybackItemsByBuybackId.get(buyback.id) ?? [];
      const payouts = payoutsByBuybackId.get(buyback.id) ?? [];
      const depositEntries = buybackDepositsByBuybackId.get(buyback.id) ?? [];
      const baseAmount = items.reduce(
        (total, item) => total + parseAmount(item.baseAmount),
        0,
      );
      const deductionAmount = items.reduce(
        (total, item) => total + parseAmount(item.deductionAmount),
        0,
      );
      const customerDepositInAmount = payouts
        .filter((payout) => payout.method === "customer_deposit")
        .reduce((total, payout) => total + parseAmount(payout.amount), 0);
      const externalPayoutAmount = payouts
        .filter((payout) => payout.method !== "customer_deposit")
        .reduce((total, payout) => total + parseAmount(payout.amount), 0);
      const lastCustomerDepositEntry = depositEntries.at(-1) ?? null;
      const payoutMethods = Array.from(
        new Set(
          payouts.map((payout) => getBuybackPayoutMethodLabel(payout.method)),
        ),
      );

      return {
        kind: "buyback",
        id: buyback.id,
        transactionNumber: buyback.transactionNumber,
        status: "completed",
        totalAmount: buyback.totalAmount,
        baseAmount: String(baseAmount),
        deductionAmount: String(deductionAmount),
        completedAt: buyback.completedAt,
        createdAt: buyback.createdAt,
        isScannedTransaction:
          baseTransaction.kind === "buyback" && buyback.id === baseTransaction.id,
        outlet: {
          id: buyback.outletId,
          code: buyback.outletCode,
          name: buyback.outletName,
        },
        totalItems: items.length,
        itemSummary: items.map((item) => ({
          lineNumber: item.lineNumber,
          source: item.source,
          productName: item.productName,
          productCode: readProductCode({
            fallbackSku: item.sku,
            snapshot: item.snapshot,
          }),
          categoryName: item.categoryName,
          finalAmount: item.finalAmount,
          weightGram:
            readSnapshotString(item.snapshot, "weightGram") ?? item.weightGram,
          purityPercent:
            readSnapshotString(item.snapshot, "purityPercent") ??
            item.purityPercent,
          exchangePurityPercent:
            readSnapshotString(item.snapshot, "exchangePurityPercent") ??
            item.exchangePurityPercent,
          imageKey:
            readSnapshotString(item.snapshot, "imageKey") ??
            readSnapshotString(item.snapshot, "productImageKey") ??
            item.productItemImageKey ??
            item.productMasterImageKey,
        })),
        payoutMethods,
        customerDeposit: {
          usedAmount: "0",
          inAmount: String(customerDepositInAmount),
          balanceAfterAmount: lastCustomerDepositEntry?.balanceAfter ?? null,
          externalPaymentDueAmount: String(externalPayoutAmount),
        },
      };
    },
  );

  const allTransactions = [...saleTransactions, ...buybackTransactions].sort(
    (firstTransaction, secondTransaction) =>
      getTransactionTime(secondTransaction).getTime() -
      getTransactionTime(firstTransaction).getTime(),
  );
  const scannedTransaction = allTransactions.find(
    (transaction) => transaction.isScannedTransaction,
  );

  if (!scannedTransaction) {
    return {
      status: "invalid",
      message: "Nota belum selesai, sudah dibatalkan, atau tidak dapat ditampilkan.",
    };
  }

  const recentTransactions = allTransactions.slice(0, PUBLIC_HISTORY_LIMIT);
  const transactions = recentTransactions.some((transaction) =>
    hasSameTransactionIdentity(transaction, scannedTransaction),
  )
    ? recentTransactions
    : [
        scannedTransaction,
        ...recentTransactions
          .filter(
            (transaction) =>
              !hasSameTransactionIdentity(transaction, scannedTransaction),
          )
          .slice(0, PUBLIC_HISTORY_LIMIT - 1),
      ];

  const positiveOutletBalances = outletBalances
    .filter((balance) => balance.balance > 0)
    .sort((firstBalance, secondBalance) =>
      firstBalance.outletName.localeCompare(secondBalance.outletName, "id-ID"),
    )
    .map(
      (balance): PublicCustomerDepositOutletBalance => ({
        outletId: balance.outletId,
        outletCode: balance.outletCode,
        outletName: balance.outletName,
        balanceAmount: balance.balanceAmount,
        balance: balance.balance,
        lastLedgerEntryAt: balance.lastLedgerEntryAt,
      }),
    );
  const customerDepositTotalBalance = positiveOutletBalances.reduce(
    (total, balance) => total + balance.balance,
    0,
  );
  const totalPurchases = transactions
    .filter(
      (transaction): transaction is PublicCustomerHistorySaleTransaction =>
        transaction.kind === "sale",
    )
    .reduce(
      (total, transaction) => total + parseAmount(transaction.totalAmount),
      0,
    );
  const totalBuybacks = transactions
    .filter(
      (transaction): transaction is PublicCustomerHistoryBuybackTransaction =>
        transaction.kind === "buyback",
    )
    .reduce(
      (total, transaction) => total + parseAmount(transaction.totalAmount),
      0,
    );
  const totalItems = transactions.reduce(
    (total, transaction) => total + transaction.totalItems,
    0,
  );
  const lastTransaction = allTransactions[0] ?? null;

  return {
    status: "valid",
    token,
    organizationId: baseTransaction.organizationId,
    outlet: {
      id: baseTransaction.outletId,
      name: baseTransaction.outletName,
      code: baseTransaction.outletCode,
      phone: baseTransaction.outletPhone,
    },
    customer: {
      id: baseTransaction.customerId,
      customerCode: baseTransaction.customerCode,
      name: baseTransaction.customerName,
      phone: maskPhone(baseTransaction.customerPhone),
    },
    scannedTransaction,
    summary: {
      totalTransactions: transactions.length,
      totalSaleTransactions: transactions.filter(
        (transaction) => transaction.kind === "sale",
      ).length,
      totalBuybackTransactions: transactions.filter(
        (transaction) => transaction.kind === "buyback",
      ).length,
      totalPurchases,
      totalBuybacks,
      totalItems,
      lastTransactionAt: lastTransaction
        ? getTransactionTime(lastTransaction)
        : null,
    },
    customerDeposit: {
      withdrawalScope: "outlet_only",
      totalBalanceAmount: String(customerDepositTotalBalance),
      totalBalance: customerDepositTotalBalance,
      balances: positiveOutletBalances,
    },
    transactions,
  };
}

export function getPublicCustomerHistoryImageUrl({
  imageKey,
  token,
}: {
  imageKey: string | null;
  token: string;
}) {
  if (!imageKey) {
    return null;
  }

  const normalizedKey = imageKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/v/${encodeURIComponent(token)}/image/${normalizedKey}`;
}
