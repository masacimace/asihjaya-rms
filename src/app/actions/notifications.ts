"use server";

import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { notificationEvents, notificationRecipients } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NotificationMutationResult = {
  ok: boolean;
  affectedCount: number;
};

function getRecipientId(formData: FormData) {
  const recipientId = String(formData.get("notificationId") ?? "").trim();
  return UUID_PATTERN.test(recipientId) ? recipientId : null;
}

async function getAccessibleRecipient(recipientId: string) {
  const auth = await requirePermission("admin.access");
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  const [row] = await db
    .select({
      id: notificationRecipients.id,
      status: notificationRecipients.status,
      eventResolvedAt: notificationEvents.resolvedAt,
    })
    .from(notificationRecipients)
    .innerJoin(
      notificationEvents,
      eq(notificationRecipients.eventId, notificationEvents.id),
    )
    .where(
      and(
        eq(notificationRecipients.id, recipientId),
        eq(notificationRecipients.userId, auth.user.id),
        eq(notificationEvents.organizationId, auth.organization.id),
        outletIds.length > 0
          ? or(
              isNull(notificationEvents.outletId),
              inArray(notificationEvents.outletId, outletIds),
            )
          : isNull(notificationEvents.outletId),
      ),
    )
    .limit(1);

  return { auth, row };
}

function revalidateNotificationSurfaces() {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/notifikasi");
}

export async function markNotificationReadAction(
  formData: FormData,
): Promise<NotificationMutationResult> {
  const recipientId = getRecipientId(formData);
  if (!recipientId) return { ok: false, affectedCount: 0 };

  const { auth, row } = await getAccessibleRecipient(recipientId);
  if (!row) return { ok: false, affectedCount: 0 };

  if (row.status !== "unread") {
    return { ok: true, affectedCount: 0 };
  }

  const now = new Date();
  const updated = await db
    .update(notificationRecipients)
    .set({
      status: "read",
      readAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(notificationRecipients.id, recipientId),
        eq(notificationRecipients.userId, auth.user.id),
        eq(notificationRecipients.status, "unread"),
      ),
    )
    .returning({ id: notificationRecipients.id });

  revalidateNotificationSurfaces();
  return { ok: true, affectedCount: updated.length };
}

export async function markNotificationUnreadAction(
  formData: FormData,
): Promise<NotificationMutationResult> {
  const recipientId = getRecipientId(formData);
  if (!recipientId) return { ok: false, affectedCount: 0 };

  const { auth, row } = await getAccessibleRecipient(recipientId);
  if (!row) return { ok: false, affectedCount: 0 };

  if (row.eventResolvedAt || row.status === "resolved" || row.status === "archived") {
    return { ok: false, affectedCount: 0 };
  }

  if (row.status === "unread") {
    return { ok: true, affectedCount: 0 };
  }

  const now = new Date();
  const updated = await db
    .update(notificationRecipients)
    .set({
      status: "unread",
      readAt: null,
      acknowledgedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(notificationRecipients.id, recipientId),
        eq(notificationRecipients.userId, auth.user.id),
        inArray(notificationRecipients.status, ["read", "acknowledged"]),
      ),
    )
    .returning({ id: notificationRecipients.id });

  revalidateNotificationSurfaces();
  return { ok: true, affectedCount: updated.length };
}

export async function archiveNotificationAction(
  formData: FormData,
): Promise<NotificationMutationResult> {
  const recipientId = getRecipientId(formData);
  if (!recipientId) return { ok: false, affectedCount: 0 };

  const { auth, row } = await getAccessibleRecipient(recipientId);
  if (!row) return { ok: false, affectedCount: 0 };

  if (row.status === "archived") {
    return { ok: true, affectedCount: 0 };
  }

  const now = new Date();
  const updated = await db
    .update(notificationRecipients)
    .set({
      status: "archived",
      archivedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(notificationRecipients.id, recipientId),
        eq(notificationRecipients.userId, auth.user.id),
        ne(notificationRecipients.status, "archived"),
      ),
    )
    .returning({ id: notificationRecipients.id });

  revalidateNotificationSurfaces();
  return { ok: true, affectedCount: updated.length };
}

export async function markAllNotificationsReadAction(): Promise<NotificationMutationResult> {
  const auth = await requirePermission("admin.access");
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const now = new Date();

  const accessibleRows = await db
    .select({ id: notificationRecipients.id })
    .from(notificationRecipients)
    .innerJoin(
      notificationEvents,
      eq(notificationRecipients.eventId, notificationEvents.id),
    )
    .where(
      and(
        eq(notificationRecipients.userId, auth.user.id),
        eq(notificationRecipients.status, "unread"),
        eq(notificationEvents.organizationId, auth.organization.id),
        outletIds.length > 0
          ? or(
              isNull(notificationEvents.outletId),
              inArray(notificationEvents.outletId, outletIds),
            )
          : isNull(notificationEvents.outletId),
      ),
    );

  const recipientIds = accessibleRows.map((row) => row.id);
  if (recipientIds.length === 0) {
    return { ok: true, affectedCount: 0 };
  }

  const updated = await db
    .update(notificationRecipients)
    .set({ status: "read", readAt: now, updatedAt: now })
    .where(inArray(notificationRecipients.id, recipientIds))
    .returning({ id: notificationRecipients.id });

  revalidateNotificationSurfaces();
  return { ok: true, affectedCount: updated.length };
}

function getRecipientIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("notificationIds")
        .map((value) => String(value).trim())
        .filter((value) => UUID_PATTERN.test(value)),
    ),
  ).slice(0, 100);
}

async function getAccessibleRecipients(recipientIds: string[]) {
  const auth = await requirePermission("admin.access");
  if (recipientIds.length === 0) return { auth, rows: [] };

  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const rows = await db
    .select({
      id: notificationRecipients.id,
      status: notificationRecipients.status,
      eventResolvedAt: notificationEvents.resolvedAt,
    })
    .from(notificationRecipients)
    .innerJoin(
      notificationEvents,
      eq(notificationRecipients.eventId, notificationEvents.id),
    )
    .where(
      and(
        inArray(notificationRecipients.id, recipientIds),
        eq(notificationRecipients.userId, auth.user.id),
        eq(notificationEvents.organizationId, auth.organization.id),
        outletIds.length > 0
          ? or(
              isNull(notificationEvents.outletId),
              inArray(notificationEvents.outletId, outletIds),
            )
          : isNull(notificationEvents.outletId),
      ),
    );

  return { auth, rows };
}

export async function markNotificationsReadAction(
  formData: FormData,
): Promise<NotificationMutationResult> {
  const recipientIds = getRecipientIds(formData);
  const { auth, rows } = await getAccessibleRecipients(recipientIds);
  const eligibleIds = rows
    .filter((row) => row.status === "unread")
    .map((row) => row.id);

  if (eligibleIds.length === 0) {
    return { ok: true, affectedCount: 0 };
  }

  const now = new Date();
  const updated = await db
    .update(notificationRecipients)
    .set({ status: "read", readAt: now, updatedAt: now })
    .where(
      and(
        inArray(notificationRecipients.id, eligibleIds),
        eq(notificationRecipients.userId, auth.user.id),
        eq(notificationRecipients.status, "unread"),
      ),
    )
    .returning({ id: notificationRecipients.id });

  revalidateNotificationSurfaces();
  return { ok: true, affectedCount: updated.length };
}

export async function markNotificationsUnreadAction(
  formData: FormData,
): Promise<NotificationMutationResult> {
  const recipientIds = getRecipientIds(formData);
  const { auth, rows } = await getAccessibleRecipients(recipientIds);
  const eligibleIds = rows
    .filter(
      (row) =>
        row.eventResolvedAt == null &&
        (row.status === "read" || row.status === "acknowledged"),
    )
    .map((row) => row.id);

  if (eligibleIds.length === 0) {
    return { ok: true, affectedCount: 0 };
  }

  const now = new Date();
  const updated = await db
    .update(notificationRecipients)
    .set({
      status: "unread",
      readAt: null,
      acknowledgedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        inArray(notificationRecipients.id, eligibleIds),
        eq(notificationRecipients.userId, auth.user.id),
        inArray(notificationRecipients.status, ["read", "acknowledged"]),
      ),
    )
    .returning({ id: notificationRecipients.id });

  revalidateNotificationSurfaces();
  return { ok: true, affectedCount: updated.length };
}

export async function archiveNotificationsAction(
  formData: FormData,
): Promise<NotificationMutationResult> {
  const recipientIds = getRecipientIds(formData);
  const { auth, rows } = await getAccessibleRecipients(recipientIds);
  const eligibleIds = rows
    .filter((row) => row.status !== "archived")
    .map((row) => row.id);

  if (eligibleIds.length === 0) {
    return { ok: true, affectedCount: 0 };
  }

  const now = new Date();
  const updated = await db
    .update(notificationRecipients)
    .set({ status: "archived", archivedAt: now, updatedAt: now })
    .where(
      and(
        inArray(notificationRecipients.id, eligibleIds),
        eq(notificationRecipients.userId, auth.user.id),
        ne(notificationRecipients.status, "archived"),
      ),
    )
    .returning({ id: notificationRecipients.id });

  revalidateNotificationSurfaces();
  return { ok: true, affectedCount: updated.length };
}

