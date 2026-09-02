import { and, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  buybackItemProcessings,
  buybackItems,
  buybacks,
  customers,
} from "@/db/schema";
import type {
  BuybackProcessingData,
  BuybackProcessingQueueRow,
} from "@/features/buybacks/processing-contracts";
import { getImageUrl } from "@/lib/storage/image-storage";

function readSnapshotText(
  snapshot: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = snapshot?.[key];
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

export async function getBuybackProcessingData({
  organizationId,
  outletId,
  limit = 180,
}: {
  organizationId: string;
  outletId: string;
  limit?: number;
}): Promise<BuybackProcessingData> {
  const baseCondition = and(
    eq(buybacks.organizationId, organizationId),
    eq(buybacks.outletId, outletId),
    eq(buybacks.status, "completed"),
  );

  const [rows, groupedCounts] = await Promise.all([
    db
      .select({
        id: buybackItemProcessings.id,
        buybackItemId: buybackItems.id,
        buybackId: buybacks.id,
        buybackNumber: buybacks.buybackNumber,
        buybackCompletedAt: buybacks.completedAt,
        customerName: customers.fullName,
        customerCode: customers.customerCode,
        source: buybackItems.source,
        lineNumber: buybackItems.lineNumber,
        sourceProductItemId: buybackItems.productItemId,
        sourceSnapshot: buybackItems.snapshot,
        sourceWeightGram: buybackItems.weightGram,
        sourcePurityPercent: buybackItems.purityPercent,
        processingType: buybackItemProcessings.processingType,
        status: buybackItemProcessings.status,
        resultProductItemId: buybackItemProcessings.resultProductItemId,
        resultSnapshot: buybackItemProcessings.resultSnapshot,
        processedAt: buybackItemProcessings.processedAt,
        createdAt: buybackItemProcessings.createdAt,
      })
      .from(buybackItemProcessings)
      .innerJoin(
        buybackItems,
        eq(buybackItemProcessings.buybackItemId, buybackItems.id),
      )
      .innerJoin(buybacks, eq(buybackItems.buybackId, buybacks.id))
      .innerJoin(customers, eq(buybacks.customerId, customers.id))
      .where(baseCondition)
      .orderBy(
        sql`case when ${buybackItemProcessings.status} = 'pending' then 0 else 1 end`,
        desc(buybackItemProcessings.createdAt),
      )
      .limit(Math.max(20, Math.min(300, limit))),
    db
      .select({
        status: buybackItemProcessings.status,
        processingType: buybackItemProcessings.processingType,
        total: count(),
      })
      .from(buybackItemProcessings)
      .innerJoin(
        buybackItems,
        eq(buybackItemProcessings.buybackItemId, buybackItems.id),
      )
      .innerJoin(buybacks, eq(buybackItems.buybackId, buybacks.id))
      .where(baseCondition)
      .groupBy(
        buybackItemProcessings.status,
        buybackItemProcessings.processingType,
      ),
  ]);

  const mappedRows: BuybackProcessingQueueRow[] = rows.map((row) => {
    const sourceSnapshot = row.sourceSnapshot ?? {};
    const resultSnapshot = row.resultSnapshot ?? {};

    const sourceDisplayName =
      readSnapshotText(sourceSnapshot, "displayName") ??
      readSnapshotText(sourceSnapshot, "originalDisplayName") ??
      readSnapshotText(sourceSnapshot, "originalProductMasterName") ??
      "Item Buyback";
    const sourceCategoryId =
      readSnapshotText(sourceSnapshot, "categoryId") ??
      readSnapshotText(sourceSnapshot, "originalCategoryId") ??
      "";
    const sourceCategoryName =
      readSnapshotText(sourceSnapshot, "categoryName") ??
      readSnapshotText(sourceSnapshot, "originalCategoryName") ??
      "Tanpa kategori";
    const sourceColor = readSnapshotText(sourceSnapshot, "color") ?? "-";
    const beforeImageKey = readSnapshotText(sourceSnapshot, "imageKey");

    const resultImageKey = readSnapshotText(resultSnapshot, "imageKey");

    return {
      id: row.id,
      buybackItemId: row.buybackItemId,
      buybackId: row.buybackId,
      buybackNumber: row.buybackNumber,
      buybackCompletedAt: row.buybackCompletedAt,
      customerName: row.customerName,
      customerCode: row.customerCode,
      source: row.source,
      lineNumber: row.lineNumber,
      processingType: row.processingType,
      status: row.status,
      sourceProductItemId: row.sourceProductItemId,
      sourceProductMasterId:
        readSnapshotText(sourceSnapshot, "originalProductMasterId") ??
        readSnapshotText(sourceSnapshot, "productMasterId"),
      sourceSku: readSnapshotText(sourceSnapshot, "sku"),
      sourceBarcode: readSnapshotText(sourceSnapshot, "barcode"),
      sourceDisplayName,
      sourceCategoryId,
      sourceCategoryName,
      sourceWeightGram:
        readSnapshotText(sourceSnapshot, "weightGram") ?? row.sourceWeightGram,
      sourcePurityPercent:
        readSnapshotText(sourceSnapshot, "purityPercent") ??
        row.sourcePurityPercent,
      sourceColor,
      beforeImageKey,
      beforeImageUrl: getImageUrl(beforeImageKey),
      resultProductItemId: row.resultProductItemId,
      resultSku: readSnapshotText(resultSnapshot, "sku"),
      resultBarcode: readSnapshotText(resultSnapshot, "barcode"),
      resultDisplayName: readSnapshotText(resultSnapshot, "displayName"),
      resultWeightGram: readSnapshotText(resultSnapshot, "weightGram"),
      resultPurityPercent: readSnapshotText(resultSnapshot, "purityPercent"),
      resultColor: readSnapshotText(resultSnapshot, "color"),
      resultPricePerGram: readSnapshotText(resultSnapshot, "pricePerGram"),
      resultImageKey,
      resultImageUrl: getImageUrl(resultImageKey),
      processedAt: row.processedAt,
      createdAt: row.createdAt,
    };
  });

  let pendingCount = 0;
  let completedCount = 0;
  let cleaningPendingCount = 0;
  let reconditionPendingCount = 0;

  for (const row of groupedCounts) {
    const total = Number(row.total ?? 0);
    if (row.status === "pending") {
      pendingCount += total;
      if (row.processingType === "cleaning") cleaningPendingCount += total;
      if (row.processingType === "recondition") reconditionPendingCount += total;
    } else if (row.status === "completed") {
      completedCount += total;
    }
  }

  return {
    rows: mappedRows,
    pendingCount,
    completedCount,
    cleaningPendingCount,
    reconditionPendingCount,
  };
}
