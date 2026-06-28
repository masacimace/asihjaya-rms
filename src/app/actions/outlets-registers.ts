"use server";

import { and, count, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  outlets,
  productItems,
  registers,
  shifts,
  userOutlets,
} from "@/db/schema";
import type { OperationsActionState } from "@/features/administration/outlet-register-contracts";
import { requirePermission } from "@/lib/auth/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OUTLET_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,23}$/;

const REGISTER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

const PHONE_PATTERN = /^[0-9+().\-\s]{6,32}$/;

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): OperationsActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function success(message: string): OperationsActionState {
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

function getConstraintName(error: unknown): string | null {
  const constraint = getDatabaseError(error).constraint;

  return typeof constraint === "string" ? constraint : null;
}

function revalidateOutletPages(outletId?: string) {
  revalidatePath("/admin/administrasi");

  revalidatePath("/admin/administrasi/outlet");

  revalidatePath("/admin/administrasi/register");

  if (outletId) {
    revalidatePath(`/admin/administrasi/outlet/${outletId}`);
  }
}

function revalidateRegisterPages(registerId?: string, outletId?: string) {
  revalidatePath("/admin/administrasi");

  revalidatePath("/admin/administrasi/outlet");

  revalidatePath("/admin/administrasi/register");

  if (registerId) {
    revalidatePath(`/admin/administrasi/register/${registerId}`);
  }

  if (outletId) {
    revalidatePath(`/admin/administrasi/outlet/${outletId}`);
  }
}

async function getOutletBlockers(outletId: string) {
  const [
    activeRegisterRows,
    assignedStaffRows,
    inventoryRows,
    activeShiftRows,
  ] = await Promise.all([
    db
      .select({
        total: count(),
      })
      .from(registers)
      .where(
        and(eq(registers.outletId, outletId), eq(registers.isActive, true)),
      ),

    db
      .select({
        total: count(),
      })
      .from(userOutlets)
      .where(eq(userOutlets.outletId, outletId)),

    db
      .select({
        total: count(),
      })
      .from(productItems)
      .where(
        and(
          eq(productItems.currentOutletId, outletId),
          eq(productItems.isActive, true),
          eq(productItems.locationState, "outlet"),
        ),
      ),

    db
      .select({
        total: count(),
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.outletId, outletId),
          inArray(shifts.status, ["open", "closing"]),
        ),
      ),
  ]);

  return {
    activeRegisterCount: Number(activeRegisterRows[0]?.total ?? 0),

    assignedStaffCount: Number(assignedStaffRows[0]?.total ?? 0),

    inventoryItemCount: Number(inventoryRows[0]?.total ?? 0),

    activeShiftCount: Number(activeShiftRows[0]?.total ?? 0),
  };
}

export async function createOutletAction(
  _previousState: OperationsActionState,
  formData: FormData,
): Promise<OperationsActionState> {
  const auth = await requirePermission("outlets.manage");

  const code = readText(formData, "code").toUpperCase();

  const name = readText(formData, "name");

  const address = readText(formData, "address");

  const phone = readText(formData, "phone");

  const isActive = readCheckbox(formData, "isActive");

  const fieldErrors: Record<string, string> = {};

  if (!OUTLET_CODE_PATTERN.test(code)) {
    fieldErrors.code =
      "Gunakan 2–24 karakter: huruf kapital, angka, garis bawah, atau tanda hubung.";
  }

  if (name.length < 2 || name.length > 160) {
    fieldErrors.name = "Nama outlet harus terdiri dari 2–160 karakter.";
  }

  if (address.length > 2000) {
    fieldErrors.address = "Alamat maksimal 2.000 karakter.";
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    fieldErrors.phone = "Format nomor telepon tidak valid.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data outlet.", fieldErrors);
  }

  const existingRows = await db
    .select({
      id: outlets.id,
    })
    .from(outlets)
    .where(
      and(
        eq(outlets.organizationId, auth.organization.id),
        eq(outlets.code, code),
      ),
    )
    .limit(1);

  if (existingRows[0]) {
    return failure("Kode outlet sudah digunakan.", {
      code: "Gunakan kode outlet yang berbeda.",
    });
  }

  const requestMetadata = await getRequestMetadata();

  let createdOutletId: string;

  try {
    createdOutletId = await db.transaction(async (transaction) => {
      const createdRows = await transaction
        .insert(outlets)
        .values({
          organizationId: auth.organization.id,
          code,
          name,
          address: normalizeNullable(address),
          phone: normalizeNullable(phone),
          isActive,
        })
        .returning({
          id: outlets.id,
        });

      const createdOutlet = createdRows[0];

      if (!createdOutlet) {
        throw new Error("Outlet gagal dibuat.");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,

        outletId: createdOutlet.id,

        actorUserId: auth.user.id,

        action: "outlet.create",

        entityType: "outlet",

        entityId: createdOutlet.id,

        afterData: {
          code,
          name,
          address: normalizeNullable(address),
          phone: normalizeNullable(phone),
          isActive,
        },

        ipAddress: requestMetadata.ipAddress,

        userAgent: requestMetadata.userAgent,
      });

      return createdOutlet.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Kode outlet sudah digunakan.", {
        code: "Gunakan kode outlet yang berbeda.",
      });
    }

    console.error("Gagal membuat outlet:", error);

    return failure("Outlet gagal dibuat. Silakan coba kembali.");
  }

  revalidateOutletPages(createdOutletId);

  redirect(`/admin/administrasi/outlet/${createdOutletId}?created=1`);
}

export async function updateOutletAction(
  outletId: string,
  _previousState: OperationsActionState,
  formData: FormData,
): Promise<OperationsActionState> {
  const auth = await requirePermission("outlets.manage");

  if (!UUID_PATTERN.test(outletId)) {
    return failure("ID outlet tidak valid.");
  }

  const existingRows = await db
    .select({
      id: outlets.id,
      code: outlets.code,
      name: outlets.name,
      address: outlets.address,
      phone: outlets.phone,
      isActive: outlets.isActive,
    })
    .from(outlets)
    .where(
      and(
        eq(outlets.id, outletId),
        eq(outlets.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  const existing = existingRows[0];

  if (!existing) {
    return failure("Outlet tidak ditemukan.");
  }

  const name = readText(formData, "name");

  const address = readText(formData, "address");

  const phone = readText(formData, "phone");

  const isActive = readCheckbox(formData, "isActive");

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2 || name.length > 160) {
    fieldErrors.name = "Nama outlet harus terdiri dari 2–160 karakter.";
  }

  if (address.length > 2000) {
    fieldErrors.address = "Alamat maksimal 2.000 karakter.";
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    fieldErrors.phone = "Format nomor telepon tidak valid.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data outlet.", fieldErrors);
  }

  if (existing.isActive && !isActive) {
    const blockers = await getOutletBlockers(outletId);

    const blockerMessages: string[] = [];

    if (blockers.activeRegisterCount > 0) {
      blockerMessages.push(
        `${blockers.activeRegisterCount} register masih aktif`,
      );
    }

    if (blockers.assignedStaffCount > 0) {
      blockerMessages.push(
        `${blockers.assignedStaffCount} staff masih memiliki akses outlet`,
      );
    }

    if (blockers.inventoryItemCount > 0) {
      blockerMessages.push(
        `${blockers.inventoryItemCount} item fisik masih berada di outlet`,
      );
    }

    if (blockers.activeShiftCount > 0) {
      blockerMessages.push(`${blockers.activeShiftCount} shift masih aktif`);
    }

    if (blockerMessages.length > 0) {
      return failure("Outlet belum dapat dinonaktifkan.", {
        isActive: blockerMessages.join("; ") + ".",
      });
    }
  }

  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      await transaction
        .update(outlets)
        .set({
          name,
          address: normalizeNullable(address),
          phone: normalizeNullable(phone),
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(outlets.id, outletId));

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,

        outletId,

        actorUserId: auth.user.id,

        action: "outlet.update",

        entityType: "outlet",

        entityId: outletId,

        beforeData: {
          code: existing.code,
          name: existing.name,
          address: existing.address,
          phone: existing.phone,
          isActive: existing.isActive,
        },

        afterData: {
          code: existing.code,
          name,
          address: normalizeNullable(address),
          phone: normalizeNullable(phone),
          isActive,
        },

        ipAddress: requestMetadata.ipAddress,

        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    console.error("Gagal memperbarui outlet:", error);

    return failure("Outlet gagal diperbarui. Silakan coba kembali.");
  }

  revalidateOutletPages(outletId);

  return success("Outlet berhasil diperbarui.");
}

export async function createRegisterAction(
  _previousState: OperationsActionState,
  formData: FormData,
): Promise<OperationsActionState> {
  const auth = await requirePermission("outlets.manage");

  const outletId = readText(formData, "outletId");

  const code = readText(formData, "code").toUpperCase();

  const name = readText(formData, "name");

  const isActive = readCheckbox(formData, "isActive");

  const isHardwareHub = readCheckbox(formData, "isHardwareHub");

  const fieldErrors: Record<string, string> = {};

  if (!UUID_PATTERN.test(outletId)) {
    fieldErrors.outletId = "Pilih outlet yang valid.";
  }

  if (!REGISTER_CODE_PATTERN.test(code)) {
    fieldErrors.code =
      "Gunakan 2–32 karakter: huruf kapital, angka, garis bawah, atau tanda hubung.";
  }

  if (name.length < 2 || name.length > 120) {
    fieldErrors.name = "Nama register harus terdiri dari 2–120 karakter.";
  }

  if (isHardwareHub && !isActive) {
    fieldErrors.isHardwareHub = "Hardware hub harus berupa register aktif.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data register.", fieldErrors);
  }

  const outletRows = await db
    .select({
      id: outlets.id,
      code: outlets.code,
      name: outlets.name,
    })
    .from(outlets)
    .where(
      and(
        eq(outlets.id, outletId),
        eq(outlets.organizationId, auth.organization.id),
        eq(outlets.isActive, true),
      ),
    )
    .limit(1);

  const outlet = outletRows[0];

  if (!outlet) {
    return failure("Outlet tidak ditemukan atau sudah nonaktif.", {
      outletId: "Pilih outlet aktif.",
    });
  }

  const currentHubRows = await db
    .select({
      id: registers.id,
      code: registers.code,
      name: registers.name,
    })
    .from(registers)
    .where(
      and(eq(registers.outletId, outletId), eq(registers.isHardwareHub, true)),
    )
    .limit(1);

  const currentHub = currentHubRows[0] ?? null;

  const requestMetadata = await getRequestMetadata();

  let createdRegisterId: string;

  try {
    createdRegisterId = await db.transaction(async (transaction) => {
      const now = new Date();

      if (isHardwareHub) {
        await transaction
          .update(registers)
          .set({
            isHardwareHub: false,
            updatedAt: now,
          })
          .where(
            and(
              eq(registers.outletId, outletId),
              eq(registers.isHardwareHub, true),
            ),
          );
      }

      const createdRows = await transaction
        .insert(registers)
        .values({
          outletId,
          code,
          name,
          isActive,
          isHardwareHub,
        })
        .returning({
          id: registers.id,
        });

      const createdRegister = createdRows[0];

      if (!createdRegister) {
        throw new Error("Register gagal dibuat.");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,

        outletId,

        actorUserId: auth.user.id,

        action: "register.create",

        entityType: "register",

        entityId: createdRegister.id,

        afterData: {
          outletId,
          outletCode: outlet.code,
          code,
          name,
          isActive,
          isHardwareHub,

          replacedHardwareHub: isHardwareHub ? currentHub : null,
        },

        ipAddress: requestMetadata.ipAddress,

        userAgent: requestMetadata.userAgent,
      });

      return createdRegister.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const constraint = getConstraintName(error);

      if (constraint === "registers_one_hardware_hub_per_outlet_uq") {
        return failure(
          "Hardware hub outlet berubah bersamaan. Muat ulang halaman dan coba kembali.",
          {
            isHardwareHub: "Outlet hanya dapat memiliki satu hardware hub.",
          },
        );
      }

      return failure("Kode register sudah digunakan pada outlet tersebut.", {
        code: "Gunakan kode register yang berbeda.",
      });
    }

    console.error("Gagal membuat register:", error);

    return failure("Register gagal dibuat. Silakan coba kembali.");
  }

  revalidateRegisterPages(createdRegisterId, outletId);

  redirect(`/admin/administrasi/register/${createdRegisterId}?created=1`);
}

export async function updateRegisterAction(
  registerId: string,
  _previousState: OperationsActionState,
  formData: FormData,
): Promise<OperationsActionState> {
  const auth = await requirePermission("outlets.manage");

  if (!UUID_PATTERN.test(registerId)) {
    return failure("ID register tidak valid.");
  }

  const existingRows = await db
    .select({
      id: registers.id,
      outletId: registers.outletId,
      code: registers.code,
      name: registers.name,
      isActive: registers.isActive,
      isHardwareHub: registers.isHardwareHub,

      outletCode: outlets.code,
      outletName: outlets.name,
      outletIsActive: outlets.isActive,
    })
    .from(registers)
    .innerJoin(outlets, eq(registers.outletId, outlets.id))
    .where(
      and(
        eq(registers.id, registerId),
        eq(outlets.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  const existing = existingRows[0];

  if (!existing) {
    return failure("Register tidak ditemukan.");
  }

  const name = readText(formData, "name");

  const isActive = readCheckbox(formData, "isActive");

  const isHardwareHub = readCheckbox(formData, "isHardwareHub");

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2 || name.length > 120) {
    fieldErrors.name = "Nama register harus terdiri dari 2–120 karakter.";
  }

  if (isHardwareHub && !isActive) {
    fieldErrors.isHardwareHub = "Hardware hub harus berupa register aktif.";
  }

  if (isActive && !existing.outletIsActive) {
    fieldErrors.isActive =
      "Register tidak dapat diaktifkan karena outlet sedang nonaktif.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data register.", fieldErrors);
  }

  if (existing.isActive && !isActive) {
    const activeShiftRows = await db
      .select({
        total: count(),
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.registerId, registerId),
          inArray(shifts.status, ["open", "closing"]),
        ),
      );

    const activeShiftCount = Number(activeShiftRows[0]?.total ?? 0);

    if (activeShiftCount > 0) {
      return failure("Register belum dapat dinonaktifkan.", {
        isActive: `${activeShiftCount} shift pada register ini masih aktif atau sedang ditutup.`,
      });
    }
  }

  const currentHubRows = await db
    .select({
      id: registers.id,
      code: registers.code,
      name: registers.name,
    })
    .from(registers)
    .where(
      and(
        eq(registers.outletId, existing.outletId),
        eq(registers.isHardwareHub, true),
      ),
    )
    .limit(1);

  const currentHub = currentHubRows[0] ?? null;

  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      const now = new Date();

      if (isHardwareHub) {
        await transaction
          .update(registers)
          .set({
            isHardwareHub: false,
            updatedAt: now,
          })
          .where(
            and(
              eq(registers.outletId, existing.outletId),
              ne(registers.id, registerId),
              eq(registers.isHardwareHub, true),
            ),
          );
      }

      await transaction
        .update(registers)
        .set({
          name,
          isActive,
          isHardwareHub: isActive ? isHardwareHub : false,
          updatedAt: now,
        })
        .where(eq(registers.id, registerId));

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,

        outletId: existing.outletId,

        actorUserId: auth.user.id,

        action: "register.update",

        entityType: "register",

        entityId: registerId,

        beforeData: {
          outletId: existing.outletId,
          outletCode: existing.outletCode,
          code: existing.code,
          name: existing.name,
          isActive: existing.isActive,
          isHardwareHub: existing.isHardwareHub,
        },

        afterData: {
          outletId: existing.outletId,
          outletCode: existing.outletCode,
          code: existing.code,
          name,
          isActive,
          isHardwareHub: isActive ? isHardwareHub : false,

          replacedHardwareHub:
            isHardwareHub && currentHub?.id !== registerId ? currentHub : null,
        },

        ipAddress: requestMetadata.ipAddress,

        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const constraint = getConstraintName(error);

      if (constraint === "registers_one_hardware_hub_per_outlet_uq") {
        return failure(
          "Hardware hub outlet berubah bersamaan. Muat ulang halaman dan coba kembali.",
          {
            isHardwareHub: "Outlet hanya dapat memiliki satu hardware hub.",
          },
        );
      }
    }

    console.error("Gagal memperbarui register:", error);

    return failure("Register gagal diperbarui. Silakan coba kembali.");
  }

  revalidateRegisterPages(registerId, existing.outletId);

  return success("Register berhasil diperbarui.");
}
