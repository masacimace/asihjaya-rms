"use server";

import { and, eq, or } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditLogs, organizations, users } from "@/db/schema";
import {
  createUserSession,
  getCurrentAuth,
  getDefaultRoute,
  getUserPermissionCodes,
  revokeCurrentSession,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { serverEnv } from "@/lib/env";

export type LoginActionState = {
  message?: string;

  errors?: {
    identifier?: string;
    password?: string;
  };

  values?: {
    identifier?: string;
  };
};

function getClientIp(headerStore: Headers): string | null {
  const forwardedFor = headerStore.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim().slice(0, 64) ?? null;
  }

  return headerStore.get("x-real-ip")?.slice(0, 64) ?? null;
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const identifier = String(formData.get("identifier") ?? "")
    .trim()
    .toLowerCase();

  const password = String(formData.get("password") ?? "");

  const errors: NonNullable<LoginActionState["errors"]> = {};

  if (identifier.length < 3 || identifier.length > 254) {
    errors.identifier = "Masukkan username atau email yang valid.";
  }

  if (password.length < 8 || password.length > 1024) {
    errors.password = "Kata sandi tidak valid.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      values: {
        identifier,
      },
    };
  }

  const organizationRows = await db
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .where(
      and(
        eq(organizations.slug, serverEnv.DEFAULT_ORGANIZATION_SLUG),
        eq(organizations.isActive, true),
      ),
    )
    .limit(1);

  const organization = organizationRows[0];

  if (!organization) {
    return {
      message: "Konfigurasi organization belum tersedia.",
      values: {
        identifier,
      },
    };
  }

  const userRows = await db
    .select({
      id: users.id,
      organizationId: users.organizationId,
      passwordHash: users.passwordHash,
      status: users.status,
    })
    .from(users)
    .where(
      and(
        eq(users.organizationId, organization.id),
        or(eq(users.username, identifier), eq(users.email, identifier)),
      ),
    )
    .limit(1);

  const user = userRows[0];

  /*
   * Tetap menjalankan scrypt saat user tidak ditemukan
   * agar perbedaan waktu respons tidak terlalu mencolok.
   */
  if (!user?.passwordHash) {
    await hashPassword(password);

    return {
      message: "Username/email atau kata sandi tidak valid.",
      values: {
        identifier,
      },
    };
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid || user.status !== "active") {
    return {
      message: "Username/email atau kata sandi tidak valid.",
      values: {
        identifier,
      },
    };
  }

  const permissionCodes = await getUserPermissionCodes(user.id);

  const hasApplicationAccess =
    permissionCodes.includes("admin.access") ||
    permissionCodes.includes("pos.access");

  if (!hasApplicationAccess) {
    return {
      message: "Akun belum mempunyai akses ke aplikasi.",
      values: {
        identifier,
      },
    };
  }

  const headerStore = await headers();

  const ipAddress = getClientIp(headerStore);

  const userAgent = headerStore.get("user-agent");

  await db.transaction(async (transaction) => {
    await transaction
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await transaction.insert(auditLogs).values({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      afterData: {
        method: "password",
      },
      ipAddress,
      userAgent,
    });
  });

  await createUserSession({
    userId: user.id,
    ipAddress,
    userAgent,
  });

  redirect(getDefaultRoute(permissionCodes));
}

export async function logoutAction(): Promise<void> {
  const auth = await getCurrentAuth();

  if (auth) {
    const headerStore = await headers();

    await db.insert(auditLogs).values({
      organizationId: auth.organization.id,
      actorUserId: auth.user.id,
      action: "auth.logout",
      entityType: "user_session",
      entityId: auth.session.id,
      ipAddress: getClientIp(headerStore),
      userAgent: headerStore.get("user-agent"),
    });
  }

  await revokeCurrentSession();

  redirect("/login");
}
