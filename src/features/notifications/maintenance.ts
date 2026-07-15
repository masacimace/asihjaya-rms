import { and, eq, inArray, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { notificationEvents, notificationRecipients } from "@/db/schema";

const DEFAULT_SUCCESS_AUTO_RESOLVE_DAYS = 7;
const DEFAULT_INFO_AUTO_RESOLVE_DAYS = 14;
const DEFAULT_WARNING_AUTO_RESOLVE_DAYS = 30;
const DEFAULT_RESOLVED_AUTO_ARCHIVE_DAYS = 30;
const DEFAULT_MAINTENANCE_INTERVAL_MINUTES = 5;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 365;
const MIN_MAINTENANCE_INTERVAL_MINUTES = 1;
const MAX_MAINTENANCE_INTERVAL_MINUTES = 60;

const lastMaintenanceRunByOrganization = new Map<string, number>();

type NotificationMaintenanceResult = {
  resolvedEventCount: number;
  resolvedRecipientCount: number;
  archivedRecipientCount: number;
  skipped: boolean;
};

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function getMaintenancePolicy() {
  return {
    successDays: readBoundedInteger(
      process.env.NOTIFICATION_SUCCESS_AUTO_RESOLVE_DAYS,
      DEFAULT_SUCCESS_AUTO_RESOLVE_DAYS,
      MIN_RETENTION_DAYS,
      MAX_RETENTION_DAYS,
    ),
    infoDays: readBoundedInteger(
      process.env.NOTIFICATION_INFO_AUTO_RESOLVE_DAYS,
      DEFAULT_INFO_AUTO_RESOLVE_DAYS,
      MIN_RETENTION_DAYS,
      MAX_RETENTION_DAYS,
    ),
    warningDays: readBoundedInteger(
      process.env.NOTIFICATION_WARNING_AUTO_RESOLVE_DAYS,
      DEFAULT_WARNING_AUTO_RESOLVE_DAYS,
      MIN_RETENTION_DAYS,
      MAX_RETENTION_DAYS,
    ),
    resolvedArchiveDays: readBoundedInteger(
      process.env.NOTIFICATION_RESOLVED_AUTO_ARCHIVE_DAYS,
      DEFAULT_RESOLVED_AUTO_ARCHIVE_DAYS,
      MIN_RETENTION_DAYS,
      MAX_RETENTION_DAYS,
    ),
    intervalMinutes: readBoundedInteger(
      process.env.NOTIFICATION_MAINTENANCE_INTERVAL_MINUTES,
      DEFAULT_MAINTENANCE_INTERVAL_MINUTES,
      MIN_MAINTENANCE_INTERVAL_MINUTES,
      MAX_MAINTENANCE_INTERVAL_MINUTES,
    ),
  };
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 86_400_000);
}

/**
 * Lightweight opportunistic maintenance. It never auto-resolves actionable or
 * critical events. Those must be closed by the business workflow that created
 * them. Informational events are aged out and resolved recipients are archived
 * without deleting the shared audit event.
 */
export async function runNotificationMaintenanceForOrganization(
  organizationId: string,
  { force = false }: { force?: boolean } = {},
): Promise<NotificationMaintenanceResult> {
  const policy = getMaintenancePolicy();
  const now = new Date();
  const lastRun = lastMaintenanceRunByOrganization.get(organizationId) ?? 0;
  const intervalMs = policy.intervalMinutes * 60_000;

  if (!force && now.getTime() - lastRun < intervalMs) {
    return {
      resolvedEventCount: 0,
      resolvedRecipientCount: 0,
      archivedRecipientCount: 0,
      skipped: true,
    };
  }

  const result = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`notification-maintenance:${organizationId}`}, 0))`,
    );

    const resolvedEvents = await transaction
      .update(notificationEvents)
      .set({
        resolvedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(notificationEvents.organizationId, organizationId),
          eq(notificationEvents.requiresAction, false),
          sql`${notificationEvents.resolvedAt} is null`,
          or(
            and(
              eq(notificationEvents.severity, "success"),
              lt(
                notificationEvents.occurredAt,
                subtractDays(now, policy.successDays),
              ),
            ),
            and(
              eq(notificationEvents.severity, "info"),
              lt(
                notificationEvents.occurredAt,
                subtractDays(now, policy.infoDays),
              ),
            ),
            and(
              eq(notificationEvents.severity, "warning"),
              lt(
                notificationEvents.occurredAt,
                subtractDays(now, policy.warningDays),
              ),
            ),
          )!,
        ),
      )
      .returning({ id: notificationEvents.id });

    const resolvedEventIds = resolvedEvents.map((event) => event.id);
    let resolvedRecipientCount = 0;

    if (resolvedEventIds.length > 0) {
      const resolvedRecipients = await transaction
        .update(notificationRecipients)
        .set({
          status: "resolved",
          readAt: sql`coalesce(${notificationRecipients.readAt}, ${now})`,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            inArray(notificationRecipients.eventId, resolvedEventIds),
            inArray(notificationRecipients.status, [
              "unread",
              "read",
              "acknowledged",
            ]),
          ),
        )
        .returning({ id: notificationRecipients.id });

      resolvedRecipientCount = resolvedRecipients.length;
    }

    const recipientRowsToArchive = await transaction
      .select({ id: notificationRecipients.id })
      .from(notificationRecipients)
      .innerJoin(
        notificationEvents,
        eq(notificationRecipients.eventId, notificationEvents.id),
      )
      .where(
        and(
          eq(notificationEvents.organizationId, organizationId),
          eq(notificationRecipients.status, "resolved"),
          lt(
            notificationRecipients.resolvedAt,
            subtractDays(now, policy.resolvedArchiveDays),
          ),
        ),
      );

    const recipientIdsToArchive = recipientRowsToArchive.map((row) => row.id);
    let archivedRecipientCount = 0;

    if (recipientIdsToArchive.length > 0) {
      const archivedRecipients = await transaction
        .update(notificationRecipients)
        .set({
          status: "archived",
          archivedAt: now,
          updatedAt: now,
        })
        .where(inArray(notificationRecipients.id, recipientIdsToArchive))
        .returning({ id: notificationRecipients.id });

      archivedRecipientCount = archivedRecipients.length;
    }

    return {
      resolvedEventCount: resolvedEventIds.length,
      resolvedRecipientCount,
      archivedRecipientCount,
      skipped: false,
    };
  });

  lastMaintenanceRunByOrganization.set(organizationId, now.getTime());
  return result;
}
