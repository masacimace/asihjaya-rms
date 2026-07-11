import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { approvals, notifications } from "@/db/schema";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(auth, "admin.access")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const notificationOutletCondition = outletIds.length > 0
    ? or(isNull(notifications.outletId), inArray(notifications.outletId, outletIds))!
    : isNull(notifications.outletId);
  const approvalOutletCondition = outletIds.length > 0
    ? or(isNull(approvals.outletId), inArray(approvals.outletId, outletIds))!
    : isNull(approvals.outletId);

  const [notificationRows, approvalRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.organizationId, auth.organization.id),
          notificationOutletCondition,
          or(isNull(notifications.userId), eq(notifications.userId, auth.user.id))!,
          eq(notifications.isRead, false),
        ),
      ),
    db
      .select({ value: count() })
      .from(approvals)
      .where(
        and(
          eq(approvals.organizationId, auth.organization.id),
          approvalOutletCondition,
          eq(approvals.status, "pending"),
        ),
      ),
  ]);

  return NextResponse.json(
    {
      approvalPendingCount: approvalRows[0]?.value ?? 0,
      notificationUnreadCount: notificationRows[0]?.value ?? 0,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
