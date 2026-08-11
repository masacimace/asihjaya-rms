import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  outlets,
  productBatchImportItemRows,
  productBatchImportMasterRows,
  productBatchImportMedia,
  productBatchImportSessions,
  productCategories,
  users,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";

import type { ProductBatchValidationIssue } from "./validation";

export type ProductBatchPreviewIssue = ProductBatchValidationIssue;

export type ProductBatchPreviewMedia = {
  id: string;
  entityKind: "master" | "item";
  masterKey: string | null;
  rowKey: string | null;
  archivePath: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  status: string;
};

export type ProductBatchPreviewMasterRow = {
  id: string;
  rowNumber: number;
  masterKey: string;
  validationStatus: "pending" | "valid" | "warning" | "invalid";
  validationErrors: ProductBatchPreviewIssue[];
  validationWarnings: ProductBatchPreviewIssue[];
  normalizedPayload: Record<string, unknown>;
  resolvedCategoryId: string | null;
  resolvedCategoryCode: string | null;
  resolvedCategoryName: string | null;
  media: ProductBatchPreviewMedia | null;
};

export type ProductBatchPreviewItemRow = {
  id: string;
  rowNumber: number;
  rowKey: string;
  masterKey: string;
  validationStatus: "pending" | "valid" | "warning" | "invalid";
  validationErrors: ProductBatchPreviewIssue[];
  validationWarnings: ProductBatchPreviewIssue[];
  normalizedPayload: Record<string, unknown>;
  resolvedOutletId: string | null;
  resolvedOutletCode: string | null;
  resolvedOutletName: string | null;
  media: ProductBatchPreviewMedia | null;
  masterMedia: ProductBatchPreviewMedia | null;
  effectiveImageSource: "physical" | "master" | "none";
};

export type ProductBatchImportPreview = {
  session: {
    id: string;
    fileName: string;
    fileSha256: string;
    fileSizeBytes: number;
    templateVersion: number;
    status: string;
    totalMasterRows: number;
    totalItemRows: number;
    validMasterRows: number;
    validItemRows: number;
    invalidRows: number;
    warningCount: number;
    committedMasterCount: number;
    committedItemCount: number;
    failureCode: string | null;
    failureMessage: string | null;
    createdAt: Date;
    validatedAt: Date | null;
    committedAt: Date | null;
    cancelledAt: Date | null;
    expiresAt: Date | null;
    createdByUserId: string;
    createdByName: string;
  };
  masters: ProductBatchPreviewMasterRow[];
  items: ProductBatchPreviewItemRow[];
  media: ProductBatchPreviewMedia[];
};

function asIssues(value: Array<Record<string, unknown>>): ProductBatchPreviewIssue[] {
  return value.flatMap((entry) => {
    const severity = entry.severity;
    const code = entry.code;
    const message = entry.message;
    if (
      (severity !== "error" && severity !== "warning") ||
      typeof code !== "string" ||
      typeof message !== "string"
    ) {
      return [];
    }

    const field = typeof entry.field === "string" ? entry.field : null;
    const scope =
      entry.scope === "row" ||
      entry.scope === "archive" ||
      entry.scope === "workbook" ||
      entry.scope === "permission"
        ? entry.scope
        : undefined;
    const archivePath =
      typeof entry.archivePath === "string" ? entry.archivePath : undefined;

    return [{ severity, code, field, message, scope, archivePath }];
  });
}

export async function getRecentProductBatchImportSessions(
  auth: AuthContext,
  limit = 8,
) {
  const boundedLimit = Math.max(1, Math.min(20, Math.trunc(limit)));
  return db
    .select({
      id: productBatchImportSessions.id,
      fileName: productBatchImportSessions.fileName,
      status: productBatchImportSessions.status,
      totalMasterRows: productBatchImportSessions.totalMasterRows,
      totalItemRows: productBatchImportSessions.totalItemRows,
      invalidRows: productBatchImportSessions.invalidRows,
      warningCount: productBatchImportSessions.warningCount,
      createdAt: productBatchImportSessions.createdAt,
      expiresAt: productBatchImportSessions.expiresAt,
      createdByName: users.fullName,
    })
    .from(productBatchImportSessions)
    .innerJoin(users, eq(productBatchImportSessions.createdByUserId, users.id))
    .where(eq(productBatchImportSessions.organizationId, auth.organization.id))
    .orderBy(desc(productBatchImportSessions.createdAt))
    .limit(boundedLimit);
}

export async function getProductBatchImportPreview(
  auth: AuthContext,
  sessionId: string,
): Promise<ProductBatchImportPreview | null> {
  const [session] = await db
    .select({
      id: productBatchImportSessions.id,
      fileName: productBatchImportSessions.fileName,
      fileSha256: productBatchImportSessions.fileSha256,
      fileSizeBytes: productBatchImportSessions.fileSizeBytes,
      templateVersion: productBatchImportSessions.templateVersion,
      status: productBatchImportSessions.status,
      totalMasterRows: productBatchImportSessions.totalMasterRows,
      totalItemRows: productBatchImportSessions.totalItemRows,
      validMasterRows: productBatchImportSessions.validMasterRows,
      validItemRows: productBatchImportSessions.validItemRows,
      invalidRows: productBatchImportSessions.invalidRows,
      warningCount: productBatchImportSessions.warningCount,
      committedMasterCount: productBatchImportSessions.committedMasterCount,
      committedItemCount: productBatchImportSessions.committedItemCount,
      failureCode: productBatchImportSessions.failureCode,
      failureMessage: productBatchImportSessions.failureMessage,
      createdAt: productBatchImportSessions.createdAt,
      validatedAt: productBatchImportSessions.validatedAt,
      committedAt: productBatchImportSessions.committedAt,
      cancelledAt: productBatchImportSessions.cancelledAt,
      expiresAt: productBatchImportSessions.expiresAt,
      createdByUserId: productBatchImportSessions.createdByUserId,
      createdByName: users.fullName,
    })
    .from(productBatchImportSessions)
    .innerJoin(users, eq(productBatchImportSessions.createdByUserId, users.id))
    .where(
      and(
        eq(productBatchImportSessions.id, sessionId),
        eq(productBatchImportSessions.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  if (!session) return null;

  const [masterRows, itemRows, mediaRows] = await Promise.all([
    db
      .select({
        id: productBatchImportMasterRows.id,
        rowNumber: productBatchImportMasterRows.rowNumber,
        masterKey: productBatchImportMasterRows.masterKey,
        normalizedPayload: productBatchImportMasterRows.normalizedPayload,
        validationStatus: productBatchImportMasterRows.validationStatus,
        validationErrors: productBatchImportMasterRows.validationErrors,
        validationWarnings: productBatchImportMasterRows.validationWarnings,
        resolvedCategoryId: productBatchImportMasterRows.resolvedCategoryId,
        resolvedCategoryCode: productCategories.code,
        resolvedCategoryName: productCategories.name,
      })
      .from(productBatchImportMasterRows)
      .leftJoin(
        productCategories,
        eq(productBatchImportMasterRows.resolvedCategoryId, productCategories.id),
      )
      .where(eq(productBatchImportMasterRows.sessionId, sessionId))
      .orderBy(asc(productBatchImportMasterRows.rowNumber)),
    db
      .select({
        id: productBatchImportItemRows.id,
        rowNumber: productBatchImportItemRows.rowNumber,
        rowKey: productBatchImportItemRows.rowKey,
        masterKey: productBatchImportItemRows.masterKey,
        normalizedPayload: productBatchImportItemRows.normalizedPayload,
        validationStatus: productBatchImportItemRows.validationStatus,
        validationErrors: productBatchImportItemRows.validationErrors,
        validationWarnings: productBatchImportItemRows.validationWarnings,
        resolvedOutletId: productBatchImportItemRows.resolvedOutletId,
        resolvedOutletCode: outlets.code,
        resolvedOutletName: outlets.name,
      })
      .from(productBatchImportItemRows)
      .leftJoin(outlets, eq(productBatchImportItemRows.resolvedOutletId, outlets.id))
      .where(eq(productBatchImportItemRows.sessionId, sessionId))
      .orderBy(asc(productBatchImportItemRows.rowNumber)),
    db
      .select({
        id: productBatchImportMedia.id,
        entityKind: productBatchImportMedia.entityKind,
        masterKey: productBatchImportMedia.masterKey,
        rowKey: productBatchImportMedia.rowKey,
        archivePath: productBatchImportMedia.archivePath,
        contentType: productBatchImportMedia.contentType,
        byteSize: productBatchImportMedia.byteSize,
        width: productBatchImportMedia.width,
        height: productBatchImportMedia.height,
        status: productBatchImportMedia.status,
      })
      .from(productBatchImportMedia)
      .where(eq(productBatchImportMedia.sessionId, sessionId))
      .orderBy(asc(productBatchImportMedia.archivePath)),
  ]);

  const media: ProductBatchPreviewMedia[] = mediaRows.map((row) => ({
    ...row,
    entityKind: row.entityKind === "master" ? "master" : "item",
  }));
  const masterMediaByKey = new Map(
    media.filter((row) => row.entityKind === "master" && row.masterKey && row.status !== "deleted").map((row) => [row.masterKey!, row]),
  );
  const itemMediaByKey = new Map(
    media.filter((row) => row.entityKind === "item" && row.rowKey && row.status !== "deleted").map((row) => [row.rowKey!, row]),
  );

  const masters: ProductBatchPreviewMasterRow[] = masterRows.map((row) => ({
    ...row,
    validationErrors: asIssues(row.validationErrors),
    validationWarnings: asIssues(row.validationWarnings),
    media: masterMediaByKey.get(row.masterKey) ?? null,
  }));

  const items: ProductBatchPreviewItemRow[] = itemRows.map((row) => {
    const physicalMedia = itemMediaByKey.get(row.rowKey) ?? null;
    const masterMedia = masterMediaByKey.get(row.masterKey) ?? null;
    const effectiveSource = String(
      row.normalizedPayload._effective_image_source ?? "",
    );
    const effectiveImageSource = physicalMedia
      ? "physical"
      : effectiveSource === "master" && masterMedia
        ? "master"
        : "none";

    return {
      ...row,
      validationErrors: asIssues(row.validationErrors),
      validationWarnings: asIssues(row.validationWarnings),
      media: physicalMedia,
      masterMedia,
      effectiveImageSource,
    };
  });

  return { session, masters, items, media };
}

export async function getProductBatchImportMediaRecord({
  auth,
  sessionId,
  mediaId,
}: {
  auth: AuthContext;
  sessionId: string;
  mediaId: string;
}) {
  const [row] = await db
    .select({
      id: productBatchImportMedia.id,
      contentType: productBatchImportMedia.contentType,
      stagingKey: productBatchImportMedia.stagingKey,
      status: productBatchImportMedia.status,
      organizationId: productBatchImportSessions.organizationId,
    })
    .from(productBatchImportMedia)
    .innerJoin(
      productBatchImportSessions,
      eq(productBatchImportMedia.sessionId, productBatchImportSessions.id),
    )
    .where(
      and(
        eq(productBatchImportMedia.id, mediaId),
        eq(productBatchImportMedia.sessionId, sessionId),
        eq(productBatchImportSessions.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  return row ?? null;
}
