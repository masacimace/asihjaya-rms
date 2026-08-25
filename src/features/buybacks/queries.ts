import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  buybackItems,
  buybackPayouts,
  buybacks,
  customerDepositLedger,
  customers,
  hardwareJobs,
  itemBarcodes,
  outlets,
  productCategories,
  productItems,
  productMasters,
  registers,
  saleItems,
  sales,
  shifts,
  users,
} from "@/db/schema";
import { getDefaultPosRegisterCondition } from "@/features/pos/context";
import type {
  BuybackExistingItemOption,
  BuybackHistoryData,
  BuybackHistoryPayoutSummary,
  BuybackHistoryRow,
  BuybackInitialData,
} from "@/features/buybacks/contracts";

function parseMoney(value: string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

export async function getBuybackInitialData({
  organizationId,
  outletId,
}: {
  organizationId: string;
  outletId?: string | null;
}): Promise<BuybackInitialData> {
  const outlet = outletId
    ? (
        await db
          .select({ id: outlets.id, code: outlets.code, name: outlets.name })
          .from(outlets)
          .where(
            and(
              eq(outlets.id, outletId),
              eq(outlets.organizationId, organizationId),
              eq(outlets.isActive, true),
            ),
          )
          .limit(1)
      )[0] ?? null
    : null;

  const register = outlet
    ? (
        await db
          .select({ id: registers.id, code: registers.code, name: registers.name })
          .from(registers)
          .where(getDefaultPosRegisterCondition(outlet.id))
          .orderBy(asc(registers.name))
          .limit(1)
      )[0] ?? null
    : null;

  const activeShift = register
    ? (
        await db
          .select({
            id: shifts.id,
            openedAt: shifts.openedAt,
            expectedCash: shifts.expectedCash,
          })
          .from(shifts)
          .where(
            and(
              eq(shifts.outletId, outlet!.id),
              eq(shifts.registerId, register.id),
              eq(shifts.status, "open"),
            ),
          )
          .orderBy(desc(shifts.openedAt))
          .limit(1)
      )[0] ?? null
    : null;

  const customerRows = await db
    .select({
      id: customers.id,
      customerCode: customers.customerCode,
      fullName: customers.fullName,
      phone: customers.phone,
      email: customers.email,
    })
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customers.isActive, true),
      ),
    )
    .orderBy(asc(customers.fullName), desc(customers.createdAt))
    .limit(80);

  const customerIds = customerRows.map((row) => row.id);
  const ledgerRows =
    outlet && customerIds.length > 0
      ? await db
          .select({
            customerId: customerDepositLedger.customerId,
            balanceAfter: customerDepositLedger.balanceAfter,
            occurredAt: customerDepositLedger.occurredAt,
            createdAt: customerDepositLedger.createdAt,
          })
          .from(customerDepositLedger)
          .where(
            and(
              eq(customerDepositLedger.organizationId, organizationId),
              eq(customerDepositLedger.outletId, outlet.id),
              inArray(customerDepositLedger.customerId, customerIds),
            ),
          )
          .orderBy(
            desc(customerDepositLedger.occurredAt),
            desc(customerDepositLedger.createdAt),
          )
      : [];

  const latestLedgerByCustomer = new Map<string, (typeof ledgerRows)[number]>();
  for (const row of ledgerRows) {
    if (!latestLedgerByCustomer.has(row.customerId)) {
      latestLedgerByCustomer.set(row.customerId, row);
    }
  }

  return {
    context: {
      outlet,
      register,
      activeShift,
    },
    customers: customerRows.map((customer) => {
      const balance = latestLedgerByCustomer.get(customer.id)?.balanceAfter ?? "0";
      return {
        ...customer,
        customerDepositBalanceAmount: balance,
        customerDepositBalance: parseMoney(balance),
        customerDepositLastLedgerEntryAt:
          latestLedgerByCustomer.get(customer.id)?.occurredAt ?? null,
      };
    }),
  };
}

export async function searchBuybackExistingItems({
  organizationId,
  query,
  limit = 20,
}: {
  organizationId: string;
  query: string;
  limit?: number;
}): Promise<BuybackExistingItemOption[]> {
  const normalizedQuery = query.trim().slice(0, 160);
  if (normalizedQuery.length < 2) return [];

  const pattern = `%${normalizedQuery}%`;
  const barcodeRows = await db
    .select({ itemId: itemBarcodes.itemId, barcodeValue: itemBarcodes.barcodeValue })
    .from(itemBarcodes)
    .where(
      and(
        eq(itemBarcodes.organizationId, organizationId),
        eq(itemBarcodes.isActive, true),
        ilike(itemBarcodes.barcodeValue, pattern),
      ),
    )
    .limit(60);
  const barcodeItemIds = Array.from(new Set(barcodeRows.map((row) => row.itemId)));

  const identifierConditions = [
    ilike(productItems.sku, pattern),
    ilike(productItems.barcode, pattern),
    ilike(productItems.qrValue, pattern),
    ilike(productItems.serialNumber, pattern),
    ilike(productItems.displayName, pattern),
    ilike(productMasters.code, pattern),
    ilike(productMasters.name, pattern),
  ];
  if (barcodeItemIds.length > 0) {
    identifierConditions.push(inArray(productItems.id, barcodeItemIds));
  }

  const rows = await db
    .select({
      id: productItems.id,
      sku: productItems.sku,
      barcode: productItems.barcode,
      qrValue: productItems.qrValue,
      serialNumber: productItems.serialNumber,
      productMasterId: productMasters.id,
      productCode: productMasters.code,
      productName: sql<string>`coalesce(${productItems.displayName}, ${productMasters.name})`,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      weightGram: productItems.weightGram,
      purityPercent: productItems.purityPercent,
      exchangePurityPercent: productItems.exchangePurityPercent,
      color: productItems.color,
      deductionPerGram: productItems.deductionPerGram,
      imageKey: productItems.imageKey,
    })
    .from(productItems)
    .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
    .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
    .where(
      and(
        eq(productItems.organizationId, organizationId),
        eq(productItems.isActive, true),
        eq(productItems.availability, "sold"),
        eq(productItems.locationState, "customer"),
        eq(productMasters.status, "active"),
        eq(productCategories.isActive, true),
        or(...identifierConditions),
      ),
    )
    .orderBy(
      sql`case
        when lower(${productItems.barcode}) = lower(${normalizedQuery}) then 0
        when lower(${productItems.sku}) = lower(${normalizedQuery}) then 1
        when lower(coalesce(${productItems.qrValue}, '')) = lower(${normalizedQuery}) then 2
        else 3
      end`,
      desc(productItems.updatedAt),
      asc(productItems.sku),
    )
    .limit(Math.max(1, Math.min(30, limit)));

  const itemIds = rows.map((row) => row.id);
  const saleRows =
    itemIds.length > 0
      ? await db
          .select({
            productItemId: saleItems.productItemId,
            invoiceNumber: sales.invoiceNumber,
            completedAt: sales.completedAt,
            createdAt: sales.createdAt,
          })
          .from(saleItems)
          .innerJoin(sales, eq(saleItems.saleId, sales.id))
          .where(
            and(
              inArray(saleItems.productItemId, itemIds),
              eq(sales.organizationId, organizationId),
              inArray(sales.status, ["completed", "partially_refunded"]),
            ),
          )
          .orderBy(desc(sales.completedAt), desc(sales.createdAt))
      : [];

  const latestSaleByItem = new Map<string, (typeof saleRows)[number]>();
  for (const sale of saleRows) {
    if (!latestSaleByItem.has(sale.productItemId)) {
      latestSaleByItem.set(sale.productItemId, sale);
    }
  }

  return rows.map((row) => {
    const latestSale = latestSaleByItem.get(row.id) ?? null;
    return {
      ...row,
      soldAt: latestSale?.completedAt ?? latestSale?.createdAt ?? null,
      lastInvoiceNumber: latestSale?.invoiceNumber ?? null,
    };
  });
}


export async function getBuybackHistoryData({
  organizationId,
  outletId,
  detailId,
  limit = 80,
}: {
  organizationId: string;
  outletId: string;
  detailId?: string | null;
  limit?: number;
}): Promise<BuybackHistoryData> {
  const rows = await db
    .select({
      id: buybacks.id,
      buybackNumber: buybacks.buybackNumber,
      status: buybacks.status,
      totalAmount: buybacks.totalAmount,
      completedAt: buybacks.completedAt,
      createdAt: buybacks.createdAt,
      customerId: customers.id,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      customerPhone: customers.phone,
      processedByName: users.fullName,
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
    })
    .from(buybacks)
    .innerJoin(customers, eq(buybacks.customerId, customers.id))
    .innerJoin(users, eq(buybacks.processedBy, users.id))
    .innerJoin(outlets, eq(buybacks.outletId, outlets.id))
    .where(
      and(
        eq(buybacks.organizationId, organizationId),
        eq(buybacks.outletId, outletId),
      ),
    )
    .orderBy(desc(buybacks.completedAt), desc(buybacks.createdAt))
    .limit(Math.max(1, Math.min(200, limit)));

  const ids = rows.map((row) => row.id);
  const [itemCounts, payoutRows] =
    ids.length > 0
      ? await Promise.all([
          db
            .select({
              buybackId: buybackItems.buybackId,
              itemCount: sql<number>`count(*)::int`,
            })
            .from(buybackItems)
            .where(inArray(buybackItems.buybackId, ids))
            .groupBy(buybackItems.buybackId),
          db
            .select({
              buybackId: buybackPayouts.buybackId,
              method: buybackPayouts.method,
              amount: buybackPayouts.amount,
              reference: buybackPayouts.reference,
            })
            .from(buybackPayouts)
            .where(inArray(buybackPayouts.buybackId, ids))
            .orderBy(asc(buybackPayouts.createdAt)),
        ])
      : [[], []];

  const itemCountByBuyback = new Map(
    itemCounts.map((row) => [row.buybackId, Number(row.itemCount ?? 0)]),
  );
  const payoutsByBuyback = new Map<string, BuybackHistoryPayoutSummary[]>();
  for (const payout of payoutRows) {
    const current = payoutsByBuyback.get(payout.buybackId) ?? [];
    current.push({
      method: payout.method,
      amount: payout.amount,
      reference: payout.reference,
    });
    payoutsByBuyback.set(payout.buybackId, current);
  }

  const historyRows: BuybackHistoryRow[] = rows.map((row) => ({
    ...row,
    itemCount: itemCountByBuyback.get(row.id) ?? 0,
    payouts: payoutsByBuyback.get(row.id) ?? [],
  }));

  if (!detailId) {
    return { rows: historyRows, detail: null };
  }

  let detailBase = historyRows.find((row) => row.id === detailId) ?? null;
  if (!detailBase) {
    const [olderDetail] = await db
      .select({
        id: buybacks.id,
        buybackNumber: buybacks.buybackNumber,
        status: buybacks.status,
        totalAmount: buybacks.totalAmount,
        completedAt: buybacks.completedAt,
        createdAt: buybacks.createdAt,
        customerId: customers.id,
        customerCode: customers.customerCode,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        processedByName: users.fullName,
        outletId: outlets.id,
        outletCode: outlets.code,
        outletName: outlets.name,
      })
      .from(buybacks)
      .innerJoin(customers, eq(buybacks.customerId, customers.id))
      .innerJoin(users, eq(buybacks.processedBy, users.id))
      .innerJoin(outlets, eq(buybacks.outletId, outlets.id))
      .where(
        and(
          eq(buybacks.id, detailId),
          eq(buybacks.organizationId, organizationId),
          eq(buybacks.outletId, outletId),
        ),
      )
      .limit(1);

    if (!olderDetail) {
      return { rows: historyRows, detail: null };
    }

    const [olderItemCount, olderPayouts] = await Promise.all([
      db
        .select({ itemCount: sql<number>`count(*)::int` })
        .from(buybackItems)
        .where(eq(buybackItems.buybackId, detailId)),
      db
        .select({
          method: buybackPayouts.method,
          amount: buybackPayouts.amount,
          reference: buybackPayouts.reference,
        })
        .from(buybackPayouts)
        .where(eq(buybackPayouts.buybackId, detailId))
        .orderBy(asc(buybackPayouts.createdAt)),
    ]);

    detailBase = {
      ...olderDetail,
      itemCount: Number(olderItemCount[0]?.itemCount ?? 0),
      payouts: olderPayouts,
    };
  }

  const [registerRow, detailItems, receiptJobs] = await Promise.all([
    db
      .select({
        code: registers.code,
        name: registers.name,
        notes: buybacks.notes,
      })
      .from(buybacks)
      .innerJoin(registers, eq(buybacks.registerId, registers.id))
      .where(
        and(
          eq(buybacks.id, detailId),
          eq(buybacks.organizationId, organizationId),
          eq(buybacks.outletId, outletId),
        ),
      )
      .limit(1),
    db
      .select({
        id: buybackItems.id,
        productItemId: buybackItems.productItemId,
        source: buybackItems.source,
        lineNumber: buybackItems.lineNumber,
        weightGram: buybackItems.weightGram,
        purityPercent: buybackItems.purityPercent,
        exchangePurityPercent: buybackItems.exchangePurityPercent,
        buybackPricePerGram: buybackItems.buybackPricePerGram,
        deductionPerGram: buybackItems.deductionPerGram,
        baseAmount: buybackItems.baseAmount,
        deductionAmount: buybackItems.deductionAmount,
        finalAmount: buybackItems.finalAmount,
        snapshot: buybackItems.snapshot,
        currentSku: productItems.sku,
        currentBarcode: productItems.barcode,
        currentDisplayName: sql<string>`coalesce(${productItems.displayName}, ${productMasters.name})`,
      })
      .from(buybackItems)
      .innerJoin(productItems, eq(buybackItems.productItemId, productItems.id))
      .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
      .where(eq(buybackItems.buybackId, detailId))
      .orderBy(asc(buybackItems.lineNumber)),
    db
      .select({
        id: hardwareJobs.id,
        status: hardwareJobs.status,
        attempts: hardwareJobs.attempts,
        lastErrorMessage: hardwareJobs.lastErrorMessage,
        createdAt: hardwareJobs.createdAt,
        updatedAt: hardwareJobs.updatedAt,
      })
      .from(hardwareJobs)
      .where(
        and(
          eq(hardwareJobs.organizationId, organizationId),
          eq(hardwareJobs.sourceType, "buyback"),
          eq(hardwareJobs.sourceId, detailId),
          eq(hardwareJobs.jobType, "print_receipt_certificate"),
        ),
      )
      .orderBy(desc(hardwareJobs.createdAt))
      .limit(1),
  ]);

  const register = registerRow[0];
  if (!register) {
    return { rows: historyRows, detail: null };
  }

  return {
    rows: historyRows,
    detail: {
      ...detailBase,
      registerCode: register.code,
      registerName: register.name,
      notes: register.notes,
      items: detailItems,
      receiptJob: receiptJobs[0] ?? null,
    },
  };
}
