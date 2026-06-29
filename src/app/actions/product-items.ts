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
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
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
  const forwardedFor = headerStore.get("x-forwarded-for");

  return {
    ipAddress:
      forwardedFor?.split(",")[0]?.trim().slice(0, 64) ??
      headerStore.get("x-real-ip")?.slice(0, 64) ??
      null,
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
  productId: string,
  _previousState: ProductItemActionState,
  formData: FormData,
): Promise<ProductItemActionState> {
  const auth = await requireAnyPermission([
    "inventory.receive",
    "inventory.manage",
  ]);
  const canManagePricing = hasPermission(auth, "pricing.manage");

  if (!isUuid(productId)) {
    return failure("ID produk tidak valid.");
  }

  const product = await getProductContext(auth.organization.id, productId);

  if (!product) {
    return failure("Produk tidak ditemukan.");
  }

  if (product.status === "inactive") {
    return failure("Item fisik belum dapat dibuat.", {
      submitIntent: "Produk nonaktif tidak dapat menerima item baru.",
    });
  }

  const submitIntent = readText(formData, "submitIntent");
  const targetAvailability =
    submitIntent === "available" ? "available" : "draft";
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
  const image = readImage(formData);

  const rawCostAmount = canManagePricing
    ? readText(formData, "costAmount")
    : "";
  const rawSellingAmount = canManagePricing
    ? readText(formData, "sellingAmount")
    : "";
  const rawPricePerGram = canManagePricing
    ? readText(formData, "pricePerGram")
    : "";
  const rawDeductionPerGram = canManagePricing
    ? readText(formData, "deductionPerGram")
    : "";

  const fieldErrors: Record<string, string> = {};
  const weight = parseDecimal(weightRaw, "Berat aktual");
  const purityPercent = parseOptionalPercent(purityPercentRaw, "Kadar");
  const exchangePurity = parseOptionalPercent(exchangePurityRaw, "Kadar tukar");
  const costAmount = parseMoney(rawCostAmount, "Harga modal", {
    allowZero: true,
  });
  const sellingAmount = parseMoney(rawSellingAmount, "Harga label");
  const pricePerGram = parseMoney(rawPricePerGram, "Harga per gram", {
    allowZero: true,
  });
  const deductionPerGram = parseMoney(
    rawDeductionPerGram,
    "Potongan per gram",
    { allowZero: true },
  );

  if (displayName.length > 220) {
    fieldErrors.displayName = "Nama item maksimal 220 karakter.";
  }

  if (weight.error) fieldErrors.weightGram = weight.error;
  if (purityPercent.error) fieldErrors.purityPercent = purityPercent.error;
  if (exchangePurity.error) {
    fieldErrors.exchangePurityPercent = exchangePurity.error;
  }
  if (canManagePricing && costAmount.error) {
    fieldErrors.costAmount = costAmount.error;
  }
  if (canManagePricing && sellingAmount.error) {
    fieldErrors.sellingAmount = sellingAmount.error;
  }
  if (canManagePricing && pricePerGram.error) {
    fieldErrors.pricePerGram = pricePerGram.error;
  }
  if (canManagePricing && deductionPerGram.error) {
    fieldErrors.deductionPerGram = deductionPerGram.error;
  }

  if (itemSize.length > 64) {
    fieldErrors.size = "Ukuran aktual maksimal 64 karakter.";
  }

  if (itemColor.length > 64) {
    fieldErrors.color = "Warna aktual maksimal 64 karakter.";
  }

  if (itemGemstone.length > 160) {
    fieldErrors.gemstone = "Informasi batu maksimal 160 karakter.";
  }

  if (
    !isItemCondition(conditionRaw) ||
    !["good", "damaged"].includes(conditionRaw)
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
    if (product.status !== "active") {
      fieldErrors.submitIntent =
        "Produk harus berstatus Aktif sebelum item dapat dijadikan Tersedia.";
    }

    if (!weight.value) {
      fieldErrors.weightGram = "Berat aktual wajib untuk item Tersedia.";
    }

    if (!canManagePricing) {
      fieldErrors.sellingAmount =
        "Permission pricing.manage diperlukan untuk menetapkan harga label dan menjadikan item Tersedia.";
    } else if (!sellingAmount.value) {
      fieldErrors.sellingAmount = "Harga label wajib untuk item Tersedia.";
    }

    if (!validOutlet) {
      fieldErrors.currentOutletId = "Outlet awal wajib untuk item Tersedia.";
    }

    if (!image) {
      fieldErrors.image = "Foto aktual wajib untuk item Tersedia.";
    }

    if (conditionRaw !== "good") {
      fieldErrors.condition =
        "Hanya item berkondisi Baik yang dapat langsung dijadikan Tersedia.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data item fisik.", fieldErrors);
  }

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
        displayName: normalizeNullable(displayName),
        currentOutletId: validOutlet?.id ?? null,
        sku: identifiers.sku,
        barcode: identifiers.barcode,
        qrValue: identifiers.qrValue,
        weightGram: weight.value,
        purityPercent: purityPercent.value,
        exchangePurityPercent: exchangePurity.value,
        size: normalizeNullable(itemSize),
        color: normalizeNullable(itemColor),
        gemstone: normalizeNullable(itemGemstone),
        costAmount: canManagePricing ? costAmount.value : null,
        sellingAmount: canManagePricing ? sellingAmount.value : null,
        pricePerGram: canManagePricing ? pricePerGram.value : null,
        deductionPerGram: canManagePricing ? deductionPerGram.value : null,
        availability: targetAvailability,
        condition: conditionRaw as "good" | "damaged",
        locationState: "outlet",
        locationCode: normalizeNullable(locationCode),
        imageKey,
        internalNotes: normalizeNullable(internalNotes),
        isActive: true,
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
          displayName: normalizeNullable(displayName),
          currentOutletId: validOutlet?.id ?? null,
          outletCode: validOutlet?.code ?? null,
          outletName: validOutlet?.name ?? null,
          weightGram: weight.value,
          purityPercent: purityPercent.value,
          exchangePurityPercent: exchangePurity.value,
          size: normalizeNullable(itemSize),
          color: normalizeNullable(itemColor),
          gemstone: normalizeNullable(itemGemstone),
          costAmount: canManagePricing ? costAmount.value : null,
          sellingAmount: canManagePricing ? sellingAmount.value : null,
          pricePerGram: canManagePricing ? pricePerGram.value : null,
          deductionPerGram: canManagePricing ? deductionPerGram.value : null,
          availability: targetAvailability,
          condition: conditionRaw,
          locationCode: normalizeNullable(locationCode),
          imageKey,
          pricingManagedByActor: canManagePricing,
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

    return failure("Item fisik gagal dibuat. Silakan coba kembali.");
  }

  revalidatePath("/admin/produk");
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
  const canManagePricing = hasPermission(auth, "pricing.manage");

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
      size: productItems.size,
      color: productItems.color,
      gemstone: productItems.gemstone,
      costAmount: productItems.costAmount,
      sellingAmount: productItems.sellingAmount,
      pricePerGram: productItems.pricePerGram,
      deductionPerGram: productItems.deductionPerGram,
      availability: productItems.availability,
      condition: productItems.condition,
      locationCode: productItems.locationCode,
      imageKey: productItems.imageKey,
      internalNotes: productItems.internalNotes,
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
  const exchangePurityRaw = readText(formData, "exchangePurityPercent");
  const itemSize = readText(formData, "size");
  const itemColor = readText(formData, "color");
  const itemGemstone = readText(formData, "gemstone");
  const conditionRaw = readText(formData, "condition");
  const requestedOutletId = readText(formData, "currentOutletId");
  const locationCode = readText(formData, "locationCode");
  const internalNotes = readText(formData, "internalNotes");
  const image = readImage(formData);
  const removeImage = readText(formData, "removeImage") === "1";

  const rawCostAmount = canManagePricing
    ? readText(formData, "costAmount")
    : (existing.costAmount ?? "");
  const rawSellingAmount = canManagePricing
    ? readText(formData, "sellingAmount")
    : (existing.sellingAmount ?? "");
  const rawPricePerGram = canManagePricing
    ? readText(formData, "pricePerGram")
    : (existing.pricePerGram ?? "");
  const rawDeductionPerGram = canManagePricing
    ? readText(formData, "deductionPerGram")
    : (existing.deductionPerGram ?? "");

  const fieldErrors: Record<string, string> = {};
  const weight = parseDecimal(weightRaw, "Berat aktual");
  const exchangePurity = parseOptionalPercent(exchangePurityRaw, "Kadar tukar");
  const costAmount = parseMoney(rawCostAmount, "Harga modal", {
    allowZero: true,
  });
  const sellingAmount = parseMoney(rawSellingAmount, "Harga label");
  const pricePerGram = parseMoney(rawPricePerGram, "Harga per gram", {
    allowZero: true,
  });
  const deductionPerGram = parseMoney(
    rawDeductionPerGram,
    "Potongan per gram",
    { allowZero: true },
  );

  if (displayName.length > 220) {
    fieldErrors.displayName = "Nama item maksimal 220 karakter.";
  }

  if (weight.error) fieldErrors.weightGram = weight.error;
  if (exchangePurity.error) {
    fieldErrors.exchangePurityPercent = exchangePurity.error;
  }
  if (canManagePricing && costAmount.error) {
    fieldErrors.costAmount = costAmount.error;
  }
  if (canManagePricing && sellingAmount.error) {
    fieldErrors.sellingAmount = sellingAmount.error;
  }
  if (canManagePricing && pricePerGram.error) {
    fieldErrors.pricePerGram = pricePerGram.error;
  }
  if (canManagePricing && deductionPerGram.error) {
    fieldErrors.deductionPerGram = deductionPerGram.error;
  }

  if (itemSize.length > 64) {
    fieldErrors.size = "Ukuran aktual maksimal 64 karakter.";
  }
  if (itemColor.length > 64) {
    fieldErrors.color = "Warna aktual maksimal 64 karakter.";
  }
  if (itemGemstone.length > 160) {
    fieldErrors.gemstone = "Informasi batu maksimal 160 karakter.";
  }
  if (
    !isItemCondition(conditionRaw) ||
    !["good", "damaged"].includes(conditionRaw)
  ) {
    fieldErrors.condition = "Pilih kondisi item yang valid.";
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

  const willHaveImage =
    Boolean(image) || Boolean(existing.imageKey && !removeImage);

  if (targetAvailability === "available") {
    if (existing.productStatus !== "active") {
      fieldErrors.submitIntent =
        "Produk harus berstatus Aktif sebelum item dapat dijadikan Tersedia.";
    }
    if (!weight.value) {
      fieldErrors.weightGram = "Berat aktual wajib untuk item Tersedia.";
    }
    if (!sellingAmount.value) {
      fieldErrors.sellingAmount = "Harga label wajib untuk item Tersedia.";
    }
    if (!finalOutlet) {
      fieldErrors.currentOutletId = "Outlet awal wajib untuk item Tersedia.";
    }
    if (!willHaveImage) {
      fieldErrors.image = "Foto aktual wajib untuk item Tersedia.";
    }
    if (conditionRaw !== "good") {
      fieldErrors.condition =
        "Hanya item berkondisi Baik yang dapat berstatus Tersedia.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data item fisik.", fieldErrors);
  }

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
          displayName: normalizeNullable(displayName),
          currentOutletId: finalOutlet?.id ?? null,
          weightGram: weight.value,
          exchangePurityPercent: exchangePurity.value,
          size: normalizeNullable(itemSize),
          color: normalizeNullable(itemColor),
          gemstone: normalizeNullable(itemGemstone),
          costAmount: canManagePricing ? costAmount.value : existing.costAmount,
          sellingAmount: canManagePricing
            ? sellingAmount.value
            : existing.sellingAmount,
          pricePerGram: canManagePricing
            ? pricePerGram.value
            : existing.pricePerGram,
          deductionPerGram: canManagePricing
            ? deductionPerGram.value
            : existing.deductionPerGram,
          availability: targetAvailability,
          condition: conditionRaw as "good" | "damaged",
          locationCode: normalizeNullable(locationCode),
          imageKey: nextImageKey,
          internalNotes: normalizeNullable(internalNotes),
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
          exchangePurityPercent: existing.exchangePurityPercent,
          size: existing.size,
          color: existing.color,
          gemstone: existing.gemstone,
          costAmount: existing.costAmount,
          sellingAmount: existing.sellingAmount,
          pricePerGram: existing.pricePerGram,
          deductionPerGram: existing.deductionPerGram,
          currentOutletId: existing.currentOutletId,
          availability: existing.availability,
          condition: existing.condition,
          locationCode: existing.locationCode,
          imageKey: existing.imageKey,
          internalNotes: existing.internalNotes,
        },
        afterData: {
          sku: existing.sku,
          barcode: existing.barcode,
          productMasterId: existing.productMasterId,
          productCode: existing.productCode,
          productName: existing.productName,
          displayName: normalizeNullable(displayName),
          weightGram: weight.value,
          purityPercent: existing.purityPercent,
          exchangePurityPercent: exchangePurity.value,
          size: normalizeNullable(itemSize),
          color: normalizeNullable(itemColor),
          gemstone: normalizeNullable(itemGemstone),
          costAmount: canManagePricing ? costAmount.value : existing.costAmount,
          sellingAmount: canManagePricing
            ? sellingAmount.value
            : existing.sellingAmount,
          pricePerGram: canManagePricing
            ? pricePerGram.value
            : existing.pricePerGram,
          deductionPerGram: canManagePricing
            ? deductionPerGram.value
            : existing.deductionPerGram,
          currentOutletId: finalOutlet?.id ?? null,
          outletCode: finalOutlet?.code ?? null,
          outletName: finalOutlet?.name ?? null,
          availability: targetAvailability,
          condition: conditionRaw,
          locationCode: normalizeNullable(locationCode),
          imageKey: nextImageKey,
          internalNotes: normalizeNullable(internalNotes),
          pricingManagedByActor: canManagePricing,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    await deleteImageFile(newImageKey);

    console.error("Gagal memperbarui item fisik:", error);
    return failure("Item fisik gagal diperbarui. Silakan coba kembali.");
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
      ? "Item fisik berhasil dijadikan Tersedia."
      : "Perubahan item fisik berhasil disimpan.",
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
