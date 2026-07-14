"use server";

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { notificationEvents, notificationRecipients } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function markNotificationReadAction(formData: FormData) {
  const auth = await requirePermission("admin.access");
  const recipientId = String(formData.get("notificationId") ?? "").trim();

  if (!UUID_PATTERN.test(recipientId)) return;

  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const now = new Date();

  const [accessible] = await db
    .select({ id: notificationRecipients.id })
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

  if (!accessible) return;

  await db
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
    );

  revalidatePath("/admin");
}

export async function markAllNotificationsReadAction() {
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
  if (recipientIds.length > 0) {
    await db
      .update(notificationRecipients)
      .set({ status: "read", readAt: now, updatedAt: now })
      .where(inArray(notificationRecipients.id, recipientIds));
  }

  revalidatePath("/admin");
}
