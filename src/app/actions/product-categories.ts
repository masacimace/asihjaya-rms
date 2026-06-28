"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  productCategories,
  productMasters,
} from "@/db/schema";
import {
  isUuid,
  type CategoryActionState,
} from "@/features/products/category-contracts";
import { requirePermission } from "@/lib/auth/session";

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

function readCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function normalizeNullable(value: string): string | null {
  return value.length > 0 ? value : null;
}

function readDisplayOrder(formData: FormData): number | null {
  const rawValue = readText(formData, "displayOrder");

  if (!/^\d+$/.test(rawValue)) {
    return null;
  }

  const value = Number.parseInt(rawValue, 10);

  return Number.isSafeInteger(value) ? value : null;
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

function revalidateCategoryPages(categoryId?: string) {
  revalidatePath("/admin/produk");
  revalidatePath("/admin/produk/kategori");

  if (categoryId) {
    revalidatePath(`/admin/produk/kategori/${categoryId}`);
  }
}

async function validateParentCategory({
  organizationId,
  parentCategoryId,
  currentCategoryId,
}: {
  organizationId: string;
  parentCategoryId: string | null;
  currentCategoryId?: string;
}) {
  if (!parentCategoryId) {
    return {
      parent: null,
      error: null,
    };
  }

  if (!isUuid(parentCategoryId)) {
    return {
      parent: null,
      error: "Pilih kategori induk yang valid.",
    };
  }

  if (currentCategoryId && parentCategoryId === currentCategoryId) {
    return {
      parent: null,
      error: "Kategori tidak dapat menjadi induk dirinya sendiri.",
    };
  }

  const parentRows = await db
    .select({
      id: productCategories.id,
      code: productCategories.code,
      name: productCategories.name,
      parentCategoryId: productCategories.parentCategoryId,
      isActive: productCategories.isActive,
    })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.id, parentCategoryId),
        eq(productCategories.organizationId, organizationId),
      ),
    )
    .limit(1);

  const parent = parentRows[0];

  if (!parent) {
    return {
      parent: null,
      error: "Kategori induk tidak ditemukan.",
    };
  }

  if (!parent.isActive) {
    return {
      parent: null,
      error: "Kategori induk harus berstatus aktif.",
    };
  }

  if (parent.parentCategoryId) {
    return {
      parent: null,
      error: "Subkategori tidak dapat dijadikan kategori induk.",
    };
  }

  return {
    parent,
    error: null,
  };
}

export async function createProductCategoryAction(
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const auth = await requirePermission("products.manage");

  const code = readText(formData, "code").toUpperCase();
  const name = readText(formData, "name");
  const parentCategoryId = normalizeNullable(
    readText(formData, "parentCategoryId"),
  );
  const description = readText(formData, "description");
  const displayOrder = readDisplayOrder(formData);
  const isActive = readCheckbox(formData, "isActive");

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

  if (displayOrder === null || displayOrder < 0 || displayOrder > 9999) {
    fieldErrors.displayOrder = "Urutan harus berupa angka dari 0 sampai 9.999.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data kategori.", fieldErrors);
  }

  const parentValidation = await validateParentCategory({
    organizationId: auth.organization.id,
    parentCategoryId,
  });

  if (parentValidation.error) {
    return failure("Kategori belum dapat dibuat.", {
      parentCategoryId: parentValidation.error,
    });
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
          parentCategoryId,
          code,
          name,
          description: normalizeNullable(description),
          displayOrder: displayOrder!,
          isActive,
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
          parentCategoryId,
          parentCategoryCode: parentValidation.parent?.code ?? null,
          description: normalizeNullable(description),
          displayOrder,
          isActive,
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
  const parentCategoryId = normalizeNullable(
    readText(formData, "parentCategoryId"),
  );
  const description = readText(formData, "description");
  const displayOrder = readDisplayOrder(formData);
  const isActive = readCheckbox(formData, "isActive");

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2 || name.length > 120) {
    fieldErrors.name = "Nama kategori harus terdiri dari 2–120 karakter.";
  }

  if (description.length > 2000) {
    fieldErrors.description = "Deskripsi maksimal 2.000 karakter.";
  }

  if (displayOrder === null || displayOrder < 0 || displayOrder > 9999) {
    fieldErrors.displayOrder = "Urutan harus berupa angka dari 0 sampai 9.999.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data kategori.", fieldErrors);
  }

  const parentValidation = await validateParentCategory({
    organizationId: auth.organization.id,
    parentCategoryId,
    currentCategoryId: categoryId,
  });

  if (parentValidation.error) {
    return failure("Kategori belum dapat diperbarui.", {
      parentCategoryId: parentValidation.error,
    });
  }

  const childRows = await db
    .select({ total: count() })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.organizationId, auth.organization.id),
        eq(productCategories.parentCategoryId, categoryId),
        ne(productCategories.id, categoryId),
      ),
    );

  const childCount = Number(childRows[0]?.total ?? 0);

  if (parentCategoryId && childCount > 0) {
    return failure("Kategori belum dapat dijadikan subkategori.", {
      parentCategoryId: `${childCount} subkategori masih berada di bawah kategori ini.`,
    });
  }

  if (existing.isActive && !isActive) {
    const [activeProductRows, activeChildRows] = await Promise.all([
      db
        .select({ total: count() })
        .from(productMasters)
        .where(
          and(
            eq(productMasters.organizationId, auth.organization.id),
            eq(productMasters.categoryId, categoryId),
            eq(productMasters.status, "active"),
          ),
        ),

      db
        .select({ total: count() })
        .from(productCategories)
        .where(
          and(
            eq(productCategories.organizationId, auth.organization.id),
            eq(productCategories.parentCategoryId, categoryId),
            eq(productCategories.isActive, true),
          ),
        ),
    ]);

    const activeProductCount = Number(activeProductRows[0]?.total ?? 0);
    const activeChildCount = Number(activeChildRows[0]?.total ?? 0);
    const blockerMessages: string[] = [];

    if (activeProductCount > 0) {
      blockerMessages.push(`${activeProductCount} produk aktif`);
    }

    if (activeChildCount > 0) {
      blockerMessages.push(`${activeChildCount} subkategori aktif`);
    }

    if (blockerMessages.length > 0) {
      return failure("Kategori belum dapat dinonaktifkan.", {
        isActive: `${blockerMessages.join(" dan ")} masih terhubung.`,
      });
    }
  }

  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      await transaction
        .update(productCategories)
        .set({
          parentCategoryId,
          name,
          description: normalizeNullable(description),
          displayOrder: displayOrder!,
          isActive,
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
          parentCategoryId: existing.parentCategoryId,
          description: existing.description,
          displayOrder: existing.displayOrder,
          isActive: existing.isActive,
        },
        afterData: {
          code: existing.code,
          name,
          parentCategoryId,
          parentCategoryCode: parentValidation.parent?.code ?? null,
          description: normalizeNullable(description),
          displayOrder,
          isActive,
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
