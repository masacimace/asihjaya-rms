import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { notificationEvents, notificationRecipients } from "@/db/schema";
import { runNotificationMaintenanceForOrganization } from "@/features/notifications/maintenance";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!hasPermission(auth, "admin.access")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await runNotificationMaintenanceForOrganization(auth.organization.id);

  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const notificationOutletCondition = outletIds.length > 0
    ? or(isNull(notificationEvents.outletId), inArray(notificationEvents.outletId, outletIds))!
    : isNull(notificationEvents.outletId);

  const [notificationRow] = await db
    .select({ value: count() })
    .from(notificationRecipients)
    .innerJoin(notificationEvents, eq(notificationRecipients.eventId, notificationEvents.id))
    .where(
      and(
        eq(notificationEvents.organizationId, auth.organization.id),
        notificationOutletCondition,
        eq(notificationRecipients.userId, auth.user.id),
        eq(notificationRecipients.status, "unread"),
      ),
    );

  return NextResponse.json(
    {
      notificationUnreadCount: notificationRow?.value ?? 0,
      generatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
