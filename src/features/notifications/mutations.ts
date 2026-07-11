import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import type {
  NotificationSeverity,
  NotificationType,
} from "@/features/notifications/contracts";

type CreateAdminNotificationInput = {
  organizationId: string;
  outletId?: string | null;
  userId?: string | null;
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  dedupeUnread?: boolean;
};

export async function createAdminNotification({
  organizationId,
  outletId = null,
  userId = null,
  type,
  severity = "info",
  title,
  message,
  entityType = null,
  entityId = null,
  actionUrl = null,
  metadata = {},
  dedupeUnread = false,
}: CreateAdminNotificationInput) {
  const trimmedTitle = title.trim().slice(0, 160);
  const trimmedMessage = message.trim();

  if (!trimmedTitle || !trimmedMessage) {
    return null;
  }

  if (dedupeUnread) {
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.organizationId, organizationId),
          outletId ? eq(notifications.outletId, outletId) : isNull(notifications.outletId),
          userId ? eq(notifications.userId, userId) : isNull(notifications.userId),
          eq(notifications.type, type),
          eq(notifications.title, trimmedTitle),
          entityType
            ? eq(notifications.entityType, entityType)
            : isNull(notifications.entityType),
          entityId
            ? eq(notifications.entityId, entityId)
            : isNull(notifications.entityId),
          eq(notifications.isRead, false),
        ),
      )
      .limit(1);

    if (existing) {
      return existing;
    }
  }

  const [created] = await db
    .insert(notifications)
    .values({
      organizationId,
      outletId,
      userId,
      type,
      severity,
      title: trimmedTitle,
      message: trimmedMessage,
      entityType,
      entityId,
      actionUrl,
      metadata,
      isRead: false,
    })
    .returning({ id: notifications.id });

  return created ?? null;
}

export async function markUnreadNotificationsReadByEntity({
  organizationId,
  type,
  entityType,
  entityId,
}: {
  organizationId: string;
  type?: NotificationType;
  entityType: string;
  entityId: string;
}) {
  const now = new Date();

  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        type ? eq(notifications.type, type) : undefined,
        eq(notifications.entityType, entityType),
        eq(notifications.entityId, entityId),
        eq(notifications.isRead, false),
      ),
    );
}
