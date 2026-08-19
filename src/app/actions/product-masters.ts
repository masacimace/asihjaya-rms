"use server";

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
  type QuickProductMasterActionState,
} from "@/features/products/product-master-contracts";
import type { ProductStatus } from "@/features/products/contracts";
import { getClientIp } from "@/lib/http/client-ip";
import { requirePermission } from "@/lib/auth/session";

const PRODUCT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_\/-]{1,63}$/;
const OPERATIONAL_ITEM_AVAILABILITIES: Array<
  "draft" | "migration_hold" | "available" | "reserved"
> = ["draft", "migration_hold", "available", "reserved"];

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


function normalizeNullable(value: string): string | null {
  return value.length > 0 ? value : null;
}

async function getRequestMetadata() {
  const headerStore = await headers();

  const ipAddress = getClientIp(headerStore);

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

  const fieldErrors = validateCommonFields({
    name,
    brand,
    collection,
    description,
    status: rawStatus,
  });

  if (!PRODUCT_CODE_PATTERN.test(code)) {
    fieldErrors.code =
      "Gunakan 2–64 karakter: huruf kapital, angka, garis miring, garis bawah, atau tanda hubung.";
  }

  if (!isUuid(categoryId)) {
    fieldErrors.categoryId = "Pilih kategori yang valid.";
  }

  if (rawStatus === "inactive") {
    fieldErrors.status =
      "Produk baru hanya dapat dibuat sebagai Draft atau Aktif.";
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

  const requestMetadata = await getRequestMetadata();
  let createdProductId: string | null = null;

  try {
    await db.transaction(async (transaction) => {
      const createdRows = await transaction
        .insert(productMasters)
        .values({
          organizationId: auth.organization.id,
          categoryId,
          code,
          name,
          brand: normalizeNullable(brand),
          collection: normalizeNullable(collection),
          description: normalizeNullable(description),
          status,
        })
        .returning({ id: productMasters.id });

      const created = createdRows[0];

      if (!created) {
        throw new Error("PRODUCT_MASTER_CREATE_FAILED");
      }

      createdProductId = created.id;

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "product_master.create",
        entityType: "product_master",
        entityId: created.id,
        afterData: {
          code,
          name,
          categoryId,
          categoryCode: category.code,
          categoryName: category.name,
          brand: normalizeNullable(brand),
          collection: normalizeNullable(collection),
          description: normalizeNullable(description),
          status,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Kode produk sudah digunakan.", {
        code: "Gunakan kode produk yang berbeda.",
      });
    }

    console.error("Gagal membuat Product Master:", error);
    return failure("Produk gagal dibuat. Silakan coba kembali.");
  }

  if (!createdProductId) {
    return failure("Produk gagal dibuat. Silakan coba kembali.");
  }

  revalidateProductPages(createdProductId);
  redirect(`/admin/produk/${createdProductId}?created=1`);
}

export async function quickCreateProductMasterAction(
  _previousState: QuickProductMasterActionState,
  formData: FormData,
): Promise<QuickProductMasterActionState> {
  const auth = await requirePermission("products.manage");

  const code = readText(formData, "code").toUpperCase();
  const name = readText(formData, "name");
  const categoryId = readText(formData, "categoryId");
  const fieldErrors: Record<string, string> = {};

  if (!PRODUCT_CODE_PATTERN.test(code)) {
    fieldErrors.code =
      "Gunakan 2–64 karakter: huruf kapital, angka, garis miring, garis bawah, atau tanda hubung.";
  }

  if (name.length < 2 || name.length > 200) {
    fieldErrors.name = "Nama Product Master harus terdiri dari 2–200 karakter.";
  }

  if (!isUuid(categoryId)) {
    fieldErrors.categoryId = "Pilih kategori terlebih dahulu.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Periksa kembali data Product Master.",
      fieldErrors,
    };
  }

  const category = await getCategoryForProduct({
    organizationId: auth.organization.id,
    categoryId,
  });

  if (!category || !category.isActive) {
    return {
      status: "error",
      message: "Kategori tidak tersedia untuk Product Master baru.",
      fieldErrors: { categoryId: "Gunakan kategori aktif." },
    };
  }

  const requestMetadata = await getRequestMetadata();

  try {
    const createdRows = await db.transaction(async (transaction) => {
      const rows = await transaction
        .insert(productMasters)
        .values({
          organizationId: auth.organization.id,
          categoryId,
          code,
          name,
          status: "active",
        })
        .returning({
          id: productMasters.id,
          categoryId: productMasters.categoryId,
          code: productMasters.code,
          name: productMasters.name,
        });

      const created = rows[0];
      if (!created) {
        throw new Error("PRODUCT_MASTER_QUICK_CREATE_FAILED");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "product_master.quick_create",
        entityType: "product_master",
        entityId: created.id,
        afterData: {
          code,
          name,
          categoryId,
          categoryCode: category.code,
          categoryName: category.name,
          status: "active",
          source: "product_item_form",
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return rows;
    });

    const created = createdRows[0];
    if (!created) {
      return { status: "error", message: "Product Master gagal dibuat." };
    }

    revalidatePath("/admin/produk");
    revalidatePath("/admin/produk/tambah");

    return {
      status: "success",
      message: "Product Master berhasil dibuat dan langsung dipilih.",
      createdMaster: created,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: "Kode Product Master sudah digunakan.",
        fieldErrors: { code: "Gunakan kode Product Master yang berbeda." },
      };
    }

    console.error("Gagal quick-create Product Master:", error);
    return {
      status: "error",
      message: "Product Master gagal dibuat. Silakan coba kembali.",
    };
  }
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
          attributes: existing.attributes,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    console.error("Gagal memperbarui Product Master:", error);

    return failure("Produk gagal diperbarui. Silakan coba kembali.");
  }


  revalidateProductPages(productId);

  return success("Produk berhasil diperbarui.");
}
