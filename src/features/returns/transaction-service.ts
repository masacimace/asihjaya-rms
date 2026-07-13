import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  inventoryMovements,
  productItems,
  saleReturnCases,
  saleReturnItems,
  sales,
} from "@/db/schema";
import type { ReturnInspectionDecision } from "@/features/returns/contracts";

const WEIGHT_TOLERANCE_GRAM = 0.01;

export type ReturnWorkflowErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "IDENTITY_MISMATCH"
  | "CONCURRENT_STATE_CHANGE"
  | "VALIDATION_ERROR";

export class ReturnWorkflowError extends Error {
  constructor(
    public readonly code: ReturnWorkflowErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReturnWorkflowError";
  }
}

type ReturnActor = {
  id: string;
  fullName: string;
};

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

function normalizeScanCode(value: string) {
  return value.trim().toUpperCase();
}

function parseWeight(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function lockReturnCase(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  returnCaseId: string,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${returnCaseId}, 0))`,
  );
}

export async function receiveSaleReturnItem(input: {
  organizationId: string;
  accessibleOutletIds: string[];
  saleId: string;
  returnItemId: string;
  scannedCode: string;
  actor: ReturnActor;
  requestMetadata: RequestMetadata;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const scannedCode = normalizeScanCode(input.scannedCode);

  if (scannedCode.length < 3 || scannedCode.length > 160) {
    throw new ReturnWorkflowError(
      "VALIDATION_ERROR",
      "Barcode, SKU, atau serial yang dipindai tidak valid.",
    );
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        returnItemId: saleReturnItems.id,
        returnCaseId: saleReturnItems.returnCaseId,
        returnItemStatus: saleReturnItems.status,
        expectedSku: saleReturnItems.expectedSku,
        expectedBarcode: saleReturnItems.expectedBarcode,
        expectedSerialNumber: saleReturnItems.expectedSerialNumber,
        productItemId: saleReturnItems.productItemId,
        caseStatus: saleReturnCases.status,
        outletId: saleReturnCases.outletId,
        saleId: saleReturnCases.saleId,
        invoiceNumber: sales.invoiceNumber,
        currentOutletId: productItems.currentOutletId,
        availability: productItems.availability,
        condition: productItems.condition,
        locationState: productItems.locationState,
      })
      .from(saleReturnItems)
      .innerJoin(
        saleReturnCases,
        eq(saleReturnItems.returnCaseId, saleReturnCases.id),
      )
      .innerJoin(sales, eq(saleReturnCases.saleId, sales.id))
      .innerJoin(
        productItems,
        eq(saleReturnItems.productItemId, productItems.id),
      )
      .where(
        and(
          eq(saleReturnItems.id, input.returnItemId),
          eq(saleReturnCases.saleId, input.saleId),
          eq(saleReturnCases.organizationId, input.organizationId),
          inArray(saleReturnCases.outletId, input.accessibleOutletIds),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ReturnWorkflowError(
        "NOT_FOUND",
        "Item retur tidak ditemukan atau bukan bagian dari outlet yang bisa kamu akses.",
      );
    }

    await lockReturnCase(tx, row.returnCaseId);

    if (row.returnItemStatus !== "awaiting_receipt") {
      throw new ReturnWorkflowError(
        "INVALID_STATE",
        "Item ini sudah pernah diterima atau tidak lagi menunggu penerimaan.",
      );
    }

    if (
      !["awaiting_receipt", "pending_inspection"].includes(row.caseStatus)
    ) {
      throw new ReturnWorkflowError(
        "INVALID_STATE",
        "Kasus retur tidak berada pada status yang dapat menerima barang.",
      );
    }

    const acceptedCodes = [
      row.expectedSku,
      row.expectedBarcode,
      row.expectedSerialNumber,
    ]
      .filter((value): value is string => Boolean(value))
      .map(normalizeScanCode);

    if (!acceptedCodes.includes(scannedCode)) {
      throw new ReturnWorkflowError(
        "IDENTITY_MISMATCH",
        "Kode barang tidak cocok dengan SKU, barcode, atau serial pada transaksi asal.",
      );
    }

    if (
      row.availability !== "sold" ||
      row.locationState !== "customer" ||
      row.currentOutletId !== row.outletId
    ) {
      throw new ReturnWorkflowError(
        "CONCURRENT_STATE_CHANGE",
        "Status inventory item sudah berubah. Penerimaan dihentikan agar stok tidak salah.",
      );
    }

    const [receivedItem] = await tx
      .update(saleReturnItems)
      .set({
        status: "pending_inspection",
        receivedCode: scannedCode,
        receivedBy: input.actor.id,
        receivedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(saleReturnItems.id, row.returnItemId),
          eq(saleReturnItems.status, "awaiting_receipt"),
        ),
      )
      .returning({ id: saleReturnItems.id });

    if (!receivedItem) {
      throw new ReturnWorkflowError(
        "CONCURRENT_STATE_CHANGE",
        "Item retur sedang diproses request lain. Muat ulang halaman.",
      );
    }

    const [updatedProduct] = await tx
      .update(productItems)
      .set({
        availability: "inspection",
        condition: "returned",
        locationState: "outlet",
        currentOutletId: row.outletId,
        locationCode: "RETURN_INSPECTION",
        updatedAt: now,
      })
      .where(
        and(
          eq(productItems.id, row.productItemId),
          eq(productItems.organizationId, input.organizationId),
          eq(productItems.currentOutletId, row.outletId),
          eq(productItems.availability, "sold"),
          eq(productItems.locationState, "customer"),
        ),
      )
      .returning({ id: productItems.id });

    if (!updatedProduct) {
      throw new ReturnWorkflowError(
        "CONCURRENT_STATE_CHANGE",
        "Inventory berubah saat barang diterima. Seluruh perubahan dibatalkan.",
      );
    }

    await tx.insert(inventoryMovements).values({
      organizationId: input.organizationId,
      itemId: row.productItemId,
      movementType: "sale_return",
      fromOutletId: null,
      toOutletId: row.outletId,
      referenceType: "return_item_receipt",
      referenceId: row.returnItemId,
      reason: `Penerimaan retur ${row.invoiceNumber}`,
      metadata: {
        source: "admin.sales.return.receipt",
        saleId: row.saleId,
        returnCaseId: row.returnCaseId,
        returnItemId: row.returnItemId,
        scannedCode,
        previousAvailability: row.availability,
        previousCondition: row.condition,
        previousLocationState: row.locationState,
      },
      performedBy: input.actor.id,
      occurredAt: now,
      createdAt: now,
    });

    const [caseRow] = await tx
      .select({
        expectedItemCount: saleReturnCases.expectedItemCount,
        receivedItemCount: saleReturnCases.receivedItemCount,
      })
      .from(saleReturnCases)
      .where(eq(saleReturnCases.id, row.returnCaseId))
      .limit(1);

    if (!caseRow) {
      throw new ReturnWorkflowError(
        "CONCURRENT_STATE_CHANGE",
        "Kasus retur tidak ditemukan saat finalisasi penerimaan.",
      );
    }

    const nextReceivedCount = caseRow.receivedItemCount + 1;
    const [updatedCase] = await tx
      .update(saleReturnCases)
      .set({
        receivedItemCount: nextReceivedCount,
        status:
          nextReceivedCount >= caseRow.expectedItemCount
            ? "pending_inspection"
            : "awaiting_receipt",
        updatedAt: now,
      })
      .where(eq(saleReturnCases.id, row.returnCaseId))
      .returning({ id: saleReturnCases.id });

    if (!updatedCase) {
      throw new ReturnWorkflowError(
        "CONCURRENT_STATE_CHANGE",
        "Kasus retur berubah saat penerimaan. Seluruh perubahan dibatalkan.",
      );
    }

    await tx.insert(auditLogs).values({
      organizationId: input.organizationId,
      outletId: row.outletId,
      actorUserId: input.actor.id,
      action: "sale.return_item_received",
      entityType: "sale_return_item",
      entityId: row.returnItemId,
      beforeData: {
        returnItemStatus: row.returnItemStatus,
        availability: row.availability,
        condition: row.condition,
        locationState: row.locationState,
      },
      afterData: {
        returnItemStatus: "pending_inspection",
        availability: "inspection",
        condition: "returned",
        locationState: "outlet",
        receivedCode: scannedCode,
      },
      reason: `Barang retur diterima untuk pemeriksaan: ${row.invoiceNumber}`,
      ipAddress: input.requestMetadata.ipAddress,
      userAgent: input.requestMetadata.userAgent,
      metadata: {
        saleId: row.saleId,
        returnCaseId: row.returnCaseId,
        invoiceNumber: row.invoiceNumber,
        actorName: input.actor.fullName,
      },
      createdAt: now,
    });

    return {
      invoiceNumber: row.invoiceNumber,
      returnCaseId: row.returnCaseId,
      returnItemId: row.returnItemId,
      nextReceivedCount,
      expectedItemCount: caseRow.expectedItemCount,
    };
  });
}

function getInspectionTarget(decision: ReturnInspectionDecision) {
  if (decision === "restock") {
    return {
      itemStatus: "restocked" as const,
      availability: "available" as const,
      condition: "good" as const,
      locationState: "outlet" as const,
      locationCode: null,
      movementType: "adjustment" as const,
    };
  }

  if (decision === "repair") {
    return {
      itemStatus: "repair" as const,
      availability: "reserved" as const,
      condition: "damaged" as const,
      locationState: "repair" as const,
      locationCode: "RETURN_REPAIR",
      movementType: "repair_out" as const,
    };
  }

  if (decision === "damaged") {
    return {
      itemStatus: "damaged" as const,
      availability: "reserved" as const,
      condition: "damaged" as const,
      locationState: "outlet" as const,
      locationCode: "RETURN_DAMAGED",
      movementType: "damaged" as const,
    };
  }

  return {
    itemStatus: "rejected" as const,
    availability: "sold" as const,
    condition: "good" as const,
    locationState: "customer" as const,
    locationCode: null,
    movementType: "reversal" as const,
  };
}

export async function inspectSaleReturnItem(input: {
  organizationId: string;
  accessibleOutletIds: string[];
  saleId: string;
  returnItemId: string;
  actualWeightGram: string;
  identityConfirmed: boolean;
  certificateComplete: boolean;
  packagingComplete: boolean;
  conditionGood: boolean;
  decision: ReturnInspectionDecision;
  notes: string;
  photoKey: string | null;
  actor: ReturnActor;
  requestMetadata: RequestMetadata;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const actualWeight = parseWeight(input.actualWeightGram);
  const notes = input.notes.trim().slice(0, 2000);

  if (!actualWeight) {
    throw new ReturnWorkflowError(
      "VALIDATION_ERROR",
      "Berat aktual wajib diisi dengan angka lebih dari nol.",
    );
  }

  if (!["restock", "repair", "damaged", "reject"].includes(input.decision)) {
    throw new ReturnWorkflowError(
      "VALIDATION_ERROR",
      "Keputusan pemeriksaan tidak valid.",
    );
  }

  if (input.decision !== "restock" && notes.length < 8) {
    throw new ReturnWorkflowError(
      "VALIDATION_ERROR",
      "Catatan minimal 8 karakter wajib untuk keputusan selain layak jual kembali.",
    );
  }

  if (["damaged", "reject"].includes(input.decision) && !input.photoKey) {
    throw new ReturnWorkflowError(
      "VALIDATION_ERROR",
      "Foto kondisi wajib untuk keputusan rusak atau ditolak.",
    );
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        returnItemId: saleReturnItems.id,
        returnCaseId: saleReturnItems.returnCaseId,
        returnItemStatus: saleReturnItems.status,
        productItemId: saleReturnItems.productItemId,
        expectedWeightGram: saleReturnItems.expectedWeightGram,
        existingPhotoKey: saleReturnItems.photoKey,
        caseStatus: saleReturnCases.status,
        outletId: saleReturnCases.outletId,
        saleId: saleReturnCases.saleId,
        invoiceNumber: sales.invoiceNumber,
        availability: productItems.availability,
        condition: productItems.condition,
        locationState: productItems.locationState,
        currentOutletId: productItems.currentOutletId,
      })
      .from(saleReturnItems)
      .innerJoin(
        saleReturnCases,
        eq(saleReturnItems.returnCaseId, saleReturnCases.id),
      )
      .innerJoin(sales, eq(saleReturnCases.saleId, sales.id))
      .innerJoin(
        productItems,
        eq(saleReturnItems.productItemId, productItems.id),
      )
      .where(
        and(
          eq(saleReturnItems.id, input.returnItemId),
          eq(saleReturnCases.saleId, input.saleId),
          eq(saleReturnCases.organizationId, input.organizationId),
          inArray(saleReturnCases.outletId, input.accessibleOutletIds),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ReturnWorkflowError(
        "NOT_FOUND",
        "Item retur tidak ditemukan atau bukan bagian dari outlet yang bisa kamu akses.",
      );
    }

    await lockReturnCase(tx, row.returnCaseId);

    if (row.returnItemStatus !== "pending_inspection") {
      throw new ReturnWorkflowError(
        "INVALID_STATE",
        "Item ini sudah diperiksa atau belum diterima secara fisik.",
      );
    }

    if (
      !["pending_inspection", "partially_inspected"].includes(row.caseStatus)
    ) {
      throw new ReturnWorkflowError(
        "INVALID_STATE",
        "Kasus retur tidak berada pada status pemeriksaan.",
      );
    }

    if (
      row.availability !== "inspection" ||
      row.condition !== "returned" ||
      row.locationState !== "outlet" ||
      row.currentOutletId !== row.outletId
    ) {
      throw new ReturnWorkflowError(
        "CONCURRENT_STATE_CHANGE",
        "Status inventory tidak lagi berada pada area pemeriksaan retur.",
      );
    }

    const expectedWeight = parseWeight(row.expectedWeightGram);
    const weightDifference = expectedWeight
      ? Math.abs(actualWeight - expectedWeight)
      : null;
    const weightMatches =
      weightDifference === null || weightDifference <= WEIGHT_TOLERANCE_GRAM;

    if (input.decision === "restock") {
      if (!input.identityConfirmed) {
        throw new ReturnWorkflowError(
          "VALIDATION_ERROR",
          "Identitas barang harus dikonfirmasi sebelum restock.",
        );
      }

      if (!input.conditionGood) {
        throw new ReturnWorkflowError(
          "VALIDATION_ERROR",
          "Barang hanya dapat direstock jika kondisi fisiknya dinyatakan baik.",
        );
      }

      if (!weightMatches) {
        throw new ReturnWorkflowError(
          "VALIDATION_ERROR",
          `Selisih berat melebihi toleransi ${WEIGHT_TOLERANCE_GRAM.toFixed(3)} gram. Pilih repair/rusak/tolak dan beri catatan pemeriksaan.`,
        );
      }
    }

    if (["repair", "damaged"].includes(input.decision) && !input.identityConfirmed) {
      throw new ReturnWorkflowError(
        "VALIDATION_ERROR",
        "Identitas barang wajib cocok untuk keputusan repair atau rusak.",
      );
    }

    const target = getInspectionTarget(input.decision);

    const [inspectedItem] = await tx
      .update(saleReturnItems)
      .set({
        status: target.itemStatus,
        actualWeightGram: actualWeight.toFixed(3),
        identityConfirmed: input.identityConfirmed,
        certificateComplete: input.certificateComplete,
        packagingComplete: input.packagingComplete,
        conditionGood: input.conditionGood,
        decision: input.decision,
        inspectionNotes: notes || null,
        photoKey: input.photoKey,
        inspectedBy: input.actor.id,
        inspectedAt: now,
        decidedBy: input.actor.id,
        decidedAt: now,
        updatedAt: now,
        metadata: sql`coalesce(${saleReturnItems.metadata}, '{}'::jsonb) || ${JSON.stringify({
          expectedWeightGram: expectedWeight,
          actualWeightGram: actualWeight,
          weightDifferenceGram: weightDifference,
          weightWithinTolerance: weightMatches,
          weightToleranceGram: WEIGHT_TOLERANCE_GRAM,
        })}::jsonb`,
      })
      .where(
        and(
          eq(saleReturnItems.id, row.returnItemId),
          eq(saleReturnItems.status, "pending_inspection"),
        ),
      )
      .returning({ id: saleReturnItems.id });

    if (!inspectedItem) {
      throw new ReturnWorkflowError(
        "CONCURRENT_STATE_CHANGE",
        "Item sedang diperiksa request lain. Muat ulang halaman.",
      );
    }

    const [updatedProduct] = await tx
      .update(productItems)
      .set({
        availability: target.availability,
        condition: target.condition,
        locationState: target.locationState,
        currentOutletId: row.outletId,
        locationCode: target.locationCode,
        updatedAt: now,
      })
      .where(
        and(
          eq(productItems.id, row.productItemId),
          eq(productItems.organizationId, input.organizationId),
          eq(productItems.currentOutletId, row.outletId),
          eq(productItems.availability, "inspection"),
          eq(productItems.condition, "returned"),
          eq(productItems.locationState, "outlet"),
        ),
      )
      .returning({ id: productItems.id });

    if (!updatedProduct) {
      throw new ReturnWorkflowError(
        "CONCURRENT_STATE_CHANGE",
        "Inventory berubah ketika pemeriksaan diselesaikan. Seluruh perubahan dibatalkan.",
      );
    }

    await tx.insert(inventoryMovements).values({
      organizationId: input.organizationId,
      itemId: row.productItemId,
      movementType: target.movementType,
      fromOutletId: row.outletId,
      toOutletId:
        input.decision === "reject" ? null : row.outletId,
      referenceType: "return_item_inspection",
      referenceId: row.returnItemId,
      reason: notes || `Hasil pemeriksaan retur: ${input.decision}`,
      metadata: {
        source: "admin.sales.return.inspection",
        saleId: row.saleId,
        returnCaseId: row.returnCaseId,
        returnItemId: row.returnItemId,
        decision: input.decision,
        expectedWeightGram: expectedWeight,
        actualWeightGram: actualWeight,
        weightDifferenceGram: weightDifference,
        weightWithinTolerance: weightMatches,
        identityConfirmed: input.identityConfirmed,
        certificateComplete: input.certificateComplete,
        packagingComplete: input.packagingComplete,
        conditionGood: input.conditionGood,
        photoKey: input.photoKey,
      },
      performedBy: input.actor.id,
      approvedBy: input.actor.id,
      occurredAt: now,
      createdAt: now,
    });

    const itemStatuses = await tx
      .select({ status: saleReturnItems.status })
      .from(saleReturnItems)
      .where(eq(saleReturnItems.returnCaseId, row.returnCaseId));

    const inspectedStatuses = new Set([
      "restocked",
      "repair",
      "damaged",
      "rejected",
    ]);
    const inspectedItemCount = itemStatuses.filter((item) =>
      inspectedStatuses.has(item.status),
    ).length;
    const rejectedItemCount = itemStatuses.filter(
      (item) => item.status === "rejected",
    ).length;
    const allInspected = inspectedItemCount === itemStatuses.length;
    const nextCaseStatus = allInspected
      ? rejectedItemCount === itemStatuses.length
        ? ("rejected" as const)
        : ("completed" as const)
      : ("partially_inspected" as const);

    const [updatedCase] = await tx
      .update(saleReturnCases)
      .set({
        inspectedItemCount,
        status: nextCaseStatus,
        completedAt: allInspected ? now : null,
        updatedAt: now,
      })
      .where(eq(saleReturnCases.id, row.returnCaseId))
      .returning({ id: saleReturnCases.id });

    if (!updatedCase) {
      throw new ReturnWorkflowError(
        "CONCURRENT_STATE_CHANGE",
        "Kasus retur berubah saat finalisasi pemeriksaan.",
      );
    }

    await tx.insert(auditLogs).values({
      organizationId: input.organizationId,
      outletId: row.outletId,
      actorUserId: input.actor.id,
      action: "sale.return_item_inspected",
      entityType: "sale_return_item",
      entityId: row.returnItemId,
      beforeData: {
        returnItemStatus: row.returnItemStatus,
        availability: row.availability,
        condition: row.condition,
        locationState: row.locationState,
      },
      afterData: {
        returnItemStatus: target.itemStatus,
        availability: target.availability,
        condition: target.condition,
        locationState: target.locationState,
        decision: input.decision,
        actualWeightGram: actualWeight,
        weightDifferenceGram: weightDifference,
        caseStatus: nextCaseStatus,
      },
      reason: notes || `Keputusan pemeriksaan retur: ${input.decision}`,
      ipAddress: input.requestMetadata.ipAddress,
      userAgent: input.requestMetadata.userAgent,
      metadata: {
        saleId: row.saleId,
        returnCaseId: row.returnCaseId,
        invoiceNumber: row.invoiceNumber,
        actorName: input.actor.fullName,
        photoKey: input.photoKey,
      },
      createdAt: now,
    });

    return {
      invoiceNumber: row.invoiceNumber,
      returnCaseId: row.returnCaseId,
      returnItemId: row.returnItemId,
      decision: input.decision,
      nextCaseStatus,
      inspectedItemCount,
      expectedItemCount: itemStatuses.length,
      previousPhotoKey: row.existingPhotoKey,
    };
  });
}
