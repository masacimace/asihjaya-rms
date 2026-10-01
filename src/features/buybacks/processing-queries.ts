import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  buybackItemProcessings,
  buybackItems,
  buybacks,
  customers,
} from "@/db/schema";
import type {
  BuybackProcessingStatus,
  BuybackProcessingType,
} from "@/features/buybacks/contracts";
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

function normalizePositiveInteger(value: number, fallback: number) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export async function getBuybackProcessingData({
  organizationId,
  outletId,
  limit = 180,
  search = "",
  status,
  processingType = "all",
  page = 1,
  pageSize = 10,
  paginateCompleted = false,
}: {
  organizationId: string;
  outletId: string;
  limit?: number | null;
  search?: string;
  status?: BuybackProcessingStatus;
  processingType?: "all" | BuybackProcessingType;
  page?: number;
  pageSize?: number;
  paginateCompleted?: boolean;
}): Promise<BuybackProcessingData> {
  const baseConditions: SQL[] = [
    eq(buybacks.organizationId, organizationId),
    eq(buybacks.outletId, outletId),
    eq(buybacks.status, "completed"),
  ];
  const rowConditions: SQL[] = [...baseConditions];

  if (status) {
    rowConditions.push(eq(buybackItemProcessings.status, status));
  }

  if (processingType !== "all") {
    rowConditions.push(
      eq(buybackItemProcessings.processingType, processingType),
    );
  }

  const normalizedSearch = search.trim().slice(0, 160);
  if (normalizedSearch) {
    const pattern = `%${normalizedSearch}%`;
    const searchCondition = or(
      ilike(buybacks.buybackNumber, pattern),
      ilike(customers.fullName, pattern),
      ilike(customers.customerCode, pattern),
      sql`${buybackItems.snapshot}->>'displayName' ilike ${pattern}`,
      sql`${buybackItems.snapshot}->>'originalDisplayName' ilike ${pattern}`,
      sql`${buybackItems.snapshot}->>'originalProductMasterName' ilike ${pattern}`,
      sql`${buybackItems.snapshot}->>'sku' ilike ${pattern}`,
      sql`${buybackItems.snapshot}->>'barcode' ilike ${pattern}`,
      sql`${buybackItems.snapshot}->>'categoryName' ilike ${pattern}`,
      sql`${buybackItems.snapshot}->>'originalCategoryName' ilike ${pattern}`,
    );
    if (searchCondition) rowConditions.push(searchCondition);
  }

  const rowCondition = and(...rowConditions);
  const baseCondition = and(...baseConditions);

  const [filteredCountRows, groupedCounts] = await Promise.all([
    db
      .select({ total: count() })
      .from(buybackItemProcessings)
      .innerJoin(
        buybackItems,
        eq(buybackItemProcessings.buybackItemId, buybackItems.id),
      )
      .innerJoin(buybacks, eq(buybackItems.buybackId, buybacks.id))
      .innerJoin(customers, eq(buybacks.customerId, customers.id))
      .where(rowCondition),
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

  const filteredCount = Number(filteredCountRows[0]?.total ?? 0);
  const normalizedPageSize = Math.min(
    50,
    normalizePositiveInteger(pageSize, 10),
  );
  const shouldPaginate = paginateCompleted && status === "completed";
  const pageCount = shouldPaginate
    ? Math.max(1, Math.ceil(filteredCount / normalizedPageSize))
    : 1;
  const requestedPage = normalizePositiveInteger(page, 1);
  const currentPage = shouldPaginate
    ? Math.min(requestedPage, pageCount)
    : 1;
  const offset = shouldPaginate
    ? (currentPage - 1) * normalizedPageSize
    : 0;

  const rowQuery = db
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
    .where(rowCondition)
    .orderBy(
      sql`case when ${buybackItemProcessings.status} = 'pending' then 0 else 1 end`,
      desc(buybackItemProcessings.processedAt),
      desc(buybackItemProcessings.createdAt),
    );

  const rows = shouldPaginate
    ? await rowQuery.limit(normalizedPageSize).offset(offset)
    : limit === null
      ? await rowQuery
      : await rowQuery.limit(Math.max(20, Math.min(300, limit)));

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
    const sourceExchangePurityPercent =
      readSnapshotText(sourceSnapshot, "exchangePurityPercent") ??
      readSnapshotText(sourceSnapshot, "storedExchangePurityPercent");
    const sourceDeductionPerGram =
      readSnapshotText(sourceSnapshot, "deductionPerGram") ??
      readSnapshotText(sourceSnapshot, "storedDeductionPerGram");
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
      sourceExchangePurityPercent,
      sourceColor,
      sourceDeductionPerGram,
      beforeImageKey,
      beforeImageUrl: getImageUrl(beforeImageKey),
      resultProductItemId: row.resultProductItemId,
      resultSku: readSnapshotText(resultSnapshot, "sku"),
      resultBarcode: readSnapshotText(resultSnapshot, "barcode"),
      resultDisplayName: readSnapshotText(resultSnapshot, "displayName"),
      resultWeightGram: readSnapshotText(resultSnapshot, "weightGram"),
      resultPurityPercent: readSnapshotText(resultSnapshot, "purityPercent"),
      resultExchangePurityPercent: readSnapshotText(
        resultSnapshot,
        "exchangePurityPercent",
      ),
      resultColor: readSnapshotText(resultSnapshot, "color"),
      resultPricePerGram: readSnapshotText(resultSnapshot, "pricePerGram"),
      resultDeductionPerGram: readSnapshotText(
        resultSnapshot,
        "deductionPerGram",
      ),
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
    filteredCount,
    pagination: shouldPaginate
      ? {
          page: currentPage,
          pageSize: normalizedPageSize,
          total: filteredCount,
          pageCount,
        }
      : null,
  };
}
