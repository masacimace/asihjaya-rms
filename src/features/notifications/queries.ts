import { and, count, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { notifications, outlets } from "@/db/schema";
import {
  ADMIN_NOTIFICATION_DRAWER_LIMIT,
  type AdminNotificationDrawerData,
  type AdminNotificationRow,
} from "@/features/notifications/contracts";
import { syncHardwareAgentHealthNotifications } from "@/features/notifications/hardware";
import type { AuthContext } from "@/lib/auth/session";

function getAccessibleNotificationCondition(auth: AuthContext): SQL<unknown> {
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const outletCondition = outletIds.length > 0
    ? or(isNull(notifications.outletId), inArray(notifications.outletId, outletIds))!
    : isNull(notifications.outletId);

  return and(
    eq(notifications.organizationId, auth.organization.id),
    outletCondition,
    or(isNull(notifications.userId), eq(notifications.userId, auth.user.id))!,
  )!;
}

function mapNotificationRow(row: {
  id: string;
  type: AdminNotificationRow["type"];
  severity: AdminNotificationRow["severity"];
  title: string;
  message: string;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  outletCode: string | null;
  outletName: string | null;
  isRead: boolean;
  createdAt: Date;
}): AdminNotificationRow {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    actionUrl: row.actionUrl,
    entityType: row.entityType,
    entityId: row.entityId,
    outletCode: row.outletCode,
    outletName: row.outletName,
    isRead: row.isRead,
    createdAtIso: row.createdAt.toISOString(),
  };
}

export async function getAdminNotificationDrawerData(
  auth: AuthContext,
): Promise<AdminNotificationDrawerData> {
  await syncHardwareAgentHealthNotifications(auth);

  const baseCondition = getAccessibleNotificationCondition(auth);

  const [unreadRows, latestRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(baseCondition, eq(notifications.isRead, false))),

    db
      .select({
        id: notifications.id,
        type: notifications.type,
        severity: notifications.severity,
        title: notifications.title,
        message: notifications.message,
        actionUrl: notifications.actionUrl,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
        outletCode: outlets.code,
        outletName: outlets.name,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .leftJoin(outlets, eq(notifications.outletId, outlets.id))
      .where(baseCondition)
      .orderBy(desc(notifications.createdAt))
      .limit(ADMIN_NOTIFICATION_DRAWER_LIMIT),
  ]);

  return {
    unreadCount: unreadRows[0]?.value ?? 0,
    latest: latestRows.map(mapNotificationRow),
  };
}
