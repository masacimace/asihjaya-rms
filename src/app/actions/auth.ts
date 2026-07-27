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
import { getClientIp } from "@/lib/http/client-ip";
import {
  clearSecurityRateLimit,
  inspectSecurityRateLimit,
  recordSecurityRateLimitFailure,
  type SecurityRateLimitPolicy,
} from "@/lib/security/rate-limit";

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

const LOGIN_IDENTIFIER_SCOPE = "auth.login.identifier";
const LOGIN_IP_SCOPE = "auth.login.ip";
const LOGIN_LIMIT_MESSAGE =
  "Terlalu banyak percobaan masuk. Tunggu beberapa saat lalu coba kembali.";

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function getIdentifierPolicy(): SecurityRateLimitPolicy {
  return {
    limit: positiveInteger("LOGIN_RATE_LIMIT_IDENTIFIER_FAILURES", 5),
    windowMs: positiveInteger("LOGIN_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
    blockMs: positiveInteger("LOGIN_RATE_LIMIT_BLOCK_MS", 15 * 60 * 1000),
  };
}

function getIpPolicy(): SecurityRateLimitPolicy {
  return {
    limit: positiveInteger("LOGIN_RATE_LIMIT_IP_FAILURES", 20),
    windowMs: positiveInteger("LOGIN_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
    blockMs: positiveInteger("LOGIN_RATE_LIMIT_BLOCK_MS", 15 * 60 * 1000),
  };
}

function getIdentifierRateLimitKey(identifier: string): string {
  return `${serverEnv.DEFAULT_ORGANIZATION_SLUG}:${identifier}`;
}

async function isLoginRateLimited(identifier: string, ipAddress: string | null) {
  const checks = [
    inspectSecurityRateLimit({
      scope: LOGIN_IDENTIFIER_SCOPE,
      key: getIdentifierRateLimitKey(identifier),
      policy: getIdentifierPolicy(),
    }),
  ];

  if (ipAddress) {
    checks.push(
      inspectSecurityRateLimit({
        scope: LOGIN_IP_SCOPE,
        key: ipAddress,
        policy: getIpPolicy(),
      }),
    );
  }

  const decisions = await Promise.all(checks);
  return decisions.some((decision) => !decision.allowed);
}

async function recordLoginFailure(
  identifier: string | null,
  ipAddress: string | null,
) {
  const writes: Promise<unknown>[] = [];

  if (identifier) {
    writes.push(
      recordSecurityRateLimitFailure({
        scope: LOGIN_IDENTIFIER_SCOPE,
        key: getIdentifierRateLimitKey(identifier),
        policy: getIdentifierPolicy(),
      }),
    );
  }

  if (ipAddress) {
    writes.push(
      recordSecurityRateLimitFailure({
        scope: LOGIN_IP_SCOPE,
        key: ipAddress,
        policy: getIpPolicy(),
      }),
    );
  }

  await Promise.all(writes);
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  void _previousState;

  const headerStore = await headers();
  const ipAddress = getClientIp(headerStore);
  const userAgent = headerStore.get("user-agent")?.slice(0, 1000) ?? null;
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
    await recordLoginFailure(null, ipAddress);

    return {
      errors,
      values: {
        identifier,
      },
    };
  }

  if (await isLoginRateLimited(identifier, ipAddress)) {
    return {
      message: LOGIN_LIMIT_MESSAGE,
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
    await recordLoginFailure(identifier, ipAddress);

    return {
      message: "Username/email atau kata sandi tidak valid.",
      values: {
        identifier,
      },
    };
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid || user.status !== "active") {
    await recordLoginFailure(identifier, ipAddress);

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

  await clearSecurityRateLimit({
    scope: LOGIN_IDENTIFIER_SCOPE,
    key: getIdentifierRateLimitKey(identifier),
  });

  if (!hasApplicationAccess) {
    return {
      message: "Akun belum mempunyai akses ke aplikasi.",
      values: {
        identifier,
      },
    };
  }

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
      userAgent: headerStore.get("user-agent")?.slice(0, 1000) ?? null,
    });
  }

  await revokeCurrentSession();

  redirect("/login");
}
