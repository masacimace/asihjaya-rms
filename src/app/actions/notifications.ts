"use server";

import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getOutletAccessCondition(outletIds: string[]): SQL<unknown> {
  if (outletIds.length === 0) {
    return isNull(notifications.outletId);
  }

  return or(isNull(notifications.outletId), inArray(notifications.outletId, outletIds))!;
}

export async function markNotificationReadAction(formData: FormData) {
  const auth = await requirePermission("admin.access");
  const notificationId = String(formData.get("notificationId") ?? "").trim();

  if (!UUID_PATTERN.test(notificationId)) {
    return;
  }

  const outletIds = auth.outlets.map((outlet) => outlet.id);
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
        eq(notifications.id, notificationId),
        eq(notifications.organizationId, auth.organization.id),
        getOutletAccessCondition(outletIds),
        or(isNull(notifications.userId), eq(notifications.userId, auth.user.id))!,
      ),
    );

  revalidatePath("/admin");
}

export async function markAllNotificationsReadAction() {
  const auth = await requirePermission("admin.access");
  const outletIds = auth.outlets.map((outlet) => outlet.id);
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
        eq(notifications.organizationId, auth.organization.id),
        eq(notifications.isRead, false),
        getOutletAccessCondition(outletIds),
        or(isNull(notifications.userId), eq(notifications.userId, auth.user.id))!,
      ),
    );

  revalidatePath("/admin");
}
