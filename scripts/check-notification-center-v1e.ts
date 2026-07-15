import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [
    page,
    pageClient,
    card,
    drawer,
    actions,
    queries,
    contracts,
    packageJson,
  ] = await Promise.all([
    readFile("src/app/(admin)/admin/notifikasi/page.tsx", "utf8"),
    readFile(
      "src/components/notifications/notification-center-page.tsx",
      "utf8",
    ),
    readFile("src/components/notifications/notification-card.tsx", "utf8"),
    readFile("src/components/layout/notification-drawer.tsx", "utf8"),
    readFile("src/app/actions/notifications.ts", "utf8"),
    readFile("src/features/notifications/queries.ts", "utf8"),
    readFile("src/features/notifications/contracts.ts", "utf8"),
    readFile("package.json", "utf8"),
  ]);

  assert.match(page, /requirePermission\("admin\.access"\)/);
  assert.match(page, /getAdminNotificationPageData/);
  assert.match(page, /Notification Center/);
  assert.match(page, /Filter notifikasi/);
  assert.match(page, /name="category"/);
  assert.match(page, /name="severity"/);
  assert.match(page, /name="status"/);
  assert.match(page, /name="outletId"/);
  assert.match(page, /name="range"/);
  assert.match(page, /name="from"/);
  assert.match(page, /name="to"/);
  assert.match(page, /NotificationCenterPage/);
  assert.match(page, /Pagination notifikasi/);

  assert.match(pageClient, /Pilih halaman ini/);
  assert.match(pageClient, /markNotificationsReadAction/);
  assert.match(pageClient, /markNotificationsUnreadAction/);
  assert.match(pageClient, /archiveNotificationsAction/);
  assert.match(pageClient, /notificationIds/);
  assert.match(pageClient, /NotificationCard/);

  assert.match(card, /aria-expanded=\{isExpanded\}/);
  assert.match(card, /Diarsipkan/);
  assert.match(drawer, /href="\/admin\/notifikasi"/);
  assert.match(drawer, /Lihat semua notifikasi/);

  assert.match(actions, /export async function markNotificationsReadAction/);
  assert.match(actions, /export async function markNotificationsUnreadAction/);
  assert.match(actions, /export async function archiveNotificationsAction/);
  assert.match(actions, /revalidatePath\("\/admin\/notifikasi"\)/);
  assert.match(actions, /slice\(0, 100\)/);

  assert.match(queries, /export async function getAdminNotificationPageData/);
  assert.match(queries, /ADMIN_NOTIFICATION_PAGE_SIZE/);
  assert.match(queries, /ilike\(notificationEvents\.title/);
  assert.match(queries, /eq\(notificationRecipients\.userId, auth\.user\.id\)/);
  assert.match(queries, /eq\(notificationEvents\.organizationId, auth\.organization\.id\)/);
  assert.match(queries, /status === "archived"/);

  assert.match(contracts, /parseAdminNotificationFilters/);
  assert.match(contracts, /AdminNotificationPageData/);
  assert.match(contracts, /adminNotificationPageStatuses/);
  assert.match(contracts, /adminNotificationDateRanges/);
  assert.match(packageJson, /check:notifications:v1e/);

  assert.doesNotMatch(
    `${pageClient}\n${actions}`,
    /deleteNotification|hardDeleteNotification/i,
    "Full page tidak boleh melakukan hard delete notification event.",
  );

  console.log("Notification Center V1-E full page checks passed.");
}

main().catch((error) => {
  console.error("Notification Center V1-E check gagal.", error);
  process.exitCode = 1;
});
