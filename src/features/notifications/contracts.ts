export const ADMIN_NOTIFICATION_DRAWER_LIMIT = 40;
export const ADMIN_NOTIFICATION_PAGE_SIZE = 20;

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

export type NotificationDrawerFilter = "all" | "actionable" | "unread";

export type NotificationAntiSpamOptions = {
  /** Keep the existing active event and ignore an idempotent duplicate. */
  mode?: "dedupe" | "aggregate";
  /** Stable occurrence identifier used to avoid counting the same retry twice. */
  occurrenceId?: string | null;
  /** Re-open recipient rows when a genuinely new occurrence is aggregated. */
  reNotifyRecipients?: boolean;
};

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
  antiSpam?: NotificationAntiSpamOptions;
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
  isActionable: boolean;
  payload: Record<string, unknown>;
  resolvedAtIso: string | null;
  createdAtIso: string;
};

export type AdminNotificationDrawerData = {
  unreadCount: number;
  actionableCount: number;
  latest: AdminNotificationRow[];
};


export const adminNotificationCategories = [
  "sales",
  "payment",
  "cash_shift",
  "inventory_return",
  "hardware",
  "security",
  "system",
  "approval_result",
] as const;

export const adminNotificationSeverities = [
  "info",
  "success",
  "warning",
  "critical",
] as const;

export const adminNotificationPageStatuses = [
  "all",
  "unread",
  "read",
  "actionable",
  "resolved",
  "archived",
] as const;

export const adminNotificationDateRanges = [
  "today",
  "7d",
  "30d",
  "90d",
  "all",
  "custom",
] as const;

export type AdminNotificationPageStatus =
  (typeof adminNotificationPageStatuses)[number];
export type AdminNotificationDateRange =
  (typeof adminNotificationDateRanges)[number];

export type AdminNotificationFilters = {
  search: string;
  category: NotificationCategory | "all";
  severity: NotificationSeverity | "all";
  status: AdminNotificationPageStatus;
  outletId: string | null;
  range: AdminNotificationDateRange;
  from: string | null;
  to: string | null;
  page: number;
};

export type AdminNotificationPageSummary = {
  total: number;
  unread: number;
  actionable: number;
  resolved: number;
  archived: number;
};

export type AdminNotificationPageData = {
  filters: AdminNotificationFilters;
  rows: AdminNotificationRow[];
  outlets: Array<{ id: string; code: string; name: string }>;
  summary: AdminNotificationPageSummary;
  totalCount: number;
  page: number;
  pageCount: number;
  pageSize: number;
  periodLabel: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isIsoDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function parseAdminNotificationFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminNotificationFilters {
  const category = readSearchParam(searchParams, "category").trim();
  const severity = readSearchParam(searchParams, "severity").trim();
  const status = readSearchParam(searchParams, "status").trim();
  const range = readSearchParam(searchParams, "range").trim();
  const outletId = readSearchParam(searchParams, "outletId").trim();
  const from = readSearchParam(searchParams, "from").trim();
  const to = readSearchParam(searchParams, "to").trim();
  const page = Number.parseInt(readSearchParam(searchParams, "page"), 10);

  return {
    search: readSearchParam(searchParams, "q").trim().slice(0, 160),
    category: adminNotificationCategories.includes(
      category as NotificationCategory,
    )
      ? (category as NotificationCategory)
      : "all",
    severity: adminNotificationSeverities.includes(
      severity as NotificationSeverity,
    )
      ? (severity as NotificationSeverity)
      : "all",
    status: adminNotificationPageStatuses.includes(
      status as AdminNotificationPageStatus,
    )
      ? (status as AdminNotificationPageStatus)
      : "all",
    outletId: UUID_PATTERN.test(outletId) ? outletId : null,
    range: adminNotificationDateRanges.includes(
      range as AdminNotificationDateRange,
    )
      ? (range as AdminNotificationDateRange)
      : "30d",
    from: isIsoDate(from) ? from : null,
    to: isIsoDate(to) ? to : null,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

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
