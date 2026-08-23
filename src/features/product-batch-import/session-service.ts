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
  productMasters,
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
  PRODUCT_BATCH_IMPORT_LEGACY_TEMPLATE_VERSION,
  PRODUCT_BATCH_IMPORT_SESSION_TTL_MS,
  PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
} from "./contracts";
import { extractProductBatchArchiveEntry } from "./archive-parser";
import { parseProductBatchImportPackage } from "./package-parser";
import {
  logProductBatchImportError,
  logProductBatchImportEvent,
} from "./observability";
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
  templateVersion: number;
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
  const lower = normalized.toLocaleLowerCase("en-US");
  if (
    !normalized ||
    normalized.length > 255 ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.startsWith(".") ||
    (!lower.endsWith(".zip") && !lower.endsWith(".xlsx"))
  ) {
    throw serviceError(
      "UPLOAD_FILE_NAME_INVALID",
      "Nama file upload harus berupa nama .zip atau .xlsx sederhana maksimal 255 karakter.",
      400,
    );
  }
  return normalized;
}

export function getProductBatchImportUploadLimit(fileName: string) {
  return fileName.toLocaleLowerCase("en-US").endsWith(".xlsx")
    ? PRODUCT_BATCH_IMPORT_LIMITS.xlsxUploadBytes
    : PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes;
}

export function getProductBatchImportUploadContentType(fileName: string) {
  return fileName.toLocaleLowerCase("en-US").endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/zip";
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

function normalizeLookupText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("id-ID");
}

async function buildLookups(
  organizationId: string,
  _categoryInputs: string[],
  outletCodes: string[],
): Promise<ProductBatchValidationLookups> {
  const [categoryRows, masterRows, outletRows] = await Promise.all([
    db
      .select({
        id: productCategories.id,
        code: productCategories.code,
        name: productCategories.name,
        isActive: productCategories.isActive,
      })
      .from(productCategories)
      .where(eq(productCategories.organizationId, organizationId)),
    db
      .select({
        id: productMasters.id,
        categoryId: productMasters.categoryId,
        name: productMasters.name,
        status: productMasters.status,
      })
      .from(productMasters)
      .where(eq(productMasters.organizationId, organizationId)),
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

  const categoriesByCode = new Map(
    categoryRows
      .filter((row) => row.isActive)
      .map((row) => [row.code, row] as const),
  );
  const categoriesByLookupKey = new Map<string, typeof categoryRows>();
  for (const category of categoryRows) {
    for (const key of new Set([
      normalizeLookupText(category.code),
      normalizeLookupText(category.name),
    ])) {
      const rows = categoriesByLookupKey.get(key) ?? [];
      if (!rows.some((row) => row.id === category.id)) rows.push(category);
      categoriesByLookupKey.set(key, rows);
    }
  }

  const mastersByCategoryAndName = new Map<string, typeof masterRows>();
  for (const master of masterRows) {
    const key = `${master.categoryId}:${normalizeLookupText(master.name)}`;
    const rows = mastersByCategoryAndName.get(key) ?? [];
    rows.push(master);
    mastersByCategoryAndName.set(key, rows);
  }

  return {
    categoriesByCode,
    categoriesByLookupKey,
    mastersByCategoryAndName,
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
        sourceBytes: entry.sourceBytes ?? null,
        sourceEntry:
          parsed.archive?.imageEntries.find(
            (archiveEntry) => archiveEntry.path === entry.archivePath,
          ) ?? null,
      },
    ];
  });
}

async function stageFiles({
  archiveBuffer,
  archiveStorageKey,
  archiveContentType,
  mediaRows,
}: {
  archiveBuffer: Buffer;
  archiveStorageKey: string;
  archiveContentType: string;
  mediaRows: ReturnType<typeof mediaRowsForPackage>;
}) {
  const createdKeys: string[] = [];
  try {
    await storeProductBatchImportStagingFile({
      key: archiveStorageKey,
      buffer: archiveBuffer,
      contentType: archiveContentType,
    });
    createdKeys.push(archiveStorageKey);

    for (const media of mediaRows) {
      const bytes = media.sourceBytes ??
        (media.sourceEntry
          ? extractProductBatchArchiveEntry(archiveBuffer, media.sourceEntry)
          : null);
      if (!bytes) {
        throw serviceError(
          "MEDIA_SOURCE_MISSING",
          `Source media ${media.archivePath} tidak ditemukan pada upload package.`,
          500,
        );
      }
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

export type CreateProductBatchImportSessionInput = {
  auth: AuthContext;
  fileName: string;
  archiveBuffer: Buffer;
  requestMetadata?: ProductBatchImportRequestMetadata;
  now?: Date;
};

async function createProductBatchImportSessionInternal({
  auth,
  fileName,
  archiveBuffer,
  requestMetadata = {},
  now = new Date(),
}: CreateProductBatchImportSessionInput): Promise<ProductBatchImportSessionSummary> {
  assertPermission(auth, "products.batch_import");
  const normalizedFileName = normalizeProductBatchImportFileName(fileName);

  const uploadLimit = getProductBatchImportUploadLimit(normalizedFileName);
  if (archiveBuffer.length <= 0 || archiveBuffer.length > uploadLimit) {
    throw serviceError(
      "UPLOAD_SIZE_INVALID",
      "Ukuran file harus lebih dari 0 dan maksimal 100 MB.",
      archiveBuffer.length > uploadLimit ? 413 : 400,
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

  const parsed = await parseProductBatchImportPackage(archiveBuffer, {
    fileName: normalizedFileName,
  });
  if (parsed.fileSha256 !== fileSha256) {
    throw serviceError(
      "PACKAGE_HASH_MISMATCH",
      "SHA-256 file berubah selama parsing.",
      500,
    );
  }
  if (
    parsed.workbook.templateVersion !== PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION &&
    parsed.workbook.templateVersion !== PRODUCT_BATCH_IMPORT_LEGACY_TEMPLATE_VERSION
  ) {
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
    archiveContentType: getProductBatchImportUploadContentType(normalizedFileName),
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
        templateVersion: Number(parsed.workbook.templateVersion),
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
          stagedMedia.map(({ sourceBytes, sourceEntry, ...media }) => {
            void sourceBytes;
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
          templateVersion: parsed.workbook.templateVersion,
          packageKind: parsed.packageKind,
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
    templateVersion: Number(parsed.workbook.templateVersion),
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

export async function createProductBatchImportSession(
  input: CreateProductBatchImportSessionInput,
): Promise<ProductBatchImportSessionSummary> {
  const startedAtMs = Date.now();
  try {
    const result = await createProductBatchImportSessionInternal(input);
    logProductBatchImportEvent({
      event: "upload_validated",
      sessionId: result.id,
      organizationId: input.auth.organization.id,
      durationMs: Date.now() - startedAtMs,
      status: result.status,
      totalMasterRows: result.totalMasterRows,
      totalItemRows: result.totalItemRows,
      validMasterRows: result.validMasterRows,
      validItemRows: result.validItemRows,
      invalidRows: result.invalidRows,
      warningCount: result.warningCount,
      fileSizeBytes: input.archiveBuffer.length,
    });
    return result;
  } catch (error) {
    logProductBatchImportError({
      event: "upload_failed",
      organizationId: input.auth.organization.id,
      durationMs: Date.now() - startedAtMs,
      fileSizeBytes: input.archiveBuffer.length,
      error,
    });
    throw error;
  }
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
