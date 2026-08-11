import { createHash, randomUUID } from "node:crypto";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  inventoryMovements,
  itemBarcodes,
  outlets,
  productBatchImportItemRows,
  productBatchImportMasterRows,
  productBatchImportMedia,
  productBatchImportSessions,
  productCategories,
  productItems,
  productMasters,
} from "@/db/schema";
import { getNextProductItemIdentifiers } from "@/features/inventory/product-item-identifiers";
import type { AuthContext } from "@/lib/auth/session";
import {
  deleteImageFileStrict,
  storeImageBuffer,
} from "@/lib/storage/image-storage";
import {
  deleteProductBatchImportStagingFiles,
  productBatchImportStorageKeyBelongsToSession,
  readProductBatchImportStagingFile,
} from "@/lib/storage/product-batch-import-storage";

import { getNextProductMasterCode } from "./product-master-identifiers";

export type ProductBatchImportCommitRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ProductBatchImportCommitResult = {
  sessionId: string;
  committedMasterCount: number;
  committedItemCount: number;
  availableItemCount: number;
  draftItemCount: number;
  committedAt: Date;
  stagingCleanupWarnings: number;
};

export type ProductBatchImportCommitTestFailpoint =
  | "after_first_media_promotion"
  | "after_first_identifier_allocation";

export class ProductBatchImportCommitError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProductBatchImportCommitError";
  }
}

function commitError(
  code: string,
  message: string,
  statusCode = 400,
  cause?: unknown,
) {
  return new ProductBatchImportCommitError(
    code,
    message,
    statusCode,
    cause === undefined ? undefined : { cause },
  );
}

function assertPermission(auth: AuthContext, permission: string) {
  if (!auth.permissionCodes.includes(permission)) {
    throw commitError(
      "COMMIT_PERMISSION_REQUIRED",
      `Permission ${permission} diperlukan saat commit Product Batch Import.`,
      403,
    );
  }
}

function assertInventoryPermission(auth: AuthContext) {
  if (
    !auth.permissionCodes.includes("inventory.receive") &&
    !auth.permissionCodes.includes("inventory.manage")
  ) {
    throw commitError(
      "COMMIT_INVENTORY_PERMISSION_REQUIRED",
      "Permission inventory.receive atau inventory.manage diperlukan saat commit Product Batch Import.",
      403,
    );
  }
}

function text(payload: Record<string, unknown>, field: string) {
  const value = payload[field];
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value).trim();
}

function nullableText(payload: Record<string, unknown>, field: string) {
  const value = text(payload, field);
  return value ? value : null;
}

function hasFinancialInput(payload: Record<string, unknown>) {
  return [
    "cost_amount",
    "selling_amount",
    "price_per_gram",
    "deduction_per_gram",
  ].some((field) => nullableText(payload, field) !== null);
}

function getDatabaseError(error: unknown): {
  code?: unknown;
  constraint?: unknown;
} {
  if (typeof error !== "object" || error === null) return {};
  const databaseError = error as {
    code?: unknown;
    constraint?: unknown;
    cause?: { code?: unknown; constraint?: unknown };
  };
  return {
    code: databaseError.code ?? databaseError.cause?.code,
    constraint: databaseError.constraint ?? databaseError.cause?.constraint,
  };
}

function uniqueStrings(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => !!value)),
  );
}

type PlannedMasterRow = {
  id: string;
  rowNumber: number;
  masterKey: string;
  normalizedPayload: Record<string, unknown>;
  validationStatus: "pending" | "valid" | "warning" | "invalid";
  resolvedCategoryId: string | null;
  plannedProductMasterId: string;
  committedProductMasterId: string | null;
};

type PlannedItemRow = {
  id: string;
  rowNumber: number;
  rowKey: string;
  masterKey: string;
  normalizedPayload: Record<string, unknown>;
  validationStatus: "pending" | "valid" | "warning" | "invalid";
  resolvedOutletId: string | null;
  plannedProductItemId: string;
  committedProductItemId: string | null;
  generatedSku: string | null;
  generatedBarcode: string | null;
  generatedQrValue: string | null;
};

type PlannedMediaRow = {
  id: string;
  entityKind: "master" | "item";
  masterKey: string | null;
  rowKey: string | null;
  sha256: string;
  stagingKey: string;
  finalKey: string | null;
  status: "staged" | "validated" | "promoted" | "failed" | "deleted";
};

type CommitPlan = {
  sessionId: string;
  organizationId: string;
  storageKey: string;
  fileSha256: string;
  totalMasterRows: number;
  totalItemRows: number;
  masters: PlannedMasterRow[];
  items: PlannedItemRow[];
  media: PlannedMediaRow[];
};

async function prepareCommitPlan({
  auth,
  sessionId,
  requestMetadata,
  now,
}: {
  auth: AuthContext;
  sessionId: string;
  requestMetadata: ProductBatchImportCommitRequestMetadata;
  now: Date;
}): Promise<CommitPlan> {
  assertPermission(auth, "products.batch_import");

  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`product-batch-import-session:${sessionId}`}))`,
    );

    const [session] = await transaction
      .select({
        id: productBatchImportSessions.id,
        organizationId: productBatchImportSessions.organizationId,
        storageKey: productBatchImportSessions.storageKey,
        fileSha256: productBatchImportSessions.fileSha256,
        status: productBatchImportSessions.status,
        totalMasterRows: productBatchImportSessions.totalMasterRows,
        totalItemRows: productBatchImportSessions.totalItemRows,
        validMasterRows: productBatchImportSessions.validMasterRows,
        validItemRows: productBatchImportSessions.validItemRows,
        invalidRows: productBatchImportSessions.invalidRows,
        expiresAt: productBatchImportSessions.expiresAt,
      })
      .from(productBatchImportSessions)
      .where(
        and(
          eq(productBatchImportSessions.id, sessionId),
          eq(productBatchImportSessions.organizationId, auth.organization.id),
        ),
      )
      .limit(1);

    if (!session) {
      throw commitError(
        "SESSION_NOT_FOUND",
        "Session Product Batch Import tidak ditemukan.",
        404,
      );
    }
    if (session.status !== "ready") {
      throw commitError(
        "SESSION_NOT_READY",
        `Session tidak dapat di-commit karena status saat ini ${session.status}.`,
        409,
      );
    }
    if (session.expiresAt && session.expiresAt.getTime() <= now.getTime()) {
      throw commitError(
        "SESSION_EXPIRED",
        "Session Product Batch Import sudah melewati batas waktu staging. Upload ulang file sebelum commit.",
        409,
      );
    }
    if (
      session.invalidRows !== 0 ||
      session.validMasterRows !== session.totalMasterRows ||
      session.validItemRows !== session.totalItemRows
    ) {
      throw commitError(
        "SESSION_VALIDATION_SNAPSHOT_INVALID",
        "Session ready tidak memiliki validation counts yang konsisten.",
        409,
      );
    }

    const [masterRows, itemRows, mediaRows] = await Promise.all([
      transaction
        .select({
          id: productBatchImportMasterRows.id,
          rowNumber: productBatchImportMasterRows.rowNumber,
          masterKey: productBatchImportMasterRows.masterKey,
          normalizedPayload: productBatchImportMasterRows.normalizedPayload,
          validationStatus: productBatchImportMasterRows.validationStatus,
          resolvedCategoryId: productBatchImportMasterRows.resolvedCategoryId,
          plannedProductMasterId:
            productBatchImportMasterRows.plannedProductMasterId,
          committedProductMasterId:
            productBatchImportMasterRows.committedProductMasterId,
        })
        .from(productBatchImportMasterRows)
        .where(eq(productBatchImportMasterRows.sessionId, sessionId))
        .orderBy(asc(productBatchImportMasterRows.rowNumber)),
      transaction
        .select({
          id: productBatchImportItemRows.id,
          rowNumber: productBatchImportItemRows.rowNumber,
          rowKey: productBatchImportItemRows.rowKey,
          masterKey: productBatchImportItemRows.masterKey,
          normalizedPayload: productBatchImportItemRows.normalizedPayload,
          validationStatus: productBatchImportItemRows.validationStatus,
          resolvedOutletId: productBatchImportItemRows.resolvedOutletId,
          plannedProductItemId: productBatchImportItemRows.plannedProductItemId,
          committedProductItemId:
            productBatchImportItemRows.committedProductItemId,
          generatedSku: productBatchImportItemRows.generatedSku,
          generatedBarcode: productBatchImportItemRows.generatedBarcode,
          generatedQrValue: productBatchImportItemRows.generatedQrValue,
        })
        .from(productBatchImportItemRows)
        .where(eq(productBatchImportItemRows.sessionId, sessionId))
        .orderBy(asc(productBatchImportItemRows.rowNumber)),
      transaction
        .select({
          id: productBatchImportMedia.id,
          entityKind: productBatchImportMedia.entityKind,
          masterKey: productBatchImportMedia.masterKey,
          rowKey: productBatchImportMedia.rowKey,
          sha256: productBatchImportMedia.sha256,
          stagingKey: productBatchImportMedia.stagingKey,
          finalKey: productBatchImportMedia.finalKey,
          status: productBatchImportMedia.status,
        })
        .from(productBatchImportMedia)
        .where(eq(productBatchImportMedia.sessionId, sessionId)),
    ]);

    if (
      masterRows.length !== session.totalMasterRows ||
      itemRows.length !== session.totalItemRows
    ) {
      throw commitError(
        "STAGING_ROW_COUNT_MISMATCH",
        "Jumlah staging row berubah sejak validation.",
        409,
      );
    }

    for (const row of [...masterRows, ...itemRows]) {
      if (
        row.validationStatus !== "valid" &&
        row.validationStatus !== "warning"
      ) {
        throw commitError(
          "STAGING_ROW_NOT_COMMITTABLE",
          "Terdapat staging row yang tidak lagi valid untuk commit.",
          409,
        );
      }
    }

    if (
      masterRows.some(
        (row) =>
          row.plannedProductMasterId !== null ||
          row.committedProductMasterId !== null,
      ) ||
      itemRows.some(
        (row) =>
          row.plannedProductItemId !== null ||
          row.committedProductItemId !== null ||
          row.generatedSku !== null ||
          row.generatedBarcode !== null ||
          row.generatedQrValue !== null,
      ) ||
      mediaRows.some(
        (row) => row.finalKey !== null || row.status !== "validated",
      )
    ) {
      throw commitError(
        "SESSION_ALREADY_PLANNED",
        "Session sudah pernah memasuki proses commit dan tidak dapat dijalankan ulang.",
        409,
      );
    }

    assertPermission(auth, "products.manage");
    if (itemRows.length > 0) {
      assertInventoryPermission(auth);
    }
    if (itemRows.some((row) => hasFinancialInput(row.normalizedPayload))) {
      assertPermission(auth, "pricing.manage");
    }

    const categoryIds = uniqueStrings(
      masterRows.map((row) => row.resolvedCategoryId),
    );
    if (masterRows.some((row) => !row.resolvedCategoryId)) {
      throw commitError(
        "CATEGORY_SNAPSHOT_MISSING",
        "Resolved category staging tidak lengkap.",
        409,
      );
    }
    if (categoryIds.length > 0) {
      const activeCategories = await transaction
        .select({ id: productCategories.id })
        .from(productCategories)
        .where(
          and(
            eq(productCategories.organizationId, auth.organization.id),
            eq(productCategories.isActive, true),
            inArray(productCategories.id, categoryIds),
          ),
        );
      if (activeCategories.length !== categoryIds.length) {
        throw commitError(
          "CATEGORY_CHANGED_SINCE_VALIDATION",
          "Satu atau lebih category berubah/nonaktif setelah preview. Upload ulang batch untuk validation terbaru.",
          409,
        );
      }
    }

    const outletIds = uniqueStrings(
      itemRows.map((row) => row.resolvedOutletId),
    );
    const allowedOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));
    if (outletIds.some((outletId) => !allowedOutletIds.has(outletId))) {
      throw commitError(
        "OUTLET_ACCESS_CHANGED_SINCE_VALIDATION",
        "Akses outlet berubah setelah preview. Upload ulang batch untuk validation terbaru.",
        403,
      );
    }
    if (outletIds.length > 0) {
      const activeOutlets = await transaction
        .select({ id: outlets.id })
        .from(outlets)
        .where(
          and(
            eq(outlets.organizationId, auth.organization.id),
            eq(outlets.isActive, true),
            inArray(outlets.id, outletIds),
          ),
        );
      if (activeOutlets.length !== outletIds.length) {
        throw commitError(
          "OUTLET_CHANGED_SINCE_VALIDATION",
          "Satu atau lebih outlet berubah/nonaktif setelah preview. Upload ulang batch untuk validation terbaru.",
          409,
        );
      }
    }

    const masterKeys = new Set(masterRows.map((row) => row.masterKey));
    const masterMediaKeys = new Set(
      mediaRows
        .filter((row) => row.entityKind === "master" && row.masterKey)
        .map((row) => row.masterKey as string),
    );
    for (const row of masterRows) {
      if (!masterMediaKeys.has(row.masterKey)) {
        throw commitError(
          "MASTER_MEDIA_SNAPSHOT_MISSING",
          `Primary image staging untuk ${row.masterKey} tidak tersedia.`,
          409,
        );
      }
    }
    for (const row of itemRows) {
      if (!masterKeys.has(row.masterKey)) {
        throw commitError(
          "ITEM_MASTER_SNAPSHOT_MISSING",
          `Parent staging master untuk ${row.rowKey} tidak tersedia.`,
          409,
        );
      }
      const physicalImage = nullableText(
        row.normalizedPayload,
        "physical_image",
      );
      if (
        physicalImage &&
        !mediaRows.some(
          (media) => media.entityKind === "item" && media.rowKey === row.rowKey,
        )
      ) {
        throw commitError(
          "ITEM_MEDIA_SNAPSHOT_MISSING",
          `Physical image staging untuk ${row.rowKey} tidak tersedia.`,
          409,
        );
      }

      const availability = text(row.normalizedPayload, "initial_availability");
      if (availability === "available") {
        const parent = masterRows.find(
          (master) => master.masterKey === row.masterKey,
        );
        if (
          !parent ||
          text(parent.normalizedPayload, "status") !== "active" ||
          !row.resolvedOutletId ||
          !nullableText(row.normalizedPayload, "weight_gram") ||
          !nullableText(row.normalizedPayload, "selling_amount") ||
          text(row.normalizedPayload, "condition") !== "good"
        ) {
          throw commitError(
            "AVAILABLE_ITEM_SNAPSHOT_INVALID",
            `Business rule item available berubah/tidak lengkap pada ${row.rowKey}.`,
            409,
          );
        }
      }
    }

    const plannedMasters: PlannedMasterRow[] = [];
    for (const row of masterRows) {
      const plannedProductMasterId = randomUUID();
      await transaction
        .update(productBatchImportMasterRows)
        .set({ plannedProductMasterId })
        .where(
          and(
            eq(productBatchImportMasterRows.id, row.id),
            eq(productBatchImportMasterRows.sessionId, sessionId),
          ),
        );
      plannedMasters.push({ ...row, plannedProductMasterId });
    }

    const plannedItems: PlannedItemRow[] = [];
    for (const row of itemRows) {
      const plannedProductItemId = randomUUID();
      await transaction
        .update(productBatchImportItemRows)
        .set({ plannedProductItemId })
        .where(
          and(
            eq(productBatchImportItemRows.id, row.id),
            eq(productBatchImportItemRows.sessionId, sessionId),
          ),
        );
      plannedItems.push({ ...row, plannedProductItemId });
    }

    await transaction
      .update(productBatchImportSessions)
      .set({
        status: "committing",
        failureCode: null,
        failureMessage: null,
        updatedAt: now,
      })
      .where(eq(productBatchImportSessions.id, sessionId));

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      actorUserId: auth.user.id,
      action: "products.batch_import.commit_started",
      entityType: "product_batch_import_session",
      entityId: sessionId,
      afterData: {
        status: "committing",
        totalMasterRows: session.totalMasterRows,
        totalItemRows: session.totalItemRows,
      },
      ipAddress: requestMetadata.ipAddress?.slice(0, 64) ?? null,
      userAgent: requestMetadata.userAgent?.slice(0, 1_000) ?? null,
      metadata: { source: "admin.products.batch_import" },
      createdAt: now,
    });

    return {
      sessionId,
      organizationId: auth.organization.id,
      storageKey: session.storageKey,
      fileSha256: session.fileSha256,
      totalMasterRows: session.totalMasterRows,
      totalItemRows: session.totalItemRows,
      masters: plannedMasters,
      items: plannedItems,
      media: mediaRows,
    };
  });
}

async function verifyStagingSnapshot(plan: CommitPlan) {
  if (
    !productBatchImportStorageKeyBelongsToSession({
      key: plan.storageKey,
      organizationId: plan.organizationId,
      sessionId: plan.sessionId,
    })
  ) {
    throw commitError(
      "STAGING_STORAGE_SCOPE_INVALID",
      "Storage key archive tidak berada pada session/organization yang benar.",
      409,
    );
  }

  const archiveBuffer = await readProductBatchImportStagingFile(
    plan.storageKey,
  );
  const actualHash = createHash("sha256").update(archiveBuffer).digest("hex");
  if (actualHash !== plan.fileSha256) {
    throw commitError(
      "STAGING_ARCHIVE_HASH_MISMATCH",
      "Archive staging berubah sejak validation. Commit dihentikan.",
      409,
    );
  }
}

type PromotedMedia = {
  id: string;
  finalKey: string;
};

async function promoteMedia({
  plan,
  promoted,
  testFailpoint,
}: {
  plan: CommitPlan;
  promoted: PromotedMedia[];
  testFailpoint?: ProductBatchImportCommitTestFailpoint;
}) {
  const masterIdByKey = new Map(
    plan.masters.map((row) => [row.masterKey, row.plannedProductMasterId]),
  );
  const itemIdByKey = new Map(
    plan.items.map((row) => [row.rowKey, row.plannedProductItemId]),
  );
  for (const media of plan.media) {
    if (
      !productBatchImportStorageKeyBelongsToSession({
        key: media.stagingKey,
        organizationId: plan.organizationId,
        sessionId: plan.sessionId,
      })
    ) {
      throw commitError(
        "STAGING_MEDIA_SCOPE_INVALID",
        `Staging media ${media.id} berada di luar session/organization.`,
        409,
      );
    }

    const targetEntityId =
      media.entityKind === "master"
        ? media.masterKey
          ? masterIdByKey.get(media.masterKey)
          : null
        : media.rowKey
          ? itemIdByKey.get(media.rowKey)
          : null;
    if (!targetEntityId) {
      throw commitError(
        "MEDIA_TARGET_INVALID",
        `Target final media ${media.id} tidak dapat dipetakan ke planned entity.`,
        409,
      );
    }

    const input = await readProductBatchImportStagingFile(media.stagingKey);
    const actualHash = createHash("sha256").update(input).digest("hex");
    if (actualHash !== media.sha256) {
      throw commitError(
        "STAGING_MEDIA_HASH_MISMATCH",
        `Hash media staging berubah: ${media.id}.`,
        409,
      );
    }

    const finalKey = await storeImageBuffer({
      input,
      organizationId: plan.organizationId,
      entityType: media.entityKind === "master" ? "products" : "items",
      entityId: targetEntityId,
    });
    promoted.push({ id: media.id, finalKey });

    const updated = await db
      .update(productBatchImportMedia)
      .set({ finalKey, status: "promoted" })
      .where(
        and(
          eq(productBatchImportMedia.id, media.id),
          eq(productBatchImportMedia.sessionId, plan.sessionId),
          eq(productBatchImportMedia.status, "validated"),
        ),
      )
      .returning({ id: productBatchImportMedia.id });
    if (updated.length !== 1) {
      throw commitError(
        "MEDIA_PROMOTION_STATE_CONFLICT",
        `Status media ${media.id} berubah selama commit.`,
        409,
      );
    }

    if (
      testFailpoint === "after_first_media_promotion" &&
      promoted.length === 1
    ) {
      throw commitError(
        "TEST_FAILPOINT",
        "Simulated failure setelah media promotion pertama.",
        500,
      );
    }
  }
}

async function cleanupPromotedMedia({
  plan,
  promoted,
}: {
  plan: CommitPlan;
  promoted: PromotedMedia[];
}) {
  const failures: Array<{ id: string; finalKey: string; message: string }> = [];

  for (const media of promoted) {
    try {
      await deleteImageFileStrict(media.finalKey);
      await db
        .update(productBatchImportMedia)
        .set({ finalKey: null, status: "failed" })
        .where(
          and(
            eq(productBatchImportMedia.id, media.id),
            eq(productBatchImportMedia.sessionId, plan.sessionId),
          ),
        );
    } catch (error) {
      failures.push({
        id: media.id,
        finalKey: media.finalKey,
        message:
          error instanceof Error ? error.message : "Final image cleanup gagal.",
      });
      await db
        .update(productBatchImportMedia)
        .set({ status: "failed" })
        .where(
          and(
            eq(productBatchImportMedia.id, media.id),
            eq(productBatchImportMedia.sessionId, plan.sessionId),
          ),
        )
        .catch(() => undefined);
    }
  }

  return failures;
}

async function markCommitFailed({
  auth,
  plan,
  error,
  cleanupFailures,
  requestMetadata,
  now,
}: {
  auth: AuthContext;
  plan: CommitPlan;
  error: unknown;
  cleanupFailures: Array<{ id: string; finalKey: string; message: string }>;
  requestMetadata: ProductBatchImportCommitRequestMetadata;
  now: Date;
}) {
  const baseCode =
    error instanceof ProductBatchImportCommitError
      ? error.code
      : getDatabaseError(error).code === "23505"
        ? "COMMIT_UNIQUE_CONFLICT"
        : "COMMIT_FAILED";
  const baseMessage =
    error instanceof Error ? error.message : "Atomic commit gagal.";
  const cleanupMessage = cleanupFailures.length
    ? `\nCompensating cleanup gagal: ${cleanupFailures
        .map((failure) => `${failure.finalKey}: ${failure.message}`)
        .join(" | ")}`
    : "";

  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`product-batch-import-session:${plan.sessionId}`}))`,
    );
    const [session] = await transaction
      .select({ status: productBatchImportSessions.status })
      .from(productBatchImportSessions)
      .where(
        and(
          eq(productBatchImportSessions.id, plan.sessionId),
          eq(productBatchImportSessions.organizationId, plan.organizationId),
        ),
      )
      .limit(1);

    if (!session || session.status !== "committing") return;

    await transaction
      .update(productBatchImportSessions)
      .set({
        status: "failed",
        failureCode: (cleanupFailures.length
          ? "COMMIT_CLEANUP_INCOMPLETE"
          : baseCode
        ).slice(0, 120),
        failureMessage: `${baseMessage}${cleanupMessage}`.slice(0, 4_000),
        updatedAt: now,
      })
      .where(eq(productBatchImportSessions.id, plan.sessionId));

    await transaction.insert(auditLogs).values({
      organizationId: plan.organizationId,
      actorUserId: auth.user.id,
      action: "products.batch_import.commit_failed",
      entityType: "product_batch_import_session",
      entityId: plan.sessionId,
      afterData: {
        status: "failed",
        failureCode:
          cleanupFailures.length > 0 ? "COMMIT_CLEANUP_INCOMPLETE" : baseCode,
        cleanupFailureCount: cleanupFailures.length,
      },
      reason: baseMessage.slice(0, 4_000),
      ipAddress: requestMetadata.ipAddress?.slice(0, 64) ?? null,
      userAgent: requestMetadata.userAgent?.slice(0, 1_000) ?? null,
      metadata: { source: "admin.products.batch_import" },
      createdAt: now,
    });
  });
}

async function commitBusinessData({
  auth,
  plan,
  requestMetadata,
  now,
  testFailpoint,
}: {
  auth: AuthContext;
  plan: CommitPlan;
  requestMetadata: ProductBatchImportCommitRequestMetadata;
  now: Date;
  testFailpoint?: ProductBatchImportCommitTestFailpoint;
}): Promise<ProductBatchImportCommitResult> {
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`product-batch-import-session:${plan.sessionId}`}))`,
    );

    const [session] = await transaction
      .select({ status: productBatchImportSessions.status })
      .from(productBatchImportSessions)
      .where(
        and(
          eq(productBatchImportSessions.id, plan.sessionId),
          eq(productBatchImportSessions.organizationId, plan.organizationId),
        ),
      )
      .limit(1);
    if (!session || session.status !== "committing") {
      throw commitError(
        "SESSION_COMMIT_STATE_CHANGED",
        "Session tidak lagi berada pada state committing.",
        409,
      );
    }

    const [masters, items, mediaRows] = await Promise.all([
      transaction
        .select({
          id: productBatchImportMasterRows.id,
          rowNumber: productBatchImportMasterRows.rowNumber,
          masterKey: productBatchImportMasterRows.masterKey,
          normalizedPayload: productBatchImportMasterRows.normalizedPayload,
          resolvedCategoryId: productBatchImportMasterRows.resolvedCategoryId,
          plannedProductMasterId:
            productBatchImportMasterRows.plannedProductMasterId,
          committedProductMasterId:
            productBatchImportMasterRows.committedProductMasterId,
        })
        .from(productBatchImportMasterRows)
        .where(eq(productBatchImportMasterRows.sessionId, plan.sessionId))
        .orderBy(asc(productBatchImportMasterRows.rowNumber)),
      transaction
        .select({
          id: productBatchImportItemRows.id,
          rowNumber: productBatchImportItemRows.rowNumber,
          rowKey: productBatchImportItemRows.rowKey,
          masterKey: productBatchImportItemRows.masterKey,
          normalizedPayload: productBatchImportItemRows.normalizedPayload,
          resolvedOutletId: productBatchImportItemRows.resolvedOutletId,
          plannedProductItemId: productBatchImportItemRows.plannedProductItemId,
          committedProductItemId:
            productBatchImportItemRows.committedProductItemId,
        })
        .from(productBatchImportItemRows)
        .where(eq(productBatchImportItemRows.sessionId, plan.sessionId))
        .orderBy(asc(productBatchImportItemRows.rowNumber)),
      transaction
        .select({
          id: productBatchImportMedia.id,
          entityKind: productBatchImportMedia.entityKind,
          masterKey: productBatchImportMedia.masterKey,
          rowKey: productBatchImportMedia.rowKey,
          finalKey: productBatchImportMedia.finalKey,
          status: productBatchImportMedia.status,
        })
        .from(productBatchImportMedia)
        .where(eq(productBatchImportMedia.sessionId, plan.sessionId)),
    ]);

    if (
      masters.length !== plan.totalMasterRows ||
      items.length !== plan.totalItemRows ||
      masters.some(
        (row) =>
          !row.plannedProductMasterId || row.committedProductMasterId !== null,
      ) ||
      items.some(
        (row) =>
          !row.plannedProductItemId || row.committedProductItemId !== null,
      ) ||
      mediaRows.some((row) => row.status !== "promoted" || !row.finalKey)
    ) {
      throw commitError(
        "COMMIT_SNAPSHOT_CHANGED",
        "Snapshot staging berubah selama media promotion.",
        409,
      );
    }

    const masterMediaByKey = new Map(
      mediaRows
        .filter(
          (media) =>
            media.entityKind === "master" && media.masterKey && media.finalKey,
        )
        .map((media) => [media.masterKey as string, media.finalKey as string]),
    );
    const itemMediaByKey = new Map(
      mediaRows
        .filter(
          (media) =>
            media.entityKind === "item" && media.rowKey && media.finalKey,
        )
        .map((media) => [media.rowKey as string, media.finalKey as string]),
    );

    const masterIdByKey = new Map<string, string>();
    const masterCodeByKey = new Map<string, string>();

    for (const row of masters) {
      if (!row.plannedProductMasterId || !row.resolvedCategoryId) {
        throw commitError(
          "MASTER_PLAN_INVALID",
          `Planned Product Master ${row.masterKey} tidak lengkap.`,
          409,
        );
      }
      const imageKey = masterMediaByKey.get(row.masterKey);
      if (!imageKey) {
        throw commitError(
          "MASTER_FINAL_IMAGE_MISSING",
          `Final image Product Master ${row.masterKey} tidak tersedia.`,
          409,
        );
      }

      const code = await getNextProductMasterCode({
        execute: (query) => transaction.execute(query),
        isCodeUsed: async (candidate) => {
          const [existing] = await transaction
            .select({ id: productMasters.id })
            .from(productMasters)
            .where(
              and(
                eq(productMasters.organizationId, plan.organizationId),
                eq(productMasters.code, candidate),
              ),
            )
            .limit(1);
          return !!existing;
        },
      });

      const name = text(row.normalizedPayload, "name");
      const status = text(row.normalizedPayload, "status") as
        | "draft"
        | "active";
      await transaction.insert(productMasters).values({
        id: row.plannedProductMasterId,
        organizationId: plan.organizationId,
        categoryId: row.resolvedCategoryId,
        code,
        name,
        brand: nullableText(row.normalizedPayload, "brand"),
        material: nullableText(row.normalizedPayload, "material"),
        collection: nullableText(row.normalizedPayload, "collection"),
        description: nullableText(row.normalizedPayload, "description"),
        imageKey,
        status,
      });

      await transaction
        .update(productBatchImportMasterRows)
        .set({ committedProductMasterId: row.plannedProductMasterId })
        .where(eq(productBatchImportMasterRows.id, row.id));

      await transaction.insert(auditLogs).values({
        organizationId: plan.organizationId,
        actorUserId: auth.user.id,
        action: "product_master.create",
        entityType: "product_master",
        entityId: row.plannedProductMasterId,
        afterData: {
          source: "product_batch_import",
          sessionId: plan.sessionId,
          rowNumber: row.rowNumber,
          masterKey: row.masterKey,
          code,
          name,
          categoryId: row.resolvedCategoryId,
          brand: nullableText(row.normalizedPayload, "brand"),
          material: nullableText(row.normalizedPayload, "material"),
          collection: nullableText(row.normalizedPayload, "collection"),
          description: nullableText(row.normalizedPayload, "description"),
          imageKey,
          status,
        },
        ipAddress: requestMetadata.ipAddress?.slice(0, 64) ?? null,
        userAgent: requestMetadata.userAgent?.slice(0, 1_000) ?? null,
        metadata: {
          source: "admin.products.batch_import",
          sessionId: plan.sessionId,
        },
        createdAt: now,
      });

      masterIdByKey.set(row.masterKey, row.plannedProductMasterId);
      masterCodeByKey.set(row.masterKey, code);
    }

    let availableItemCount = 0;
    let draftItemCount = 0;

    for (let index = 0; index < items.length; index += 1) {
      const row = items[index]!;
      if (!row.plannedProductItemId) {
        throw commitError(
          "ITEM_PLAN_INVALID",
          `Planned Product Item ${row.rowKey} tidak lengkap.`,
          409,
        );
      }
      const productMasterId = masterIdByKey.get(row.masterKey);
      const productCode = masterCodeByKey.get(row.masterKey);
      if (!productMasterId || !productCode) {
        throw commitError(
          "ITEM_PARENT_COMMIT_MISSING",
          `Committed parent ${row.masterKey} untuk ${row.rowKey} tidak tersedia.`,
          409,
        );
      }

      const identifiers = await getNextProductItemIdentifiers((query) =>
        transaction.execute(query),
      );
      if (
        testFailpoint === "after_first_identifier_allocation" &&
        index === 0
      ) {
        throw commitError(
          "TEST_FAILPOINT",
          "Simulated failure setelah Product Item identifier pertama dialokasikan.",
          500,
        );
      }

      const availability = text(
        row.normalizedPayload,
        "initial_availability",
      ) as "draft" | "available";
      const condition = text(row.normalizedPayload, "condition") as
        | "good"
        | "damaged";
      const imageKey = itemMediaByKey.get(row.rowKey) ?? null;

      await transaction.insert(productItems).values({
        id: row.plannedProductItemId,
        organizationId: plan.organizationId,
        productMasterId,
        displayName: nullableText(row.normalizedPayload, "display_name"),
        currentOutletId: row.resolvedOutletId,
        sku: identifiers.sku,
        barcode: identifiers.barcode,
        qrValue: identifiers.qrValue,
        weightGram: nullableText(row.normalizedPayload, "weight_gram"),
        purityPercent: nullableText(row.normalizedPayload, "purity_percent"),
        exchangePurityPercent: nullableText(
          row.normalizedPayload,
          "exchange_purity_percent",
        ),
        size: nullableText(row.normalizedPayload, "size"),
        color: nullableText(row.normalizedPayload, "color"),
        gemstone: nullableText(row.normalizedPayload, "gemstone"),
        costAmount: nullableText(row.normalizedPayload, "cost_amount"),
        sellingAmount: nullableText(row.normalizedPayload, "selling_amount"),
        pricePerGram: nullableText(row.normalizedPayload, "price_per_gram"),
        deductionPerGram: nullableText(
          row.normalizedPayload,
          "deduction_per_gram",
        ),
        availability,
        condition,
        locationState: "outlet",
        locationCode: nullableText(row.normalizedPayload, "location_code"),
        imageKey,
        internalNotes: nullableText(row.normalizedPayload, "internal_notes"),
        isActive: true,
      });

      await transaction.insert(itemBarcodes).values({
        organizationId: plan.organizationId,
        itemId: row.plannedProductItemId,
        barcodeValue: identifiers.barcode,
        source: "system_generated",
        isPrimary: true,
        isActive: true,
        createdBy: auth.user.id,
      });

      if (availability === "available") {
        if (!row.resolvedOutletId) {
          throw commitError(
            "AVAILABLE_ITEM_OUTLET_MISSING",
            `Outlet final untuk ${row.rowKey} tidak tersedia.`,
            409,
          );
        }
        availableItemCount += 1;
        await transaction.insert(inventoryMovements).values({
          organizationId: plan.organizationId,
          itemId: row.plannedProductItemId,
          movementType: "goods_receipt",
          toOutletId: row.resolvedOutletId,
          referenceType: "product_item",
          referenceId: row.plannedProductItemId,
          reason: "Penerimaan awal item fisik dari Product Batch Import",
          metadata: {
            source: "product_batch_import",
            sessionId: plan.sessionId,
            rowKey: row.rowKey,
            sku: identifiers.sku,
            barcode: identifiers.barcode,
            productId: productMasterId,
            productCode,
            availability,
          },
          performedBy: auth.user.id,
          occurredAt: now,
          createdAt: now,
        });
      } else {
        draftItemCount += 1;
      }

      await transaction
        .update(productBatchImportItemRows)
        .set({
          committedProductItemId: row.plannedProductItemId,
          generatedSku: identifiers.sku,
          generatedBarcode: identifiers.barcode,
          generatedQrValue: identifiers.qrValue,
        })
        .where(eq(productBatchImportItemRows.id, row.id));

      await transaction.insert(auditLogs).values({
        organizationId: plan.organizationId,
        outletId: row.resolvedOutletId,
        actorUserId: auth.user.id,
        action: "product_item.create",
        entityType: "product_item",
        entityId: row.plannedProductItemId,
        afterData: {
          source: "product_batch_import",
          sessionId: plan.sessionId,
          rowNumber: row.rowNumber,
          rowKey: row.rowKey,
          masterKey: row.masterKey,
          sku: identifiers.sku,
          barcode: identifiers.barcode,
          qrValue: identifiers.qrValue,
          productMasterId,
          productCode,
          displayName: nullableText(row.normalizedPayload, "display_name"),
          currentOutletId: row.resolvedOutletId,
          weightGram: nullableText(row.normalizedPayload, "weight_gram"),
          purityPercent: nullableText(row.normalizedPayload, "purity_percent"),
          exchangePurityPercent: nullableText(
            row.normalizedPayload,
            "exchange_purity_percent",
          ),
          size: nullableText(row.normalizedPayload, "size"),
          color: nullableText(row.normalizedPayload, "color"),
          gemstone: nullableText(row.normalizedPayload, "gemstone"),
          costAmount: nullableText(row.normalizedPayload, "cost_amount"),
          sellingAmount: nullableText(row.normalizedPayload, "selling_amount"),
          pricePerGram: nullableText(row.normalizedPayload, "price_per_gram"),
          deductionPerGram: nullableText(
            row.normalizedPayload,
            "deduction_per_gram",
          ),
          availability,
          condition,
          locationCode: nullableText(row.normalizedPayload, "location_code"),
          imageKey,
        },
        ipAddress: requestMetadata.ipAddress?.slice(0, 64) ?? null,
        userAgent: requestMetadata.userAgent?.slice(0, 1_000) ?? null,
        metadata: {
          source: "admin.products.batch_import",
          sessionId: plan.sessionId,
        },
        createdAt: now,
      });
    }

    await transaction
      .update(productBatchImportSessions)
      .set({
        status: "completed",
        committedMasterCount: masters.length,
        committedItemCount: items.length,
        committedAt: now,
        failureCode: null,
        failureMessage: null,
        updatedAt: now,
      })
      .where(eq(productBatchImportSessions.id, plan.sessionId));

    await transaction.insert(auditLogs).values({
      organizationId: plan.organizationId,
      actorUserId: auth.user.id,
      action: "products.batch_import.commit_completed",
      entityType: "product_batch_import_session",
      entityId: plan.sessionId,
      afterData: {
        status: "completed",
        committedMasterCount: masters.length,
        committedItemCount: items.length,
        availableItemCount,
        draftItemCount,
      },
      ipAddress: requestMetadata.ipAddress?.slice(0, 64) ?? null,
      userAgent: requestMetadata.userAgent?.slice(0, 1_000) ?? null,
      metadata: { source: "admin.products.batch_import" },
      createdAt: now,
    });

    return {
      sessionId: plan.sessionId,
      committedMasterCount: masters.length,
      committedItemCount: items.length,
      availableItemCount,
      draftItemCount,
      committedAt: now,
      stagingCleanupWarnings: 0,
    };
  });
}

async function cleanupCompletedStaging({
  auth,
  plan,
  requestMetadata,
  now,
}: {
  auth: AuthContext;
  plan: CommitPlan;
  requestMetadata: ProductBatchImportCommitRequestMetadata;
  now: Date;
}) {
  const failures = await deleteProductBatchImportStagingFiles([
    plan.storageKey,
    ...plan.media.map((media) => media.stagingKey),
  ]);
  if (failures.length === 0) return 0;

  try {
    await db.transaction(async (transaction) => {
      await transaction
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
            eq(productBatchImportSessions.id, plan.sessionId),
            eq(productBatchImportSessions.organizationId, plan.organizationId),
            eq(productBatchImportSessions.status, "completed"),
          ),
        );

      await transaction.insert(auditLogs).values({
        organizationId: plan.organizationId,
        actorUserId: auth.user.id,
        action: "products.batch_import.staging_cleanup_warning",
        entityType: "product_batch_import_session",
        entityId: plan.sessionId,
        afterData: { failureCount: failures.length },
        reason: failures
          .map((failure) => `${failure.key}: ${failure.message}`)
          .join("\n")
          .slice(0, 4_000),
        ipAddress: requestMetadata.ipAddress?.slice(0, 64) ?? null,
        userAgent: requestMetadata.userAgent?.slice(0, 1_000) ?? null,
        metadata: { source: "admin.products.batch_import" },
        createdAt: now,
      });
    });
  } catch (error) {
    console.error(
      `Atomic commit ${plan.sessionId} sudah completed tetapi warning cleanup staging gagal dicatat:`,
      error,
    );
  }

  return failures.length;
}

export async function commitProductBatchImportSession({
  auth,
  sessionId,
  requestMetadata = {},
  now = new Date(),
  testFailpoint,
}: {
  auth: AuthContext;
  sessionId: string;
  requestMetadata?: ProductBatchImportCommitRequestMetadata;
  now?: Date;
  testFailpoint?: ProductBatchImportCommitTestFailpoint;
}): Promise<ProductBatchImportCommitResult> {
  const plan = await prepareCommitPlan({
    auth,
    sessionId,
    requestMetadata,
    now,
  });

  const promoted: PromotedMedia[] = [];
  try {
    await verifyStagingSnapshot(plan);
    await promoteMedia({ plan, promoted, testFailpoint });
  } catch (error) {
    const cleanupFailures = await cleanupPromotedMedia({ plan, promoted });
    await markCommitFailed({
      auth,
      plan,
      error,
      cleanupFailures,
      requestMetadata,
      now: new Date(),
    });
    if (error instanceof ProductBatchImportCommitError) throw error;
    throw commitError(
      "MEDIA_PROMOTION_FAILED",
      error instanceof Error
        ? error.message
        : "Final image Product Batch Import gagal diproses.",
      500,
      error,
    );
  }

  let result: ProductBatchImportCommitResult;
  try {
    result = await commitBusinessData({
      auth,
      plan,
      requestMetadata,
      now: new Date(),
      testFailpoint,
    });
  } catch (error) {
    const cleanupFailures = await cleanupPromotedMedia({ plan, promoted });
    await markCommitFailed({
      auth,
      plan,
      error,
      cleanupFailures,
      requestMetadata,
      now: new Date(),
    });

    if (error instanceof ProductBatchImportCommitError) throw error;
    const databaseError = getDatabaseError(error);
    if (databaseError.code === "23505") {
      throw commitError(
        "COMMIT_UNIQUE_CONFLICT",
        "Atomic commit dibatalkan karena identifier/code bertabrakan dengan data existing. Tidak ada data bisnis parsial yang disimpan.",
        409,
        error,
      );
    }
    throw commitError(
      "COMMIT_DATABASE_FAILED",
      "Atomic commit gagal dan seluruh perubahan database telah di-rollback.",
      500,
      error,
    );
  }

  const stagingCleanupWarnings = await cleanupCompletedStaging({
    auth,
    plan,
    requestMetadata,
    now: new Date(),
  });

  return { ...result, stagingCleanupWarnings };
}
