import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [drawer, card, actions, queries, contracts, adminShell, packageJson] =
    await Promise.all([
      readFile("src/components/layout/notification-drawer.tsx", "utf8"),
      readFile("src/components/notifications/notification-card.tsx", "utf8"),
      readFile("src/app/actions/notifications.ts", "utf8"),
      readFile("src/features/notifications/queries.ts", "utf8"),
      readFile("src/features/notifications/contracts.ts", "utf8"),
      readFile("src/components/layout/admin-shell.tsx", "utf8"),
      readFile("package.json", "utf8"),
    ]);

  assert.match(drawer, /Notification Center/);
  assert.match(contracts, /"all" \| "actionable" \| "unread"/);
  assert.match(drawer, /Perlu tindakan/);
  assert.match(drawer, /Belum dibaca/);
  assert.match(card, /aria-expanded=\{isExpanded\}/);
  assert.match(drawer, /markNotificationUnreadAction/);
  assert.match(drawer, /archiveNotificationAction/);
  assert.match(drawer, /Arsip hanya menyembunyikan notifikasi/);
  assert.match(card, /Rincian pembayaran/);
  assert.match(card, /requestSnapshot/);

  assert.match(actions, /export async function markNotificationUnreadAction/);
  assert.match(actions, /export async function archiveNotificationAction/);
  assert.match(actions, /revalidatePath\("\/admin", "layout"\)/);
  assert.match(actions, /eq\(notificationRecipients\.userId, auth\.user\.id\)/);
  assert.match(actions, /eq\(notificationEvents\.organizationId, auth\.organization\.id\)/);

  assert.match(queries, /actionableCount/);
  assert.match(queries, /notificationEvents\.payload/);
  assert.match(queries, /notificationEvents\.resolvedAt/);
  assert.match(queries, /ADMIN_NOTIFICATION_DRAWER_LIMIT/);
  assert.match(contracts, /NotificationDrawerFilter/);
  assert.match(contracts, /payload: Record<string, unknown>/);
  assert.match(contracts, /isActionable: boolean/);
  assert.match(contracts, /actionableCount: number/);

  assert.match(adminShell, /onUnreadCountChange=\{setNotificationUnreadCount\}/);
  assert.match(adminShell, /key=\{notificationDrawerVersion\}/);
  assert.match(packageJson, /check:notifications:v1d/);

  assert.doesNotMatch(
    `${drawer}\n${card}`,
    /deleteNotification|hardDeleteNotification/i,
    "Drawer tidak boleh melakukan hard delete notification event.",
  );

  console.log(
    "Notification Center V1-D modern expandable drawer checks passed.",
  );
}

main().catch((error) => {
  console.error("Notification Center V1-D check gagal.", error);
  process.exitCode = 1;
});
