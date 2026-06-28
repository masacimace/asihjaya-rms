"use server";

import { randomUUID } from "node:crypto";

import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  productCategories,
  productItems,
  productMasters,
} from "@/db/schema";
import {
  isProductStatus,
  isUuid,
  type ProductMasterActionState,
} from "@/features/products/product-master-contracts";
import type { ProductStatus } from "@/features/products/contracts";
import { requirePermission } from "@/lib/auth/session";
import {
  deleteImageFile,
  storeImageFile,
} from "@/lib/storage/image-storage";
import { validateImageFile } from "@/lib/storage/image-validation";

const PRODUCT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,63}$/;
const OPERATIONAL_ITEM_AVAILABILITIES: Array<
  "draft" | "available" | "reserved"
> = ["draft", "available", "reserved"];

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): ProductMasterActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function success(message: string): ProductMasterActionState {
  return {
    status: "success",
    message,
  };
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

async function getRequestMetadata() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");

  const ipAddress =
    forwardedFor?.split(",")[0]?.trim().slice(0, 64) ??
    headerStore.get("x-real-ip")?.slice(0, 64) ??
    null;

  return {
    ipAddress,
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
    cause?: {
      code?: unknown;
      constraint?: unknown;
    };
  };

  return {
    code: databaseError.code ?? databaseError.cause?.code,
    constraint: databaseError.constraint ?? databaseError.cause?.constraint,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return getDatabaseError(error).code === "23505";
}

function revalidateProductPages(productId?: string) {
  revalidatePath("/admin/produk");
  revalidatePath("/admin/produk/kategori");

  if (productId) {
    revalidatePath(`/admin/produk/${productId}`);
  }
}

async function getCategoryForProduct({
  organizationId,
  categoryId,
}: {
  organizationId: string;
  categoryId: string;
}) {
  if (!isUuid(categoryId)) {
    return null;
  }

  const rows = await db
    .select({
      id: productCategories.id,
      code: productCategories.code,
      name: productCategories.name,
      isActive: productCategories.isActive,
    })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.id, categoryId),
        eq(productCategories.organizationId, organizationId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

function validateCommonFields({
  name,
  brand,
  collection,
  description,
  status,
}: {
  name: string;
  brand: string;
  collection: string;
  description: string;
  status: string;
}) {
  const fieldErrors: Record<string, string> = {};

  if (name.length < 2 || name.length > 200) {
    fieldErrors.name = "Nama produk harus terdiri dari 2–200 karakter.";
  }

  if (brand.length > 120) {
    fieldErrors.brand = "Brand maksimal 120 karakter.";
  }

  if (collection.length > 120) {
    fieldErrors.collection = "Koleksi maksimal 120 karakter.";
  }

  if (description.length > 4000) {
    fieldErrors.description = "Deskripsi maksimal 4.000 karakter.";
  }

  if (!isProductStatus(status)) {
    fieldErrors.status = "Pilih status produk yang valid.";
  }

  return fieldErrors;
}

export async function createProductMasterAction(
  _previousState: ProductMasterActionState,
  formData: FormData,
): Promise<ProductMasterActionState> {
  const auth = await requirePermission("products.manage");

  const code = readText(formData, "code").toUpperCase();
  const name = readText(formData, "name");
  const categoryId = readText(formData, "categoryId");
  const brand = readText(formData, "brand");
  const collection = readText(formData, "collection");
  const description = readText(formData, "description");
  const rawStatus = readText(formData, "status");
  const image = readImage(formData);

  const fieldErrors = validateCommonFields({
    name,
    brand,
    collection,
    description,
    status: rawStatus,
  });

  if (!PRODUCT_CODE_PATTERN.test(code)) {
    fieldErrors.code =
      "Gunakan 2–64 karakter: huruf kapital, angka, garis bawah, atau tanda hubung.";
  }

  if (!isUuid(categoryId)) {
    fieldErrors.categoryId = "Pilih kategori yang valid.";
  }

  if (rawStatus === "inactive") {
    fieldErrors.status =
      "Produk baru hanya dapat dibuat sebagai Draft atau Aktif.";
  }

  if (image) {
    const imageValidation = validateImageFile(image);

    if (!imageValidation.valid) {
      fieldErrors.image = imageValidation.message;
    }
  }

  if (rawStatus === "active" && !image) {
    fieldErrors.image = "Foto katalog wajib untuk Produk Aktif.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data produk.", fieldErrors);
  }

  const status = rawStatus as ProductStatus;
  const category = await getCategoryForProduct({
    organizationId: auth.organization.id,
    categoryId,
  });

  if (!category) {
    return failure("Kategori produk tidak ditemukan.", {
      categoryId: "Pilih kategori yang tersedia.",
    });
  }

  if (!category.isActive) {
    return failure("Produk belum dapat dibuat.", {
      categoryId: "Produk baru harus menggunakan kategori aktif.",
    });
  }

  const existingRows = await db
    .select({ id: productMasters.id })
    .from(productMasters)
    .where(
      and(
        eq(productMasters.organizationId, auth.organization.id),
        eq(productMasters.code, code),
      ),
    )
    .limit(1);

  if (existingRows[0]) {
    return failure("Kode produk sudah digunakan.", {
      code: "Gunakan kode produk yang berbeda.",
    });
  }

  const createdProductId = randomUUID();
  let imageKey: string | null = null;

  try {
    if (image) {
      imageKey = await storeImageFile({
        file: image,
        organizationId: auth.organization.id,
        entityType: "products",
        entityId: createdProductId,
      });
    }
  } catch (error) {
    return failure("Foto produk gagal diproses.", {
      image:
        error instanceof Error
          ? error.message
          : "Foto tidak dapat disimpan. Silakan pilih file lain.",
    });
  }

  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      await transaction.insert(productMasters).values({
        id: createdProductId,
        organizationId: auth.organization.id,
        categoryId,
        code,
        name,
        brand: normalizeNullable(brand),
        collection: normalizeNullable(collection),
        description: normalizeNullable(description),
        imageKey,
        status,
      });

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "product_master.create",
        entityType: "product_master",
        entityId: createdProductId,
        afterData: {
          code,
          name,
          categoryId,
          categoryCode: category.code,
          categoryName: category.name,
          brand: normalizeNullable(brand),
          collection: normalizeNullable(collection),
          description: normalizeNullable(description),
          imageKey,
          status,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    await deleteImageFile(imageKey);

    if (isUniqueViolation(error)) {
      return failure("Kode produk sudah digunakan.", {
        code: "Gunakan kode produk yang berbeda.",
      });
    }

    console.error("Gagal membuat Product Master:", error);

    return failure("Produk gagal dibuat. Silakan coba kembali.");
  }

  revalidateProductPages(createdProductId);

  redirect(`/admin/produk/${createdProductId}?created=1`);
}

export async function updateProductMasterAction(
  productId: string,
  _previousState: ProductMasterActionState,
  formData: FormData,
): Promise<ProductMasterActionState> {
  const auth = await requirePermission("products.manage");

  if (!isUuid(productId)) {
    return failure("ID produk tidak valid.");
  }

  const existingRows = await db
    .select({
      id: productMasters.id,
      code: productMasters.code,
      name: productMasters.name,
      categoryId: productMasters.categoryId,
      brand: productMasters.brand,
      collection: productMasters.collection,
      description: productMasters.description,
      status: productMasters.status,
      material: productMasters.material,
      imageKey: productMasters.imageKey,
      attributes: productMasters.attributes,
    })
    .from(productMasters)
    .where(
      and(
        eq(productMasters.id, productId),
        eq(productMasters.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  const existing = existingRows[0];

  if (!existing) {
    return failure("Produk tidak ditemukan.");
  }

  const name = readText(formData, "name");
  const categoryId = readText(formData, "categoryId");
  const brand = readText(formData, "brand");
  const collection = readText(formData, "collection");
  const description = readText(formData, "description");
  const rawStatus = readText(formData, "status");
  const image = readImage(formData);
  const removeImage = readText(formData, "removeImage") === "1";

  const fieldErrors = validateCommonFields({
    name,
    brand,
    collection,
    description,
    status: rawStatus,
  });

  if (!isUuid(categoryId)) {
    fieldErrors.categoryId = "Pilih kategori yang valid.";
  }

  if (existing.status === "active" && rawStatus === "draft") {
    fieldErrors.status =
      "Produk aktif tidak dapat dikembalikan ke Draft. Gunakan status Nonaktif.";
  }

  if (image) {
    const imageValidation = validateImageFile(image);

    if (!imageValidation.valid) {
      fieldErrors.image = imageValidation.message;
    }
  }

  const hasEffectiveImage = Boolean(image) || (!removeImage && Boolean(existing.imageKey));

  if (rawStatus === "active" && !hasEffectiveImage) {
    fieldErrors.image = "Foto katalog wajib untuk Produk Aktif.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data produk.", fieldErrors);
  }

  const status = rawStatus as ProductStatus;
  const category = await getCategoryForProduct({
    organizationId: auth.organization.id,
    categoryId,
  });

  if (!category) {
    return failure("Kategori produk tidak ditemukan.", {
      categoryId: "Pilih kategori yang tersedia.",
    });
  }

  const categoryChanged = categoryId !== existing.categoryId;

  if (!category.isActive && (categoryChanged || status === "active")) {
    return failure("Produk belum dapat diperbarui.", {
      categoryId:
        status === "active"
          ? "Produk aktif harus menggunakan kategori aktif."
          : "Kategori baru yang dipilih harus berstatus aktif.",
    });
  }

  if (existing.status === "active" && status === "inactive") {
    const operationalItemRows = await db
      .select({ total: count() })
      .from(productItems)
      .where(
        and(
          eq(productItems.organizationId, auth.organization.id),
          eq(productItems.productMasterId, productId),
          eq(productItems.isActive, true),
          inArray(
            productItems.availability,
            OPERATIONAL_ITEM_AVAILABILITIES,
          ),
        ),
      );

    const operationalItemCount = Number(operationalItemRows[0]?.total ?? 0);

    if (operationalItemCount > 0) {
      return failure("Produk belum dapat dinonaktifkan.", {
        status: `${operationalItemCount} item operasional aktif masih terhubung.`,
      });
    }
  }

  let uploadedImageKey: string | null = null;

  try {
    if (image) {
      uploadedImageKey = await storeImageFile({
        file: image,
        organizationId: auth.organization.id,
        entityType: "products",
        entityId: productId,
      });
    }
  } catch (error) {
    return failure("Foto produk gagal diproses.", {
      image:
        error instanceof Error
          ? error.message
          : "Foto tidak dapat disimpan. Silakan pilih file lain.",
    });
  }

  const nextImageKey = uploadedImageKey ?? (removeImage ? null : existing.imageKey);
  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      await transaction
        .update(productMasters)
        .set({
          categoryId,
          name,
          brand: normalizeNullable(brand),
          collection: normalizeNullable(collection),
          description: normalizeNullable(description),
          imageKey: nextImageKey,
          status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productMasters.id, productId),
            eq(productMasters.organizationId, auth.organization.id),
          ),
        );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "product_master.update",
        entityType: "product_master",
        entityId: productId,
        beforeData: {
          code: existing.code,
          name: existing.name,
          categoryId: existing.categoryId,
          brand: existing.brand,
          collection: existing.collection,
          description: existing.description,
          status: existing.status,
          material: existing.material,
          imageKey: existing.imageKey,
          attributes: existing.attributes,
        },
        afterData: {
          code: existing.code,
          name,
          categoryId,
          categoryCode: category.code,
          categoryName: category.name,
          brand: normalizeNullable(brand),
          collection: normalizeNullable(collection),
          description: normalizeNullable(description),
          status,
          material: existing.material,
          imageKey: nextImageKey,
          attributes: existing.attributes,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    await deleteImageFile(uploadedImageKey);
    console.error("Gagal memperbarui Product Master:", error);

    return failure("Produk gagal diperbarui. Silakan coba kembali.");
  }

  if (existing.imageKey && existing.imageKey !== nextImageKey) {
    await deleteImageFile(existing.imageKey);
  }

  revalidateProductPages(productId);

  return success("Produk berhasil diperbarui.");
}
