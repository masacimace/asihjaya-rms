import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  buybackItemProcessings,
  buybackItems,
  buybacks,
  inventoryMovements,
  itemBarcodes,
  productCategories,
  productItems,
  productMasters,
} from "@/db/schema";
import type {
  NormalizedBuybackProcessingPayload,
} from "@/features/buybacks/processing-contracts";
import { getNextProductItemIdentifiers } from "@/features/inventory/product-item-identifiers";
import { calculateJewelryBasePrice } from "@/features/pricing/metal-price-rates";

export class BuybackProcessingValidationError extends Error {}

export type BuybackProcessingServiceAuth = {
  organization: { id: string; timezone: string };
  user: { id: string };
  outlets: Array<{ id: string; code: string; name: string; isPrimary: boolean }>;
};

export type BuybackProcessingRequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type CompleteBuybackProcessingResult = {
  processingId: string;
  buybackId: string;
  buybackNumber: string;
  processingType: "cleaning" | "recondition";
  productItemId: string;
  sku: string;
  barcode: string;
  replayed: boolean;
};

type ProcessingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function readSnapshotText(
  snapshot: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = snapshot?.[key];
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function processingLabel(type: "cleaning" | "recondition") {
  return type === "cleaning" ? "Cuci" : "Rongsok";
}

export async function completeBuybackProcessingTransaction({
  auth,
  payload,
  resultImageKey,
  newProductItemId,
  requestMetadata,
}: {
  auth: BuybackProcessingServiceAuth;
  payload: NormalizedBuybackProcessingPayload;
  resultImageKey: string;
  newProductItemId: string;
  requestMetadata: BuybackProcessingRequestMetadata;
}): Promise<CompleteBuybackProcessingResult> {
  return db.transaction(async (transaction) => {
    const now = new Date();

    const [processing] = await transaction
      .select({
        processingId: buybackItemProcessings.id,
        processingType: buybackItemProcessings.processingType,
        processingStatus: buybackItemProcessings.status,
        storedResultProductItemId: buybackItemProcessings.resultProductItemId,
        storedResultSnapshot: buybackItemProcessings.resultSnapshot,
        buybackItemId: buybackItems.id,
        source: buybackItems.source,
        sourceProductItemId: buybackItems.productItemId,
        sourceWeightGram: buybackItems.weightGram,
        sourcePurityPercent: buybackItems.purityPercent,
        finalAmount: buybackItems.finalAmount,
        sourceSnapshot: buybackItems.snapshot,
        buybackId: buybacks.id,
        buybackNumber: buybacks.buybackNumber,
        buybackStatus: buybacks.status,
        outletId: buybacks.outletId,
      })
      .from(buybackItemProcessings)
      .innerJoin(
        buybackItems,
        eq(buybackItemProcessings.buybackItemId, buybackItems.id),
      )
      .innerJoin(buybacks, eq(buybackItems.buybackId, buybacks.id))
      .where(
        and(
          eq(buybackItemProcessings.id, payload.processingId),
          eq(buybacks.organizationId, auth.organization.id),
        ),
      )
      .limit(1)
      .for("update");

    if (!processing) {
      throw new BuybackProcessingValidationError(
        "Item pemrosesan Buyback tidak ditemukan. Refresh halaman lalu coba kembali.",
      );
    }

    const canAccessOutlet = auth.outlets.some(
      (outlet) => outlet.id === processing.outletId,
    );
    if (!canAccessOutlet) {
      throw new BuybackProcessingValidationError(
        "Outlet item Buyback tidak termasuk akses akun ini.",
      );
    }

    if (processing.buybackStatus !== "completed") {
      throw new BuybackProcessingValidationError(
        "Transaksi Buyback belum berada pada status selesai.",
      );
    }

    if (processing.processingStatus === "completed") {
      const resultSnapshot = processing.storedResultSnapshot ?? {};
      const storedProductItemId = processing.storedResultProductItemId;
      const storedSku = readSnapshotText(resultSnapshot, "sku");
      const storedBarcode = readSnapshotText(resultSnapshot, "barcode");

      if (!storedProductItemId || !storedSku || !storedBarcode) {
        throw new BuybackProcessingValidationError(
          "Pemrosesan sudah selesai tetapi snapshot hasil tidak lengkap. Hubungi admin.",
        );
      }

      return {
        processingId: processing.processingId,
        buybackId: processing.buybackId,
        buybackNumber: processing.buybackNumber,
        processingType: processing.processingType,
        productItemId: storedProductItemId,
        sku: storedSku,
        barcode: storedBarcode,
        replayed: true,
      };
    }

    const sourceSnapshot = processing.sourceSnapshot ?? {};
    const sourceCategoryId =
      readSnapshotText(sourceSnapshot, "categoryId") ??
      readSnapshotText(sourceSnapshot, "originalCategoryId");

    if (!sourceCategoryId) {
      throw new BuybackProcessingValidationError(
        "Kategori snapshot Buyback tidak tersedia. Item belum dapat diproses.",
      );
    }

    const [master] = await transaction
      .select({
        id: productMasters.id,
        code: productMasters.code,
        name: productMasters.name,
        status: productMasters.status,
        categoryId: productCategories.id,
        categoryCode: productCategories.code,
        categoryName: productCategories.name,
        categoryIsActive: productCategories.isActive,
      })
      .from(productMasters)
      .innerJoin(
        productCategories,
        eq(productMasters.categoryId, productCategories.id),
      )
      .where(
        and(
          eq(productMasters.id, payload.productMasterId),
          eq(productMasters.organizationId, auth.organization.id),
        ),
      )
      .limit(1);

    if (!master || master.status !== "active" || !master.categoryIsActive) {
      throw new BuybackProcessingValidationError(
        "Product Master hasil tidak ditemukan atau belum aktif.",
      );
    }

    if (master.categoryId !== sourceCategoryId) {
      throw new BuybackProcessingValidationError(
        "Product Master hasil harus berada pada kategori yang sama dengan item Buyback.",
      );
    }

    const sellingAmount = calculateJewelryBasePrice({
      weightGram: payload.weightGram,
      ratePerGram: payload.pricePerGram,
    });
    if (sellingAmount === null || sellingAmount <= 0) {
      throw new BuybackProcessingValidationError(
        "Harga hasil tidak dapat dihitung. Periksa Berat Sesudah dan Harga/Gram.",
      );
    }

    const processName = processingLabel(processing.processingType);
    const commonAfter = {
      productMasterId: master.id,
      displayName: payload.displayName,
      currentOutletId: processing.outletId,
      weightGram: payload.weightGram,
      purityPercent: payload.purityPercent,
      // Kadar Tukaran sengaja tidak dibebankan ke operator pada flow baru.
      // Untuk kompatibilitas receipt Sale lama, gunakan Kadar Persen sebagai default.
      exchangePurityPercent: payload.purityPercent,
      color: payload.color,
      costAmount: processing.finalAmount,
      sellingAmount: String(sellingAmount),
      pricePerGram: payload.pricePerGram,
      deductionPerGram: "0",
      availability: "available" as const,
      condition: "used" as const,
      locationState: "outlet" as const,
      imageKey: resultImageKey,
      updatedAt: now,
    };

    let resultProductItemId: string;
    let sku: string;
    let barcode: string;
    let qrValue: string | null;
    let serialNumber: string | null;
    let beforeProductItem: Record<string, unknown> | null = null;

    if (processing.source === "asihjaya") {
      if (!processing.sourceProductItemId) {
        throw new BuybackProcessingValidationError(
          "Physical Item ASIHJAYA pada Buyback tidak ditemukan.",
        );
      }

      const [existingItem] = await transaction
        .select({
          id: productItems.id,
          sku: productItems.sku,
          barcode: productItems.barcode,
          qrValue: productItems.qrValue,
          serialNumber: productItems.serialNumber,
          productMasterId: productItems.productMasterId,
          displayName: productItems.displayName,
          currentOutletId: productItems.currentOutletId,
          weightGram: productItems.weightGram,
          purityPercent: productItems.purityPercent,
          exchangePurityPercent: productItems.exchangePurityPercent,
          color: productItems.color,
          costAmount: productItems.costAmount,
          sellingAmount: productItems.sellingAmount,
          pricePerGram: productItems.pricePerGram,
          deductionPerGram: productItems.deductionPerGram,
          availability: productItems.availability,
          condition: productItems.condition,
          locationState: productItems.locationState,
          imageKey: productItems.imageKey,
          isActive: productItems.isActive,
        })
        .from(productItems)
        .where(
          and(
            eq(productItems.id, processing.sourceProductItemId),
            eq(productItems.organizationId, auth.organization.id),
          ),
        )
        .limit(1)
        .for("update");

      if (
        !existingItem ||
        !existingItem.isActive ||
        existingItem.availability !== "processing" ||
        existingItem.currentOutletId !== processing.outletId ||
        existingItem.locationState !== "outlet"
      ) {
        throw new BuybackProcessingValidationError(
          "Physical Item berubah status dan tidak lagi siap diselesaikan dari antrean Buyback.",
        );
      }

      beforeProductItem = {
        productMasterId: existingItem.productMasterId,
        displayName: existingItem.displayName,
        currentOutletId: existingItem.currentOutletId,
        weightGram: existingItem.weightGram,
        purityPercent: existingItem.purityPercent,
        exchangePurityPercent: existingItem.exchangePurityPercent,
        color: existingItem.color,
        costAmount: existingItem.costAmount,
        sellingAmount: existingItem.sellingAmount,
        pricePerGram: existingItem.pricePerGram,
        deductionPerGram: existingItem.deductionPerGram,
        availability: existingItem.availability,
        condition: existingItem.condition,
        locationState: existingItem.locationState,
        imageKey: existingItem.imageKey,
      };

      const updated = await transaction
        .update(productItems)
        .set(commonAfter)
        .where(
          and(
            eq(productItems.id, existingItem.id),
            eq(productItems.organizationId, auth.organization.id),
            eq(productItems.isActive, true),
            eq(productItems.availability, "processing"),
            eq(productItems.currentOutletId, processing.outletId),
          ),
        )
        .returning({
          id: productItems.id,
          sku: productItems.sku,
          barcode: productItems.barcode,
          qrValue: productItems.qrValue,
          serialNumber: productItems.serialNumber,
        });

      const result = updated[0];
      if (!result) {
        throw new BuybackProcessingValidationError(
          "Physical Item berubah saat pemrosesan diselesaikan. Refresh lalu coba kembali.",
        );
      }

      resultProductItemId = result.id;
      sku = result.sku;
      barcode = result.barcode;
      qrValue = result.qrValue;
      serialNumber = result.serialNumber;
    } else {
      if (processing.sourceProductItemId) {
        throw new BuybackProcessingValidationError(
          "Item eksternal sudah memiliki Physical Item sebelum pemrosesan selesai.",
        );
      }

      const identifiers = await getNextProductItemIdentifiers((query) =>
        transaction.execute(query),
      );

      await transaction.insert(productItems).values({
        id: newProductItemId,
        organizationId: auth.organization.id,
        productMasterId: master.id,
        displayName: payload.displayName,
        currentOutletId: processing.outletId,
        sku: identifiers.sku,
        barcode: identifiers.barcode,
        qrValue: identifiers.qrValue,
        serialNumber: null,
        weightGram: payload.weightGram,
        purityPercent: payload.purityPercent,
        exchangePurityPercent: payload.purityPercent,
        size: null,
        color: payload.color,
        gemstone: null,
        costAmount: processing.finalAmount,
        sellingAmount: String(sellingAmount),
        pricePerGram: payload.pricePerGram,
        deductionPerGram: "0",
        availability: "available",
        condition: "used",
        locationState: "outlet",
        locationCode: null,
        imageKey: resultImageKey,
        internalNotes: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await transaction.insert(itemBarcodes).values({
        organizationId: auth.organization.id,
        itemId: newProductItemId,
        barcodeValue: identifiers.barcode,
        source: "system_generated",
        isPrimary: true,
        isActive: true,
        createdBy: auth.user.id,
        createdAt: now,
      });

      resultProductItemId = newProductItemId;
      sku = identifiers.sku;
      barcode = identifiers.barcode;
      qrValue = identifiers.qrValue;
      serialNumber = null;
    }

    const resultSnapshot: Record<string, unknown> = {
      source: processing.source,
      processingType: processing.processingType,
      buybackId: processing.buybackId,
      buybackNumber: processing.buybackNumber,
      buybackItemId: processing.buybackItemId,
      productItemId: resultProductItemId,
      productMasterId: master.id,
      productCode: master.code,
      productMasterName: master.name,
      categoryId: master.categoryId,
      categoryCode: master.categoryCode,
      categoryName: master.categoryName,
      sku,
      barcode,
      qrValue,
      serialNumber,
      displayName: payload.displayName,
      weightGram: payload.weightGram,
      purityPercent: payload.purityPercent,
      exchangePurityPercent: payload.purityPercent,
      color: payload.color,
      pricePerGram: payload.pricePerGram,
      sellingAmount: String(sellingAmount),
      costAmount: processing.finalAmount,
      deductionPerGram: "0",
      imageKey: resultImageKey,
      beforeImageKey: readSnapshotText(sourceSnapshot, "imageKey"),
      beforeWeightGram:
        readSnapshotText(sourceSnapshot, "weightGram") ??
        processing.sourceWeightGram,
      beforePurityPercent:
        readSnapshotText(sourceSnapshot, "purityPercent") ??
        processing.sourcePurityPercent,
      completedAt: now.toISOString(),
    };

    const completed = await transaction
      .update(buybackItemProcessings)
      .set({
        status: "completed",
        resultProductItemId,
        resultSnapshot,
        processedBy: auth.user.id,
        processedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(buybackItemProcessings.id, processing.processingId),
          eq(buybackItemProcessings.status, "pending"),
        ),
      )
      .returning({ id: buybackItemProcessings.id });

    if (completed.length !== 1) {
      throw new BuybackProcessingValidationError(
        "Status pemrosesan berubah saat diselesaikan. Refresh lalu cek kembali.",
      );
    }

    const beforeWeight =
      Number(
        readSnapshotText(sourceSnapshot, "weightGram") ??
          processing.sourceWeightGram,
      ) || 0;
    const afterWeight = Number(payload.weightGram) || 0;

    await transaction.insert(inventoryMovements).values({
      organizationId: auth.organization.id,
      itemId: resultProductItemId,
      movementType: "repair_in",
      fromOutletId: null,
      toOutletId: processing.outletId,
      referenceType: "buyback_processing",
      referenceId: processing.processingId,
      reason: `Hasil ${processName} Buyback ${processing.buybackNumber} selesai dan masuk inventory saleable.`,
      metadata: {
        buybackId: processing.buybackId,
        buybackNumber: processing.buybackNumber,
        buybackItemId: processing.buybackItemId,
        processingType: processing.processingType,
        itemSource: processing.source,
        beforeWeightGram: String(beforeWeight),
        afterWeightGram: payload.weightGram,
        weightDifferenceGram: (afterWeight - beforeWeight).toFixed(3),
      },
      performedBy: auth.user.id,
      approvedBy: null,
      occurredAt: now,
      createdAt: now,
    });

    await transaction.insert(auditLogs).values([
      {
        organizationId: auth.organization.id,
        outletId: processing.outletId,
        actorUserId: auth.user.id,
        action:
          processing.source === "asihjaya"
            ? "product_item.buyback_processing_completed"
            : "product_item.created_from_buyback_processing",
        entityType: "product_item",
        entityId: resultProductItemId,
        beforeData: beforeProductItem,
        afterData: {
          ...commonAfter,
          id: resultProductItemId,
          sku,
          barcode,
          qrValue,
          serialNumber,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.buyback.b3",
          processingId: processing.processingId,
          processingType: processing.processingType,
          buybackId: processing.buybackId,
          buybackNumber: processing.buybackNumber,
          buybackItemId: processing.buybackItemId,
        },
        createdAt: now,
      },
      {
        organizationId: auth.organization.id,
        outletId: processing.outletId,
        actorUserId: auth.user.id,
        action: "buyback_item.processing_completed",
        entityType: "buyback_item",
        entityId: processing.buybackItemId,
        beforeData: {
          processingStatus: "pending",
          processingType: processing.processingType,
          resultProductItemId: null,
        },
        afterData: {
          processingStatus: "completed",
          processingType: processing.processingType,
          resultProductItemId,
          resultSnapshot,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.buyback.b3",
          processingId: processing.processingId,
          buybackId: processing.buybackId,
          buybackNumber: processing.buybackNumber,
        },
        createdAt: now,
      },
    ]);

    return {
      processingId: processing.processingId,
      buybackId: processing.buybackId,
      buybackNumber: processing.buybackNumber,
      processingType: processing.processingType,
      productItemId: resultProductItemId,
      sku,
      barcode,
      replayed: false,
    };
  });
}
