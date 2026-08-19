"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  inventoryMovements,
  itemBarcodes,
  outlets,
  productItems,
  productMasters,
} from "@/db/schema";
import {
  isItemCondition,
  isUuid,
  type ProductItemActionState,
} from "@/features/inventory/product-item-contracts";
import { getNextProductItemIdentifiers } from "@/features/inventory/product-item-identifiers";
import {
  calculateJewelryBasePrice,
  getActiveGoldPriceRateMap,
  normalizePurityKey,
} from "@/features/pricing/metal-price-rates";
import { getClientIp } from "@/lib/http/client-ip";
import { requireAnyPermission } from "@/lib/auth/session";
import { deleteImageFile, storeImageFile } from "@/lib/storage/image-storage";
import { validateImageFile } from "@/lib/storage/image-validation";

const DECIMAL_PATTERN = /^\d{1,9}(?:[.,]\d{1,3})?$/;
const PERCENT_PATTERN = /^\d{1,3}(?:[.,]\d{1,3})?$/;
const MONEY_PATTERN = /^\d{1,18}$/;

type ProductContext = {
  id: string;
  code: string;
  name: string;
  status: "draft" | "active" | "inactive";
  imageKey: string | null;
};

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): ProductItemActionState {
  return { status: "error", message, fieldErrors };
}

function success(message: string): ProductItemActionState {
  return { status: "success", message };
}

function readText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function readImage(formData: FormData): File | null {
  const value = formData.get("image");

  return value instanceof File && value.size > 0 ? value : null;
}

function normalizeNullable(value: string): string | null {
  return value.length > 0 ? value : null;
}

function parseDecimal(
  value: string,
  label: string,
): { value: string | null; error: string | null } {
  if (!value) {
    return { value: null, error: null };
  }

  if (!DECIMAL_PATTERN.test(value)) {
    return {
      value: null,
      error: `${label} harus berupa angka dengan maksimal 3 desimal.`,
    };
  }

  const normalized = value.replace(",", ".");
  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return { value: null, error: `${label} harus lebih besar dari 0.` };
  }

  return { value: normalized, error: null };
}

function parseOptionalPercent(
  value: string,
  label: string,
): { value: string | null; error: string | null } {
  if (!value) {
    return { value: null, error: null };
  }

  if (!PERCENT_PATTERN.test(value)) {
    return {
      value: null,
      error: `${label} harus berupa angka 0–100 dengan maksimal 3 desimal.`,
    };
  }

  const normalized = value.replace(",", ".");
  const numericValue = Number(normalized);

  if (
    !Number.isFinite(numericValue) ||
    numericValue <= 0 ||
    numericValue > 100
  ) {
    return {
      value: null,
      error: `${label} harus berada di atas 0 dan maksimal 100.`,
    };
  }

  return { value: normalized, error: null };
}

function parseExchangePurity(
  value: string,
): { value: string | null; error: string | null } {
  if (!value) {
    return { value: null, error: null };
  }

  if (!/^\d{1,3}(?:[.,]\d{1,3})?$/.test(value)) {
    return {
      value: null,
      error: "Kadar Tukaran harus berupa angka dengan maksimal 3 desimal.",
    };
  }

  const normalized = value.replace(",", ".");
  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 999.999) {
    return {
      value: null,
      error: "Kadar Tukaran harus lebih besar dari 0 dan maksimal 999,999.",
    };
  }

  return { value: normalized, error: null };
}

function parseMoney(
  value: string,
  label: string,
  options: { allowZero?: boolean } = {},
): { value: string | null; error: string | null } {
  if (!value) {
    return { value: null, error: null };
  }

  const normalized = value
    .replace(/^rp\s*/i, "")
    .replace(/[.\s]/g, "")
    .replace(/^0+(?=\d)/, "");

  if (!MONEY_PATTERN.test(normalized)) {
    return {
      value: null,
      error: `${label} harus berupa nominal Rupiah bulat maksimal 18 digit.`,
    };
  }

  const isZero = /^0+$/.test(normalized);

  if (isZero && !options.allowZero) {
    return { value: null, error: `${label} harus lebih besar dari Rp 0.` };
  }

  return { value: normalized, error: null };
}

async function getRequestMetadata() {
  const headerStore = await headers();

  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent"),
  };
}

function getDatabaseError(error: unknown): {
  code?: unknown;
  constraint?: unknown;
} {
  if (typeof error !== "object" || error === null) {
    return {};
  }

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

async function getProductContext(
  organizationId: string,
  productId: string,
): Promise<ProductContext | null> {
  const rows = await db
    .select({
      id: productMasters.id,
      code: productMasters.code,
      name: productMasters.name,
      status: productMasters.status,
      imageKey: productMasters.imageKey,
    })
    .from(productMasters)
    .where(
      and(
        eq(productMasters.id, productId),
        eq(productMasters.organizationId, organizationId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function createProductItemAction(
  _previousState: ProductItemActionState,
  formData: FormData,
): Promise<ProductItemActionState> {
  const auth = await requireAnyPermission([
    "inventory.receive",
    "inventory.manage",
  ]);

  const productId = readText(formData, "productMasterId");
  if (!isUuid(productId)) {
    return failure("Pilih Product Master yang valid.", {
      productMasterId: "Pilih Product Master terlebih dahulu.",
    });
  }

  const product = await getProductContext(auth.organization.id, productId);

  if (!product) {
    return failure("Product Master tidak ditemukan.", {
      productMasterId: "Pilih Product Master yang tersedia.",
    });
  }

  if (product.status !== "active") {
    return failure("Item fisik belum dapat dibuat.", {
      productMasterId: "Gunakan Product Master yang berstatus Aktif.",
    });
  }

  const submitIntent = readText(formData, "submitIntent");
  const targetAvailability =
    submitIntent === "draft" ? "draft" : "available";
  const displayName = readText(formData, "displayName");
  const weightRaw = readText(formData, "weightGram");
  const purityPercentRaw = readText(formData, "purityPercent");
  const exchangePurityRaw = readText(formData, "exchangePurityPercent");
  const itemSize = readText(formData, "size");
  const itemColor = readText(formData, "color");
  const itemGemstone = readText(formData, "gemstone");
  const conditionRaw = readText(formData, "condition");
  const outletId = readText(formData, "currentOutletId");
  const locationCode = readText(formData, "locationCode");
  const internalNotes = readText(formData, "internalNotes");
  const rawDeductionPerGram = readText(formData, "deductionPerGram");
  const image = readImage(formData);

  const fieldErrors: Record<string, string> = {};
  const weight = parseDecimal(weightRaw, "Berat");
  const purityPercent = parseOptionalPercent(purityPercentRaw, "Kadar Persen");
  const exchangePurity = parseExchangePurity(exchangePurityRaw);
  const deductionPerGram = parseMoney(
    rawDeductionPerGram,
    "Potongan per gram",
    { allowZero: true },
  );

  if (displayName.length < 2 || displayName.length > 220) {
    fieldErrors.displayName = "Nama produk harus terdiri dari 2–220 karakter.";
  }

  if (weight.error) fieldErrors.weightGram = weight.error;
  if (!weight.value && targetAvailability === "available") {
    fieldErrors.weightGram = "Berat wajib diisi.";
  }

  if (purityPercent.error) fieldErrors.purityPercent = purityPercent.error;
  if (!purityPercent.value && targetAvailability === "available") {
    fieldErrors.purityPercent = "Kadar Persen wajib diisi.";
  }

  if (exchangePurity.error) {
    fieldErrors.exchangePurityPercent = exchangePurity.error;
  }
  if (!exchangePurity.value && targetAvailability === "available") {
    fieldErrors.exchangePurityPercent = "Kadar Tukaran wajib diisi.";
  }

  if (deductionPerGram.error) {
    fieldErrors.deductionPerGram = deductionPerGram.error;
  }
  if (!rawDeductionPerGram && targetAvailability === "available") {
    fieldErrors.deductionPerGram = "Potongan per gram wajib diisi. Gunakan 0 jika tidak ada.";
  }

  if (itemSize.length > 64) {
    fieldErrors.size = "Ukuran maksimal 64 karakter.";
  }

  if (itemColor.length > 64) {
    fieldErrors.color = "Warna maksimal 64 karakter.";
  }
  if (!itemColor && targetAvailability === "available") {
    fieldErrors.color = "Warna wajib diisi.";
  }

  if (itemGemstone.length > 160) {
    fieldErrors.gemstone = "Informasi batu maksimal 160 karakter.";
  }

  if (
    !isItemCondition(conditionRaw) ||
    !["good", "used", "damaged"].includes(conditionRaw)
  ) {
    fieldErrors.condition = "Pilih kondisi awal yang valid.";
  }

  if (locationCode.length > 80) {
    fieldErrors.locationCode = "Kode lokasi maksimal 80 karakter.";
  }

  if (internalNotes.length > 4000) {
    fieldErrors.internalNotes = "Catatan internal maksimal 4.000 karakter.";
  }

  if (image) {
    const imageValidation = validateImageFile(image);
    if (!imageValidation.valid) {
      fieldErrors.image = imageValidation.message;
    }
  }

  let validOutlet: { id: string; code: string; name: string } | null = null;

  if (outletId) {
    if (
      !isUuid(outletId) ||
      !auth.outlets.some((outlet) => outlet.id === outletId)
    ) {
      fieldErrors.currentOutletId =
        "Pilih outlet aktif yang diberikan kepada akun ini.";
    } else {
      const outletRows = await db
        .select({ id: outlets.id, code: outlets.code, name: outlets.name })
        .from(outlets)
        .where(
          and(
            eq(outlets.id, outletId),
            eq(outlets.organizationId, auth.organization.id),
            eq(outlets.isActive, true),
          ),
        )
        .limit(1);

      validOutlet = outletRows[0] ?? null;
      if (!validOutlet) {
        fieldErrors.currentOutletId = "Outlet tidak tersedia.";
      }
    }
  }

  if (targetAvailability === "available") {
    if (!validOutlet) {
      fieldErrors.currentOutletId = "Outlet wajib dipilih.";
    }

    if (!["good", "used"].includes(conditionRaw)) {
      fieldErrors.condition =
        "Hanya barang Baru atau Bekas yang dapat langsung dijual.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data produk fisik.", fieldErrors);
  }

  const activePriceRates = await getActiveGoldPriceRateMap(
    auth.organization.id,
  );
  const purityKey = normalizePurityKey(purityPercent.value);
  const activeRate = purityKey ? activePriceRates.get(purityKey) : null;
  const pricePerGram = activeRate?.ratePerGram ?? null;
  const compatibilitySellingAmount = activeRate
    ? calculateJewelryBasePrice({
        weightGram: weight.value,
        ratePerGram: activeRate.ratePerGram,
      })
    : null;

  const itemId = randomUUID();
  let imageKey: string | null = null;

  try {
    if (image) {
      imageKey = await storeImageFile({
        file: image,
        organizationId: auth.organization.id,
        entityType: "items",
        entityId: itemId,
      });
    }
  } catch (error) {
    return failure("Foto item gagal diproses.", {
      image:
        error instanceof Error
          ? error.message
          : "Foto tidak dapat disimpan. Silakan pilih file lain.",
    });
  }

  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      const identifiers = await getNextProductItemIdentifiers((query) =>
        transaction.execute(query),
      );

      await transaction.insert(productItems).values({
        id: itemId,
        organizationId: auth.organization.id,
        productMasterId: productId,
        displayName,
        currentOutletId: validOutlet?.id ?? null,
        sku: identifiers.sku,
        barcode: identifiers.barcode,
        qrValue: identifiers.qrValue,
        weightGram: weight.value,
        purityPercent: purityPercent.value,
        exchangePurityPercent: exchangePurity.value,
        size: normalizeNullable(itemSize),
        color: itemColor,
        gemstone: normalizeNullable(itemGemstone),
        costAmount: null,
        sellingAmount:
          compatibilitySellingAmount === null
            ? null
            : String(compatibilitySellingAmount),
        pricePerGram,
        deductionPerGram: deductionPerGram.value ?? "0",
        availability: targetAvailability,
        condition: conditionRaw as "good" | "used" | "damaged",
        locationState: "outlet",
        locationCode: normalizeNullable(locationCode),
        imageKey,
        internalNotes: normalizeNullable(internalNotes),
        isActive: true,
      });

      await transaction.insert(itemBarcodes).values({
        organizationId: auth.organization.id,
        itemId,
        barcodeValue: identifiers.barcode,
        source: "system_generated",
        isPrimary: true,
        isActive: true,
        createdBy: auth.user.id,
      });

      if (targetAvailability === "available" && validOutlet) {
        await transaction.insert(inventoryMovements).values({
          organizationId: auth.organization.id,
          itemId,
          movementType: "goods_receipt",
          toOutletId: validOutlet.id,
          referenceType: "product_item",
          referenceId: itemId,
          reason: "Penerimaan awal item fisik",
          metadata: {
            sku: identifiers.sku,
            barcode: identifiers.barcode,
            productId,
            productCode: product.code,
            availability: targetAvailability,
          },
          performedBy: auth.user.id,
        });
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: validOutlet?.id ?? null,
        actorUserId: auth.user.id,
        action: "product_item.create",
        entityType: "product_item",
        entityId: itemId,
        afterData: {
          sku: identifiers.sku,
          barcode: identifiers.barcode,
          qrValue: identifiers.qrValue,
          productMasterId: productId,
          productCode: product.code,
          productName: product.name,
          displayName,
          currentOutletId: validOutlet?.id ?? null,
          outletCode: validOutlet?.code ?? null,
          outletName: validOutlet?.name ?? null,
          weightGram: weight.value,
          purityPercent: purityPercent.value,
          exchangePurityPercent: exchangePurity.value,
          color: itemColor,
          condition: conditionRaw,
          pricePerGram,
          priceRatePurityKey: purityKey,
          activePriceRateFound: Boolean(activeRate),
          compatibilitySellingAmount,
          deductionPerGram: deductionPerGram.value ?? "0",
          availability: targetAvailability,
          imageKey,
          source: "simple_product_create_v2",
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    await deleteImageFile(imageKey);

    const databaseError = getDatabaseError(error);
    if (databaseError.code === "23505") {
      return failure(
        "Identitas item bertabrakan dengan data lain. Silakan coba kembali.",
      );
    }

    console.error("Gagal membuat item fisik:", error);
    return failure("Produk fisik gagal dibuat. Silakan coba kembali.");
  }

  revalidatePath("/admin/produk");
  revalidatePath("/admin/produk/tambah");
  revalidatePath(`/admin/produk/${productId}`);
  revalidatePath("/admin/inventaris");
  revalidatePath(`/admin/inventaris/item/${itemId}`);

  redirect(`/admin/inventaris/item/${itemId}?created=1`);
}

export async function updateProductItemAction(
  itemId: string,
  _previousState: ProductItemActionState,
  formData: FormData,
): Promise<ProductItemActionState> {
  const auth = await requireAnyPermission([
    "inventory.receive",
    "inventory.adjust",
    "inventory.manage",
  ]);

  if (!isUuid(itemId)) {
    return failure("ID item fisik tidak valid.");
  }

  const existingRows = await db
    .select({
      id: productItems.id,
      productMasterId: productItems.productMasterId,
      displayName: productItems.displayName,
      currentOutletId: productItems.currentOutletId,
      sku: productItems.sku,
      barcode: productItems.barcode,
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
      imageKey: productItems.imageKey,
      isActive: productItems.isActive,
      productCode: productMasters.code,
      productName: productMasters.name,
      productStatus: productMasters.status,
    })
    .from(productItems)
    .innerJoin(
      productMasters,
      eq(productItems.productMasterId, productMasters.id),
    )
    .where(
      and(
        eq(productItems.id, itemId),
        eq(productItems.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  const existing = existingRows[0];

  if (!existing) {
    return failure("Item fisik tidak ditemukan.");
  }

  if (!existing.isActive) {
    return failure("Item fisik sudah nonaktif dan tidak dapat diedit.");
  }

  if (["reserved", "sold"].includes(existing.availability)) {
    return failure(
      "Item Reserved atau Terjual tidak dapat diubah melalui form ini.",
    );
  }

  const submitIntent = readText(formData, "submitIntent");
  const isActivation =
    existing.availability === "draft" && submitIntent === "available";
  const targetAvailability = isActivation ? "available" : existing.availability;

  const displayName = readText(formData, "displayName");
  const weightRaw = readText(formData, "weightGram");
  const purityPercentRaw = readText(formData, "purityPercent");
  const exchangePurityRaw = readText(formData, "exchangePurityPercent");
  const itemColor = readText(formData, "color");
  const conditionRaw = readText(formData, "condition");
  const requestedOutletId = readText(formData, "currentOutletId");
  const rawDeductionPerGram = readText(formData, "deductionPerGram");
  const image = readImage(formData);
  const removeImage = readText(formData, "removeImage") === "1";

  const fieldErrors: Record<string, string> = {};
  const weight = parseDecimal(weightRaw, "Berat");
  const purityPercent = parseOptionalPercent(purityPercentRaw, "Kadar Persen");
  const exchangePurity = parseExchangePurity(exchangePurityRaw);
  const deductionPerGram = parseMoney(
    rawDeductionPerGram,
    "Potongan per gram",
    { allowZero: true },
  );

  if (displayName.length < 2 || displayName.length > 220) {
    fieldErrors.displayName = "Nama produk harus terdiri dari 2–220 karakter.";
  }

  if (weight.error) fieldErrors.weightGram = weight.error;
  if (!weight.value) fieldErrors.weightGram = "Berat wajib diisi.";

  if (purityPercent.error) fieldErrors.purityPercent = purityPercent.error;
  if (!purityPercent.value) {
    fieldErrors.purityPercent = "Kadar Persen wajib diisi.";
  }

  if (exchangePurity.error) {
    fieldErrors.exchangePurityPercent = exchangePurity.error;
  }
  if (!exchangePurity.value) {
    fieldErrors.exchangePurityPercent = "Kadar Tukaran wajib diisi.";
  }

  if (deductionPerGram.error) {
    fieldErrors.deductionPerGram = deductionPerGram.error;
  }
  if (!rawDeductionPerGram) {
    fieldErrors.deductionPerGram =
      "Potongan per gram wajib diisi. Gunakan 0 jika tidak ada.";
  }

  if (!itemColor) {
    fieldErrors.color = "Warna wajib diisi.";
  } else if (itemColor.length > 64) {
    fieldErrors.color = "Warna maksimal 64 karakter.";
  }

  if (
    !isItemCondition(conditionRaw) ||
    !["good", "used", "damaged"].includes(conditionRaw)
  ) {
    fieldErrors.condition = "Pilih kondisi item yang valid.";
  }

  if (image) {
    const imageValidation = validateImageFile(image);
    if (!imageValidation.valid) {
      fieldErrors.image = imageValidation.message;
    }
  }

  let finalOutlet: { id: string; code: string; name: string } | null = null;

  if (existing.availability === "available") {
    if (requestedOutletId && requestedOutletId !== existing.currentOutletId) {
      fieldErrors.currentOutletId =
        "Outlet item Tersedia hanya dapat diubah melalui proses transfer.";
    }

    if (existing.currentOutletId) {
      const outletRows = await db
        .select({ id: outlets.id, code: outlets.code, name: outlets.name })
        .from(outlets)
        .where(
          and(
            eq(outlets.id, existing.currentOutletId),
            eq(outlets.organizationId, auth.organization.id),
          ),
        )
        .limit(1);
      finalOutlet = outletRows[0] ?? null;
    }
  } else if (requestedOutletId) {
    if (
      !isUuid(requestedOutletId) ||
      !auth.outlets.some((outlet) => outlet.id === requestedOutletId)
    ) {
      fieldErrors.currentOutletId =
        "Pilih outlet aktif yang diberikan kepada akun ini.";
    } else {
      const outletRows = await db
        .select({ id: outlets.id, code: outlets.code, name: outlets.name })
        .from(outlets)
        .where(
          and(
            eq(outlets.id, requestedOutletId),
            eq(outlets.organizationId, auth.organization.id),
            eq(outlets.isActive, true),
          ),
        )
        .limit(1);
      finalOutlet = outletRows[0] ?? null;

      if (!finalOutlet) {
        fieldErrors.currentOutletId = "Outlet tidak tersedia.";
      }
    }
  }

  if (targetAvailability === "available") {
    if (existing.productStatus !== "active") {
      fieldErrors.submitIntent =
        "Product Master harus Aktif sebelum item dapat dijadikan Tersedia.";
    }
    if (!finalOutlet) {
      fieldErrors.currentOutletId = "Outlet wajib dipilih.";
    }
    if (!["good", "used"].includes(conditionRaw)) {
      fieldErrors.condition =
        "Hanya barang Baru atau Bekas yang dapat berstatus Tersedia.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data produk fisik.", fieldErrors);
  }

  const activePriceRates = await getActiveGoldPriceRateMap(
    auth.organization.id,
  );
  const purityKey = normalizePurityKey(purityPercent.value);
  const activeRate = purityKey ? activePriceRates.get(purityKey) : null;
  const pricePerGram = activeRate?.ratePerGram ?? null;
  const compatibilitySellingAmount = activeRate
    ? calculateJewelryBasePrice({
        weightGram: weight.value,
        ratePerGram: activeRate.ratePerGram,
      })
    : null;

  let newImageKey: string | null = null;

  try {
    if (image) {
      newImageKey = await storeImageFile({
        file: image,
        organizationId: auth.organization.id,
        entityType: "items",
        entityId: itemId,
      });
    }
  } catch (error) {
    return failure("Foto item gagal diproses.", {
      image:
        error instanceof Error
          ? error.message
          : "Foto tidak dapat disimpan. Silakan pilih file lain.",
    });
  }

  const nextImageKey = newImageKey ?? (removeImage ? null : existing.imageKey);
  const requestMetadata = await getRequestMetadata();
  const updatedAt = new Date();

  try {
    await db.transaction(async (transaction) => {
      await transaction
        .update(productItems)
        .set({
          displayName,
          currentOutletId: finalOutlet?.id ?? null,
          weightGram: weight.value,
          purityPercent: purityPercent.value,
          exchangePurityPercent: exchangePurity.value,
          color: itemColor,
          // Kolom lama ini masih dipertahankan sementara sampai schema cleanup R4.
          // Harga transaksi final tidak lagi diedit dari Product Item.
          costAmount: existing.costAmount,
          sellingAmount:
            compatibilitySellingAmount === null
              ? null
              : String(compatibilitySellingAmount),
          pricePerGram,
          deductionPerGram: deductionPerGram.value ?? "0",
          availability: targetAvailability,
          condition: conditionRaw as "good" | "used" | "damaged",
          imageKey: nextImageKey,
          updatedAt,
        })
        .where(
          and(
            eq(productItems.id, itemId),
            eq(productItems.organizationId, auth.organization.id),
          ),
        );

      if (isActivation && finalOutlet) {
        await transaction.insert(inventoryMovements).values({
          organizationId: auth.organization.id,
          itemId,
          movementType: "goods_receipt",
          toOutletId: finalOutlet.id,
          referenceType: "product_item",
          referenceId: itemId,
          reason: "Aktivasi penerimaan awal item fisik",
          metadata: {
            sku: existing.sku,
            barcode: existing.barcode,
            productId: existing.productMasterId,
            availability: targetAvailability,
          },
          performedBy: auth.user.id,
        });
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: finalOutlet?.id ?? null,
        actorUserId: auth.user.id,
        action: isActivation ? "product_item.activate" : "product_item.update",
        entityType: "product_item",
        entityId: itemId,
        beforeData: {
          displayName: existing.displayName,
          weightGram: existing.weightGram,
          purityPercent: existing.purityPercent,
          exchangePurityPercent: existing.exchangePurityPercent,
          color: existing.color,
          sellingAmount: existing.sellingAmount,
          pricePerGram: existing.pricePerGram,
          deductionPerGram: existing.deductionPerGram,
          currentOutletId: existing.currentOutletId,
          availability: existing.availability,
          condition: existing.condition,
          imageKey: existing.imageKey,
        },
        afterData: {
          sku: existing.sku,
          barcode: existing.barcode,
          productMasterId: existing.productMasterId,
          productCode: existing.productCode,
          productName: existing.productName,
          displayName,
          weightGram: weight.value,
          purityPercent: purityPercent.value,
          exchangePurityPercent: exchangePurity.value,
          color: itemColor,
          pricePerGram,
          priceRatePurityKey: purityKey,
          activePriceRateFound: Boolean(activeRate),
          compatibilitySellingAmount,
          deductionPerGram: deductionPerGram.value ?? "0",
          currentOutletId: finalOutlet?.id ?? null,
          outletCode: finalOutlet?.code ?? null,
          outletName: finalOutlet?.name ?? null,
          availability: targetAvailability,
          condition: conditionRaw,
          imageKey: nextImageKey,
          source: "simple_product_update_v2",
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    await deleteImageFile(newImageKey);

    console.error("Gagal memperbarui item fisik:", error);
    return failure("Produk fisik gagal diperbarui. Silakan coba kembali.");
  }

  if ((newImageKey || removeImage) && existing.imageKey !== nextImageKey) {
    await deleteImageFile(existing.imageKey);
  }

  revalidatePath("/admin/inventaris");
  revalidatePath(`/admin/inventaris/item/${itemId}`);
  revalidatePath(`/admin/inventaris/item/${itemId}/edit`);
  revalidatePath(`/admin/produk/${existing.productMasterId}`);

  return success(
    isActivation
      ? "Produk fisik berhasil dijadikan Tersedia."
      : "Perubahan produk fisik berhasil disimpan.",
  );
}

export async function archiveProductItemAction(
  itemId: string,
): Promise<ProductItemActionState> {
  const auth = await requireAnyPermission(["inventory.manage"]);

  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(productItems)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(productItems.id, itemId),
            eq(productItems.organizationId, auth.organization.id),
          ),
        )
        .returning({ id: productItems.id });

      if (!updated) {
        throw new Error("Item tidak ditemukan atau tidak dapat diakses.");
      }

      await tx.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "archive",
        entityType: "product_item",
        entityId: itemId,
        reason: "Item diarsipkan oleh admin",
      });
    });

    revalidatePath("/admin/inventaris");
    revalidatePath(`/admin/inventaris/item/${itemId}`);
    revalidatePath(`/admin/inventaris/item/${itemId}/edit`);

    return success("Item fisik berhasil diarsipkan.");
  } catch (error) {
    console.error("Gagal mengarsipkan item:", error);
    return failure("Gagal mengarsipkan item. Silakan coba kembali.");
  }
}

export async function restoreProductItemAction(
  itemId: string,
): Promise<ProductItemActionState> {
  const auth = await requireAnyPermission(["inventory.manage"]);

  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(productItems)
        .set({ isActive: true, updatedAt: new Date() })
        .where(
          and(
            eq(productItems.id, itemId),
            eq(productItems.organizationId, auth.organization.id),
          ),
        )
        .returning({ id: productItems.id });

      if (!updated) {
        throw new Error("Item tidak ditemukan atau tidak dapat diakses.");
      }

      await tx.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "restore",
        entityType: "product_item",
        entityId: itemId,
        reason: "Item dipulihkan dari arsip oleh admin",
      });
    });

    revalidatePath("/admin/inventaris");
    revalidatePath(`/admin/inventaris/item/${itemId}`);
    revalidatePath(`/admin/inventaris/item/${itemId}/edit`);

    return success("Item fisik berhasil dipulihkan.");
  } catch (error) {
    console.error("Gagal memulihkan item:", error);
    return failure("Gagal memulihkan item. Silakan coba kembali.");
  }
}
