import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  notificationEvents,
  notificationRecipients,
  permissions,
  rolePermissions,
  roles,
  userOutlets,
  userRoles,
  users,
} from "@/db/schema";
import type {
  NotificationCategory,
  NotificationRecipientTarget,
  PublishNotificationEventInput,
  PublishedNotificationEvent,
} from "@/features/notifications/contracts";

export type NotificationTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

const EVENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RECIPIENTS_PER_EVENT = 500;

function uniqueValidUuids(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()))].filter(
    (value) => UUID_PATTERN.test(value),
  );
}

function uniquePermissionCodes(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()))].filter(
    Boolean,
  );
}

function uniqueRoleCodes(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()))].filter(
    Boolean,
  );
}

function normalizeInput(input: PublishNotificationEventInput) {
  const title = input.title.trim().slice(0, 160);
  const summary = input.summary.trim();
  const eventType = input.eventType.trim().toLowerCase().slice(0, 120);
  const actionUrl = input.actionUrl?.trim().slice(0, 300) || null;
  const deduplicationKey = input.deduplicationKey?.trim().slice(0, 220) || null;

  if (!title || !summary) {
    throw new Error("Judul dan ringkasan notification event wajib diisi.");
  }
  if (!EVENT_TYPE_PATTERN.test(eventType)) {
    throw new Error("Event type notifikasi tidak valid.");
  }
  if (actionUrl && !actionUrl.startsWith("/")) {
    throw new Error("Action URL notifikasi harus berupa path internal.");
  }

  return {
    ...input,
    outletId: input.outletId ?? null,
    severity: input.severity ?? "info",
    title,
    summary,
    eventType,
    entityType: input.entityType?.trim().slice(0, 80) || null,
    entityId: input.entityId?.trim().slice(0, 160) || null,
    actionUrl,
    requiresAction: input.requiresAction ?? false,
    payload: input.payload ?? {},
    deduplicationKey,
    occurredAt: input.occurredAt ?? new Date(),
  };
}

async function resolveRecipientUserIds(
  transaction: NotificationTransaction,
  {
    organizationId,
    outletId,
    recipients,
  }: {
    organizationId: string;
    outletId: string | null;
    recipients?: NotificationRecipientTarget;
  },
) {
  const explicitUserIds = uniqueValidUuids(recipients?.userIds);
  const permissionCodes = uniquePermissionCodes(
    recipients?.requiredAnyPermissionCodes,
  );
  const organizationRoleCodes = uniqueRoleCodes(
    recipients?.organizationRoleCodes,
  );
  const outletRoleCodes = uniqueRoleCodes(recipients?.outletRoleCodes);
  const excludedUserIds = uniqueValidUuids(recipients?.excludeUserIds);
  const selectedUserIds = new Set<string>();

  // A generic operational event targets admin users by default only when
  // the caller did not provide an explicit selector at all.
  const hasExplicitSelector =
    recipients?.userIds !== undefined ||
    recipients?.requiredAnyPermissionCodes !== undefined ||
    recipients?.organizationRoleCodes !== undefined ||
    recipients?.outletRoleCodes !== undefined;
  const effectivePermissionCodes =
    !hasExplicitSelector &&
    explicitUserIds.length === 0 &&
    permissionCodes.length === 0 &&
    organizationRoleCodes.length === 0 &&
    outletRoleCodes.length === 0
      ? ["admin.access"]
      : permissionCodes;
  const exclusionCondition =
    excludedUserIds.length > 0
      ? notInArray(users.id, excludedUserIds)
      : undefined;

  if (explicitUserIds.length > 0) {
    const directRows = await transaction
      .selectDistinct({ id: users.id })
      .from(users)
      .leftJoin(userOutlets, eq(userOutlets.userId, users.id))
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.status, "active"),
          inArray(users.id, explicitUserIds),
          outletId ? eq(userOutlets.outletId, outletId) : undefined,
          exclusionCondition,
        ),
      );

    directRows.forEach((row) => selectedUserIds.add(row.id));
  }

  if (effectivePermissionCodes.length > 0) {
    const permissionRows = await transaction
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .leftJoin(userOutlets, eq(userOutlets.userId, users.id))
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.status, "active"),
          eq(roles.organizationId, organizationId),
          eq(roles.isActive, true),
          inArray(permissions.code, effectivePermissionCodes),
          outletId ? eq(userOutlets.outletId, outletId) : undefined,
          exclusionCondition,
        ),
      );

    permissionRows.forEach((row) => selectedUserIds.add(row.id));
  }

  if (organizationRoleCodes.length > 0) {
    const organizationRoleRows = await transaction
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.status, "active"),
          eq(roles.organizationId, organizationId),
          eq(roles.isActive, true),
          inArray(roles.code, organizationRoleCodes),
          exclusionCondition,
        ),
      );

    organizationRoleRows.forEach((row) => selectedUserIds.add(row.id));
  }

  if (outletRoleCodes.length > 0) {
    const outletRoleRows = await transaction
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(userOutlets, eq(userOutlets.userId, users.id))
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.status, "active"),
          eq(roles.organizationId, organizationId),
          eq(roles.isActive, true),
          inArray(roles.code, outletRoleCodes),
          outletId ? eq(userOutlets.outletId, outletId) : undefined,
          exclusionCondition,
        ),
      );

    outletRoleRows.forEach((row) => selectedUserIds.add(row.id));
  }

  const result = [...selectedUserIds];
  if (result.length > MAX_RECIPIENTS_PER_EVENT) {
    throw new Error(
      `Jumlah penerima notifikasi melebihi batas ${MAX_RECIPIENTS_PER_EVENT}.`,
    );
  }
  return result;
}

export async function publishNotificationEventInTransaction(
  transaction: NotificationTransaction,
  rawInput: PublishNotificationEventInput,
): Promise<PublishedNotificationEvent | null> {
  const input = normalizeInput(rawInput);

  if (input.deduplicationKey) {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`notification:${input.organizationId}:${input.deduplicationKey}`}, 0))`,
    );

    const [existing] = await transaction
      .select({ id: notificationEvents.id })
      .from(notificationEvents)
      .where(
        and(
          eq(notificationEvents.organizationId, input.organizationId),
          eq(notificationEvents.deduplicationKey, input.deduplicationKey),
          isNull(notificationEvents.resolvedAt),
        ),
      )
      .limit(1);

    if (existing) {
      const recipientUserIds = await resolveRecipientUserIds(
        transaction,
        input,
      );
      if (recipientUserIds.length > 0) {
        await transaction
          .insert(notificationRecipients)
          .values(
            recipientUserIds.map((userId) => ({
              eventId: existing.id,
              userId,
              status: "unread" as const,
            })),
          )
          .onConflictDoNothing();
      }

      return {
        eventId: existing.id,
        created: false,
        recipientCount: recipientUserIds.length,
      };
    }
  }

  const recipientUserIds = await resolveRecipientUserIds(transaction, input);
  if (recipientUserIds.length === 0) {
    return null;
  }

  const now = new Date();
  const [event] = await transaction
    .insert(notificationEvents)
    .values({
      organizationId: input.organizationId,
      outletId: input.outletId,
      category: input.category,
      eventType: input.eventType,
      severity: input.severity,
      title: input.title,
      summary: input.summary,
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl,
      requiresAction: input.requiresAction,
      payload: input.payload,
      deduplicationKey: input.deduplicationKey,
      occurredAt: input.occurredAt,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: notificationEvents.id });

  if (!event) {
    throw new Error("Notification event gagal dibuat.");
  }

  await transaction.insert(notificationRecipients).values(
    recipientUserIds.map((userId) => ({
      eventId: event.id,
      userId,
      status: "unread" as const,
      createdAt: now,
      updatedAt: now,
    })),
  );

  return {
    eventId: event.id,
    created: true,
    recipientCount: recipientUserIds.length,
  };
}

export async function publishNotificationEvent(
  input: PublishNotificationEventInput,
) {
  return db.transaction((transaction) =>
    publishNotificationEventInTransaction(transaction, input),
  );
}

export type ResolveNotificationEventsByEntityInput = {
  organizationId: string;
  category?: NotificationCategory;
  eventType?: string;
  entityType: string;
  entityId: string;
  resolvedAt?: Date;
};

export async function resolveNotificationEventsByEntityInTransaction(
  transaction: NotificationTransaction,
  {
    organizationId,
    category,
    eventType,
    entityType,
    entityId,
    resolvedAt = new Date(),
  }: ResolveNotificationEventsByEntityInput,
) {
  const eventRows = await transaction
    .select({ id: notificationEvents.id })
    .from(notificationEvents)
    .where(
      and(
        eq(notificationEvents.organizationId, organizationId),
        category ? eq(notificationEvents.category, category) : undefined,
        eventType ? eq(notificationEvents.eventType, eventType) : undefined,
        eq(notificationEvents.entityType, entityType),
        eq(notificationEvents.entityId, entityId),
        isNull(notificationEvents.resolvedAt),
      ),
    );

  const eventIds = eventRows.map((row) => row.id);
  if (eventIds.length === 0) return 0;

  await transaction
    .update(notificationEvents)
    .set({ resolvedAt, updatedAt: resolvedAt })
    .where(inArray(notificationEvents.id, eventIds));

  await transaction
    .update(notificationRecipients)
    .set({
      status: "resolved",
      readAt: sql`coalesce(${notificationRecipients.readAt}, ${resolvedAt})`,
      resolvedAt,
      updatedAt: resolvedAt,
    })
    .where(
      and(
        inArray(notificationRecipients.eventId, eventIds),
        inArray(notificationRecipients.status, [
          "unread",
          "read",
          "acknowledged",
        ]),
      ),
    );

  return eventIds.length;
}

export async function resolveNotificationEventsByEntity(
  input: ResolveNotificationEventsByEntityInput,
) {
  return db.transaction((transaction) =>
    resolveNotificationEventsByEntityInTransaction(transaction, input),
  );
}
