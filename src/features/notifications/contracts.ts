export const ADMIN_NOTIFICATION_DRAWER_LIMIT = 12;

export type NotificationType =
  | "sales"
  | "hardware"
  | "shift"
  | "cash"
  | "inventory"
  | "system";

export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type AdminNotificationRow = {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  outletCode: string | null;
  outletName: string | null;
  isRead: boolean;
  createdAtIso: string;
};

export type AdminNotificationDrawerData = {
  unreadCount: number;
  latest: AdminNotificationRow[];
};
