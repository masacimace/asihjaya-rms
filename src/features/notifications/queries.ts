import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
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
  ADMIN_NOTIFICATION_PAGE_SIZE,
  mapCategoryToLegacyNotificationType,
  type AdminNotificationDrawerData,
  type AdminNotificationFilters,
  type AdminNotificationPageData,
  type AdminNotificationRow,
} from "@/features/notifications/contracts";
import {
  syncHardwareAgentHealthNotifications,
  syncHardwareJobOperationalNotifications,
} from "@/features/notifications/hardware";
import { runNotificationMaintenanceForOrganization } from "@/features/notifications/maintenance";
import type { AuthContext } from "@/lib/auth/session";

const ACTIONABLE_RECIPIENT_STATUSES = [
  "unread",
  "read",
  "acknowledged",
] as const;

function getAccessibleNotificationCondition(
  auth: AuthContext,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): SQL<unknown> {
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
    includeArchived ? undefined : ne(notificationRecipients.status, "archived"),
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
  payload: Record<string, unknown>;
  eventResolvedAt: Date | null;
  occurredAt: Date;
}): AdminNotificationRow {
  const isActionable =
    row.requiresAction &&
    row.eventResolvedAt == null &&
    ACTIONABLE_RECIPIENT_STATUSES.includes(
      row.status as (typeof ACTIONABLE_RECIPIENT_STATUSES)[number],
    );

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
    isActionable,
    payload: row.payload ?? {},
    resolvedAtIso: row.eventResolvedAt?.toISOString() ?? null,
    createdAtIso: row.occurredAt.toISOString(),
  };
}

export async function getAdminNotificationDrawerData(
  auth: AuthContext,
): Promise<AdminNotificationDrawerData> {
  await Promise.all([
    syncHardwareAgentHealthNotifications(auth),
    syncHardwareJobOperationalNotifications(auth),
  ]);
  await runNotificationMaintenanceForOrganization(auth.organization.id);

  const baseCondition = getAccessibleNotificationCondition(auth);

  const [unreadRows, actionableRows, latestRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(notificationRecipients)
      .innerJoin(
        notificationEvents,
        eq(notificationRecipients.eventId, notificationEvents.id),
      )
      .where(and(baseCondition, eq(notificationRecipients.status, "unread"))),

    db
      .select({ value: count() })
      .from(notificationRecipients)
      .innerJoin(
        notificationEvents,
        eq(notificationRecipients.eventId, notificationEvents.id),
      )
      .where(
        and(
          baseCondition,
          eq(notificationEvents.requiresAction, true),
          isNull(notificationEvents.resolvedAt),
          inArray(
            notificationRecipients.status,
            ACTIONABLE_RECIPIENT_STATUSES,
          ),
        ),
      ),

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
        payload: notificationEvents.payload,
        eventResolvedAt: notificationEvents.resolvedAt,
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
    actionableCount: actionableRows[0]?.value ?? 0,
    latest: latestRows.map(mapNotificationRow),
  };
}

function jakartaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatPeriodDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function startOfJakartaDate(value: string) {
  return new Date(`${value}T00:00:00+07:00`);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function getNotificationRangeBounds(filters: AdminNotificationFilters) {
  if (filters.range === "all") {
    return { start: null, end: null, label: "Semua waktu" };
  }

  if (filters.range === "custom") {
    const from = filters.from ? startOfJakartaDate(filters.from) : null;
    const to = filters.to ? addDays(startOfJakartaDate(filters.to), 1) : null;

    if (from && to && from >= to) {
      return {
        start: from,
        end: addDays(from, 1),
        label: formatPeriodDate(from),
      };
    }

    const label =
      from && to
        ? `${formatPeriodDate(from)} – ${formatPeriodDate(addDays(to, -1))}`
        : from
          ? `Mulai ${formatPeriodDate(from)}`
          : to
            ? `Sampai ${formatPeriodDate(addDays(to, -1))}`
            : "Semua waktu";

    return { start: from, end: to, label };
  }

  const today = startOfJakartaDate(jakartaDateString());
  const days =
    filters.range === "today"
      ? 1
      : filters.range === "7d"
        ? 7
        : filters.range === "90d"
          ? 90
          : 30;
  const start = addDays(today, -(days - 1));
  const end = addDays(today, 1);

  return {
    start,
    end,
    label:
      filters.range === "today"
        ? "Hari ini"
        : `${formatPeriodDate(start)} – ${formatPeriodDate(today)}`,
  };
}

function getPageOutletCondition(
  auth: AuthContext,
  outletId: string | null,
): SQL<unknown> {
  const accessibleOutletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletId) {
    return accessibleOutletIds.includes(outletId)
      ? eq(notificationEvents.outletId, outletId)
      : sql`false`;
  }

  return accessibleOutletIds.length > 0
    ? or(
        isNull(notificationEvents.outletId),
        inArray(notificationEvents.outletId, accessibleOutletIds),
      )!
    : isNull(notificationEvents.outletId);
}

function createNotificationPageBaseConditions({
  auth,
  filters,
}: {
  auth: AuthContext;
  filters: AdminNotificationFilters;
}) {
  const conditions: SQL[] = [
    eq(notificationEvents.organizationId, auth.organization.id),
    eq(notificationRecipients.userId, auth.user.id),
    getPageOutletCondition(auth, filters.outletId),
  ];

  if (filters.category !== "all") {
    conditions.push(eq(notificationEvents.category, filters.category));
  }

  if (filters.severity !== "all") {
    conditions.push(eq(notificationEvents.severity, filters.severity));
  }

  const range = getNotificationRangeBounds(filters);
  if (range.start) conditions.push(gte(notificationEvents.occurredAt, range.start));
  if (range.end) conditions.push(lt(notificationEvents.occurredAt, range.end));

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(notificationEvents.title, pattern),
        ilike(notificationEvents.summary, pattern),
        ilike(notificationEvents.eventType, pattern),
        ilike(notificationEvents.entityId, pattern),
        ilike(outlets.code, pattern),
        ilike(outlets.name, pattern),
      )!,
    );
  }

  return { conditions, periodLabel: range.label };
}

function getNotificationPageStatusCondition(
  status: AdminNotificationFilters["status"],
): SQL<unknown> {
  if (status === "unread") {
    return eq(notificationRecipients.status, "unread");
  }

  if (status === "read") {
    return inArray(notificationRecipients.status, ["read", "acknowledged"]);
  }

  if (status === "actionable") {
    return and(
      ne(notificationRecipients.status, "archived"),
      eq(notificationEvents.requiresAction, true),
      isNull(notificationEvents.resolvedAt),
      inArray(notificationRecipients.status, ACTIONABLE_RECIPIENT_STATUSES),
    )!;
  }

  if (status === "resolved") {
    return and(
      ne(notificationRecipients.status, "archived"),
      or(
        eq(notificationRecipients.status, "resolved"),
        isNotNull(notificationEvents.resolvedAt),
      ),
    )!;
  }

  if (status === "archived") {
    return eq(notificationRecipients.status, "archived");
  }

  return ne(notificationRecipients.status, "archived");
}

const pageRowSelection = {
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
  payload: notificationEvents.payload,
  eventResolvedAt: notificationEvents.resolvedAt,
  occurredAt: notificationEvents.occurredAt,
};

async function countNotifications(whereClause: SQL<unknown>) {
  const rows = await db
    .select({ value: count() })
    .from(notificationRecipients)
    .innerJoin(
      notificationEvents,
      eq(notificationRecipients.eventId, notificationEvents.id),
    )
    .leftJoin(outlets, eq(notificationEvents.outletId, outlets.id))
    .where(whereClause);

  return rows[0]?.value ?? 0;
}

export async function getAdminNotificationPageData(
  auth: AuthContext,
  filters: AdminNotificationFilters,
): Promise<AdminNotificationPageData> {
  await Promise.all([
    syncHardwareAgentHealthNotifications(auth),
    syncHardwareJobOperationalNotifications(auth),
  ]);
  await runNotificationMaintenanceForOrganization(auth.organization.id);

  const { conditions, periodLabel } = createNotificationPageBaseConditions({
    auth,
    filters,
  });
  const baseWhere = and(...conditions)!;
  const filteredWhere = and(
    baseWhere,
    getNotificationPageStatusCondition(filters.status),
  )!;

  const [totalCount, total, unread, actionable, resolved, archived] =
    await Promise.all([
      countNotifications(filteredWhere),
      countNotifications(
        and(baseWhere, ne(notificationRecipients.status, "archived"))!,
      ),
      countNotifications(
        and(baseWhere, eq(notificationRecipients.status, "unread"))!,
      ),
      countNotifications(
        and(
          baseWhere,
          ne(notificationRecipients.status, "archived"),
          eq(notificationEvents.requiresAction, true),
          isNull(notificationEvents.resolvedAt),
          inArray(notificationRecipients.status, ACTIONABLE_RECIPIENT_STATUSES),
        )!,
      ),
      countNotifications(
        and(
          baseWhere,
          ne(notificationRecipients.status, "archived"),
          or(
            eq(notificationRecipients.status, "resolved"),
            isNotNull(notificationEvents.resolvedAt),
          ),
        )!,
      ),
      countNotifications(
        and(baseWhere, eq(notificationRecipients.status, "archived"))!,
      ),
    ]);

  const pageCount = Math.max(
    1,
    Math.ceil(totalCount / ADMIN_NOTIFICATION_PAGE_SIZE),
  );
  const page = Math.min(filters.page, pageCount);

  const rows = await db
    .select(pageRowSelection)
    .from(notificationRecipients)
    .innerJoin(
      notificationEvents,
      eq(notificationRecipients.eventId, notificationEvents.id),
    )
    .leftJoin(outlets, eq(notificationEvents.outletId, outlets.id))
    .where(filteredWhere)
    .orderBy(desc(notificationEvents.occurredAt), desc(notificationRecipients.id))
    .limit(ADMIN_NOTIFICATION_PAGE_SIZE)
    .offset((page - 1) * ADMIN_NOTIFICATION_PAGE_SIZE);

  return {
    filters: { ...filters, page },
    rows: rows.map(mapNotificationRow),
    outlets: auth.outlets.map(({ id, code, name }) => ({ id, code, name })),
    summary: { total, unread, actionable, resolved, archived },
    totalCount,
    page,
    pageCount,
    pageSize: ADMIN_NOTIFICATION_PAGE_SIZE,
    periodLabel,
  };
}

