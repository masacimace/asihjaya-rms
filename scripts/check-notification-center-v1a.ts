import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  mapCategoryToLegacyNotificationType,
  mapLegacyNotificationTypeToCategory,
} from "../src/features/notifications/contracts";

async function main() {
  assert.equal(mapLegacyNotificationTypeToCategory("shift"), "cash_shift");
  assert.equal(mapLegacyNotificationTypeToCategory("cash"), "cash_shift");
  assert.equal(
    mapCategoryToLegacyNotificationType({
      category: "cash_shift",
      eventType: "shift.variance_detected",
    }),
    "shift",
  );
  assert.equal(
    mapCategoryToLegacyNotificationType({
      category: "payment",
      eventType: "payment.mismatch",
    }),
    "system",
  );

  const [
    schema,
    service,
    queries,
    actions,
    liveCounts,
    posAction,
    salesNotifications,
    adminShell,
  ] = await Promise.all([
    readFile("src/db/schema/index.ts", "utf8"),
    readFile("src/features/notifications/event-service.ts", "utf8"),
    readFile("src/features/notifications/queries.ts", "utf8"),
    readFile("src/app/actions/notifications.ts", "utf8"),
    readFile("src/app/api/admin/live-counts/route.ts", "utf8"),
    readFile("src/app/actions/pos.ts", "utf8"),
    readFile("src/features/notifications/sales.ts", "utf8"),
    readFile("src/components/layout/admin-shell.tsx", "utf8"),
  ]);

  assert.match(schema, /notification_events/);
  assert.match(schema, /notification_recipients/);
  assert.match(schema, /notification_recipient_status/);

  assert.match(service, /requiredAnyPermissionCodes/);
  assert.match(service, /pg_advisory_xact_lock/);
  assert.match(service, /deduplicationKey/);
  assert.match(service, /resolveNotificationEventsByEntity/);

  assert.match(queries, /notificationRecipients\.userId/);
  assert.match(actions, /notificationRecipients\.status, "unread"/);
  assert.match(liveCounts, /notificationRecipients/);
  assert.match(posAction, /publishSaleCompletedNotificationInTransaction/);
  assert.match(salesNotifications, /eventType: "sale\.completed"/);
  assert.doesNotMatch(posAction, /transaction\.insert\(notifications\)/);
  assert.match(adminShell, /notificationDrawerData\.unreadCount/);

  // Assertions terhadap SQL backfill migration lama sengaja dihapus.
  // Setelah migration squash, compatibility backfill historis tidak lagi
  // menjadi kontrak untuk fresh database; kontrak aktif divalidasi melalui
  // schema dan implementation source di atas.
  console.log("Notification Center V1-A event foundation checks passed.");
}

main().catch((error: unknown) => {
  console.error("Notification Center V1-A check gagal.", error);
  process.exitCode = 1;
});
