import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  customers,
  outlets,
  payments,
  productCategories,
  productItems,
  productMasters,
  saleItems,
  sales,
} from "@/db/schema";
import { verifyReceiptVerificationToken } from "@/features/sales/verification/receipt-token";

const PUBLIC_HISTORY_LIMIT = 50;
const PUBLIC_HISTORY_SALE_STATUSES = [
  "completed",
  "partially_refunded",
  "refunded",
] as const;

export type PublicCustomerHistoryData =
  | {
      status: "valid";
      token: string;
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
      scannedSale: PublicCustomerHistoryTransaction;
      summary: {
        totalTransactions: number;
        totalSpent: number;
        totalItems: number;
        lastTransactionAt: Date | null;
      };
      transactions: PublicCustomerHistoryTransaction[];
    }
  | {
      status: "no_customer";
      message: string;
      sale: {
        invoiceNumber: string;
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

export type PublicCustomerHistoryTransaction = {
  id: string;
  invoiceNumber: string;
  status: "completed" | "partially_refunded" | "refunded";
  totalAmount: string;
  subtotalAmount: string;
  discountAmount: string;
  completedAt: Date | null;
  createdAt: Date;
  isScannedSale: boolean;
  totalItems: number;
  itemSummary: Array<{
    lineNumber: number;
    productName: string;
    productCode: string;
    categoryName: string | null;
    finalPriceAmount: string;
    weightGram: string | null;
    purityPercent: string | null;
    exchangePurityPercent: string | null;
    imageKey: string | null;
  }>;
  paymentMethods: string[];
};

type SaleItemSnapshot = {
  barcode?: unknown;
  qrValue?: unknown;
  serialNumber?: unknown;
  sku?: unknown;
  productCode?: unknown;
  productName?: unknown;
  itemDisplayName?: unknown;
  masterProductName?: unknown;
  categoryName?: unknown;
  weightGram?: unknown;
  purityPercent?: unknown;
  exchangePurityPercent?: unknown;
  imageKey?: unknown;
  productImageKey?: unknown;
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

function readSnapshotString(snapshot: unknown, key: keyof SaleItemSnapshot) {
  const value = (snapshot as SaleItemSnapshot | null)?.[key];

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

export async function getPublicCustomerHistoryData(
  token: string,
): Promise<PublicCustomerHistoryData> {
  const parsedToken = verifyReceiptVerificationToken(token);

  if (!parsedToken) {
    return {
      status: "invalid",
      message: "Kode QR nota tidak valid atau sudah berubah.",
    };
  }

  const [baseSale] = await db
    .select({
      id: sales.id,
      organizationId: sales.organizationId,
      outletId: sales.outletId,
      customerId: sales.customerId,
      invoiceNumber: sales.invoiceNumber,
      status: sales.status,
      totalAmount: sales.totalAmount,
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
    .where(eq(sales.id, parsedToken.saleId))
    .limit(1);

  if (!baseSale) {
    return {
      status: "invalid",
      message: "Nota tidak ditemukan di sistem Asihjaya.",
    };
  }

  if (!baseSale.customerId || !baseSale.customerName) {
    return {
      status: "no_customer",
      message:
        "Riwayat transaksi pelanggan tidak tersedia karena nota ini dibuat tanpa customer terdaftar.",
      sale: {
        invoiceNumber: baseSale.invoiceNumber,
        completedAt: baseSale.completedAt,
        createdAt: baseSale.createdAt,
      },
      outlet: {
        name: baseSale.outletName,
        code: baseSale.outletCode,
        phone: baseSale.outletPhone,
      },
    };
  }

  const saleRows = await db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      status: sales.status,
      totalAmount: sales.totalAmount,
      subtotalAmount: sales.subtotalAmount,
      discountAmount: sales.discountAmount,
      completedAt: sales.completedAt,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .where(
      and(
        eq(sales.organizationId, baseSale.organizationId),
        eq(sales.outletId, baseSale.outletId),
        eq(sales.customerId, baseSale.customerId),
        inArray(sales.status, [...PUBLIC_HISTORY_SALE_STATUSES]),
      ),
    )
    .orderBy(desc(sales.completedAt), desc(sales.createdAt))
    .limit(PUBLIC_HISTORY_LIMIT);

  const saleIds = saleRows.map((sale) => sale.id);

  const [itemRows, paymentRows] =
    saleIds.length > 0
      ? await Promise.all([
          db
            .select({
              saleId: saleItems.saleId,
              lineNumber: saleItems.lineNumber,
              finalPriceAmount: saleItems.finalPriceAmount,
              snapshot: saleItems.snapshot,
              sku: productItems.sku,
              productItemImageKey: productItems.imageKey,
              productMasterImageKey: productMasters.imageKey,
              productName: sql<string>`coalesce(${saleItems.snapshot}->>'productName', ${saleItems.snapshot}->>'itemDisplayName', ${productItems.displayName}, ${productMasters.name})`,
              categoryName: sql<string | null>`coalesce(${saleItems.snapshot}->>'categoryName', ${productCategories.name})`,
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

  const transactions = saleRows.map((sale): PublicCustomerHistoryTransaction => {
    const items = itemsBySaleId.get(sale.id) ?? [];
    const paidPayments = (paymentsBySaleId.get(sale.id) ?? []).filter(
      (payment) => payment.status === "paid",
    );

    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      status: sale.status as PublicCustomerHistoryTransaction["status"],
      totalAmount: sale.totalAmount,
      subtotalAmount: sale.subtotalAmount,
      discountAmount: sale.discountAmount,
      completedAt: sale.completedAt,
      createdAt: sale.createdAt,
      isScannedSale: sale.id === parsedToken.saleId,
      totalItems: items.length,
      itemSummary: items.slice(0, 4).map((item) => ({
        lineNumber: item.lineNumber,
        productName: item.productName,
        productCode: readProductCode({
          fallbackSku: item.sku,
          snapshot: item.snapshot,
        }),
        categoryName: item.categoryName,
        finalPriceAmount: item.finalPriceAmount,
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
      paymentMethods: Array.from(
        new Set(paidPayments.map((payment) => getPaymentMethodLabel(payment.method))),
      ),
    };
  });

  const totalSpent = transactions.reduce(
    (total, transaction) => total + parseAmount(transaction.totalAmount),
    0,
  );
  const totalItems = transactions.reduce(
    (total, transaction) => total + transaction.totalItems,
    0,
  );
  const lastTransaction = transactions[0] ?? null;
  const scannedSale = transactions.find((sale) => sale.isScannedSale);

  if (!scannedSale) {
    return {
      status: "invalid",
      message: "Nota belum selesai, sudah dibatalkan, atau tidak dapat ditampilkan.",
    };
  }

  return {
    status: "valid",
    token,
    outlet: {
      id: baseSale.outletId,
      name: baseSale.outletName,
      code: baseSale.outletCode,
      phone: baseSale.outletPhone,
    },
    customer: {
      id: baseSale.customerId,
      customerCode: baseSale.customerCode,
      name: baseSale.customerName,
      phone: maskPhone(baseSale.customerPhone),
    },
    scannedSale,
    summary: {
      totalTransactions: transactions.length,
      totalSpent,
      totalItems,
      lastTransactionAt: lastTransaction
        ? getTransactionTime(lastTransaction)
        : null,
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
