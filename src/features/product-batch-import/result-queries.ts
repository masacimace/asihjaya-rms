import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  hardwareJobs,
  outlets,
  productBatchImportItemRows,
  productBatchImportMasterRows,
  productBatchImportSessions,
  productItems,
  productMasters,
  users,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";

export type ProductBatchImportResultWarning = {
  sheet: "PRODUCT_MASTERS" | "PHYSICAL_PRODUCTS" | "PRODUCTS";
  rowNumber: number;
  key: string;
  code: string;
  field: string | null;
  message: string;
};

export type ProductBatchImportResultMaster = {
  rowNumber: number;
  masterKey: string;
  productMasterId: string;
  code: string;
  name: string;
  status: string;
  imageStatus: "stored" | "missing";
  resolution: "created" | "reused";
};

export type ProductBatchImportResultItem = {
  rowNumber: number;
  rowKey: string;
  masterKey: string;
  productItemId: string;
  productMasterId: string;
  productName: string;
  displayName: string | null;
  sku: string;
  barcode: string;
  qrValue: string | null;
  outletId: string | null;
  outletCode: string | null;
  outletName: string | null;
  availability: string;
  imageSource: "physical" | "master-fallback" | "none";
  weightGram: string | null;
  purityPercent: string | null;
  exchangePurityPercent: string | null;
  size: string | null;
  color: string | null;
  gemstone: string | null;
  sellingAmount: string | null;
  isActive: boolean;
};

export type ProductBatchImportLabelJob = {
  id: string;
  itemId: string | null;
  status: string;
  attempts: number;
  error: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
};

export type ProductBatchImportResult = {
  session: {
    id: string;
    fileName: string;
    fileSha256: string;
    templateVersion: number;
    status: string;
    committedMasterCount: number;
    committedItemCount: number;
    warningCount: number;
    createdAt: Date;
    committedAt: Date | null;
    createdByUserId: string;
    createdByName: string;
  };
  masters: ProductBatchImportResultMaster[];
  items: ProductBatchImportResultItem[];
  warnings: ProductBatchImportResultWarning[];
  labelJobs: ProductBatchImportLabelJob[];
};

function readWarnings(
  value: Array<Record<string, unknown>>,
  context: {
    sheet: "PRODUCT_MASTERS" | "PHYSICAL_PRODUCTS" | "PRODUCTS";
    rowNumber: number;
    key: string;
  },
): ProductBatchImportResultWarning[] {
  return value.flatMap((entry) => {
    if (entry.severity !== "warning") return [];
    const code = typeof entry.code === "string" ? entry.code : "WARNING";
    const message =
      typeof entry.message === "string" ? entry.message : "Warning import.";
    return [
      {
        ...context,
        code,
        field: typeof entry.field === "string" ? entry.field : null,
        message,
      },
    ];
  });
}

function readHardwareJobItemId(payload: Record<string, unknown>) {
  const itemId = payload.itemId;
  return typeof itemId === "string" ? itemId : null;
}

export async function getProductBatchImportResult(
  auth: AuthContext,
  sessionId: string,
): Promise<ProductBatchImportResult | null> {
  const [session] = await db
    .select({
      id: productBatchImportSessions.id,
      fileName: productBatchImportSessions.fileName,
      fileSha256: productBatchImportSessions.fileSha256,
      templateVersion: productBatchImportSessions.templateVersion,
      status: productBatchImportSessions.status,
      committedMasterCount: productBatchImportSessions.committedMasterCount,
      committedItemCount: productBatchImportSessions.committedItemCount,
      warningCount: productBatchImportSessions.warningCount,
      createdAt: productBatchImportSessions.createdAt,
      committedAt: productBatchImportSessions.committedAt,
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

  const [masterRows, itemRows, jobRows] = await Promise.all([
    db
      .select({
        rowNumber: productBatchImportMasterRows.rowNumber,
        masterKey: productBatchImportMasterRows.masterKey,
        committedProductMasterId:
          productBatchImportMasterRows.committedProductMasterId,
        plannedProductMasterId:
          productBatchImportMasterRows.plannedProductMasterId,
        validationWarnings: productBatchImportMasterRows.validationWarnings,
        productMasterId: productMasters.id,
        code: productMasters.code,
        name: productMasters.name,
        status: productMasters.status,
        imageKey: productMasters.imageKey,
      })
      .from(productBatchImportMasterRows)
      .leftJoin(
        productMasters,
        eq(
          productBatchImportMasterRows.committedProductMasterId,
          productMasters.id,
        ),
      )
      .where(eq(productBatchImportMasterRows.sessionId, sessionId))
      .orderBy(asc(productBatchImportMasterRows.rowNumber)),
    db
      .select({
        rowNumber: productBatchImportItemRows.rowNumber,
        rowKey: productBatchImportItemRows.rowKey,
        masterKey: productBatchImportItemRows.masterKey,
        committedProductItemId: productBatchImportItemRows.committedProductItemId,
        generatedSku: productBatchImportItemRows.generatedSku,
        generatedBarcode: productBatchImportItemRows.generatedBarcode,
        generatedQrValue: productBatchImportItemRows.generatedQrValue,
        validationWarnings: productBatchImportItemRows.validationWarnings,
        productItemId: productItems.id,
        productMasterId: productItems.productMasterId,
        displayName: productItems.displayName,
        sku: productItems.sku,
        barcode: productItems.barcode,
        qrValue: productItems.qrValue,
        currentOutletId: productItems.currentOutletId,
        availability: productItems.availability,
        imageKey: productItems.imageKey,
        weightGram: productItems.weightGram,
        purityPercent: productItems.purityPercent,
        exchangePurityPercent: productItems.exchangePurityPercent,
        size: productItems.size,
        color: productItems.color,
        gemstone: productItems.gemstone,
        sellingAmount: productItems.sellingAmount,
        isActive: productItems.isActive,
        productName: productMasters.name,
        outletCode: outlets.code,
        outletName: outlets.name,
      })
      .from(productBatchImportItemRows)
      .leftJoin(
        productItems,
        eq(productBatchImportItemRows.committedProductItemId, productItems.id),
      )
      .leftJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
      .leftJoin(outlets, eq(productItems.currentOutletId, outlets.id))
      .where(eq(productBatchImportItemRows.sessionId, sessionId))
      .orderBy(asc(productBatchImportItemRows.rowNumber)),
    db
      .select({
        id: hardwareJobs.id,
        payload: hardwareJobs.payload,
        status: hardwareJobs.status,
        attempts: hardwareJobs.attempts,
        error: hardwareJobs.error,
        lastErrorCode: hardwareJobs.lastErrorCode,
        lastErrorMessage: hardwareJobs.lastErrorMessage,
        createdAt: hardwareJobs.createdAt,
        completedAt: hardwareJobs.completedAt,
        failedAt: hardwareJobs.failedAt,
      })
      .from(hardwareJobs)
      .where(
        and(
          eq(hardwareJobs.organizationId, auth.organization.id),
          eq(hardwareJobs.sourceType, "product_batch_import"),
          eq(hardwareJobs.sourceId, sessionId),
          eq(hardwareJobs.jobType, "print_label_sato"),
        ),
      )
      .orderBy(desc(hardwareJobs.createdAt)),
  ]);

  const masters: ProductBatchImportResultMaster[] = masterRows.flatMap((row) => {
    if (
      !row.committedProductMasterId ||
      !row.productMasterId ||
      !row.code ||
      !row.name ||
      !row.status
    ) {
      return [];
    }
    return [
      {
        rowNumber: row.rowNumber,
        masterKey: row.masterKey,
        productMasterId: row.productMasterId,
        code: row.code,
        name: row.name,
        status: row.status,
        imageStatus: row.imageKey ? "stored" : "missing",
        resolution:
          row.plannedProductMasterId === row.productMasterId
            ? "created"
            : "reused",
      },
    ];
  });

  const items: ProductBatchImportResultItem[] = itemRows.flatMap((row) => {
    if (
      !row.committedProductItemId ||
      !row.productItemId ||
      !row.productMasterId ||
      !row.productName ||
      !row.sku ||
      !row.barcode ||
      !row.availability ||
      row.isActive === null
    ) {
      return [];
    }
    return [
      {
        rowNumber: row.rowNumber,
        rowKey: row.rowKey,
        masterKey: row.masterKey,
        productItemId: row.productItemId,
        productMasterId: row.productMasterId,
        productName: row.productName,
        displayName: row.displayName,
        sku: row.sku,
        barcode: row.barcode,
        qrValue: row.qrValue,
        outletId: row.currentOutletId,
        outletCode: row.outletCode,
        outletName: row.outletName,
        availability: row.availability,
        imageSource: row.imageKey
          ? "physical"
          : session.templateVersion === 2
            ? "none"
            : "master-fallback",
        weightGram: row.weightGram,
        purityPercent: row.purityPercent,
        exchangePurityPercent: row.exchangePurityPercent,
        size: row.size,
        color: row.color,
        gemstone: row.gemstone,
        sellingAmount: row.sellingAmount,
        isActive: row.isActive,
      },
    ];
  });

  const warnings = [
    ...masterRows.flatMap((row) =>
      readWarnings(row.validationWarnings, {
        sheet: session.templateVersion === 2 ? "PRODUCTS" : "PRODUCT_MASTERS",
        rowNumber: row.rowNumber,
        key: row.masterKey,
      }),
    ),
    ...itemRows.flatMap((row) =>
      readWarnings(row.validationWarnings, {
        sheet: session.templateVersion === 2 ? "PRODUCTS" : "PHYSICAL_PRODUCTS",
        rowNumber: row.rowNumber,
        key: row.rowKey,
      }),
    ),
  ];

  const labelJobs: ProductBatchImportLabelJob[] = jobRows.map((row) => ({
    id: row.id,
    itemId: readHardwareJobItemId(row.payload),
    status: row.status,
    attempts: row.attempts,
    error: row.error,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    failedAt: row.failedAt,
  }));

  return { session, masters, items, warnings, labelJobs };
}

export async function getProductBatchImportHistory(
  auth: AuthContext,
  limit = 100,
) {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return db
    .select({
      id: productBatchImportSessions.id,
      fileName: productBatchImportSessions.fileName,
      status: productBatchImportSessions.status,
      totalMasterRows: productBatchImportSessions.totalMasterRows,
      totalItemRows: productBatchImportSessions.totalItemRows,
      invalidRows: productBatchImportSessions.invalidRows,
      warningCount: productBatchImportSessions.warningCount,
      committedMasterCount: productBatchImportSessions.committedMasterCount,
      committedItemCount: productBatchImportSessions.committedItemCount,
      createdAt: productBatchImportSessions.createdAt,
      committedAt: productBatchImportSessions.committedAt,
      createdByName: users.fullName,
    })
    .from(productBatchImportSessions)
    .innerJoin(users, eq(productBatchImportSessions.createdByUserId, users.id))
    .where(eq(productBatchImportSessions.organizationId, auth.organization.id))
    .orderBy(desc(productBatchImportSessions.createdAt))
    .limit(boundedLimit);
}
