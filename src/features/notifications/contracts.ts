export const ADMIN_NOTIFICATION_DRAWER_LIMIT = 12;

/**
 * Legacy presentation type used by the current drawer. Notification Center V1-D
 * will render the richer category/eventType fields directly.
 */
export type NotificationType =
  "sales" | "hardware" | "shift" | "cash" | "inventory" | "system";

export type NotificationCategory =
  | "sales"
  | "payment"
  | "cash_shift"
  | "inventory_return"
  | "hardware"
  | "security"
  | "system"
  | "approval_result";

export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type NotificationRecipientStatus =
  "unread" | "read" | "acknowledged" | "resolved" | "archived";

export type NotificationRecipientTarget = {
  /** Explicit recipients, still restricted to the same organization/outlet. */
  userIds?: string[];
  /** A user is selected when they have at least one of these permissions. */
  requiredAnyPermissionCodes?: string[];
  /** Built-in/custom roles selected across the whole organization. */
  organizationRoleCodes?: string[];
  /** Roles selected only when the user is assigned to the event outlet. */
  outletRoleCodes?: string[];
  /** Actor or other users that must not receive the event. */
  excludeUserIds?: string[];
};

export type PublishNotificationEventInput = {
  organizationId: string;
  outletId?: string | null;
  category: NotificationCategory;
  eventType: string;
  severity?: NotificationSeverity;
  title: string;
  summary: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  requiresAction?: boolean;
  payload?: Record<string, unknown>;
  deduplicationKey?: string | null;
  occurredAt?: Date;
  recipients?: NotificationRecipientTarget;
};

export type PublishedNotificationEvent = {
  eventId: string;
  created: boolean;
  recipientCount: number;
};

export type AdminNotificationRow = {
  /** Recipient ID. Per-user actions must never use the shared event ID. */
  id: string;
  eventId: string;
  type: NotificationType;
  category: NotificationCategory;
  eventType: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  outletCode: string | null;
  outletName: string | null;
  status: NotificationRecipientStatus;
  isRead: boolean;
  requiresAction: boolean;
  createdAtIso: string;
};

export type AdminNotificationDrawerData = {
  unreadCount: number;
  latest: AdminNotificationRow[];
};

export function mapLegacyNotificationTypeToCategory(
  type: NotificationType,
): NotificationCategory {
  if (type === "cash" || type === "shift") return "cash_shift";
  if (type === "inventory") return "inventory_return";
  return type;
}

export function mapCategoryToLegacyNotificationType({
  category,
  eventType,
}: {
  category: NotificationCategory;
  eventType: string;
}): NotificationType {
  if (category === "cash_shift") {
    return eventType.includes("shift") ? "shift" : "cash";
  }
  if (category === "inventory_return") return "inventory";
  if (
    category === "sales" ||
    category === "hardware" ||
    category === "system"
  ) {
    return category;
  }
  return "system";
}
