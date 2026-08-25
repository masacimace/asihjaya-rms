import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  buybackItems,
  buybackPayouts,
  buybacks,
  cashMovements,
  customerDepositLedger,
  customers,
  inventoryMovements,
  itemBarcodes,
  productCategories,
  productItems,
  productMasters,
  registers,
  shifts,
} from "@/db/schema";
import { generateBuybackNumber } from "@/features/buybacks/numbering";
import type { NormalizedBuybackPayload } from "@/features/buybacks/contracts";
import { lockCustomerDepositBalance } from "@/features/customers/deposit-balance-lock";
import { getNextProductItemIdentifiers } from "@/features/inventory/product-item-identifiers";
import { getDefaultPosRegisterCondition } from "@/features/pos/context";
import {
  calculateJewelryBasePrice,
  normalizePurityKey,
} from "@/features/pricing/metal-price-rates";
import { RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY } from "@/features/sales/documents/receipt-certificate-render-modes";
import { buildBuybackReceiptDocumentPayloadV2 } from "@/lib/hardware/job-payload-contracts-v2";
import { createHardwareJobV2InTransaction } from "@/lib/hardware/job-producer-v2";

export class BuybackValidationError extends Error {}

export type BuybackServiceAuth = {
  organization: { id: string; timezone: string };
  user: { id: string };
  outlets: Array<{ id: string; code: string; name: string; isPrimary: boolean }>;
};

export type BuybackRequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type BuybackExternalArtifact = {
  itemId: string;
  imageKey: string | null;
};

export type CompleteBuybackResult = {
  buybackId: string;
  buybackNumber: string;
  totalAmount: number;
  itemCount: number;
  replayed: boolean;
  receiptJobId?: string | null;
};

function getPrimaryOutlet(auth: BuybackServiceAuth) {
  return auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0] ?? null;
}

export async function completeBuybackTransaction({
  auth,
  payload,
  requestMetadata,
  externalArtifacts,
  activeSaleRateByPurity,
}: {
  auth: BuybackServiceAuth;
  payload: NormalizedBuybackPayload;
  requestMetadata: BuybackRequestMetadata;
  externalArtifacts: Map<string, BuybackExternalArtifact>;
  activeSaleRateByPurity: Map<string, string>;
}): Promise<CompleteBuybackResult> {
  const primaryOutlet = getPrimaryOutlet(auth);
  if (!primaryOutlet) {
    throw new BuybackValidationError(
      "Outlet aktif tidak ditemukan. Hubungi manager/admin untuk mengatur akses outlet staff ini.",
    );
  }

  return db.transaction(async (transaction) => {
    const now = new Date();

    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${auth.organization.id}:buyback:${payload.idempotencyKey}`}))`,
    );

    const [existingBuyback] = await transaction
      .select({
        id: buybacks.id,
        buybackNumber: buybacks.buybackNumber,
        totalAmount: buybacks.totalAmount,
      })
      .from(buybacks)
      .where(
        and(
          eq(buybacks.organizationId, auth.organization.id),
          eq(buybacks.idempotencyKey, payload.idempotencyKey),
        ),
      )
      .limit(1);

    if (existingBuyback) {
      return {
        buybackId: existingBuyback.id,
        buybackNumber: existingBuyback.buybackNumber,
        totalAmount: Number(existingBuyback.totalAmount),
        itemCount: payload.items.length,
        replayed: true,
        receiptJobId: null,
      };
    }

    const [register] = await transaction
      .select({ id: registers.id, code: registers.code, name: registers.name })
      .from(registers)
      .where(getDefaultPosRegisterCondition(primaryOutlet.id))
      .orderBy(registers.name)
      .limit(1);

    if (!register) {
      throw new BuybackValidationError(
        "Register Hardware Hub aktif belum tersedia. Hubungi manager/admin untuk cek konfigurasi outlet.",
      );
    }

    const [activeShift] = await transaction
      .select({
        id: shifts.id,
        expectedCash: shifts.expectedCash,
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.outletId, primaryOutlet.id),
          eq(shifts.registerId, register.id),
          eq(shifts.status, "open"),
        ),
      )
      .limit(1)
      .for("update");

    if (!activeShift) {
      throw new BuybackValidationError(
        "Shift aktif belum dibuka. Buka shift terlebih dahulu sebelum melakukan Buyback.",
      );
    }

    const [customer] = await transaction
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        fullName: customers.fullName,
        phone: customers.phone,
      })
      .from(customers)
      .where(
        and(
          eq(customers.id, payload.customerId),
          eq(customers.organizationId, auth.organization.id),
          eq(customers.isActive, true),
        ),
      )
      .limit(1);

    if (!customer) {
      throw new BuybackValidationError(
        "Customer tidak ditemukan atau sudah nonaktif. Pilih customer aktif.",
      );
    }

    const cashPayout =
      payload.payouts.find((payout) => payout.method === "cash")?.amount ?? 0;

    // Payout Cash tetap boleh diproses walaupun expected cash shift menjadi negatif.
    // expectedCash adalah saldo kas tercatat/reconciliation, bukan hard limit uang fisik.
    // Cash movement Buyback tetap dicatat sebagai cash_out dan Closing Shift akan
    // merekonsiliasi expected cash terhadap uang fisik aktual.

    const existingItemIds = payload.items
      .filter((item) => item.source === "asihjaya")
      .map((item) => item.productItemId!)
      .filter(Boolean);

    const existingRows =
      existingItemIds.length > 0
        ? await transaction
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
              deductionPerGram: productItems.deductionPerGram,
              costAmount: productItems.costAmount,
              availability: productItems.availability,
              condition: productItems.condition,
              locationState: productItems.locationState,
              isActive: productItems.isActive,
              imageKey: productItems.imageKey,
              productCode: productMasters.code,
              productMasterName: productMasters.name,
              productStatus: productMasters.status,
              categoryId: productCategories.id,
              categoryCode: productCategories.code,
              categoryName: productCategories.name,
              categoryIsActive: productCategories.isActive,
            })
            .from(productItems)
            .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
            .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
            .where(
              and(
                eq(productItems.organizationId, auth.organization.id),
                inArray(productItems.id, existingItemIds),
              ),
            )
            .for("update")
        : [];

    if (existingRows.length !== existingItemIds.length) {
      throw new BuybackValidationError(
        "Sebagian produk ASIHJAYA tidak ditemukan. Cari ulang item sebelum menyelesaikan Buyback.",
      );
    }

    const existingById = new Map(existingRows.map((row) => [row.id, row]));
    for (const itemId of existingItemIds) {
      const row = existingById.get(itemId);
      if (!row) continue;
      if (
        !row.isActive ||
        row.availability !== "sold" ||
        row.locationState !== "customer"
      ) {
        throw new BuybackValidationError(
          `${row.sku} sudah tidak berada pada status Terjual/Customer dan tidak dapat di-Buyback lagi.`,
        );
      }
      if (row.productStatus !== "active" || !row.categoryIsActive) {
        throw new BuybackValidationError(
          `${row.sku} memakai Product Master/Kategori nonaktif. Aktifkan terlebih dahulu sebelum Buyback.`,
        );
      }
    }

    const externalMasterIds = Array.from(
      new Set(
        payload.items
          .filter((item) => item.source === "external")
          .map((item) => item.productMasterId!)
          .filter(Boolean),
      ),
    );
    const externalMasterRows =
      externalMasterIds.length > 0
        ? await transaction
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
            .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
            .where(
              and(
                eq(productMasters.organizationId, auth.organization.id),
                inArray(productMasters.id, externalMasterIds),
              ),
            )
        : [];

    const externalMasterById = new Map(externalMasterRows.map((row) => [row.id, row]));
    if (externalMasterRows.length !== externalMasterIds.length) {
      throw new BuybackValidationError(
        "Sebagian Product Master produk eksternal tidak ditemukan.",
      );
    }
    for (const row of externalMasterRows) {
      if (row.status !== "active" || !row.categoryIsActive) {
        throw new BuybackValidationError(
          `${row.code} belum aktif dan tidak dapat dipakai untuk produk Buyback eksternal.`,
        );
      }
    }

    const buybackNumber = generateBuybackNumber({
      outletCode: primaryOutlet.code,
      date: now,
      timeZone: auth.organization.timezone,
    });

    const [buyback] = await transaction
      .insert(buybacks)
      .values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        registerId: register.id,
        shiftId: activeShift.id,
        customerId: customer.id,
        processedBy: auth.user.id,
        buybackNumber,
        idempotencyKey: payload.idempotencyKey,
        status: "completed",
        totalAmount: String(payload.totalAmount),
        notes: payload.notes,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: buybacks.id });

    if (!buyback) throw new Error("BUYBACK_INSERT_FAILED");

    const completedItems: Array<{
      productItemId: string;
      sku: string;
      source: "asihjaya" | "external";
      lineNumber: number;
      before: Record<string, unknown> | null;
      after: Record<string, unknown>;
    }> = [];

    for (const [index, item] of payload.items.entries()) {
      const lineNumber = index + 1;
      const salePurityKey = normalizePurityKey(item.purityPercent);
      const activeSaleRate = salePurityKey
        ? activeSaleRateByPurity.get(salePurityKey) ?? null
        : null;
      const compatibilitySellingAmount = activeSaleRate
        ? calculateJewelryBasePrice({
            weightGram: item.weightGram,
            ratePerGram: activeSaleRate,
          })
        : null;

      if (item.source === "asihjaya") {
        const existing = existingById.get(item.productItemId!);
        if (!existing) throw new BuybackValidationError("Item Buyback tidak ditemukan.");

        const claimed = await transaction
          .update(productItems)
          .set({
            currentOutletId: primaryOutlet.id,
            weightGram: item.weightGram,
            purityPercent: item.purityPercent,
            exchangePurityPercent: item.exchangePurityPercent,
            color: item.color,
            costAmount: String(item.finalAmount),
            sellingAmount:
              compatibilitySellingAmount === null
                ? null
                : String(compatibilitySellingAmount),
            pricePerGram: activeSaleRate,
            deductionPerGram: item.deductionPerGram,
            availability: "available",
            condition: "used",
            locationState: "outlet",
            updatedAt: now,
          })
          .where(
            and(
              eq(productItems.id, existing.id),
              eq(productItems.organizationId, auth.organization.id),
              eq(productItems.isActive, true),
              eq(productItems.availability, "sold"),
              eq(productItems.locationState, "customer"),
            ),
          )
          .returning({ id: productItems.id });

        if (claimed.length !== 1) {
          throw new BuybackValidationError(
            `${existing.sku} berubah status saat Buyback diproses. Refresh lalu cek ulang.`,
          );
        }

        const after = {
          currentOutletId: primaryOutlet.id,
          weightGram: item.weightGram,
          purityPercent: item.purityPercent,
          exchangePurityPercent: item.exchangePurityPercent,
          color: item.color,
          costAmount: String(item.finalAmount),
          deductionPerGram: item.deductionPerGram,
          availability: "available",
          condition: "used",
          locationState: "outlet",
        };

        await transaction.insert(buybackItems).values({
          buybackId: buyback.id,
          productItemId: existing.id,
          source: "asihjaya",
          lineNumber,
          weightGram: item.weightGram,
          purityPercent: item.purityPercent,
          exchangePurityPercent: item.exchangePurityPercent,
          buybackPricePerGram: item.buybackPricePerGram,
          deductionPerGram: item.deductionPerGram,
          baseAmount: String(item.baseAmount),
          deductionAmount: String(item.deductionAmount),
          finalAmount: String(item.finalAmount),
          snapshot: {
            source: "asihjaya",
            sku: existing.sku,
            barcode: existing.barcode,
            qrValue: existing.qrValue,
            serialNumber: existing.serialNumber,
            productMasterId: existing.productMasterId,
            productCode: existing.productCode,
            productMasterName: existing.productMasterName,
            displayName: existing.displayName,
            categoryId: existing.categoryId,
            categoryCode: existing.categoryCode,
            categoryName: existing.categoryName,
            storedWeightGram: existing.weightGram,
            weightGram: item.weightGram,
            storedPurityPercent: existing.purityPercent,
            purityPercent: item.purityPercent,
            storedExchangePurityPercent: existing.exchangePurityPercent,
            exchangePurityPercent: item.exchangePurityPercent,
            storedColor: existing.color,
            color: item.color,
            buybackPricePerGram: item.buybackPricePerGram,
            deductionPerGram: item.deductionPerGram,
            baseAmount: String(item.baseAmount),
            deductionAmount: String(item.deductionAmount),
            finalAmount: String(item.finalAmount),
            previousCostAmount: existing.costAmount,
            imageKey: existing.imageKey,
          },
          createdAt: now,
        });

        const before = {
          currentOutletId: existing.currentOutletId,
          weightGram: existing.weightGram,
          purityPercent: existing.purityPercent,
          exchangePurityPercent: existing.exchangePurityPercent,
          color: existing.color,
          costAmount: existing.costAmount,
          deductionPerGram: existing.deductionPerGram,
          availability: existing.availability,
          condition: existing.condition,
          locationState: existing.locationState,
        };

        completedItems.push({
          productItemId: existing.id,
          sku: existing.sku,
          source: "asihjaya",
          lineNumber,
          before,
          after,
        });
      } else {
        const master = externalMasterById.get(item.productMasterId!);
        const artifact = externalArtifacts.get(item.clientKey);
        if (!master || !artifact) {
          throw new BuybackValidationError(
            "Data produk eksternal tidak lengkap. Tambahkan ulang item eksternal.",
          );
        }

        const identifiers = await getNextProductItemIdentifiers((query) =>
          transaction.execute(query),
        );

        await transaction.insert(productItems).values({
          id: artifact.itemId,
          organizationId: auth.organization.id,
          productMasterId: master.id,
          displayName: item.displayName,
          currentOutletId: primaryOutlet.id,
          sku: identifiers.sku,
          barcode: identifiers.barcode,
          qrValue: identifiers.qrValue,
          weightGram: item.weightGram,
          purityPercent: item.purityPercent,
          exchangePurityPercent: item.exchangePurityPercent,
          size: null,
          color: item.color,
          gemstone: null,
          costAmount: String(item.finalAmount),
          sellingAmount:
            compatibilitySellingAmount === null
              ? null
              : String(compatibilitySellingAmount),
          pricePerGram: activeSaleRate,
          deductionPerGram: item.deductionPerGram,
          availability: "available",
          condition: "used",
          locationState: "outlet",
          locationCode: null,
          imageKey: artifact.imageKey,
          internalNotes: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        await transaction.insert(itemBarcodes).values({
          organizationId: auth.organization.id,
          itemId: artifact.itemId,
          barcodeValue: identifiers.barcode,
          source: "system_generated",
          isPrimary: true,
          isActive: true,
          createdBy: auth.user.id,
        });

        await transaction.insert(buybackItems).values({
          buybackId: buyback.id,
          productItemId: artifact.itemId,
          source: "external",
          lineNumber,
          weightGram: item.weightGram,
          purityPercent: item.purityPercent,
          exchangePurityPercent: item.exchangePurityPercent,
          buybackPricePerGram: item.buybackPricePerGram,
          deductionPerGram: item.deductionPerGram,
          baseAmount: String(item.baseAmount),
          deductionAmount: String(item.deductionAmount),
          finalAmount: String(item.finalAmount),
          snapshot: {
            source: "external",
            sku: identifiers.sku,
            barcode: identifiers.barcode,
            qrValue: identifiers.qrValue,
            productMasterId: master.id,
            productCode: master.code,
            productMasterName: master.name,
            displayName: item.displayName,
            categoryId: master.categoryId,
            categoryCode: master.categoryCode,
            categoryName: master.categoryName,
            weightGram: item.weightGram,
            purityPercent: item.purityPercent,
            exchangePurityPercent: item.exchangePurityPercent,
            color: item.color,
            buybackPricePerGram: item.buybackPricePerGram,
            deductionPerGram: item.deductionPerGram,
            baseAmount: String(item.baseAmount),
            deductionAmount: String(item.deductionAmount),
            finalAmount: String(item.finalAmount),
            imageKey: artifact.imageKey,
          },
          createdAt: now,
        });

        const after = {
          productMasterId: master.id,
          currentOutletId: primaryOutlet.id,
          sku: identifiers.sku,
          barcode: identifiers.barcode,
          weightGram: item.weightGram,
          purityPercent: item.purityPercent,
          exchangePurityPercent: item.exchangePurityPercent,
          color: item.color,
          costAmount: String(item.finalAmount),
          deductionPerGram: item.deductionPerGram,
          availability: "available",
          condition: "used",
          locationState: "outlet",
          imageKey: artifact.imageKey,
        };

        completedItems.push({
          productItemId: artifact.itemId,
          sku: identifiers.sku,
          source: "external",
          lineNumber,
          before: null,
          after,
        });
      }
    }

    await transaction.insert(inventoryMovements).values(
      completedItems.map((item) => ({
        organizationId: auth.organization.id,
        itemId: item.productItemId,
        movementType: "buyback" as const,
        fromOutletId: null,
        toOutletId: primaryOutlet.id,
        referenceType: "buyback",
        referenceId: buyback.id,
        reason: `Diterima melalui Buyback ${buybackNumber}.`,
        metadata: {
          buybackNumber,
          source: item.source,
          customerId: customer.id,
          lineNumber: item.lineNumber,
          finalAmount: String(payload.items[item.lineNumber - 1]?.finalAmount ?? 0),
        },
        performedBy: auth.user.id,
        approvedBy: null,
        occurredAt: now,
        createdAt: now,
      })),
    );

    await transaction.insert(buybackPayouts).values(
      payload.payouts.map((payout) => ({
        buybackId: buyback.id,
        method: payout.method,
        amount: String(payout.amount),
        reference: payout.reference,
        metadata: { source: "pos.buyback.bb1" },
        createdBy: auth.user.id,
        createdAt: now,
      })),
    );

    if (cashPayout > 0) {
      await transaction.insert(cashMovements).values({
        shiftId: activeShift.id,
        type: "cash_out",
        amount: String(cashPayout),
        referenceType: "buyback",
        referenceId: buyback.id,
        reason: `Payout cash Buyback ${buybackNumber}.`,
        createdBy: auth.user.id,
        createdAt: now,
      });

      await transaction
        .update(shifts)
        .set({
          expectedCash: sql`coalesce(${shifts.expectedCash}, 0) - ${cashPayout}`,
          updatedAt: now,
        })
        .where(eq(shifts.id, activeShift.id));
    }

    const depositPayout =
      payload.payouts.find((payout) => payout.method === "customer_deposit")
        ?.amount ?? 0;
    if (depositPayout > 0) {
      const currentBalance = await lockCustomerDepositBalance(transaction, {
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        customerId: customer.id,
      });
      const nextBalance = currentBalance + depositPayout;

      await transaction.insert(customerDepositLedger).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        customerId: customer.id,
        saleId: null,
        paymentId: null,
        cashMovementId: null,
        approvalId: null,
        entryType: "deposit_in",
        direction: "credit",
        amount: String(depositPayout),
        balanceAfter: String(nextBalance),
        idempotencyKey: `buyback:${payload.idempotencyKey}:deposit_in`,
        referenceType: "buyback",
        referenceId: buyback.id,
        description: `Dana Titip dari Buyback ${buybackNumber}.`,
        metadata: {
          source: "pos.buyback.bb1",
          buybackNumber,
          totalAmount: String(payload.totalAmount),
        },
        createdBy: auth.user.id,
        occurredAt: now,
        createdAt: now,
      });
    }

    if (completedItems.length > 0) {
      await transaction.insert(auditLogs).values(
        completedItems.map((item) => ({
          organizationId: auth.organization.id,
          outletId: primaryOutlet.id,
          actorUserId: auth.user.id,
          action:
            item.source === "asihjaya"
              ? "product_item.reacquired_by_buyback"
              : "product_item.created_by_buyback",
          entityType: "product_item",
          entityId: item.productItemId,
          beforeData: item.before,
          afterData: item.after,
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
          metadata: {
            source: "pos.buyback.bb1",
            buybackId: buyback.id,
            buybackNumber,
            customerId: customer.id,
            sku: item.sku,
          },
          createdAt: now,
        })),
      );
    }

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: primaryOutlet.id,
      actorUserId: auth.user.id,
      action: "buyback.completed",
      entityType: "buyback",
      entityId: buyback.id,
      beforeData: null,
      afterData: {
        buybackNumber,
        customerId: customer.id,
        customerCode: customer.customerCode,
        customerName: customer.fullName,
        itemCount: payload.items.length,
        totalAmount: String(payload.totalAmount),
        payouts: payload.payouts.map((payout) => ({
          method: payout.method,
          amount: String(payout.amount),
          reference: payout.reference,
        })),
      },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        source: "pos.buyback.bb1",
        registerId: register.id,
        shiftId: activeShift.id,
        idempotencyKey: payload.idempotencyKey,
      },
      createdAt: now,
    });

    const receiptJob = await createHardwareJobV2InTransaction(transaction, {
      organizationId: auth.organization.id,
      outletId: primaryOutlet.id,
      registerId: register.id,
      createdByUserId: auth.user.id,
      jobType: "print_receipt_certificate",
      mode: "automatic",
      payload: buildBuybackReceiptDocumentPayloadV2({
        buybackId: buyback.id,
        buybackNumber,
        requestSource: "pos.buyback",
        reprint: false,
        requestedAt: now,
        renderMode: RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
      }),
      idempotencyKey: `buyback-receipt:${buyback.id}:initial`,
      sourceType: "buyback",
      sourceId: buyback.id,
      now,
      audit: {
        source: "pos.buyback",
        requestId: payload.idempotencyKey,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      },
    });

    return {
      buybackId: buyback.id,
      buybackNumber,
      totalAmount: payload.totalAmount,
      itemCount: payload.items.length,
      replayed: false,
      receiptJobId: receiptJob.job.id,
    };
  });
}
