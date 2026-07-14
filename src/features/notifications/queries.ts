import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  notificationEvents,
  notificationRecipients,
  outlets,
} from "@/db/schema";
import {
  ADMIN_NOTIFICATION_DRAWER_LIMIT,
  mapCategoryToLegacyNotificationType,
  type AdminNotificationDrawerData,
  type AdminNotificationRow,
} from "@/features/notifications/contracts";
import { syncHardwareAgentHealthNotifications } from "@/features/notifications/hardware";
import type { AuthContext } from "@/lib/auth/session";

function getAccessibleNotificationCondition(auth: AuthContext): SQL<unknown> {
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const outletCondition =
    outletIds.length > 0
      ? or(
          isNull(notificationEvents.outletId),
          inArray(notificationEvents.outletId, outletIds),
        )!
      : isNull(notificationEvents.outletId);

  return and(
    eq(notificationEvents.organizationId, auth.organization.id),
    eq(notificationRecipients.userId, auth.user.id),
    outletCondition,
    ne(notificationRecipients.status, "archived"),
  )!;
}

function mapNotificationRow(row: {
  recipientId: string;
  eventId: string;
  category: AdminNotificationRow["category"];
  eventType: string;
  severity: AdminNotificationRow["severity"];
  title: string;
  summary: string;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  outletCode: string | null;
  outletName: string | null;
  status: AdminNotificationRow["status"];
  requiresAction: boolean;
  occurredAt: Date;
}): AdminNotificationRow {
  return {
    id: row.recipientId,
    eventId: row.eventId,
    type: mapCategoryToLegacyNotificationType({
      category: row.category,
      eventType: row.eventType,
    }),
    category: row.category,
    eventType: row.eventType,
    severity: row.severity,
    title: row.title,
    message: row.summary,
    actionUrl: row.actionUrl,
    entityType: row.entityType,
    entityId: row.entityId,
    outletCode: row.outletCode,
    outletName: row.outletName,
    status: row.status,
    isRead: row.status !== "unread",
    requiresAction: row.requiresAction,
    createdAtIso: row.occurredAt.toISOString(),
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
      .from(notificationRecipients)
      .innerJoin(
        notificationEvents,
        eq(notificationRecipients.eventId, notificationEvents.id),
      )
      .where(and(baseCondition, eq(notificationRecipients.status, "unread"))),

    db
      .select({
        recipientId: notificationRecipients.id,
        eventId: notificationEvents.id,
        category: notificationEvents.category,
        eventType: notificationEvents.eventType,
        severity: notificationEvents.severity,
        title: notificationEvents.title,
        summary: notificationEvents.summary,
        actionUrl: notificationEvents.actionUrl,
        entityType: notificationEvents.entityType,
        entityId: notificationEvents.entityId,
        outletCode: outlets.code,
        outletName: outlets.name,
        status: notificationRecipients.status,
        requiresAction: notificationEvents.requiresAction,
        occurredAt: notificationEvents.occurredAt,
      })
      .from(notificationRecipients)
      .innerJoin(
        notificationEvents,
        eq(notificationRecipients.eventId, notificationEvents.id),
      )
      .leftJoin(outlets, eq(notificationEvents.outletId, outlets.id))
      .where(baseCondition)
      .orderBy(desc(notificationEvents.occurredAt))
      .limit(ADMIN_NOTIFICATION_DRAWER_LIMIT),
  ]);

  return {
    unreadCount: unreadRows[0]?.value ?? 0,
    latest: latestRows.map(mapNotificationRow),
  };
}
