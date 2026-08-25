import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  buybackItems,
  buybackPayouts,
  buybacks,
  customerDepositLedger,
  customers,
  organizations,
  outlets,
  productItems,
  productMasters,
  registers,
  users,
} from "@/db/schema";
import type { ReceiptCertificateData } from "@/features/sales/documents/receipt-certificate";

function readSnapshotString(
  snapshot: Record<string, unknown>,
  key: string,
): string | null {
  const value = snapshot[key];
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function getBuybackDetailQrValue({
  buybackId,
  buybackNumber,
}: {
  buybackId: string;
  buybackNumber: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return `BUYBACK:${buybackNumber}`;
  }
  return `${baseUrl}/pos/buyback?detail=${encodeURIComponent(buybackId)}`;
}

export async function getBuybackReceiptData({
  buybackId,
  organizationId,
}: {
  buybackId: string;
  organizationId: string;
}): Promise<ReceiptCertificateData | null> {
  const [row] = await db
    .select({
      id: buybacks.id,
      organizationId: buybacks.organizationId,
      buybackNumber: buybacks.buybackNumber,
      status: buybacks.status,
      totalAmount: buybacks.totalAmount,
      notes: buybacks.notes,
      completedAt: buybacks.completedAt,
      organizationName: organizations.name,
      organizationTimezone: organizations.timezone,
      organizationCurrency: organizations.currency,
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
      outletAddress: outlets.address,
      outletPhone: outlets.phone,
      registerCode: registers.code,
      registerName: registers.name,
      processedByName: users.fullName,
      customerId: customers.id,
      customerName: customers.fullName,
      customerPhone: customers.phone,
    })
    .from(buybacks)
    .innerJoin(organizations, eq(buybacks.organizationId, organizations.id))
    .innerJoin(outlets, eq(buybacks.outletId, outlets.id))
    .innerJoin(registers, eq(buybacks.registerId, registers.id))
    .innerJoin(users, eq(buybacks.processedBy, users.id))
    .innerJoin(customers, eq(buybacks.customerId, customers.id))
    .where(
      and(
        eq(buybacks.id, buybackId),
        eq(buybacks.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!row || row.status !== "completed") {
    return null;
  }

  const [items, payouts, depositRows] = await Promise.all([
    db
      .select({
        lineNumber: buybackItems.lineNumber,
        baseAmount: buybackItems.baseAmount,
        deductionAmount: buybackItems.deductionAmount,
        finalAmount: buybackItems.finalAmount,
        buybackPricePerGram: buybackItems.buybackPricePerGram,
        deductionPerGram: buybackItems.deductionPerGram,
        weightGram: buybackItems.weightGram,
        purityPercent: buybackItems.purityPercent,
        exchangePurityPercent: buybackItems.exchangePurityPercent,
        snapshot: buybackItems.snapshot,
        currentDisplayName: productItems.displayName,
        currentSku: productItems.sku,
        currentBarcode: productItems.barcode,
        currentQrValue: productItems.qrValue,
        itemImageKey: productItems.imageKey,
        masterName: productMasters.name,
        masterImageKey: productMasters.imageKey,
      })
      .from(buybackItems)
      .innerJoin(productItems, eq(buybackItems.productItemId, productItems.id))
      .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
      .where(eq(buybackItems.buybackId, buybackId))
      .orderBy(asc(buybackItems.lineNumber)),
    db
      .select({
        method: buybackPayouts.method,
        amount: buybackPayouts.amount,
        reference: buybackPayouts.reference,
        metadata: buybackPayouts.metadata,
        createdAt: buybackPayouts.createdAt,
      })
      .from(buybackPayouts)
      .where(eq(buybackPayouts.buybackId, buybackId))
      .orderBy(asc(buybackPayouts.createdAt)),
    db
      .select({
        amount: customerDepositLedger.amount,
        balanceAfter: customerDepositLedger.balanceAfter,
        occurredAt: customerDepositLedger.occurredAt,
      })
      .from(customerDepositLedger)
      .where(
        and(
          eq(customerDepositLedger.organizationId, organizationId),
          eq(customerDepositLedger.customerId, row.customerId),
          eq(customerDepositLedger.referenceType, "buyback"),
          eq(customerDepositLedger.referenceId, buybackId),
          eq(customerDepositLedger.entryType, "deposit_in"),
          eq(customerDepositLedger.direction, "credit"),
        ),
      )
      .orderBy(asc(customerDepositLedger.occurredAt)),
  ]);

  if (items.length === 0) {
    return null;
  }

  const depositAmount = payouts
    .filter((payout) => payout.method === "customer_deposit")
    .reduce((total, payout) => total + Number(payout.amount), 0);
  const externalPayoutAmount = payouts
    .filter((payout) => payout.method !== "customer_deposit")
    .reduce((total, payout) => total + Number(payout.amount), 0);
  const baseTotal = items.reduce((total, item) => total + Number(item.baseAmount), 0);
  const deductionTotal = items.reduce(
    (total, item) => total + Number(item.deductionAmount),
    0,
  );

  return {
    documentKind: "buyback",
    organization: {
      name: row.organizationName,
      timezone: row.organizationTimezone,
      currency: row.organizationCurrency,
    },
    outlet: {
      id: row.outletId,
      code: row.outletCode,
      name: row.outletName,
      address: row.outletAddress,
      phone: row.outletPhone,
    },
    register: {
      code: row.registerCode,
      name: row.registerName,
    },
    cashier: {
      fullName: row.processedByName,
    },
    customer: {
      fullName: row.customerName,
      phone: row.customerPhone,
    },
    sale: {
      id: row.id,
      invoiceNumber: row.buybackNumber,
      status: row.status,
      subtotalAmount: String(baseTotal),
      discountAmount: String(deductionTotal),
      additionalFeeAmount: "0",
      totalAmount: row.totalAmount,
      completedAt: row.completedAt,
      notes: row.notes,
    },
    items: items.map((item) => {
      const snapshot = item.snapshot ?? {};
      return {
        lineNumber: item.lineNumber,
        listPriceAmount: item.baseAmount,
        discountAmount: item.deductionAmount,
        finalPriceAmount: item.finalAmount,
        snapshot: {
          sku:
            readSnapshotString(snapshot, "sku") ??
            item.currentSku,
          barcode:
            readSnapshotString(snapshot, "barcode") ??
            item.currentBarcode,
          qrValue:
            readSnapshotString(snapshot, "qrValue") ??
            item.currentQrValue,
          serialNumber: readSnapshotString(snapshot, "serialNumber"),
          productCode: readSnapshotString(snapshot, "productCode"),
          productName:
            readSnapshotString(snapshot, "displayName") ??
            readSnapshotString(snapshot, "productMasterName") ??
            item.currentDisplayName ??
            item.masterName,
          itemDisplayName:
            readSnapshotString(snapshot, "displayName") ??
            item.currentDisplayName,
          masterProductName:
            readSnapshotString(snapshot, "productMasterName") ??
            item.masterName,
          categoryName: readSnapshotString(snapshot, "categoryName"),
          weightGram:
            readSnapshotString(snapshot, "weightGram") ??
            item.weightGram,
          purityPercent:
            readSnapshotString(snapshot, "purityPercent") ??
            item.purityPercent,
          exchangePurityPercent:
            readSnapshotString(snapshot, "exchangePurityPercent") ??
            item.exchangePurityPercent,
          size: null,
          color: readSnapshotString(snapshot, "color"),
          gemstone: null,
          sellingAmount: null,
          deductionPerGram:
            readSnapshotString(snapshot, "deductionPerGram") ??
            item.deductionPerGram,
          buybackPricePerGram:
            readSnapshotString(snapshot, "buybackPricePerGram") ??
            item.buybackPricePerGram,
          imageKey:
            readSnapshotString(snapshot, "imageKey") ??
            item.itemImageKey,
          productImageKey: item.masterImageKey,
        },
      };
    }),
    payments: payouts.map((payout) => ({
      method: payout.method,
      provider: "buyback_payout",
      amount: payout.amount,
      providerReference: payout.reference,
      paidAt: payout.createdAt,
      metadata: payout.metadata ?? null,
    })),
    customerDeposit: {
      usedAmount: "0",
      inAmount: String(depositAmount),
      balanceAfterAmount: depositRows.at(-1)?.balanceAfter ?? null,
      externalPaymentDueAmount: String(externalPayoutAmount),
    },
    verification: {
      token: `buyback:${row.id}`,
      url: getBuybackDetailQrValue({
        buybackId: row.id,
        buybackNumber: row.buybackNumber,
      }),
    },
  };
}
