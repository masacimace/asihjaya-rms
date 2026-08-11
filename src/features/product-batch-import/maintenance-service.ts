import { and, asc, eq, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  organizations,
  productBatchImportItemRows,
  productBatchImportMasterRows,
  productBatchImportSessions,
  productItems,
  productMasters,
} from "@/db/schema";
import {
  deleteImageFileStrict,
  listImageKeysForEntity,
} from "@/lib/storage/image-storage";
import {
  deleteProductBatchImportStagingFiles,
  getProductBatchImportStorageReport,
  type ProductBatchImportStorageReport,
} from "@/lib/storage/product-batch-import-storage";

import { PRODUCT_BATCH_IMPORT_MAINTENANCE } from "./contracts";
import { expireProductBatchImportSessions } from "./session-service";
import { logProductBatchImportEvent } from "./observability";

const TERMINAL_STAGING_CLEANUP_STATUSES = [
  "failed",
  "cancelled",
  "expired",
  "completed",
] as const;
const SAFE_FINAL_ORPHAN_CLEANUP_STATUSES = [
  "failed",
  "cancelled",
  "expired",
] as const;

type SessionStatus =
  | "uploaded"
  | "validating"
  | "invalid"
  | "ready"
  | "committing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

type MaintenanceIssue = {
  code: string;
  message: string;
  sessionId?: string;
  key?: string;
};

export type ProductBatchImportMaintenanceResult = {
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  expiredSessions: number;
  expiryCleanupFailures: number;
  stagingObjectsDeleted: number;
  orphanStagingObjectsDeleted: number;
  finalOrphanImagesDeleted: number;
  cleanupFailures: number;
  staleCommittingSessions: string[];
  completedEvidenceAnomalies: number;
  storage: Omit<ProductBatchImportStorageReport, "objects">;
  issues: MaintenanceIssue[];
};

function parseSessionIdFromStagingKey(key: string) {
  const match = key.match(
    /^organizations\/[0-9a-f-]{36}\/product-batch-import\/([0-9a-f-]{36})\//i,
  );
  return match?.[1]?.toLowerCase() ?? null;
}

function isTerminalStagingCleanupStatus(
  status: SessionStatus,
): status is (typeof TERMINAL_STAGING_CLEANUP_STATUSES)[number] {
  return TERMINAL_STAGING_CLEANUP_STATUSES.includes(
    status as (typeof TERMINAL_STAGING_CLEANUP_STATUSES)[number],
  );
}

function isSafeFinalCleanupStatus(
  status: SessionStatus,
): status is (typeof SAFE_FINAL_ORPHAN_CLEANUP_STATUSES)[number] {
  return SAFE_FINAL_ORPHAN_CLEANUP_STATUSES.includes(
    status as (typeof SAFE_FINAL_ORPHAN_CLEANUP_STATUSES)[number],
  );
}

async function expireDueSessions({
  dryRun,
  now,
}: {
  dryRun: boolean;
  now: Date;
}) {
  if (dryRun) {
    const rows = await db
      .select({ id: productBatchImportSessions.id })
      .from(productBatchImportSessions)
      .where(
        and(
          lte(productBatchImportSessions.expiresAt, now),
          inArray(productBatchImportSessions.status, [
            "uploaded",
            "validating",
            "invalid",
            "ready",
            "failed",
          ]),
        ),
      )
      .limit(PRODUCT_BATCH_IMPORT_MAINTENANCE.maxExpireSessionsPerRun);
    return { expiredSessions: rows.length, cleanupFailures: 0 };
  }

  let expiredSessions = 0;
  let cleanupFailures = 0;
  while (
    expiredSessions < PRODUCT_BATCH_IMPORT_MAINTENANCE.maxExpireSessionsPerRun
  ) {
    const result = await expireProductBatchImportSessions({
      now,
      limit: PRODUCT_BATCH_IMPORT_MAINTENANCE.expireBatchSize,
    });
    expiredSessions += result.expired;
    cleanupFailures += result.cleanupFailures;
    if (result.scanned < PRODUCT_BATCH_IMPORT_MAINTENANCE.expireBatchSize) {
      break;
    }
  }
  return { expiredSessions, cleanupFailures };
}

async function getSessionSnapshot() {
  const rows = await db
    .select({
      id: productBatchImportSessions.id,
      organizationId: productBatchImportSessions.organizationId,
      status: productBatchImportSessions.status,
      storageKey: productBatchImportSessions.storageKey,
      updatedAt: productBatchImportSessions.updatedAt,
      committedMasterCount: productBatchImportSessions.committedMasterCount,
      committedItemCount: productBatchImportSessions.committedItemCount,
    })
    .from(productBatchImportSessions)
    .orderBy(asc(productBatchImportSessions.createdAt));

  return new Map(
    rows.map((row) => [
      row.id.toLowerCase(),
      { ...row, status: row.status as SessionStatus },
    ]),
  );
}

async function cleanupStagingStorage({
  dryRun,
  now,
  sessionSnapshot,
  organizationIds,
  issues,
}: {
  dryRun: boolean;
  now: Date;
  sessionSnapshot: Awaited<ReturnType<typeof getSessionSnapshot>>;
  organizationIds: string[];
  issues: MaintenanceIssue[];
}) {
  const report = await getProductBatchImportStorageReport({
    organizationIds,
    maxObjectsPerOrganization:
      PRODUCT_BATCH_IMPORT_MAINTENANCE.maxStorageObjectsPerOrganization,
  });
  if (report.truncated) {
    issues.push({
      code: "STAGING_SCAN_TRUNCATED",
      message:
        "Scan staging mencapai batas object. Naikkan observability limit sebelum menganggap storage bersih.",
    });
  }

  const terminalKeys: string[] = [];
  const orphanKeys: string[] = [];
  for (const object of report.objects) {
    const sessionId = parseSessionIdFromStagingKey(object.key);
    if (!sessionId) continue;
    const session = sessionSnapshot.get(sessionId);
    if (session && isTerminalStagingCleanupStatus(session.status)) {
      terminalKeys.push(object.key);
      continue;
    }
    if (session) continue;

    const ageMs = object.modifiedAt
      ? now.getTime() - object.modifiedAt.getTime()
      : 0;
    if (ageMs >= PRODUCT_BATCH_IMPORT_MAINTENANCE.orphanStorageGraceMs) {
      orphanKeys.push(object.key);
    } else {
      issues.push({
        code: "ORPHAN_STAGING_WITHIN_GRACE",
        key: object.key,
        message:
          "Object staging belum mempunyai session DB tetapi masih dalam grace period; dipertahankan untuk menghindari race upload.",
      });
    }
  }

  const keysToDelete = [...terminalKeys, ...orphanKeys];
  let cleanupFailures = 0;
  const failedKeys = new Set<string>();
  if (!dryRun && keysToDelete.length > 0) {
    const failures = await deleteProductBatchImportStagingFiles(keysToDelete);
    cleanupFailures += failures.length;
    for (const failure of failures) {
      failedKeys.add(failure.key);
      issues.push({
        code: "STAGING_DELETE_FAILED",
        key: failure.key,
        message: failure.message,
      });
    }
  }

  return {
    report,
    terminalDeleted: terminalKeys.filter((key) => !failedKeys.has(key)).length,
    orphanDeleted: orphanKeys.filter((key) => !failedKeys.has(key)).length,
    cleanupFailures,
  };
}

async function cleanupTerminalFinalOrphans({
  dryRun,
  issues,
}: {
  dryRun: boolean;
  issues: MaintenanceIssue[];
}) {
  const sessions = await db
    .select({
      id: productBatchImportSessions.id,
      organizationId: productBatchImportSessions.organizationId,
      status: productBatchImportSessions.status,
    })
    .from(productBatchImportSessions)
    .where(
      inArray(
        productBatchImportSessions.status,
        SAFE_FINAL_ORPHAN_CLEANUP_STATUSES,
      ),
    );
  if (sessions.length === 0) {
    return { deleted: 0, failures: 0 };
  }

  const sessionIds = sessions.map((session) => session.id);
  const [masterRows, itemRows] = await Promise.all([
    db
      .select({
        sessionId: productBatchImportMasterRows.sessionId,
        plannedId: productBatchImportMasterRows.plannedProductMasterId,
        committedId: productBatchImportMasterRows.committedProductMasterId,
      })
      .from(productBatchImportMasterRows)
      .where(inArray(productBatchImportMasterRows.sessionId, sessionIds)),
    db
      .select({
        sessionId: productBatchImportItemRows.sessionId,
        plannedId: productBatchImportItemRows.plannedProductItemId,
        committedId: productBatchImportItemRows.committedProductItemId,
      })
      .from(productBatchImportItemRows)
      .where(inArray(productBatchImportItemRows.sessionId, sessionIds)),
  ]);

  const masterIds = Array.from(
    new Set(masterRows.flatMap((row) => (row.plannedId ? [row.plannedId] : []))),
  );
  const itemIds = Array.from(
    new Set(itemRows.flatMap((row) => (row.plannedId ? [row.plannedId] : []))),
  );
  const [existingMasters, existingItems] = await Promise.all([
    masterIds.length
      ? db
          .select({ id: productMasters.id })
          .from(productMasters)
          .where(inArray(productMasters.id, masterIds))
      : Promise.resolve([]),
    itemIds.length
      ? db
          .select({ id: productItems.id })
          .from(productItems)
          .where(inArray(productItems.id, itemIds))
      : Promise.resolve([]),
  ]);
  const existingMasterIds = new Set(existingMasters.map((row) => row.id));
  const existingItemIds = new Set(existingItems.map((row) => row.id));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  let deleted = 0;
  let failures = 0;
  const cleanupEntity = async ({
    sessionId,
    plannedId,
    committedId,
    entityType,
    exists,
  }: {
    sessionId: string;
    plannedId: string | null;
    committedId: string | null;
    entityType: "products" | "items";
    exists: boolean;
  }) => {
    if (!plannedId) return;
    const session = sessionById.get(sessionId);
    if (!session || !isSafeFinalCleanupStatus(session.status as SessionStatus)) {
      return;
    }
    if (committedId || exists) {
      issues.push({
        code: "TERMINAL_SESSION_HAS_BUSINESS_ENTITY",
        sessionId,
        message: `Session ${session.status} masih mempunyai ${entityType} committed/planned yang resolve ke data bisnis; final image tidak disentuh.`,
      });
      return;
    }

    const keys = await listImageKeysForEntity({
      organizationId: session.organizationId,
      entityType,
      entityId: plannedId,
    });
    for (const key of keys) {
      const [masterReference, itemReference] = await Promise.all([
        db
          .select({ id: productMasters.id })
          .from(productMasters)
          .where(eq(productMasters.imageKey, key))
          .limit(1),
        db
          .select({ id: productItems.id })
          .from(productItems)
          .where(eq(productItems.imageKey, key))
          .limit(1),
      ]);
      if (masterReference.length > 0 || itemReference.length > 0) {
        issues.push({
          code: "FINAL_IMAGE_STILL_REFERENCED",
          sessionId,
          key,
          message:
            "Candidate orphan final image masih direferensikan data bisnis; maintenance tidak menghapusnya.",
        });
        continue;
      }
      if (dryRun) {
        deleted += 1;
        continue;
      }
      try {
        await deleteImageFileStrict(key);
        deleted += 1;
      } catch (error) {
        failures += 1;
        issues.push({
          code: "FINAL_ORPHAN_DELETE_FAILED",
          sessionId,
          key,
          message:
            error instanceof Error ? error.message : "Final orphan cleanup gagal.",
        });
      }
    }
  };

  for (const row of masterRows) {
    await cleanupEntity({
      sessionId: row.sessionId,
      plannedId: row.plannedId,
      committedId: row.committedId,
      entityType: "products",
      exists: !!row.plannedId && existingMasterIds.has(row.plannedId),
    });
  }
  for (const row of itemRows) {
    await cleanupEntity({
      sessionId: row.sessionId,
      plannedId: row.plannedId,
      committedId: row.committedId,
      entityType: "items",
      exists: !!row.plannedId && existingItemIds.has(row.plannedId),
    });
  }

  return { deleted, failures };
}

async function detectStaleCommittingSessions(now: Date) {
  const cutoff = new Date(
    now.getTime() - PRODUCT_BATCH_IMPORT_MAINTENANCE.staleCommittingMs,
  );
  return db
    .select({ id: productBatchImportSessions.id })
    .from(productBatchImportSessions)
    .where(
      and(
        eq(productBatchImportSessions.status, "committing"),
        lte(productBatchImportSessions.updatedAt, cutoff),
      ),
    )
    .orderBy(asc(productBatchImportSessions.updatedAt))
    .limit(200);
}

async function detectCompletedEvidenceAnomalies() {
  const completed = await db
    .select({
      id: productBatchImportSessions.id,
      committedMasterCount: productBatchImportSessions.committedMasterCount,
      committedItemCount: productBatchImportSessions.committedItemCount,
    })
    .from(productBatchImportSessions)
    .where(eq(productBatchImportSessions.status, "completed"));
  if (completed.length === 0) return 0;

  const sessionIds = completed.map((session) => session.id);
  const [masterRows, itemRows] = await Promise.all([
    db
      .select({
        sessionId: productBatchImportMasterRows.sessionId,
        committedId: productBatchImportMasterRows.committedProductMasterId,
      })
      .from(productBatchImportMasterRows)
      .where(inArray(productBatchImportMasterRows.sessionId, sessionIds)),
    db
      .select({
        sessionId: productBatchImportItemRows.sessionId,
        committedId: productBatchImportItemRows.committedProductItemId,
      })
      .from(productBatchImportItemRows)
      .where(inArray(productBatchImportItemRows.sessionId, sessionIds)),
  ]);
  const masterCounts = new Map<string, number>();
  const itemCounts = new Map<string, number>();
  for (const row of masterRows) {
    if (!row.committedId) continue;
    masterCounts.set(row.sessionId, (masterCounts.get(row.sessionId) ?? 0) + 1);
  }
  for (const row of itemRows) {
    if (!row.committedId) continue;
    itemCounts.set(row.sessionId, (itemCounts.get(row.sessionId) ?? 0) + 1);
  }

  return completed.filter(
    (session) =>
      (masterCounts.get(session.id) ?? 0) !== session.committedMasterCount ||
      (itemCounts.get(session.id) ?? 0) !== session.committedItemCount,
  ).length;
}

function storageSeverity(report: Omit<ProductBatchImportStorageReport, "objects">) {
  if (
    report.totalBytes >= PRODUCT_BATCH_IMPORT_MAINTENANCE.stagingCriticalBytes ||
    (report.diskUsedPercent ?? 0) >=
      PRODUCT_BATCH_IMPORT_MAINTENANCE.diskCriticalPercent
  ) {
    return "critical" as const;
  }
  if (
    report.totalBytes >= PRODUCT_BATCH_IMPORT_MAINTENANCE.stagingWarningBytes ||
    (report.diskUsedPercent ?? 0) >=
      PRODUCT_BATCH_IMPORT_MAINTENANCE.diskWarningPercent
  ) {
    return "warning" as const;
  }
  return "healthy" as const;
}

export async function runProductBatchImportMaintenance({
  dryRun = false,
  now = new Date(),
}: {
  dryRun?: boolean;
  now?: Date;
} = {}): Promise<ProductBatchImportMaintenanceResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs);
  const issues: MaintenanceIssue[] = [];

  const expiry = await expireDueSessions({ dryRun, now });
  const [organizationRows, sessionSnapshot] = await Promise.all([
    db.select({ id: organizations.id }).from(organizations).limit(10_000),
    getSessionSnapshot(),
  ]);
  const staging = await cleanupStagingStorage({
    dryRun,
    now,
    sessionSnapshot,
    organizationIds: organizationRows.map((row) => row.id),
    issues,
  });
  const finalOrphans = await cleanupTerminalFinalOrphans({ dryRun, issues });
  const [staleCommitting, completedEvidenceAnomalies] = await Promise.all([
    detectStaleCommittingSessions(now),
    detectCompletedEvidenceAnomalies(),
  ]);
  for (const session of staleCommitting) {
    issues.push({
      code: "STALE_COMMITTING_SESSION",
      sessionId: session.id,
      message:
        "Session committing melewati threshold. Maintenance hanya mendeteksi dan tidak menghapus final media agar tidak merusak commit yang mungkin masih aktif.",
    });
  }
  if (completedEvidenceAnomalies > 0) {
    issues.push({
      code: "COMPLETED_EVIDENCE_MISMATCH",
      message: `${completedEvidenceAnomalies} completed session memiliki committed evidence count yang tidak konsisten. Final product images tidak disentuh.`,
    });
  }

  const postStorageReport = dryRun
    ? staging.report
    : await getProductBatchImportStorageReport({
        organizationIds: organizationRows.map((row) => row.id),
        maxObjectsPerOrganization:
          PRODUCT_BATCH_IMPORT_MAINTENANCE.maxStorageObjectsPerOrganization,
      });
  const { objects: _objects, ...storage } = postStorageReport;
  void _objects;
  const severity = storageSeverity(storage);
  if (severity !== "healthy") {
    issues.push({
      code: severity === "critical" ? "STORAGE_CRITICAL" : "STORAGE_WARNING",
      message: `Staging=${storage.totalBytes} byte, diskUsed=${storage.diskUsedPercent ?? "n/a"}%.`,
    });
  }

  const finishedAtMs = Date.now();
  const result: ProductBatchImportMaintenanceResult = {
    dryRun,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: Math.max(0, finishedAtMs - startedAtMs),
    expiredSessions: expiry.expiredSessions,
    expiryCleanupFailures: expiry.cleanupFailures,
    stagingObjectsDeleted: staging.terminalDeleted,
    orphanStagingObjectsDeleted: staging.orphanDeleted,
    finalOrphanImagesDeleted: finalOrphans.deleted,
    cleanupFailures:
      expiry.cleanupFailures + staging.cleanupFailures + finalOrphans.failures,
    staleCommittingSessions: staleCommitting.map((session) => session.id),
    completedEvidenceAnomalies,
    storage,
    issues,
  };

  logProductBatchImportEvent({
    event: "maintenance_summary",
    level:
      result.cleanupFailures > 0 || severity === "critical"
        ? "error"
        : result.issues.length > 0
          ? "warning"
          : "info",
    durationMs: result.durationMs,
    dryRun,
    expiredSessions: result.expiredSessions,
    stagingObjectsDeleted: result.stagingObjectsDeleted,
    orphanStagingObjectsDeleted: result.orphanStagingObjectsDeleted,
    finalOrphanImagesDeleted: result.finalOrphanImagesDeleted,
    cleanupFailures: result.cleanupFailures,
    staleCommittingSessions: result.staleCommittingSessions,
    completedEvidenceAnomalies,
    storageDriver: storage.driver,
    stagingBytes: storage.totalBytes,
    stagingObjectCount: storage.objectCount,
    diskUsedPercent: storage.diskUsedPercent,
    issueCodes: Array.from(new Set(result.issues.map((issue) => issue.code))),
  });

  return result;
}
