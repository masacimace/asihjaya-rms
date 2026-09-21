import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  buybackItemProcessings,
  buybackItems,
  buybackPayouts,
  buybacks,
  cashMovements,
  customerDepositLedger,
  customers,
  inventoryMovements,
  metalBuybackPriceRates,
  metalPurities,
  metals,
  productCategories,
  productItems,
  productMasters,
  registers,
  saleItems,
  sales,
  shifts,
} from "@/db/schema";
import type { NormalizedBuybackPayload } from "@/features/buybacks/contracts";
import { generateBuybackNumber } from "@/features/buybacks/numbering";
import { lockCustomerDepositBalance } from "@/features/customers/deposit-balance-lock";
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

export type BuybackItemArtifact = {
  buybackItemId: string;
  imageKey: string;
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

type BuybackTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function readSnapshotText(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function sameNullableText(left: unknown, right: unknown) {
  const normalize = (value: unknown) => {
    const normalized = String(value ?? "").trim();
    return normalized || null;
  };
  return normalize(left) === normalize(right);
}

function sameNumeric(left: unknown, right: unknown) {
  return Number(left ?? 0) === Number(right ?? 0);
}

async function getExistingBuybackReplayResultInTransaction(
  transaction: BuybackTransaction,
  organizationId: string,
  payload: NormalizedBuybackPayload,
): Promise<CompleteBuybackResult | null> {
  const [existing] = await transaction
    .select({
      id: buybacks.id,
      buybackNumber: buybacks.buybackNumber,
      customerId: buybacks.customerId,
      totalAmount: buybacks.totalAmount,
      notes: buybacks.notes,
    })
    .from(buybacks)
    .where(
      and(
        eq(buybacks.organizationId, organizationId),
        eq(buybacks.idempotencyKey, payload.idempotencyKey),
      ),
    )
    .limit(1);

  if (!existing) return null;

  const [storedItems, storedPayouts] = await Promise.all([
    transaction
      .select({
        id: buybackItems.id,
        productItemId: buybackItems.productItemId,
        source: buybackItems.source,
        lineNumber: buybackItems.lineNumber,
        weightGram: buybackItems.weightGram,
        purityPercent: buybackItems.purityPercent,
        baseAmount: buybackItems.baseAmount,
        deductionAmount: buybackItems.deductionAmount,
        finalAmount: buybackItems.finalAmount,
        snapshot: buybackItems.snapshot,
        processingType: buybackItemProcessings.processingType,
      })
      .from(buybackItems)
      .innerJoin(
        buybackItemProcessings,
        eq(buybackItemProcessings.buybackItemId, buybackItems.id),
      )
      .where(eq(buybackItems.buybackId, existing.id))
      .orderBy(asc(buybackItems.lineNumber)),
    transaction
      .select({
        method: buybackPayouts.method,
        amount: buybackPayouts.amount,
        reference: buybackPayouts.reference,
      })
      .from(buybackPayouts)
      .where(eq(buybackPayouts.buybackId, existing.id)),
  ]);

  let matches =
    existing.customerId === payload.customerId &&
    sameNumeric(existing.totalAmount, payload.totalAmount) &&
    sameNullableText(existing.notes, payload.notes) &&
    storedItems.length === payload.items.length &&
    storedPayouts.length === payload.payouts.length;

  if (matches) {
    for (const [index, incoming] of payload.items.entries()) {
      const stored = storedItems[index];
      if (
        !stored ||
        stored.lineNumber !== index + 1 ||
        stored.source !== incoming.source ||
        stored.processingType !== incoming.processingType
      ) {
        matches = false;
        break;
      }

      const snapshot = stored.snapshot ?? {};
      const identityMatches =
        incoming.source === "asihjaya"
          ? stored.productItemId === incoming.productItemId
          : stored.productItemId === null;
      const incomingDeductionAmount =
        incoming.source === "asihjaya" ? incoming.deductionAmount : 0;
      const incomingBaseAmount =
        incoming.source === "asihjaya"
          ? incoming.finalAmount + incomingDeductionAmount
          : incoming.finalAmount;

      if (
        !identityMatches ||
        !sameNullableText(readSnapshotText(snapshot, "displayName"), incoming.displayName) ||
        readSnapshotText(snapshot, "categoryId") !== incoming.categoryId ||
        !sameNumeric(stored.weightGram, incoming.weightGram) ||
        !sameNumeric(stored.purityPercent, incoming.purityPercent) ||
        !sameNullableText(readSnapshotText(snapshot, "color"), incoming.color) ||
        !sameNumeric(stored.baseAmount, incomingBaseAmount) ||
        !sameNumeric(stored.deductionAmount, incomingDeductionAmount) ||
        !sameNumeric(stored.finalAmount, incoming.finalAmount)
      ) {
        matches = false;
        break;
      }
    }
  }

  if (matches) {
    const storedPayoutByMethod = new Map(
      storedPayouts.map((payout) => [payout.method, payout]),
    );
    for (const incoming of payload.payouts) {
      const stored = storedPayoutByMethod.get(incoming.method);
      if (
        !stored ||
        !sameNumeric(stored.amount, incoming.amount) ||
        !sameNullableText(stored.reference, incoming.reference)
      ) {
        matches = false;
        break;
      }
    }
  }

  if (!matches) {
    throw new BuybackValidationError(
      "Sesi Buyback ini sudah dipakai oleh transaksi berhasil dengan data yang berbeda. Refresh halaman untuk memulai Buyback baru.",
    );
  }

  return {
    buybackId: existing.id,
    buybackNumber: existing.buybackNumber,
    totalAmount: Number(existing.totalAmount),
    itemCount: storedItems.length,
    replayed: true,
    receiptJobId: null,
  };
}

export function getExistingBuybackReplayResult({
  organizationId,
  payload,
}: {
  organizationId: string;
  payload: NormalizedBuybackPayload;
}) {
  return db.transaction((transaction) =>
    getExistingBuybackReplayResultInTransaction(
      transaction,
      organizationId,
      payload,
    ),
  );
}

export async function completeBuybackTransaction({
  auth,
  payload,
  requestMetadata,
  itemArtifacts,
}: {
  auth: BuybackServiceAuth;
  payload: NormalizedBuybackPayload;
  requestMetadata: BuybackRequestMetadata;
  itemArtifacts: Map<string, BuybackItemArtifact>;
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

    const replayResult = await getExistingBuybackReplayResultInTransaction(
      transaction,
      auth.organization.id,
      payload,
    );
    if (replayResult) return replayResult;

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
      .select({ id: shifts.id, expectedCash: shifts.expectedCash })
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
              originalCategoryId: productCategories.id,
              originalCategoryCode: productCategories.code,
              originalCategoryName: productCategories.name,
              originalCategoryIsActive: productCategories.isActive,
            })
            .from(productItems)
            .innerJoin(
              productMasters,
              eq(productItems.productMasterId, productMasters.id),
            )
            .innerJoin(
              productCategories,
              eq(productMasters.categoryId, productCategories.id),
            )
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
      if (row.productStatus !== "active" || !row.originalCategoryIsActive) {
        throw new BuybackValidationError(
          `${row.sku} memakai Product Master/Kategori nonaktif. Aktifkan terlebih dahulu sebelum Buyback.`,
        );
      }
    }

    const latestSaleRows =
      existingItemIds.length > 0
        ? await transaction
            .select({
              productItemId: saleItems.productItemId,
              invoiceNumber: sales.invoiceNumber,
              finalPriceAmount: saleItems.finalPriceAmount,
              completedAt: sales.completedAt,
              createdAt: sales.createdAt,
            })
            .from(saleItems)
            .innerJoin(sales, eq(saleItems.saleId, sales.id))
            .where(
              and(
                eq(sales.organizationId, auth.organization.id),
                inArray(saleItems.productItemId, existingItemIds),
                inArray(sales.status, ["completed", "partially_refunded"]),
              ),
            )
            .orderBy(desc(sales.completedAt), desc(sales.createdAt))
        : [];

    const latestSaleByItem = new Map<
      string,
      {
        invoiceNumber: string;
        finalPriceAmount: string;
        completedAt: Date | null;
        createdAt: Date;
      }
    >();
    for (const sale of latestSaleRows) {
      if (!latestSaleByItem.has(sale.productItemId)) {
        latestSaleByItem.set(sale.productItemId, {
          invoiceNumber: sale.invoiceNumber,
          finalPriceAmount: sale.finalPriceAmount,
          completedAt: sale.completedAt,
          createdAt: sale.createdAt,
        });
      }
    }

    for (const item of payload.items) {
      if (item.source !== "asihjaya" || !item.productItemId) continue;

      const existing = existingById.get(item.productItemId);
      const latestSale = latestSaleByItem.get(item.productItemId);
      if (!existing || !latestSale) {
        throw new BuybackValidationError(
          `${existing?.sku ?? "Produk ASIHJAYA"} belum memiliki riwayat harga jual sebelumnya yang valid.`,
        );
      }

      const previousSaleAmount = Number(latestSale.finalPriceAmount);
      if (!Number.isSafeInteger(previousSaleAmount) || previousSaleAmount <= 0) {
        throw new BuybackValidationError(
          `Harga Jual Sebelumnya ${existing.sku} tidak valid. Periksa riwayat transaksi penjualan item.`,
        );
      }
      if (!Number.isSafeInteger(item.deductionAmount) || item.deductionAmount < 0) {
        throw new BuybackValidationError(
          `Potongan ${existing.sku} tidak valid. Gunakan nominal Rp0 atau lebih besar.`,
        );
      }

      const authoritativeFinalAmount = previousSaleAmount - item.deductionAmount;
      if (authoritativeFinalAmount <= 0) {
        throw new BuybackValidationError(
          `Potongan ${existing.sku} harus lebih kecil dari Harga Jual Sebelumnya.`,
        );
      }
      if (authoritativeFinalAmount !== item.finalAmount) {
        throw new BuybackValidationError(
          `Total Harga Buyback ${existing.sku} sudah tidak sesuai. Harga jual sebelumnya atau Potongan berubah; buka ulang item lalu coba kembali.`,
        );
      }
    }

    const categoryIds = Array.from(
      new Set(payload.items.map((item) => item.categoryId)),
    );
    const categoryRows = await transaction
      .select({
        id: productCategories.id,
        code: productCategories.code,
        name: productCategories.name,
        isActive: productCategories.isActive,
      })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.organizationId, auth.organization.id),
          inArray(productCategories.id, categoryIds),
        ),
      );

    if (categoryRows.length !== categoryIds.length) {
      throw new BuybackValidationError(
        "Sebagian kategori item Buyback tidak ditemukan. Pilih ulang kategori.",
      );
    }
    if (categoryRows.some((category) => !category.isActive)) {
      throw new BuybackValidationError(
        "Kategori nonaktif tidak dapat dipakai untuk item Buyback.",
      );
    }
    const categoryById = new Map(categoryRows.map((row) => [row.id, row]));

    for (const item of payload.items) {
      if (!itemArtifacts.has(item.clientKey)) {
        throw new BuybackValidationError(
          "Foto kondisi salah satu item Buyback belum tersimpan. Tambahkan ulang foto item.",
        );
      }
    }

    // Recommendation yang tampil di browser bukan source of truth. Untuk item
    // external, server membaca ulang Rate Buyback aktif pada timestamp transaksi
    // dan membuat snapshot recommendation secara independen dari payload client.
    const externalPurityKeys = new Set<string>();
    for (const item of payload.items) {
      if (item.source !== "external") continue;
      const purityKey = normalizePurityKey(item.purityPercent);
      if (!purityKey) {
        throw new BuybackValidationError(
          `Kadar ${item.purityPercent}% tidak valid untuk kalkulasi Rate Buyback.`,
        );
      }
      externalPurityKeys.add(purityKey);
    }

    const activeBuybackRateRows =
      externalPurityKeys.size > 0
        ? await transaction
            .select({
              purityPercent: metalPurities.purityPercentage,
              ratePerGram: metalBuybackPriceRates.ratePerGram,
              effectiveFrom: metalBuybackPriceRates.effectiveFrom,
            })
            .from(metalBuybackPriceRates)
            .innerJoin(
              metalPurities,
              eq(metalBuybackPriceRates.metalPurityId, metalPurities.id),
            )
            .innerJoin(metals, eq(metalPurities.metalId, metals.id))
            .where(
              and(
                eq(metals.organizationId, auth.organization.id),
                eq(metals.code, "GOLD"),
                eq(metals.isActive, true),
                eq(metalPurities.isActive, true),
                lte(metalBuybackPriceRates.effectiveFrom, now),
                or(
                  isNull(metalBuybackPriceRates.effectiveUntil),
                  gt(metalBuybackPriceRates.effectiveUntil, now),
                ),
              ),
            )
            .orderBy(desc(metalBuybackPriceRates.effectiveFrom))
        : [];

    const activeBuybackRateByPurity = new Map<
      string,
      { ratePerGram: string; effectiveFrom: Date }
    >();
    for (const rate of activeBuybackRateRows) {
      const purityKey = normalizePurityKey(rate.purityPercent);
      if (
        !purityKey ||
        !externalPurityKeys.has(purityKey) ||
        activeBuybackRateByPurity.has(purityKey)
      ) {
        continue;
      }
      activeBuybackRateByPurity.set(purityKey, {
        ratePerGram: rate.ratePerGram,
        effectiveFrom: rate.effectiveFrom,
      });
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

    const reacquiredItems: Array<{
      productItemId: string;
      sku: string;
      lineNumber: number;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    }> = [];
    const processingAuditRows: Array<{
      buybackItemId: string;
      processingType: "cleaning" | "recondition";
      source: "asihjaya" | "external";
      productItemId: string | null;
      lineNumber: number;
    }> = [];

    for (const [index, item] of payload.items.entries()) {
      const lineNumber = index + 1;
      const artifact = itemArtifacts.get(item.clientKey);
      const category = categoryById.get(item.categoryId);
      if (!artifact || !category) {
        throw new BuybackValidationError(
          "Data item Buyback tidak lengkap. Tambahkan ulang item.",
        );
      }

      let productItemId: string | null = null;
      let snapshot: Record<string, unknown>;
      let buybackPricePerGram: string | null = null;
      let recommendedBuybackAmount: number | null = null;
      let buybackRateEffectiveFrom: Date | null = null;
      let buybackPurityKey: string | null = null;
      let baseAmount = item.finalAmount;
      let deductionAmount = 0;

      if (item.source === "external") {
        buybackPurityKey = normalizePurityKey(item.purityPercent);
        if (!buybackPurityKey) {
          throw new BuybackValidationError(
            `Kadar ${item.purityPercent}% tidak valid untuk kalkulasi Rate Buyback.`,
          );
        }

        const activeRate =
          activeBuybackRateByPurity.get(buybackPurityKey) ?? null;
        if (activeRate) {
          const recommendation = calculateJewelryBasePrice({
            weightGram: item.weightGram,
            ratePerGram: activeRate.ratePerGram,
          });
          if (recommendation === null) {
            throw new BuybackValidationError(
              `Rekomendasi Buyback untuk kadar ${buybackPurityKey}% tidak dapat dihitung. Periksa kembali berat item.`,
            );
          }

          buybackPricePerGram = activeRate.ratePerGram;
          recommendedBuybackAmount = recommendation;
          buybackRateEffectiveFrom = activeRate.effectiveFrom;
        }
      }

      if (item.source === "asihjaya") {
        const existing = existingById.get(item.productItemId!);
        const latestSale = latestSaleByItem.get(item.productItemId!);
        if (!existing || !latestSale) {
          throw new BuybackValidationError("Item Buyback tidak ditemukan.");
        }

        baseAmount = Number(latestSale.finalPriceAmount);
        deductionAmount = item.deductionAmount;

        const claimed = await transaction
          .update(productItems)
          .set({
            currentOutletId: primaryOutlet.id,
            weightGram: item.weightGram,
            purityPercent: item.purityPercent,
            color: item.color,
            costAmount: String(item.finalAmount),
            sellingAmount: null,
            pricePerGram: null,
            deductionPerGram: null,
            availability: "processing",
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

        productItemId = existing.id;
        snapshot = {
          source: "asihjaya",
          sku: existing.sku,
          barcode: existing.barcode,
          qrValue: existing.qrValue,
          serialNumber: existing.serialNumber,
          originalProductMasterId: existing.productMasterId,
          originalProductCode: existing.productCode,
          originalProductMasterName: existing.productMasterName,
          originalDisplayName: existing.displayName,
          originalCategoryId: existing.originalCategoryId,
          originalCategoryCode: existing.originalCategoryCode,
          originalCategoryName: existing.originalCategoryName,
          displayName: item.displayName,
          categoryId: category.id,
          categoryCode: category.code,
          categoryName: category.name,
          storedWeightGram: existing.weightGram,
          weightGram: item.weightGram,
          storedPurityPercent: existing.purityPercent,
          purityPercent: item.purityPercent,
          storedExchangePurityPercent: existing.exchangePurityPercent,
          storedColor: existing.color,
          color: item.color,
          totalAmount: String(item.finalAmount),
          baseAmount: String(baseAmount),
          deductionAmount: String(deductionAmount),
          deductionType: "nominal",
          previousSaleInvoiceNumber: latestSale.invoiceNumber,
          previousSaleFinalPriceAmount: latestSale.finalPriceAmount,
          previousSaleCompletedAt:
            (latestSale.completedAt ?? latestSale.createdAt).toISOString(),
          previousCostAmount: existing.costAmount,
          previousImageKey: existing.imageKey,
          imageKey: artifact.imageKey,
          processingType: item.processingType,
        };

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
        const after = {
          currentOutletId: primaryOutlet.id,
          weightGram: item.weightGram,
          purityPercent: item.purityPercent,
          color: item.color,
          costAmount: String(item.finalAmount),
          sellingAmount: null,
          pricePerGram: null,
          deductionPerGram: null,
          availability: "processing",
          condition: "used",
          locationState: "outlet",
        };
        reacquiredItems.push({
          productItemId: existing.id,
          sku: existing.sku,
          lineNumber,
          before,
          after,
        });
      } else {
        snapshot = {
          source: "external",
          displayName: item.displayName,
          categoryId: category.id,
          categoryCode: category.code,
          categoryName: category.name,
          weightGram: item.weightGram,
          purityPercent: item.purityPercent,
          color: item.color,
          totalAmount: String(item.finalAmount),
          baseAmount: String(item.finalAmount),
          deductionAmount: "0",
          buybackPurityKey,
          buybackRateStatus: buybackPricePerGram ? "available" : "missing",
          buybackRatePerGram: buybackPricePerGram,
          buybackRateEffectiveFrom:
            buybackRateEffectiveFrom?.toISOString() ?? null,
          recommendedBuybackAmount:
            recommendedBuybackAmount === null
              ? null
              : String(recommendedBuybackAmount),
          buybackRecommendationSource: "server_active_buyback_rate",
          buybackRecommendationCalculatedAt: now.toISOString(),
          imageKey: artifact.imageKey,
          processingType: item.processingType,
        };
      }

      await transaction.insert(buybackItems).values({
        id: artifact.buybackItemId,
        buybackId: buyback.id,
        productItemId,
        source: item.source,
        lineNumber,
        weightGram: item.weightGram,
        purityPercent: item.purityPercent,
        exchangePurityPercent: null,
        buybackPricePerGram,
        deductionPerGram: "0",
        baseAmount: String(baseAmount),
        deductionAmount: String(deductionAmount),
        finalAmount: String(item.finalAmount),
        snapshot,
        createdAt: now,
      });

      await transaction.insert(buybackItemProcessings).values({
        buybackItemId: artifact.buybackItemId,
        processingType: item.processingType,
        status: "pending",
        resultProductItemId: null,
        resultSnapshot: null,
        processedBy: null,
        processedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      processingAuditRows.push({
        buybackItemId: artifact.buybackItemId,
        processingType: item.processingType,
        source: item.source,
        productItemId,
        lineNumber,
      });
    }

    if (reacquiredItems.length > 0) {
      await transaction.insert(inventoryMovements).values(
        reacquiredItems.map((item) => ({
          organizationId: auth.organization.id,
          itemId: item.productItemId,
          movementType: "buyback" as const,
          fromOutletId: null,
          toOutletId: primaryOutlet.id,
          referenceType: "buyback",
          referenceId: buyback.id,
          reason: `Diterima melalui Buyback ${buybackNumber}; menunggu pemrosesan.`,
          metadata: {
            buybackNumber,
            source: "asihjaya",
            customerId: customer.id,
            lineNumber: item.lineNumber,
            processingStatus: "pending",
            baseAmount: String(
              (payload.items[item.lineNumber - 1]?.finalAmount ?? 0) +
                (payload.items[item.lineNumber - 1]?.deductionAmount ?? 0),
            ),
            deductionAmount: String(
              payload.items[item.lineNumber - 1]?.deductionAmount ?? 0,
            ),
            finalAmount: String(
              payload.items[item.lineNumber - 1]?.finalAmount ?? 0,
            ),
          },
          performedBy: auth.user.id,
          approvedBy: null,
          occurredAt: now,
          createdAt: now,
        })),
      );
    }

    await transaction.insert(buybackPayouts).values(
      payload.payouts.map((payout) => ({
        buybackId: buyback.id,
        method: payout.method,
        amount: String(payout.amount),
        reference: payout.reference,
        metadata: { source: "pos.buyback.b2" },
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
        entryType: "deposit_in",
        direction: "credit",
        amount: String(depositPayout),
        balanceAfter: String(nextBalance),
        idempotencyKey: `buyback:${payload.idempotencyKey}:deposit_in`,
        referenceType: "buyback",
        referenceId: buyback.id,
        description: `Dana Titip dari Buyback ${buybackNumber}.`,
        metadata: {
          source: "pos.buyback.b2",
          buybackNumber,
          totalAmount: String(payload.totalAmount),
        },
        createdBy: auth.user.id,
        occurredAt: now,
        createdAt: now,
      });
    }

    if (reacquiredItems.length > 0) {
      await transaction.insert(auditLogs).values(
        reacquiredItems.map((item) => ({
          organizationId: auth.organization.id,
          outletId: primaryOutlet.id,
          actorUserId: auth.user.id,
          action: "product_item.reacquired_by_buyback",
          entityType: "product_item",
          entityId: item.productItemId,
          beforeData: item.before,
          afterData: item.after,
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
          metadata: {
            source: "pos.buyback.b2",
            buybackId: buyback.id,
            buybackNumber,
            customerId: customer.id,
            sku: item.sku,
            lifecycle: "processing",
          },
          createdAt: now,
        })),
      );
    }

    await transaction.insert(auditLogs).values(
      processingAuditRows.map((item) => ({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        actorUserId: auth.user.id,
        action: "buyback_item.processing_queued",
        entityType: "buyback_item",
        entityId: item.buybackItemId,
        beforeData: null,
        afterData: {
          processingType: item.processingType,
          processingStatus: "pending",
          productItemId: item.productItemId,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.buyback.b2",
          buybackId: buyback.id,
          buybackNumber,
          itemSource: item.source,
          lineNumber: item.lineNumber,
        },
        createdAt: now,
      })),
    );

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
        pendingProcessingCount: payload.items.length,
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
        source: "pos.buyback.b2",
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
