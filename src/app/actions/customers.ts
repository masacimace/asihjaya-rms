"use server";

import { randomUUID } from "node:crypto";

import { and, eq, ne, or, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditLogs, customers } from "@/db/schema";
import {
  isUuid,
  type AdminCustomerActionState,
} from "@/features/customers/contracts";
import { requirePermission } from "@/lib/auth/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+().\-\s]{6,32}$/;

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): AdminCustomerActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function readText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function normalizeNullableText(value: string, maxLength: number) {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue.slice(0, maxLength) : null;
}

function normalizeEmail(value: string) {
  const email = normalizeNullableText(value, 254)?.toLowerCase() ?? null;

  return email;
}

function generateCustomerCode(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const randomSuffix = randomUUID().slice(0, 8).toUpperCase();

  return `CUST-${year}${month}${day}-${randomSuffix}`;
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

function revalidateCustomerPages(customerId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/pelanggan");
  revalidatePath("/pos/pelanggan");

  if (customerId) {
    revalidatePath(`/admin/pelanggan/${customerId}`);
    revalidatePath(`/admin/pelanggan/${customerId}/edit`);
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const databaseError = error as {
    code?: unknown;
    cause?: {
      code?: unknown;
    };
  };

  return (
    databaseError.code === "23505" || databaseError.cause?.code === "23505"
  );
}

function validateCustomerFields({
  fullName,
  phone,
  email,
  address,
  notes,
  status,
}: {
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
}) {
  const fieldErrors: Record<string, string> = {};

  if (fullName.length < 2 || fullName.length > 180) {
    fieldErrors.fullName = "Nama pelanggan harus terdiri dari 2–180 karakter.";
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    fieldErrors.phone = "Format nomor WhatsApp/telepon belum valid.";
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Format email pelanggan belum valid.";
  }

  if (address && address.length > 1000) {
    fieldErrors.address = "Alamat maksimal 1000 karakter.";
  }

  if (notes && notes.length > 500) {
    fieldErrors.notes = "Catatan internal maksimal 500 karakter.";
  }

  if (status !== "active" && status !== "inactive") {
    fieldErrors.status = "Pilih status pelanggan yang valid.";
  }

  return fieldErrors;
}

async function findDuplicateCustomer({
  organizationId,
  phone,
  email,
  excludedCustomerId,
}: {
  organizationId: string;
  phone: string | null;
  email: string | null;
  excludedCustomerId?: string;
}) {
  const duplicateConditions: SQL[] = [];

  if (phone) {
    duplicateConditions.push(eq(customers.phone, phone));
  }

  if (email) {
    duplicateConditions.push(eq(customers.email, email));
  }

  if (duplicateConditions.length === 0) {
    return null;
  }

  const duplicateMatch =
    duplicateConditions.length === 1
      ? duplicateConditions[0]
      : or(...duplicateConditions);

  if (!duplicateMatch) {
    return null;
  }

  const conditions: SQL[] = [
    eq(customers.organizationId, organizationId),
    eq(customers.isActive, true),
    duplicateMatch,
  ];

  if (excludedCustomerId) {
    conditions.push(ne(customers.id, excludedCustomerId));
  }

  const rows = await db
    .select({
      id: customers.id,
      customerCode: customers.customerCode,
      fullName: customers.fullName,
    })
    .from(customers)
    .where(and(...conditions))
    .limit(1);

  return rows[0] ?? null;
}

export async function createAdminCustomerAction(
  _previousState: AdminCustomerActionState,
  formData: FormData,
): Promise<AdminCustomerActionState> {
  const auth = await requirePermission("admin.access");

  const fullName = readText(formData, "fullName").slice(0, 180);
  const phone = normalizeNullableText(readText(formData, "phone"), 32);
  const email = normalizeEmail(readText(formData, "email"));
  const address = normalizeNullableText(readText(formData, "address"), 1000);
  const notes = normalizeNullableText(readText(formData, "notes"), 500);
  const status = readText(formData, "status") || "active";

  const fieldErrors = validateCustomerFields({
    fullName,
    phone,
    email,
    address,
    notes,
    status,
  });

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data pelanggan.", fieldErrors);
  }

  const duplicateCustomer = await findDuplicateCustomer({
    organizationId: auth.organization.id,
    phone,
    email,
  });

  if (duplicateCustomer) {
    const duplicateFieldErrors: Record<string, string> = {};

    if (phone) {
      duplicateFieldErrors.phone =
        `${duplicateCustomer.fullName} sudah menggunakan nomor ini.`;
    }

    if (email) {
      duplicateFieldErrors.email =
        `${duplicateCustomer.fullName} sudah menggunakan email ini.`;
    }

    return failure(
      "Pelanggan dengan kontak tersebut sudah ada.",
      duplicateFieldErrors,
    );
  }

  const requestMetadata = await getRequestMetadata();
  const primaryOutlet = auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];
  let createdCustomerId: string | null = null;

  try {
    createdCustomerId = await db.transaction(async (transaction) => {
      const now = new Date();
      const customerCode = generateCustomerCode(now);
      const customerRows = await transaction
        .insert(customers)
        .values({
          organizationId: auth.organization.id,
          customerCode,
          fullName,
          phone,
          email,
          address,
          notes,
          isActive: status === "active",
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: customers.id,
          customerCode: customers.customerCode,
        });

      const createdCustomer = customerRows[0];

      if (!createdCustomer) {
        throw new Error("CUSTOMER_INSERT_FAILED");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet?.id ?? null,
        actorUserId: auth.user.id,
        action: "customer.create",
        entityType: "customer",
        entityId: createdCustomer.id,
        beforeData: null,
        afterData: {
          customerId: createdCustomer.id,
          customerCode: createdCustomer.customerCode,
          fullName,
          phone,
          email,
          address,
          notes,
          isActive: status === "active",
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "admin.customers.create",
        },
      });

      return createdCustomer.id;
    });
  } catch (error) {
    console.error("Failed to create admin customer", error);

    if (isUniqueViolation(error)) {
      return failure("Kode pelanggan bentrok. Coba simpan ulang.");
    }

    return failure(
      "Pelanggan belum bisa dibuat karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    );
  }

  revalidateCustomerPages(createdCustomerId);

  redirect(`/admin/pelanggan/${createdCustomerId}?created=1`);
}

export async function updateAdminCustomerAction(
  customerId: string,
  _previousState: AdminCustomerActionState,
  formData: FormData,
): Promise<AdminCustomerActionState> {
  const auth = await requirePermission("admin.access");

  if (!isUuid(customerId)) {
    return failure("Pelanggan yang dipilih tidak valid.");
  }

  const existingRows = await db
    .select({
      id: customers.id,
      customerCode: customers.customerCode,
      fullName: customers.fullName,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      notes: customers.notes,
      isActive: customers.isActive,
    })
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  const existingCustomer = existingRows[0];

  if (!existingCustomer) {
    return failure("Pelanggan tidak ditemukan atau sudah tidak tersedia.");
  }

  const fullName = readText(formData, "fullName").slice(0, 180);
  const phone = normalizeNullableText(readText(formData, "phone"), 32);
  const email = normalizeEmail(readText(formData, "email"));
  const address = normalizeNullableText(readText(formData, "address"), 1000);
  const notes = normalizeNullableText(readText(formData, "notes"), 500);
  const status = readText(formData, "status") || "active";

  const fieldErrors = validateCustomerFields({
    fullName,
    phone,
    email,
    address,
    notes,
    status,
  });

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data pelanggan.", fieldErrors);
  }

  const duplicateCustomer = await findDuplicateCustomer({
    organizationId: auth.organization.id,
    phone,
    email,
    excludedCustomerId: customerId,
  });

  if (duplicateCustomer) {
    const duplicateFieldErrors: Record<string, string> = {};

    if (phone) {
      duplicateFieldErrors.phone =
        `${duplicateCustomer.fullName} sudah menggunakan nomor ini.`;
    }

    if (email) {
      duplicateFieldErrors.email =
        `${duplicateCustomer.fullName} sudah menggunakan email ini.`;
    }

    return failure(
      "Pelanggan dengan kontak tersebut sudah ada.",
      duplicateFieldErrors,
    );
  }

  const requestMetadata = await getRequestMetadata();
  const primaryOutlet = auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  try {
    await db.transaction(async (transaction) => {
      const now = new Date();

      await transaction
        .update(customers)
        .set({
          fullName,
          phone,
          email,
          address,
          notes,
          isActive: status === "active",
          updatedAt: now,
        })
        .where(
          and(
            eq(customers.id, customerId),
            eq(customers.organizationId, auth.organization.id),
          ),
        );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet?.id ?? null,
        actorUserId: auth.user.id,
        action: "customer.update",
        entityType: "customer",
        entityId: customerId,
        beforeData: existingCustomer,
        afterData: {
          customerId,
          customerCode: existingCustomer.customerCode,
          fullName,
          phone,
          email,
          address,
          notes,
          isActive: status === "active",
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "admin.customers.update",
        },
      });
    });
  } catch (error) {
    console.error("Failed to update admin customer", error);

    return failure(
      "Pelanggan belum bisa diperbarui karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    );
  }

  revalidateCustomerPages(customerId);

  redirect(`/admin/pelanggan/${customerId}?updated=1`);
}
