import { createHmac, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  organizations,
  outlets,
  permissions,
  rolePermissions,
  roles,
  userOutlets,
  userRoles,
  users,
  userSessions,
} from "@/db/schema";
import { serverEnv } from "@/lib/env";

export const SESSION_COOKIE_NAME = "asihjaya_session";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

type CreateSessionInput = {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AuthContext = {
  session: {
    id: string;
    expiresAt: Date;
  };

  organization: {
    id: string;
    name: string;
    slug: string;
  };

  user: {
    id: string;
    email: string;
    username: string;
    fullName: string;
  };

  roles: Array<{
    id: string;
    code: string;
    name: string;
  }>;

  permissionCodes: string[];

  outlets: Array<{
    id: string;
    code: string;
    name: string;
    isPrimary: boolean;
  }>;
};

function hashSessionToken(token: string): string {
  return createHmac("sha256", serverEnv.SESSION_SECRET)
    .update(token)
    .digest("hex");
}

export async function getUserPermissionCodes(
  userId: string,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({
      code: permissions.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(userRoles.userId, userId), eq(roles.isActive, true)));

  return rows.map((row) => row.code);
}

export async function createUserSession({
  userId,
  ipAddress,
  userAgent,
}: CreateSessionInput): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  const tokenHash = hashSessionToken(token);

  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(userSessions).values({
    userId,
    tokenHash,
    expiresAt,
    lastSeenAt: new Date(),
    ipAddress: ipAddress?.slice(0, 64) ?? null,
    userAgent: userAgent ?? null,
  });

  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function getCurrentAuth(): Promise<AuthContext | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);

  const now = new Date();

  const sessionRows = await db
    .select({
      sessionId: userSessions.id,
      expiresAt: userSessions.expiresAt,

      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,

      userId: users.id,
      email: users.email,
      username: users.username,
      fullName: users.fullName,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .innerJoin(organizations, eq(users.organizationId, organizations.id))
    .where(
      and(
        eq(userSessions.tokenHash, tokenHash),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, now),
        eq(users.status, "active"),
        eq(organizations.isActive, true),
      ),
    )
    .limit(1);

  const session = sessionRows[0];

  if (!session) {
    return null;
  }

  const [roleRows, permissionCodes, outletRows] = await Promise.all([
    db
      .selectDistinct({
        id: roles.id,
        code: roles.code,
        name: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(eq(userRoles.userId, session.userId), eq(roles.isActive, true)),
      ),

    getUserPermissionCodes(session.userId),

    db
      .select({
        id: outlets.id,
        code: outlets.code,
        name: outlets.name,
        isPrimary: userOutlets.isPrimary,
      })
      .from(userOutlets)
      .innerJoin(outlets, eq(userOutlets.outletId, outlets.id))
      .where(
        and(eq(userOutlets.userId, session.userId), eq(outlets.isActive, true)),
      ),
  ]);

  return {
    session: {
      id: session.sessionId,
      expiresAt: session.expiresAt,
    },

    organization: {
      id: session.organizationId,
      name: session.organizationName,
      slug: session.organizationSlug,
    },

    user: {
      id: session.userId,
      email: session.email,
      username: session.username,
      fullName: session.fullName,
    },

    roles: roleRows,
    permissionCodes,
    outlets: outletRows,
  };
}

export function hasPermission(
  auth: AuthContext,
  permissionCode: string,
): boolean {
  return auth.permissionCodes.includes(permissionCode);
}

export function hasAnyPermission(
  auth: AuthContext,
  permissionCodes: readonly string[],
): boolean {
  return permissionCodes.some((permissionCode) =>
    hasPermission(auth, permissionCode),
  );
}

export function getDefaultRoute(permissionCodes: readonly string[]): string {
  if (permissionCodes.includes("admin.access")) {
    return "/admin";
  }

  if (permissionCodes.includes("pos.access")) {
    return "/pos";
  }

  return "/akses-ditolak";
}

export async function requireAnyPermission(
  permissionCodes: readonly string[],
): Promise<AuthContext> {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/login");
  }

  if (!hasAnyPermission(auth, permissionCodes)) {
    redirect("/akses-ditolak");
  }

  return auth;
}

export async function requirePermission(
  permissionCode: string,
): Promise<AuthContext> {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/login");
  }

  if (!hasPermission(auth, permissionCode)) {
    if (
      permissionCode === "admin.access" &&
      hasPermission(auth, "pos.access")
    ) {
      redirect("/pos");
    }

    if (
      permissionCode === "pos.access" &&
      hasPermission(auth, "admin.access")
    ) {
      redirect("/admin");
    }

    redirect("/akses-ditolak");
  }

  return auth;
}

export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const tokenHash = hashSessionToken(token);

    await db
      .update(userSessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userSessions.tokenHash, tokenHash),
          isNull(userSessions.revokedAt),
        ),
      );
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
