import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { legacyProductImportBatches, productItems } from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";
import {
  importLegacyImageToPrivateStorage,
  LegacyImageImportError,
} from "@/lib/storage/legacy-image-import";

const IMAGE_SYNC_BATCH_SIZE = 36;
const IMAGE_SYNC_CONCURRENCY = 6;

export type LegacyImageSyncSummary = {
  batchId: string;
  processedCount: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  syncedCount: number;
  totalFailedCount: number;
  missingCount: number;
  totalWithSourceCount: number;
};

function readAttributes(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function updateLegacyImportAttributes(
  value: unknown,
  patch: Record<string, unknown>,
) {
  const attributes = readAttributes(value);
  const current = readAttributes(attributes.legacyImport);
  return {
    ...attributes,
    legacyImport: {
      ...current,
      ...patch,
    },
  };
}

async function getAccessibleBatch(auth: AuthContext, batchId: string) {
  const [batch] = await db
    .select({
      id: legacyProductImportBatches.id,
      outletId: legacyProductImportBatches.outletId,
      status: legacyProductImportBatches.status,
    })
    .from(legacyProductImportBatches)
    .where(
      and(
        eq(legacyProductImportBatches.id, batchId),
        eq(legacyProductImportBatches.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  if (!batch || !auth.outlets.some((outlet) => outlet.id === batch.outletId)) {
    throw new Error("Batch import legacy tidak ditemukan atau tidak dapat diakses.");
  }
  if (batch.status !== "ready") {
    throw new Error("Foto hanya dapat disinkronkan setelah direct import selesai.");
  }

  return batch;
}

const batchItemCondition = (organizationId: string, batchId: string) =>
  and(
    eq(productItems.organizationId, organizationId),
    sql`${productItems.attributes}->'legacyImport'->>'batchId' = ${batchId}`,
  );

export async function getLegacyImageSyncSummary({
  auth,
  batchId,
}: {
  auth: AuthContext;
  batchId: string;
}): Promise<Omit<LegacyImageSyncSummary, "processedCount" | "successCount" | "failedCount">> {
  await getAccessibleBatch(auth, batchId);

  const [row] = await db
    .select({
      pendingCount: sql<number>`count(*) filter (
        where ${productItems.legacyUrl} is not null
          and ${productItems.imageKey} is null
          and coalesce(${productItems.attributes}->'legacyImport'->>'imageStatus', 'pending') = 'pending'
      )::int`,
      syncedCount: sql<number>`count(*) filter (
        where ${productItems.imageKey} is not null
      )::int`,
      failedCount: sql<number>`count(*) filter (
        where ${productItems.legacyUrl} is not null
          and ${productItems.imageKey} is null
          and ${productItems.attributes}->'legacyImport'->>'imageStatus' = 'failed'
      )::int`,
      missingCount: sql<number>`count(*) filter (
        where ${productItems.legacyUrl} is null
      )::int`,
      totalWithSourceCount: sql<number>`count(*) filter (
        where ${productItems.legacyUrl} is not null
      )::int`,
    })
    .from(productItems)
    .where(batchItemCondition(auth.organization.id, batchId));

  return {
    batchId,
    pendingCount: Number(row?.pendingCount ?? 0),
    syncedCount: Number(row?.syncedCount ?? 0),
    totalFailedCount: Number(row?.failedCount ?? 0),
    missingCount: Number(row?.missingCount ?? 0),
    totalWithSourceCount: Number(row?.totalWithSourceCount ?? 0),
  };
}

async function processCandidate(
  auth: AuthContext,
  candidate: {
    id: string;
    legacyUrl: string;
    attributes: Record<string, unknown>;
  },
) {
  try {
    const imported = await importLegacyImageToPrivateStorage({
      sourceUrl: candidate.legacyUrl,
      organizationId: auth.organization.id,
      itemId: candidate.id,
    });

    await db
      .update(productItems)
      .set({
        imageKey: imported.imageKey,
        attributes: updateLegacyImportAttributes(candidate.attributes, {
          imageStatus: "synced",
          imageSyncedAt: new Date().toISOString(),
          imageFinalUrl: imported.finalUrl,
          imageSourceBytes: imported.sourceBytes,
          imageErrorCode: null,
          imageErrorMessage: null,
        }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productItems.id, candidate.id),
          eq(productItems.organizationId, auth.organization.id),
        ),
      );

    return true;
  } catch (error) {
    const code =
      error instanceof LegacyImageImportError ? error.code : "DOWNLOAD_FAILED";
    const message =
      error instanceof Error ? error.message.slice(0, 500) : "Foto gagal disalin.";

    await db
      .update(productItems)
      .set({
        attributes: updateLegacyImportAttributes(candidate.attributes, {
          imageStatus: "failed",
          imageFailedAt: new Date().toISOString(),
          imageErrorCode: code,
          imageErrorMessage: message,
        }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productItems.id, candidate.id),
          eq(productItems.organizationId, auth.organization.id),
        ),
      );

    return false;
  }
}

export async function syncNextLegacyImageBatch({
  auth,
  batchId,
}: {
  auth: AuthContext;
  batchId: string;
}): Promise<LegacyImageSyncSummary> {
  if (!auth.permissionCodes.includes("migration.import")) {
    throw new Error("Permission migration.import diperlukan untuk sinkronisasi foto.");
  }
  await getAccessibleBatch(auth, batchId);

  const candidates = await db
    .select({
      id: productItems.id,
      legacyUrl: productItems.legacyUrl,
      attributes: productItems.attributes,
    })
    .from(productItems)
    .where(
      and(
        batchItemCondition(auth.organization.id, batchId),
        isNotNull(productItems.legacyUrl),
        isNull(productItems.imageKey),
        sql`coalesce(${productItems.attributes}->'legacyImport'->>'imageStatus', 'pending') = 'pending'`,
      ),
    )
    .orderBy(asc(productItems.createdAt), asc(productItems.id))
    .limit(IMAGE_SYNC_BATCH_SIZE);

  let successCount = 0;
  let failedCount = 0;

  for (let offset = 0; offset < candidates.length; offset += IMAGE_SYNC_CONCURRENCY) {
    const group = candidates.slice(offset, offset + IMAGE_SYNC_CONCURRENCY);
    const results = await Promise.all(
      group.map((candidate) =>
        processCandidate(auth, {
          id: candidate.id,
          legacyUrl: candidate.legacyUrl!,
          attributes: readAttributes(candidate.attributes),
        }),
      ),
    );
    successCount += results.filter(Boolean).length;
    failedCount += results.filter((value) => !value).length;
  }

  const summary = await getLegacyImageSyncSummary({ auth, batchId });
  return {
    ...summary,
    processedCount: candidates.length,
    successCount,
    failedCount,
  };
}
