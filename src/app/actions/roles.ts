"use server";

import { and, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
  userSessions,
} from "@/db/schema";
import type { RoleActionState } from "@/features/administration/role-contracts";
import { requirePermission } from "@/lib/auth/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;

const RESERVED_SYSTEM_ROLE_CODES = new Set([
  "system_admin",
  "owner",
  "manager",
  "cashier",
  "stock_admin",
  "finance",
]);

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): RoleActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function success(message: string): RoleActionState {
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

function readCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function hasInvalidId(ids: readonly string[]): boolean {
  return ids.some((id) => !UUID_PATTERN.test(id));
}

function sortedValues(values: readonly string[]): string[] {
  return [...values].sort();
}

function arraysEqual(
  first: readonly string[],
  second: readonly string[],
): boolean {
  const firstSorted = sortedValues(first);

  const secondSorted = sortedValues(second);

  return (
    firstSorted.length === secondSorted.length &&
    firstSorted.every((value, index) => value === secondSorted[index])
  );
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

function revalidateRolePages(roleId?: string) {
  revalidatePath("/admin/administrasi");

  revalidatePath("/admin/administrasi/peran-akses");

  revalidatePath("/admin/administrasi/staff");

  if (roleId) {
    revalidatePath(`/admin/administrasi/peran-akses/${roleId}`);
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

function isForeignKeyViolation(error: unknown): boolean {
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
    databaseError.code === "23503" || databaseError.cause?.code === "23503"
  );
}

type PermissionValidationResult = {
  permissionCodes: string[];
  error: RoleActionState | null;
};

async function validatePermissionIds(
  permissionIds: string[],
): Promise<PermissionValidationResult> {
  if (permissionIds.length === 0) {
    return {
      permissionCodes: [],
      error: failure("Pilih minimal satu permission.", {
        permissionIds: "Role harus memiliki minimal satu permission.",
      }),
    };
  }

  if (hasInvalidId(permissionIds)) {
    return {
      permissionCodes: [],
      error: failure("Pilihan permission tidak valid."),
    };
  }

  const permissionRows = await db
    .select({
      id: permissions.id,
      code: permissions.code,
    })
    .from(permissions)
    .where(inArray(permissions.id, permissionIds));

  if (permissionRows.length !== permissionIds.length) {
    return {
      permissionCodes: [],
      error: failure("Salah satu permission tidak ditemukan.", {
        permissionIds: "Pilih permission yang tersedia.",
      }),
    };
  }

  const permissionCodes = permissionRows.map((permission) => permission.code);

  const hasApplicationAccess =
    permissionCodes.includes("admin.access") ||
    permissionCodes.includes("pos.access");

  if (!hasApplicationAccess) {
    return {
      permissionCodes,
      error: failure("Role harus memberikan akses ke Admin atau POS.", {
        permissionIds: "Pilih permission admin.access atau pos.access.",
      }),
    };
  }

  return {
    permissionCodes,
    error: null,
  };
}

type RoleImpactInput = {
  organizationId: string;
  roleId: string;
  currentUserId: string;
  assignedActiveUserIds: string[];
  proposedIsActive: boolean;
  proposedPermissionCodes: string[];
};

async function validateRoleImpact({
  organizationId,
  roleId,
  currentUserId,
  assignedActiveUserIds,
  proposedIsActive,
  proposedPermissionCodes,
}: RoleImpactInput): Promise<RoleActionState | null> {
  if (assignedActiveUserIds.length === 0) {
    return null;
  }

  const otherPermissionRows = await db
    .selectDistinct({
      userId: userRoles.userId,
      permissionCode: permissions.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        inArray(userRoles.userId, assignedActiveUserIds),
        ne(roles.id, roleId),
        eq(roles.organizationId, organizationId),
        eq(roles.isActive, true),
      ),
    );

  const otherPermissionsByUser = new Map<string, Set<string>>();

  for (const row of otherPermissionRows) {
    const currentPermissions =
      otherPermissionsByUser.get(row.userId) ?? new Set<string>();

    currentPermissions.add(row.permissionCode);

    otherPermissionsByUser.set(row.userId, currentPermissions);
  }

  let usersLosingApplicationAccess = 0;

  for (const userId of assignedActiveUserIds) {
    const effectivePermissions = new Set(
      otherPermissionsByUser.get(userId) ?? [],
    );

    if (proposedIsActive) {
      for (const permissionCode of proposedPermissionCodes) {
        effectivePermissions.add(permissionCode);
      }
    }

    if (userId === currentUserId) {
      const retainsAdminManagement =
        effectivePermissions.has("admin.access") &&
        effectivePermissions.has("roles.manage");

      if (!retainsAdminManagement) {
        return failure(
          "Perubahan ditolak karena dapat menghilangkan akses administrasi akun Anda sendiri.",
          {
            permissionIds:
              "Akun Anda harus tetap memiliki admin.access dan roles.manage.",
          },
        );
      }
    }

    const retainsApplicationAccess =
      effectivePermissions.has("admin.access") ||
      effectivePermissions.has("pos.access");

    if (!retainsApplicationAccess) {
      usersLosingApplicationAccess += 1;
    }
  }

  if (usersLosingApplicationAccess > 0) {
    return failure(
      `${usersLosingApplicationAccess} staff aktif akan kehilangan seluruh akses aplikasi.`,
      {
        permissionIds:
          "Berikan role pengganti kepada staff terdampak sebelum mengubah role ini.",
      },
    );
  }

  return null;
}

export async function createRoleAction(
  _previousState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const auth = await requirePermission("roles.manage");

  const name = readText(formData, "name");

  const code = readText(formData, "code").toLowerCase();

  const description = readText(formData, "description");

  const isActive = readCheckbox(formData, "isActive");

  const permissionIds = readIds(formData, "permissionIds");

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2 || name.length > 120) {
    fieldErrors.name = "Nama role harus terdiri dari 2–120 karakter.";
  }

  if (!ROLE_CODE_PATTERN.test(code)) {
    fieldErrors.code =
      "Gunakan 3–64 karakter: huruf kecil, angka, dan garis bawah.";
  }

  if (RESERVED_SYSTEM_ROLE_CODES.has(code)) {
    fieldErrors.code = "Kode tersebut dicadangkan untuk role sistem.";
  }

  if (description.length > 1000) {
    fieldErrors.description = "Deskripsi maksimal 1.000 karakter.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data role.", fieldErrors);
  }

  const permissionValidation = await validatePermissionIds(permissionIds);

  if (permissionValidation.error) {
    return permissionValidation.error;
  }

  const existingRows = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(
      and(eq(roles.organizationId, auth.organization.id), eq(roles.code, code)),
    )
    .limit(1);

  if (existingRows[0]) {
    return failure("Kode role sudah digunakan.", {
      code: "Gunakan kode role yang berbeda.",
    });
  }

  const requestMetadata = await getRequestMetadata();

  let createdRoleId: string;

  try {
    createdRoleId = await db.transaction(async (transaction) => {
      const createdRows = await transaction
        .insert(roles)
        .values({
          organizationId: auth.organization.id,
          code,
          name,
          description: description || null,
          isSystem: false,
          isActive,
        })
        .returning({
          id: roles.id,
        });

      const createdRole = createdRows[0];

      if (!createdRole) {
        throw new Error("Role gagal dibuat.");
      }

      await transaction.insert(rolePermissions).values(
        permissionIds.map((permissionId) => ({
          roleId: createdRole.id,
          permissionId,
          constraints: null,
        })),
      );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "role.create",
        entityType: "role",
        entityId: createdRole.id,
        afterData: {
          code,
          name,
          description: description || null,
          isActive,
          permissionIds,
          permissionCodes: permissionValidation.permissionCodes,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return createdRole.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Kode role sudah digunakan.", {
        code: "Gunakan kode role yang berbeda.",
      });
    }

    console.error("Gagal membuat role:", error);

    return failure("Role gagal dibuat. Silakan coba kembali.");
  }

  revalidateRolePages(createdRoleId);

  redirect(`/admin/administrasi/peran-akses/${createdRoleId}?created=1`);
}

export async function updateRoleAction(
  roleId: string,
  _previousState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const auth = await requirePermission("roles.manage");

  if (!UUID_PATTERN.test(roleId)) {
    return failure("ID role tidak valid.");
  }

  const existingRows = await db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      isActive: roles.isActive,
    })
    .from(roles)
    .where(
      and(eq(roles.id, roleId), eq(roles.organizationId, auth.organization.id)),
    )
    .limit(1);

  const existing = existingRows[0];

  if (!existing) {
    return failure("Role tidak ditemukan.");
  }

  if (existing.isSystem) {
    return failure("Role sistem bersifat read-only dan tidak dapat diubah.");
  }

  const name = readText(formData, "name");

  const description = readText(formData, "description");

  const isActive = readCheckbox(formData, "isActive");

  const permissionIds = readIds(formData, "permissionIds");

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2 || name.length > 120) {
    fieldErrors.name = "Nama role harus terdiri dari 2–120 karakter.";
  }

  if (description.length > 1000) {
    fieldErrors.description = "Deskripsi maksimal 1.000 karakter.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data role.", fieldErrors);
  }

  const permissionValidation = await validatePermissionIds(permissionIds);

  if (permissionValidation.error) {
    return permissionValidation.error;
  }

  const [previousPermissionRows, assignedUserRows] = await Promise.all([
    db
      .select({
        permissionId: rolePermissions.permissionId,
        permissionCode: permissions.code,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId)),

    db
      .select({
        userId: userRoles.userId,
        status: users.status,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleId, roleId),
          eq(users.organizationId, auth.organization.id),
        ),
      ),
  ]);

  const previousPermissionIds = previousPermissionRows.map(
    (row) => row.permissionId,
  );

  const previousPermissionCodes = previousPermissionRows.map(
    (row) => row.permissionCode,
  );

  const assignedUserIds = [
    ...new Set(assignedUserRows.map((row) => row.userId)),
  ];

  const assignedActiveUserIds = [
    ...new Set(
      assignedUserRows
        .filter((row) => row.status === "active")
        .map((row) => row.userId),
    ),
  ];

  const permissionsChanged = !arraysEqual(previousPermissionIds, permissionIds);

  const statusChanged = existing.isActive !== isActive;

  const accessChanged = permissionsChanged || statusChanged;

  if (accessChanged) {
    const impactError = await validateRoleImpact({
      organizationId: auth.organization.id,
      roleId,
      currentUserId: auth.user.id,
      assignedActiveUserIds,
      proposedIsActive: isActive,
      proposedPermissionCodes: permissionValidation.permissionCodes,
    });

    if (impactError) {
      return impactError;
    }
  }

  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      await transaction
        .update(roles)
        .set({
          name,
          description: description || null,
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(roles.id, roleId));

      await transaction
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));

      await transaction.insert(rolePermissions).values(
        permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
          constraints: null,
        })),
      );

      if (accessChanged && assignedUserIds.length > 0) {
        await transaction
          .update(userSessions)
          .set({
            revokedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(userSessions.userId, assignedUserIds),
              isNull(userSessions.revokedAt),
            ),
          );
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "role.update",
        entityType: "role",
        entityId: roleId,
        beforeData: {
          code: existing.code,
          name: existing.name,
          description: existing.description,
          isActive: existing.isActive,
          permissionIds: previousPermissionIds,
          permissionCodes: previousPermissionCodes,
        },
        afterData: {
          code: existing.code,
          name,
          description: description || null,
          isActive,
          permissionIds,
          permissionCodes: permissionValidation.permissionCodes,
          affectedUserCount: assignedUserIds.length,
          sessionsRevoked: accessChanged,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    console.error("Gagal memperbarui role:", error);

    return failure("Role gagal diperbarui. Silakan coba kembali.");
  }

  revalidateRolePages(roleId);

  return success(
    accessChanged && assignedUserIds.length > 0
      ? `Role berhasil diperbarui. Session ${assignedUserIds.length} staff terdampak telah dicabut.`
      : "Role berhasil diperbarui.",
  );
}

export async function deleteRoleAction(
  roleId: string,
  _previousState: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const auth = await requirePermission("roles.manage");

  if (!UUID_PATTERN.test(roleId)) {
    return failure("ID role tidak valid.");
  }

  const confirmationCode = readText(formData, "confirmationCode").toLowerCase();

  const requestMetadata = await getRequestMetadata();

  try {
    const result = await db.transaction(async (transaction) => {
      /*
       * Role diperiksa kembali di dalam transaction.
       * UI bukan sumber kebenaran final.
       */
      const roleRows = await transaction
        .select({
          id: roles.id,
          code: roles.code,
          name: roles.name,
          description: roles.description,
          isSystem: roles.isSystem,
          isActive: roles.isActive,
        })
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.organizationId, auth.organization.id),
          ),
        )
        .limit(1);

      const role = roleRows[0];

      if (!role) {
        return {
          ok: false as const,
          state: failure("Role tidak ditemukan atau sudah dihapus."),
        };
      }

      if (role.isSystem) {
        return {
          ok: false as const,
          state: failure("Role sistem tidak dapat dihapus."),
        };
      }

      if (confirmationCode !== role.code) {
        return {
          ok: false as const,
          state: failure("Kode konfirmasi tidak sesuai.", {
            confirmationCode: `Ketik kode role "${role.code}" untuk mengonfirmasi penghapusan.`,
          }),
        };
      }

      const assignedUserRows = await transaction
        .select({
          total: count(),
        })
        .from(userRoles)
        .where(eq(userRoles.roleId, role.id));

      const assignedUserCount = Number(assignedUserRows[0]?.total ?? 0);

      if (assignedUserCount > 0) {
        return {
          ok: false as const,
          state: failure(
            `Role masih digunakan oleh ${assignedUserCount} staff.`,
            {
              confirmationCode:
                "Pindahkan seluruh staff ke role lain sebelum menghapus role ini.",
            },
          ),
        };
      }

      const permissionRows = await transaction
        .select({
          id: permissions.id,
          code: permissions.code,
        })
        .from(rolePermissions)
        .innerJoin(
          permissions,
          eq(rolePermissions.permissionId, permissions.id),
        )
        .where(eq(rolePermissions.roleId, role.id));

      /*
       * Hapus assignment permission terlebih dahulu
       * karena role_permissions mereferensikan roles.
       */
      await transaction
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, role.id));

      await transaction
        .delete(roles)
        .where(
          and(
            eq(roles.id, role.id),
            eq(roles.organizationId, auth.organization.id),
          ),
        );

      /*
       * Snapshot role disimpan agar histori tetap
       * tersedia walaupun record role telah dihapus.
       */
      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "role.delete",
        entityType: "role",
        entityId: role.id,
        beforeData: {
          code: role.code,
          name: role.name,
          description: role.description,
          isActive: role.isActive,
          isSystem: role.isSystem,
          userCount: assignedUserCount,
          permissions: permissionRows,
        },
        afterData: {
          deleted: true,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return {
        ok: true as const,
      };
    });

    if (!result.ok) {
      return result.state;
    }
  } catch (error) {
    /*
     * Melindungi race condition:
     * bila user di-assign ketika penghapusan sedang
     * diproses, foreign key akan menolak delete.
     */
    if (isForeignKeyViolation(error)) {
      return failure(
        "Role tidak dapat dihapus karena sudah digunakan oleh staff.",
      );
    }

    console.error("Gagal menghapus role:", error);

    return failure("Role gagal dihapus. Silakan coba kembali.");
  }

  revalidateRolePages();

  redirect("/admin/administrasi/peran-akses?deleted=1");
}

