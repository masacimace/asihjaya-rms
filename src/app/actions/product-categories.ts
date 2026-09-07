"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditLogs, productCategories, productMasters } from "@/db/schema";
import {
  isUuid,
  type CategoryActionState,
} from "@/features/products/category-contracts";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const CATEGORY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): CategoryActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function success(message: string): CategoryActionState {
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

function revalidateCategoryPages(categoryId?: string) {
  revalidatePath("/admin/produk");
  revalidatePath("/admin/produk/kategori");

  if (categoryId) {
    revalidatePath(`/admin/produk/kategori/${categoryId}`);
  }
}

function readActiveStatus(formData: FormData): boolean | null {
  const value = readText(formData, "status");

  if (value === "active") return true;
  if (value === "inactive") return false;

  return null;
}

export async function createProductCategoryAction(
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const auth = await requirePermission("products.manage");

  const code = readText(formData, "code").toUpperCase();
  const name = readText(formData, "name");
  const description = readText(formData, "description");
  const isActive = readActiveStatus(formData);
  const responseMode = readText(formData, "responseMode");
  const fieldErrors: Record<string, string> = {};

  if (!CATEGORY_CODE_PATTERN.test(code)) {
    fieldErrors.code =
      "Gunakan 2–32 karakter: huruf kapital, angka, garis bawah, atau tanda hubung.";
  }

  if (name.length < 2 || name.length > 120) {
    fieldErrors.name = "Nama kategori harus terdiri dari 2–120 karakter.";
  }

  if (description.length > 2000) {
    fieldErrors.description = "Deskripsi maksimal 2.000 karakter.";
  }

  if (isActive === null) {
    fieldErrors.status = "Pilih status kategori yang valid.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data kategori.", fieldErrors);
  }

  const existingRows = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.organizationId, auth.organization.id),
        eq(productCategories.code, code),
      ),
    )
    .limit(1);

  if (existingRows[0]) {
    return failure("Kode kategori sudah digunakan.", {
      code: "Gunakan kode kategori yang berbeda.",
    });
  }

  const requestMetadata = await getRequestMetadata();
  let createdCategoryId: string;

  try {
    createdCategoryId = await db.transaction(async (transaction) => {
      const createdRows = await transaction
        .insert(productCategories)
        .values({
          organizationId: auth.organization.id,
          parentCategoryId: null,
          code,
          name,
          description: normalizeNullable(description),
          displayOrder: 0,
          isActive: isActive!,
        })
        .returning({ id: productCategories.id });

      const createdCategory = createdRows[0];

      if (!createdCategory) {
        throw new Error("Kategori gagal dibuat.");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "product_category.create",
        entityType: "product_category",
        entityId: createdCategory.id,
        afterData: {
          code,
          name,
          description: normalizeNullable(description),
          isActive,
          categoryModel: "flat",
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return createdCategory.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Kode kategori sudah digunakan.", {
        code: "Gunakan kode kategori yang berbeda.",
      });
    }

    console.error("Gagal membuat kategori produk:", error);

    return failure("Kategori gagal dibuat. Silakan coba kembali.");
  }

  revalidateCategoryPages(createdCategoryId);

  if (responseMode === "inline") {
    return success("Kategori berhasil dibuat.");
  }

  redirect(`/admin/produk/kategori/${createdCategoryId}?created=1`);
}

export async function updateProductCategoryAction(
  categoryId: string,
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const auth = await requirePermission("products.manage");

  if (!isUuid(categoryId)) {
    return failure("ID kategori tidak valid.");
  }

  const existingRows = await db
    .select({
      id: productCategories.id,
      code: productCategories.code,
      name: productCategories.name,
      parentCategoryId: productCategories.parentCategoryId,
      description: productCategories.description,
      displayOrder: productCategories.displayOrder,
      isActive: productCategories.isActive,
    })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.id, categoryId),
        eq(productCategories.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  const existing = existingRows[0];

  if (!existing) {
    return failure("Kategori tidak ditemukan.");
  }

  const name = readText(formData, "name");
  const description = readText(formData, "description");
  const isActive = readActiveStatus(formData);
  const fieldErrors: Record<string, string> = {};

  if (name.length < 2 || name.length > 120) {
    fieldErrors.name = "Nama kategori harus terdiri dari 2–120 karakter.";
  }

  if (description.length > 2000) {
    fieldErrors.description = "Deskripsi maksimal 2.000 karakter.";
  }

  if (isActive === null) {
    fieldErrors.status = "Pilih status kategori yang valid.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data kategori.", fieldErrors);
  }

  if (existing.isActive && !isActive) {
    const activeProductRows = await db
      .select({ total: count() })
      .from(productMasters)
      .where(
        and(
          eq(productMasters.organizationId, auth.organization.id),
          eq(productMasters.categoryId, categoryId),
          eq(productMasters.status, "active"),
        ),
      );

    const activeProductCount = Number(activeProductRows[0]?.total ?? 0);

    if (activeProductCount > 0) {
      return failure("Kategori belum dapat dinonaktifkan.", {
        status: `${activeProductCount} Product Master aktif masih menggunakan kategori ini.`,
      });
    }
  }

  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      await transaction
        .update(productCategories)
        .set({
          name,
          description: normalizeNullable(description),
          isActive: isActive!,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productCategories.id, categoryId),
            eq(productCategories.organizationId, auth.organization.id),
          ),
        );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "product_category.update",
        entityType: "product_category",
        entityId: categoryId,
        beforeData: {
          code: existing.code,
          name: existing.name,
          description: existing.description,
          isActive: existing.isActive,
        },
        afterData: {
          code: existing.code,
          name,
          description: normalizeNullable(description),
          isActive,
          categoryModel: "flat",
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    console.error("Gagal memperbarui kategori produk:", error);

    return failure("Kategori gagal diperbarui. Silakan coba kembali.");
  }

  revalidateCategoryPages(categoryId);

  return success("Kategori berhasil diperbarui.");
}
