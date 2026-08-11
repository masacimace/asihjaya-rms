import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  organizations,
  outlets,
  productBatchImportSessions,
  userOutlets,
  users,
} from "@/db/schema";
import {
  getUserPermissionCodes,
  type AuthContext,
} from "@/lib/auth/session";

export async function loadProductBatchImportTestAuth(sessionId: string) {
  const [row] = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      organizationTimezone: organizations.timezone,
      userId: users.id,
      email: users.email,
      username: users.username,
      fullName: users.fullName,
    })
    .from(productBatchImportSessions)
    .innerJoin(
      organizations,
      eq(productBatchImportSessions.organizationId, organizations.id),
    )
    .innerJoin(users, eq(productBatchImportSessions.createdByUserId, users.id))
    .where(eq(productBatchImportSessions.id, sessionId))
    .limit(1);

  if (!row) throw new Error("Session Product Batch Import tidak ditemukan.");

  const [permissionCodes, outletRows] = await Promise.all([
    getUserPermissionCodes(row.userId),
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
        and(
          eq(userOutlets.userId, row.userId),
          eq(outlets.organizationId, row.organizationId),
          eq(outlets.isActive, true),
        ),
      ),
  ]);

  const auth: AuthContext = {
    session: {
      id: sessionId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    organization: {
      id: row.organizationId,
      name: row.organizationName,
      slug: row.organizationSlug,
      timezone: row.organizationTimezone,
    },
    user: {
      id: row.userId,
      email: row.email,
      username: row.username,
      fullName: row.fullName,
    },
    roles: [],
    permissionCodes,
    outlets: outletRows,
  };

  return auth;
}
