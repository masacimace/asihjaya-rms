"use server";

import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  outlets,
  permissions,
  rolePermissions,
  roles,
  userOutlets,
  userRoles,
  users,
  userSessions,
} from "@/db/schema";
import type { StaffActionState } from "@/features/administration/staff-contracts";
import { hashPassword } from "@/lib/auth/password";
import { requirePermission } from "@/lib/auth/session";

type UserStatus = "active" | "inactive" | "suspended";

const USERNAME_PATTERN = /^[a-z0-9._-]{3,80}$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_PATTERN = /^[0-9+().\-\s]{6,32}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): StaffActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function success(message: string): StaffActionState {
  return {
    status: "success",
    message,
  };
}

function readText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function readIds(formData: FormData, name: string): string[] {
  return [
    ...new Set(
      formData
        .getAll(name)
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
}

function isUserStatus(value: string): value is UserStatus {
  return value === "active" || value === "inactive" || value === "suspended";
}

function hasInvalidId(ids: readonly string[]): boolean {
  return ids.some((id) => !UUID_PATTERN.test(id));
}

function normalizePhone(value: string): string | null {
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

function revalidateStaffPages(userId?: string) {
  revalidatePath("/admin/administrasi");

  revalidatePath("/admin/administrasi/staff");

  if (userId) {
    revalidatePath(`/admin/administrasi/staff/${userId}`);
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

async function validateAssignments(
  organizationId: string,
  roleIds: string[],
  outletIds: string[],
) {
  if (roleIds.length === 0) {
    return failure("Pilih minimal satu role.", {
      roleIds: "Staff harus memiliki minimal satu role.",
    });
  }

  if (outletIds.length === 0) {
    return failure("Pilih minimal satu outlet.", {
      outletIds: "Staff harus memiliki minimal satu outlet.",
    });
  }

  if (hasInvalidId(roleIds) || hasInvalidId(outletIds)) {
    return failure("Pilihan role atau outlet tidak valid.");
  }

  const [validRoleRows, validOutletRows, permissionRows] = await Promise.all([
    db
      .select({
        id: roles.id,
      })
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, organizationId),
          eq(roles.isActive, true),
          inArray(roles.id, roleIds),
        ),
      ),

    db
      .select({
        id: outlets.id,
      })
      .from(outlets)
      .where(
        and(
          eq(outlets.organizationId, organizationId),
          eq(outlets.isActive, true),
          inArray(outlets.id, outletIds),
        ),
      ),

    db
      .selectDistinct({
        code: permissions.code,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds)),
  ]);

  if (validRoleRows.length !== roleIds.length) {
    return failure("Salah satu role tidak tersedia.", {
      roleIds: "Pilih role aktif dari organisasi ini.",
    });
  }

  if (validOutletRows.length !== outletIds.length) {
    return failure("Salah satu outlet tidak tersedia.", {
      outletIds: "Pilih outlet aktif dari organisasi ini.",
    });
  }

  const permissionCodes = permissionRows.map((permission) => permission.code);

  const hasApplicationAccess =
    permissionCodes.includes("admin.access") ||
    permissionCodes.includes("pos.access");

  if (!hasApplicationAccess) {
    return failure("Role terpilih tidak memberikan akses aplikasi.", {
      roleIds: "Pilih role yang memiliki akses Admin atau POS.",
    });
  }

  return null;
}

export async function createStaffAction(
  _previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const auth = await requirePermission("staff.manage");

  const fullName = readText(formData, "fullName");

  const username = readText(formData, "username").toLowerCase();

  const email = readText(formData, "email").toLowerCase();

  const phone = readText(formData, "phone");

  const password = String(formData.get("password") ?? "");

  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );

  const statusValue = readText(formData, "status");

  const roleIds = readIds(formData, "roleIds");

  const outletIds = readIds(formData, "outletIds");

  const primaryOutletId = readText(formData, "primaryOutletId");

  const fieldErrors: Record<string, string> = {};

  if (fullName.length < 2 || fullName.length > 160) {
    fieldErrors.fullName = "Nama harus terdiri dari 2–160 karakter.";
  }

  if (!USERNAME_PATTERN.test(username)) {
    fieldErrors.username =
      "Gunakan 3–80 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.";
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Masukkan alamat email yang valid.";
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    fieldErrors.phone = "Format nomor telepon tidak valid.";
  }

  if (password.length < 12 || password.length > 128) {
    fieldErrors.password = "Kata sandi harus terdiri dari 12–128 karakter.";
  }

  if (password !== passwordConfirmation) {
    fieldErrors.passwordConfirmation = "Konfirmasi kata sandi tidak sama.";
  }

  if (statusValue !== "active" && statusValue !== "inactive") {
    fieldErrors.status = "Status akun tidak valid.";
  }

  if (!primaryOutletId || !outletIds.includes(primaryOutletId)) {
    fieldErrors.primaryOutletId =
      "Pilih salah satu outlet terpilih sebagai outlet utama.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data staff.", fieldErrors);
  }

  const assignmentError = await validateAssignments(
    auth.organization.id,
    roleIds,
    outletIds,
  );

  if (assignmentError) {
    return assignmentError;
  }

  const duplicateRows = await db
    .select({
      username: users.username,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.organizationId, auth.organization.id),
        or(eq(users.username, username), eq(users.email, email)),
      ),
    );

  if (duplicateRows.some((row) => row.username === username)) {
    fieldErrors.username = "Username sudah digunakan.";
  }

  if (duplicateRows.some((row) => row.email === email)) {
    fieldErrors.email = "Email sudah digunakan.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Username atau email sudah terdaftar.", fieldErrors);
  }

  const passwordHash = await hashPassword(password);

  const requestMetadata = await getRequestMetadata();

  let createdUserId: string;

  try {
    createdUserId = await db.transaction(async (transaction) => {
      const createdRows = await transaction
        .insert(users)
        .values({
          organizationId: auth.organization.id,
          fullName,
          username,
          email,
          phone: normalizePhone(phone),
          passwordHash,
          status: statusValue as "active" | "inactive",
        })
        .returning({
          id: users.id,
        });

      const createdUser = createdRows[0];

      if (!createdUser) {
        throw new Error("Staff gagal dibuat.");
      }

      await transaction.insert(userRoles).values(
        roleIds.map((roleId) => ({
          userId: createdUser.id,
          roleId,
          assignedBy: auth.user.id,
        })),
      );

      await transaction.insert(userOutlets).values(
        outletIds.map((outletId) => ({
          userId: createdUser.id,
          outletId,
          isPrimary: outletId === primaryOutletId,
        })),
      );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "staff.create",
        entityType: "user",
        entityId: createdUser.id,
        afterData: {
          fullName,
          username,
          email,
          phone: normalizePhone(phone),
          status: statusValue,
          roleIds,
          outletIds,
          primaryOutletId,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return createdUser.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Username atau email sudah digunakan.");
    }

    console.error("Gagal membuat staff:", error);

    return failure("Staff gagal dibuat. Silakan coba kembali.");
  }

  revalidateStaffPages(createdUserId);

  redirect(`/admin/administrasi/staff/${createdUserId}?created=1`);
}

export async function updateStaffProfileAction(
  userId: string,
  _previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const auth = await requirePermission("staff.manage");

  if (!UUID_PATTERN.test(userId)) {
    return failure("ID staff tidak valid.");
  }

  const existingRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      username: users.username,
      email: users.email,
      phone: users.phone,
      status: users.status,
    })
    .from(users)
    .where(
      and(eq(users.id, userId), eq(users.organizationId, auth.organization.id)),
    )
    .limit(1);

  const existing = existingRows[0];

  if (!existing) {
    return failure("Staff tidak ditemukan.");
  }

  const fullName = readText(formData, "fullName");

  const username = readText(formData, "username").toLowerCase();

  const email = readText(formData, "email").toLowerCase();

  const phone = readText(formData, "phone");

  const statusValue = readText(formData, "status");

  const fieldErrors: Record<string, string> = {};

  if (fullName.length < 2 || fullName.length > 160) {
    fieldErrors.fullName = "Nama harus terdiri dari 2–160 karakter.";
  }

  if (!USERNAME_PATTERN.test(username)) {
    fieldErrors.username = "Format username tidak valid.";
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Format email tidak valid.";
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    fieldErrors.phone = "Format nomor telepon tidak valid.";
  }

  if (!isUserStatus(statusValue)) {
    return failure("Status akun tidak valid.", {
      status: "Status akun tidak valid.",
    });
  }

  if (auth.user.id === userId && statusValue !== "active") {
    return failure(
      "Anda tidak dapat menonaktifkan atau menangguhkan akun sendiri.",
      {
        status:
          "Anda tidak dapat menonaktifkan atau menangguhkan akun sendiri.",
      },
    );
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data staff.", fieldErrors);
  }

  const duplicateRows = await db
    .select({
      username: users.username,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.organizationId, auth.organization.id),
        ne(users.id, userId),
        or(eq(users.username, username), eq(users.email, email)),
      ),
    );

  if (duplicateRows.some((row) => row.username === username)) {
    fieldErrors.username = "Username sudah digunakan.";
  }

  if (duplicateRows.some((row) => row.email === email)) {
    fieldErrors.email = "Email sudah digunakan.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Username atau email sudah terdaftar.", fieldErrors);
  }

  const requestMetadata = await getRequestMetadata();

  await db.transaction(async (transaction) => {
    await transaction
      .update(users)
      .set({
        fullName,
        username,
        email,
        phone: normalizePhone(phone),
        status: statusValue as UserStatus,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    if (statusValue !== "active") {
      await transaction
        .update(userSessions)
        .set({
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)),
        );
    }

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      actorUserId: auth.user.id,
      action: "staff.profile_update",
      entityType: "user",
      entityId: userId,
      beforeData: {
        fullName: existing.fullName,
        username: existing.username,
        email: existing.email,
        phone: existing.phone,
        status: existing.status,
      },
      afterData: {
        fullName,
        username,
        email,
        phone: normalizePhone(phone),
        status: statusValue,
      },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });
  });

  revalidateStaffPages(userId);

  return success("Data staff berhasil diperbarui.");
}

export async function updateStaffAccessAction(
  userId: string,
  _previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const auth = await requirePermission("staff.manage");

  if (auth.user.id === userId) {
    return failure("Akses akun sendiri tidak dapat diubah dari halaman ini.");
  }

  const targetRows = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(
      and(eq(users.id, userId), eq(users.organizationId, auth.organization.id)),
    )
    .limit(1);

  if (!targetRows[0]) {
    return failure("Staff tidak ditemukan.");
  }

  const roleIds = readIds(formData, "roleIds");

  const outletIds = readIds(formData, "outletIds");

  const primaryOutletId = readText(formData, "primaryOutletId");

  if (!primaryOutletId || !outletIds.includes(primaryOutletId)) {
    return failure("Pilih outlet utama.", {
      primaryOutletId: "Outlet utama harus termasuk dalam outlet yang dipilih.",
    });
  }

  const assignmentError = await validateAssignments(
    auth.organization.id,
    roleIds,
    outletIds,
  );

  if (assignmentError) {
    return assignmentError;
  }

  const [previousRoleRows, previousOutletRows] = await Promise.all([
    db
      .select({
        roleId: userRoles.roleId,
      })
      .from(userRoles)
      .where(eq(userRoles.userId, userId)),

    db
      .select({
        outletId: userOutlets.outletId,
        isPrimary: userOutlets.isPrimary,
      })
      .from(userOutlets)
      .where(eq(userOutlets.userId, userId)),
  ]);

  const requestMetadata = await getRequestMetadata();

  await db.transaction(async (transaction) => {
    await transaction.delete(userRoles).where(eq(userRoles.userId, userId));

    await transaction.delete(userOutlets).where(eq(userOutlets.userId, userId));

    await transaction.insert(userRoles).values(
      roleIds.map((roleId) => ({
        userId,
        roleId,
        assignedBy: auth.user.id,
      })),
    );

    await transaction.insert(userOutlets).values(
      outletIds.map((outletId) => ({
        userId,
        outletId,
        isPrimary: outletId === primaryOutletId,
      })),
    );

    await transaction
      .update(userSessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)),
      );

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      actorUserId: auth.user.id,
      action: "staff.access_update",
      entityType: "user",
      entityId: userId,
      beforeData: {
        roleIds: previousRoleRows.map((row) => row.roleId),
        outlets: previousOutletRows,
      },
      afterData: {
        roleIds,
        outletIds,
        primaryOutletId,
      },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });
  });

  revalidateStaffPages(userId);

  return success(
    "Role dan akses outlet berhasil diperbarui. Session staff tersebut telah dicabut.",
  );
}

export async function resetStaffPasswordAction(
  userId: string,
  _previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const auth = await requirePermission("staff.manage");

  if (auth.user.id === userId) {
    return failure(
      "Reset password akun sendiri akan tersedia melalui menu Keamanan Akun.",
    );
  }

  const targetRows = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(
      and(eq(users.id, userId), eq(users.organizationId, auth.organization.id)),
    )
    .limit(1);

  if (!targetRows[0]) {
    return failure("Staff tidak ditemukan.");
  }

  const password = String(formData.get("password") ?? "");

  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );

  const fieldErrors: Record<string, string> = {};

  if (password.length < 12 || password.length > 128) {
    fieldErrors.password = "Kata sandi harus terdiri dari 12–128 karakter.";
  }

  if (password !== passwordConfirmation) {
    fieldErrors.passwordConfirmation = "Konfirmasi kata sandi tidak sama.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kata sandi baru.", fieldErrors);
  }

  const passwordHash = await hashPassword(password);

  const requestMetadata = await getRequestMetadata();

  await db.transaction(async (transaction) => {
    await transaction
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await transaction
      .update(userSessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)),
      );

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      actorUserId: auth.user.id,
      action: "staff.password_reset",
      entityType: "user",
      entityId: userId,
      afterData: {
        passwordReset: true,
        sessionsRevoked: true,
      },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });
  });

  revalidateStaffPages(userId);

  return success(
    "Kata sandi berhasil direset dan seluruh session staff tersebut telah dicabut.",
  );
}
