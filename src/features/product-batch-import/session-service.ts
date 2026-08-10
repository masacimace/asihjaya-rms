import { createHash, randomUUID } from "node:crypto";

import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  outlets,
  productBatchImportItemRows,
  productBatchImportMasterRows,
  productBatchImportMedia,
  productBatchImportSessions,
  productCategories,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";
import {
  buildProductBatchImportArchiveStorageKey,
  buildProductBatchImportMediaStorageKey,
  deleteProductBatchImportStagingFiles,
  storeProductBatchImportStagingFile,
} from "@/lib/storage/product-batch-import-storage";

import {
  PRODUCT_BATCH_IMPORT_LIMITS,
  PRODUCT_BATCH_IMPORT_SESSION_TTL_MS,
  PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
} from "./contracts";
import { extractProductBatchArchiveEntry } from "./archive-parser";
import { parseProductBatchImportPackage } from "./package-parser";
import {
  collectProductBatchLookupCodes,
  validateProductBatchImportPackage,
  type ProductBatchValidationLookups,
} from "./validation";

const DUPLICATE_GUARD_STATUSES = [
  "uploaded",
  "validating",
  "ready",
  "committing",
  "completed",
] as const;

const CANCELLABLE_STATUSES = [
  "uploaded",
  "validating",
  "invalid",
  "ready",
  "failed",
] as const;

export type ProductBatchImportRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ProductBatchImportSessionSummary = {
  id: string;
  status: "invalid" | "ready";
  fileName: string;
  fileSha256: string;
  totalMasterRows: number;
  totalItemRows: number;
  validMasterRows: number;
  validItemRows: number;
  invalidRows: number;
  warningCount: number;
  expiresAt: Date;
};

export class ProductBatchImportServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProductBatchImportServiceError";
  }
}

export class ProductBatchImportDuplicateError extends ProductBatchImportServiceError {
  constructor(
    public readonly existingSessionId: string,
    public readonly existingStatus: string,
  ) {
    super(
      "DUPLICATE_FILE",
      "File yang sama sudah mempunyai session aktif/selesai pada organization ini.",
      409,
    );
    this.name = "ProductBatchImportDuplicateError";
  }
}

function serviceError(
  code: string,
  message: string,
  statusCode = 400,
  cause?: unknown,
) {
  return new ProductBatchImportServiceError(
    code,
    message,
    statusCode,
    cause === undefined ? undefined : { cause },
  );
}

function assertPermission(auth: AuthContext, permission: string) {
  if (!auth.permissionCodes.includes(permission)) {
    throw serviceError(
      "FORBIDDEN",
      `Permission ${permission} diperlukan untuk Product Batch Import.`,
      403,
    );
  }
}

export function normalizeProductBatchImportFileName(value: string) {
  const normalized = value.normalize("NFKC").trim();
  if (
    !normalized ||
    normalized.length > 255 ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.startsWith(".") ||
    !normalized.toLocaleLowerCase("en-US").endsWith(".zip")
  ) {
    throw serviceError(
      "UPLOAD_FILE_NAME_INVALID",
      "Nama file upload harus berupa nama ZIP sederhana maksimal 255 karakter.",
      400,
    );
  }
  return normalized;
}

async function findDuplicateSession(
  organizationId: string,
  fileSha256: string,
) {
  const [existing] = await db
    .select({
      id: productBatchImportSessions.id,
      status: productBatchImportSessions.status,
    })
    .from(productBatchImportSessions)
    .where(
      and(
        eq(productBatchImportSessions.organizationId, organizationId),
        eq(productBatchImportSessions.fileSha256, fileSha256),
        inArray(productBatchImportSessions.status, DUPLICATE_GUARD_STATUSES),
      ),
    )
    .limit(1);

  return existing ?? null;
}

async function buildLookups(
  organizationId: string,
  categoryCodes: string[],
  outletCodes: string[],
): Promise<ProductBatchValidationLookups> {
  const [categoryRows, outletRows] = await Promise.all([
    categoryCodes.length
      ? db
          .select({ id: productCategories.id, code: productCategories.code })
          .from(productCategories)
          .where(
            and(
              eq(productCategories.organizationId, organizationId),
              eq(productCategories.isActive, true),
              inArray(productCategories.code, categoryCodes),
            ),
          )
      : Promise.resolve([]),
    outletCodes.length
      ? db
          .select({ id: outlets.id, code: outlets.code })
          .from(outlets)
          .where(
            and(
              eq(outlets.organizationId, organizationId),
              eq(outlets.isActive, true),
              inArray(outlets.code, outletCodes),
            ),
          )
      : Promise.resolve([]),
  ]);

  return {
    categoriesByCode: new Map(categoryRows.map((row) => [row.code, row])),
    outletsByCode: new Map(outletRows.map((row) => [row.code, row])),
  };
}

function mediaRowsForPackage({
  sessionId,
  organizationId,
  parsed,
  validation,
}: {
  sessionId: string;
  organizationId: string;
  parsed: Awaited<ReturnType<typeof parseProductBatchImportPackage>>;
  validation: ReturnType<typeof validateProductBatchImportPackage>;
}) {
  const masterStagingKeyByRow = new Map(
    validation.masterRows.map((row) => [row.rowNumber, row.stagingMasterKey]),
  );
  const itemStagingKeyByRow = new Map(
    validation.itemRows.map((row) => [row.rowNumber, row.stagingRowKey]),
  );

  return parsed.images.entries.flatMap((entry) => {
    const reference = entry.references[0];
    if (!reference) return [];

    const targetKey =
      entry.entityKind === "master"
        ? masterStagingKeyByRow.get(reference.rowNumber)
        : itemStagingKeyByRow.get(reference.rowNumber);
    if (!targetKey) return [];

    const mediaId = randomUUID();
    return [
      {
        id: mediaId,
        sessionId,
        archivePath: entry.archivePath,
        entityKind: entry.entityKind === "master" ? ("master" as const) : ("item" as const),
        masterKey: entry.entityKind === "master" ? targetKey : null,
        rowKey: entry.entityKind === "physical" ? targetKey : null,
        sha256: entry.sha256,
        contentType: entry.contentType,
        byteSize: entry.byteSize,
        width: entry.width,
        height: entry.height,
        stagingKey: buildProductBatchImportMediaStorageKey({
          organizationId,
          sessionId,
          mediaId,
        }),
        finalKey: null,
        status: "validated" as const,
        sourceEntry: parsed.archive.imageEntries.find(
          (archiveEntry) => archiveEntry.path === entry.archivePath,
        ),
      },
    ];
  });
}

async function stageFiles({
  archiveBuffer,
  archiveStorageKey,
  mediaRows,
}: {
  archiveBuffer: Buffer;
  archiveStorageKey: string;
  mediaRows: ReturnType<typeof mediaRowsForPackage>;
}) {
  const createdKeys: string[] = [];
  try {
    await storeProductBatchImportStagingFile({
      key: archiveStorageKey,
      buffer: archiveBuffer,
      contentType: "application/zip",
    });
    createdKeys.push(archiveStorageKey);

    for (const media of mediaRows) {
      if (!media.sourceEntry) {
        throw serviceError(
          "MEDIA_SOURCE_MISSING",
          `Archive entry untuk media ${media.archivePath} tidak ditemukan.`,
          500,
        );
      }
      const bytes = extractProductBatchArchiveEntry(
        archiveBuffer,
        media.sourceEntry,
      );
      await storeProductBatchImportStagingFile({
        key: media.stagingKey,
        buffer: bytes,
        contentType: media.contentType,
      });
      createdKeys.push(media.stagingKey);
    }

    return createdKeys;
  } catch (error) {
    await deleteProductBatchImportStagingFiles(createdKeys);
    throw error;
  }
}

async function markSessionFailed(
  sessionId: string,
  organizationId: string,
  error: unknown,
) {
  const message =
    error instanceof Error ? error.message.slice(0, 4_000) : "Staging gagal.";
  const code =
    error instanceof ProductBatchImportServiceError
      ? error.code
      : "STAGING_FAILED";

  await db
    .update(productBatchImportSessions)
    .set({
      status: "failed",
      failureCode: code.slice(0, 120),
      failureMessage: message,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(productBatchImportSessions.id, sessionId),
        eq(productBatchImportSessions.organizationId, organizationId),
      ),
    )
    .catch(() => undefined);
}

export async function createProductBatchImportSession({
  auth,
  fileName,
  archiveBuffer,
  requestMetadata = {},
  now = new Date(),
}: {
  auth: AuthContext;
  fileName: string;
  archiveBuffer: Buffer;
  requestMetadata?: ProductBatchImportRequestMetadata;
  now?: Date;
}): Promise<ProductBatchImportSessionSummary> {
  assertPermission(auth, "products.batch_import");
  const normalizedFileName = normalizeProductBatchImportFileName(fileName);

  if (
    archiveBuffer.length <= 0 ||
    archiveBuffer.length > PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes
  ) {
    throw serviceError(
      "UPLOAD_SIZE_INVALID",
      "Ukuran ZIP harus lebih dari 0 dan maksimal 100 MB.",
      archiveBuffer.length > PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes
        ? 413
        : 400,
    );
  }

  const fileSha256 = createHash("sha256").update(archiveBuffer).digest("hex");
  const duplicateBeforeParse = await findDuplicateSession(
    auth.organization.id,
    fileSha256,
  );
  if (duplicateBeforeParse) {
    throw new ProductBatchImportDuplicateError(
      duplicateBeforeParse.id,
      duplicateBeforeParse.status,
    );
  }

  const parsed = await parseProductBatchImportPackage(archiveBuffer);
  if (parsed.archive.archiveSha256 !== fileSha256) {
    throw serviceError(
      "ARCHIVE_HASH_MISMATCH",
      "SHA-256 archive berubah selama parsing.",
      500,
    );
  }
  if (parsed.workbook.templateVersion !== PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION) {
    throw serviceError(
      "TEMPLATE_VERSION_UNSUPPORTED",
      `Template version ${parsed.workbook.templateVersion || "kosong"} tidak didukung.`,
      422,
    );
  }

  const lookupCodes = collectProductBatchLookupCodes(parsed.workbook);
  const lookups = await buildLookups(
    auth.organization.id,
    lookupCodes.categoryCodes,
    lookupCodes.outletCodes,
  );
  const validation = validateProductBatchImportPackage({
    workbook: parsed.workbook,
    images: parsed.images,
    lookups,
    auth,
  });

  const sessionId = randomUUID();
  const expiresAt = new Date(now.getTime() + PRODUCT_BATCH_IMPORT_SESSION_TTL_MS);
  const archiveStorageKey = buildProductBatchImportArchiveStorageKey({
    organizationId: auth.organization.id,
    sessionId,
  });
  const stagedMedia = mediaRowsForPackage({
    sessionId,
    organizationId: auth.organization.id,
    parsed,
    validation,
  });
  const createdStorageKeys = await stageFiles({
    archiveBuffer,
    archiveStorageKey,
    mediaRows: stagedMedia,
  });

  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`product-batch-import:${auth.organization.id}:${fileSha256}`}))`,
      );

      const [duplicate] = await transaction
        .select({
          id: productBatchImportSessions.id,
          status: productBatchImportSessions.status,
        })
        .from(productBatchImportSessions)
        .where(
          and(
            eq(
              productBatchImportSessions.organizationId,
              auth.organization.id,
            ),
            eq(productBatchImportSessions.fileSha256, fileSha256),
            inArray(
              productBatchImportSessions.status,
              DUPLICATE_GUARD_STATUSES,
            ),
          ),
        )
        .limit(1);

      if (duplicate) {
        throw new ProductBatchImportDuplicateError(
          duplicate.id,
          duplicate.status,
        );
      }

      await transaction.insert(productBatchImportSessions).values({
        id: sessionId,
        organizationId: auth.organization.id,
        createdByUserId: auth.user.id,
        fileName: normalizedFileName,
        fileSha256,
        fileSizeBytes: archiveBuffer.length,
        templateVersion: Number(PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION),
        status: "uploaded",
        storageKey: archiveStorageKey,
        totalMasterRows: parsed.workbook.masterRows.length,
        totalItemRows: parsed.workbook.itemRows.length,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });
    });

    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`product-batch-import-session:${sessionId}`}))`,
      );

      const [session] = await transaction
        .select({ status: productBatchImportSessions.status })
        .from(productBatchImportSessions)
        .where(
          and(
            eq(productBatchImportSessions.id, sessionId),
            eq(
              productBatchImportSessions.organizationId,
              auth.organization.id,
            ),
          ),
        )
        .limit(1);

      if (!session || session.status !== "uploaded") {
        throw serviceError(
          "SESSION_STATE_INVALID",
          "Session upload tidak berada pada state uploaded.",
          409,
        );
      }

      await transaction
        .update(productBatchImportSessions)
        .set({ status: "validating", updatedAt: now })
        .where(eq(productBatchImportSessions.id, sessionId));

      if (validation.masterRows.length > 0) {
        await transaction.insert(productBatchImportMasterRows).values(
          validation.masterRows.map((row) => ({
            sessionId,
            rowNumber: row.rowNumber,
            masterKey: row.stagingMasterKey,
            rawPayload: row.rawPayload,
            normalizedPayload: row.normalizedPayload,
            validationStatus: row.validationStatus,
            validationErrors: row.validationErrors,
            validationWarnings: row.validationWarnings,
            resolvedCategoryId: row.resolvedCategoryId,
          })),
        );
      }

      if (validation.itemRows.length > 0) {
        await transaction.insert(productBatchImportItemRows).values(
          validation.itemRows.map((row) => ({
            sessionId,
            rowNumber: row.rowNumber,
            rowKey: row.stagingRowKey,
            masterKey: row.stagingMasterKey,
            rawPayload: row.rawPayload,
            normalizedPayload: row.normalizedPayload,
            validationStatus: row.validationStatus,
            validationErrors: row.validationErrors,
            validationWarnings: row.validationWarnings,
            resolvedOutletId: row.resolvedOutletId,
          })),
        );
      }

      if (stagedMedia.length > 0) {
        await transaction.insert(productBatchImportMedia).values(
          stagedMedia.map(({ sourceEntry, ...media }) => {
            void sourceEntry;
            return media;
          }),
        );
      }

      const finalStatus = validation.invalidRows > 0 ? "invalid" : "ready";
      await transaction
        .update(productBatchImportSessions)
        .set({
          status: finalStatus,
          validMasterRows: validation.validMasterRows,
          validItemRows: validation.validItemRows,
          invalidRows: validation.invalidRows,
          warningCount: validation.warningCount,
          failureCode: null,
          failureMessage: null,
          validatedAt: now,
          updatedAt: now,
        })
        .where(eq(productBatchImportSessions.id, sessionId));

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "products.batch_import.upload",
        entityType: "product_batch_import_session",
        entityId: sessionId,
        afterData: {
          fileName: normalizedFileName,
          fileSha256,
          fileSizeBytes: archiveBuffer.length,
          templateVersion: PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
          status: finalStatus,
          totalMasterRows: parsed.workbook.masterRows.length,
          totalItemRows: parsed.workbook.itemRows.length,
          validMasterRows: validation.validMasterRows,
          validItemRows: validation.validItemRows,
          invalidRows: validation.invalidRows,
          warningCount: validation.warningCount,
          stagedMediaCount: stagedMedia.length,
        },
        ipAddress: requestMetadata.ipAddress?.slice(0, 64) ?? null,
        userAgent: requestMetadata.userAgent?.slice(0, 1_000) ?? null,
        metadata: { source: "admin.products.batch_import" },
        createdAt: now,
      });
    });
  } catch (error) {
    await deleteProductBatchImportStagingFiles(createdStorageKeys);
    if (error instanceof ProductBatchImportDuplicateError) {
      throw error;
    }
    await markSessionFailed(sessionId, auth.organization.id, error);
    throw error;
  }

  return {
    id: sessionId,
    status: validation.invalidRows > 0 ? "invalid" : "ready",
    fileName: normalizedFileName,
    fileSha256,
    totalMasterRows: parsed.workbook.masterRows.length,
    totalItemRows: parsed.workbook.itemRows.length,
    validMasterRows: validation.validMasterRows,
    validItemRows: validation.validItemRows,
    invalidRows: validation.invalidRows,
    warningCount: validation.warningCount,
    expiresAt,
  };
}

async function getSessionStorageKeys({
  sessionId,
  organizationId,
}: {
  sessionId: string;
  organizationId: string;
}) {
  const [session] = await db
    .select({ storageKey: productBatchImportSessions.storageKey })
    .from(productBatchImportSessions)
    .where(
      and(
        eq(productBatchImportSessions.id, sessionId),
        eq(productBatchImportSessions.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!session) return null;

  const media = await db
    .select({ stagingKey: productBatchImportMedia.stagingKey })
    .from(productBatchImportMedia)
    .where(eq(productBatchImportMedia.sessionId, sessionId));

  return [session.storageKey, ...media.map((row) => row.stagingKey)];
}

async function finalizeCleanupStatus({
  sessionId,
  organizationId,
  failures,
}: {
  sessionId: string;
  organizationId: string;
  failures: Array<{ key: string; message: string }>;
}) {
  const now = new Date();
  if (failures.length === 0) {
    await db
      .update(productBatchImportMedia)
      .set({ status: "deleted" })
      .where(eq(productBatchImportMedia.sessionId, sessionId));
    return;
  }

  await db
    .update(productBatchImportSessions)
    .set({
      failureCode: "STAGING_CLEANUP_INCOMPLETE",
      failureMessage: failures
        .map((failure) => `${failure.key}: ${failure.message}`)
        .join("\n")
        .slice(0, 4_000),
      updatedAt: now,
    })
    .where(
      and(
        eq(productBatchImportSessions.id, sessionId),
        eq(productBatchImportSessions.organizationId, organizationId),
      ),
    );
}

export async function cancelProductBatchImportSession({
  auth,
  sessionId,
  requestMetadata = {},
  now = new Date(),
}: {
  auth: AuthContext;
  sessionId: string;
  requestMetadata?: ProductBatchImportRequestMetadata;
  now?: Date;
}) {
  assertPermission(auth, "products.batch_import");

  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`product-batch-import-session:${sessionId}`}))`,
    );
    const [session] = await transaction
      .select({ status: productBatchImportSessions.status })
      .from(productBatchImportSessions)
      .where(
        and(
          eq(productBatchImportSessions.id, sessionId),
          eq(productBatchImportSessions.organizationId, auth.organization.id),
        ),
      )
      .limit(1);

    if (!session) {
      throw serviceError("SESSION_NOT_FOUND", "Session import tidak ditemukan.", 404);
    }
    if (!CANCELLABLE_STATUSES.includes(session.status as (typeof CANCELLABLE_STATUSES)[number])) {
      throw serviceError(
        "SESSION_NOT_CANCELLABLE",
        "Session ini tidak dapat dibatalkan pada state saat ini.",
        409,
      );
    }

    await transaction
      .update(productBatchImportSessions)
      .set({
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(productBatchImportSessions.id, sessionId));

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      actorUserId: auth.user.id,
      action: "products.batch_import.cancel",
      entityType: "product_batch_import_session",
      entityId: sessionId,
      afterData: { status: "cancelled" },
      ipAddress: requestMetadata.ipAddress?.slice(0, 64) ?? null,
      userAgent: requestMetadata.userAgent?.slice(0, 1_000) ?? null,
      metadata: { source: "admin.products.batch_import" },
      createdAt: now,
    });
  });

  const keys = await getSessionStorageKeys({
    sessionId,
    organizationId: auth.organization.id,
  });
  if (!keys) return;
  const failures = await deleteProductBatchImportStagingFiles(keys);
  await finalizeCleanupStatus({
    sessionId,
    organizationId: auth.organization.id,
    failures,
  });
}

export async function expireProductBatchImportSessions({
  now = new Date(),
  limit = 50,
}: {
  now?: Date;
  limit?: number;
} = {}) {
  const boundedLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const candidates = await db
    .select({
      id: productBatchImportSessions.id,
      organizationId: productBatchImportSessions.organizationId,
    })
    .from(productBatchImportSessions)
    .where(
      and(
        lte(productBatchImportSessions.expiresAt, now),
        inArray(productBatchImportSessions.status, CANCELLABLE_STATUSES),
      ),
    )
    .orderBy(asc(productBatchImportSessions.expiresAt))
    .limit(boundedLimit);

  let expired = 0;
  let cleanupFailures = 0;

  for (const candidate of candidates) {
    let transitioned = false;
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`product-batch-import-session:${candidate.id}`}))`,
      );
      const [session] = await transaction
        .select({
          status: productBatchImportSessions.status,
          expiresAt: productBatchImportSessions.expiresAt,
        })
        .from(productBatchImportSessions)
        .where(
          and(
            eq(productBatchImportSessions.id, candidate.id),
            eq(
              productBatchImportSessions.organizationId,
              candidate.organizationId,
            ),
          ),
        )
        .limit(1);

      if (
        !session ||
        !CANCELLABLE_STATUSES.includes(
          session.status as (typeof CANCELLABLE_STATUSES)[number],
        ) ||
        !session.expiresAt ||
        session.expiresAt.getTime() > now.getTime()
      ) {
        return;
      }

      await transaction
        .update(productBatchImportSessions)
        .set({ status: "expired", updatedAt: now })
        .where(eq(productBatchImportSessions.id, candidate.id));

      await transaction.insert(auditLogs).values({
        organizationId: candidate.organizationId,
        actorUserId: null,
        action: "products.batch_import.expire",
        entityType: "product_batch_import_session",
        entityId: candidate.id,
        afterData: { status: "expired" },
        metadata: { source: "product_batch_import_maintenance" },
        createdAt: now,
      });
      transitioned = true;
    });

    if (!transitioned) continue;
    expired += 1;
    const keys = await getSessionStorageKeys({
      sessionId: candidate.id,
      organizationId: candidate.organizationId,
    });
    if (!keys) continue;
    const failures = await deleteProductBatchImportStagingFiles(keys);
    if (failures.length > 0) cleanupFailures += 1;
    await finalizeCleanupStatus({
      sessionId: candidate.id,
      organizationId: candidate.organizationId,
      failures,
    });
  }

  return { scanned: candidates.length, expired, cleanupFailures };
}
