import type {
  NotificationAntiSpamOptions,
  NotificationSeverity,
  NotificationType,
} from "@/features/notifications/contracts";
import {
  mapLegacyNotificationTypeToCategory,
} from "@/features/notifications/contracts";
import {
  publishNotificationEvent,
  resolveNotificationEventsByEntity,
} from "@/features/notifications/event-service";

type CreateAdminNotificationInput = {
  organizationId: string;
  outletId?: string | null;
  userId?: string | null;
  type: NotificationType;
  eventType?: string;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  dedupeUnread?: boolean;
  deduplicationKey?: string | null;
  requiresAction?: boolean;
  recipientPermissionCodes?: string[];
  excludeUserIds?: string[];
  antiSpam?: NotificationAntiSpamOptions;
};

function createLegacyDedupeKey({
  type,
  eventType,
  entityType,
  entityId,
  title,
}: Pick<
  CreateAdminNotificationInput,
  "type" | "eventType" | "entityType" | "entityId" | "title"
>) {
  return [
    "legacy",
    eventType ?? type,
    entityType ?? "none",
    entityId ?? title.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80),
  ]
    .join(":")
    .slice(0, 220);
}

/**
 * Compatibility facade for existing notification producers. New modules should
 * call publishNotificationEvent directly and provide an explicit eventType and
 * recipient selector.
 */
export async function createAdminNotification({
  organizationId,
  outletId = null,
  userId = null,
  type,
  eventType,
  severity = "info",
  title,
  message,
  entityType = null,
  entityId = null,
  actionUrl = null,
  metadata = {},
  dedupeUnread = false,
  deduplicationKey = null,
  requiresAction = false,
  recipientPermissionCodes,
  excludeUserIds,
  antiSpam,
}: CreateAdminNotificationInput) {
  const resolvedEventType = (
    eventType ?? `${type}.${entityType ?? "general"}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_");

  return publishNotificationEvent({
    organizationId,
    outletId,
    category: mapLegacyNotificationTypeToCategory(type),
    eventType: resolvedEventType,
    severity,
    title,
    summary: message,
    entityType,
    entityId,
    actionUrl,
    requiresAction,
    payload: metadata,
    deduplicationKey:
      deduplicationKey ??
      (dedupeUnread
        ? createLegacyDedupeKey({
            type,
            eventType: resolvedEventType,
            entityType,
            entityId,
            title,
          })
        : null),
    antiSpam,
    recipients: userId
      ? {
          userIds: [userId],
          excludeUserIds,
        }
      : {
          requiredAnyPermissionCodes:
            recipientPermissionCodes ?? ["admin.access"],
          excludeUserIds,
        },
  });
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
  return resolveNotificationEventsByEntity({
    organizationId,
    category: type ? mapLegacyNotificationTypeToCategory(type) : undefined,
    entityType,
    entityId,
  });
}
