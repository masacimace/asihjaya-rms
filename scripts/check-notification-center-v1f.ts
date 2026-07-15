import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [
    contracts,
    eventService,
    maintenance,
    hardware,
    hardwareRoute,
    approvals,
    queries,
    liveCounts,
    card,
    envExample,
    packageJson,
  ] = await Promise.all([
    readFile("src/features/notifications/contracts.ts", "utf8"),
    readFile("src/features/notifications/event-service.ts", "utf8"),
    readFile("src/features/notifications/maintenance.ts", "utf8"),
    readFile("src/features/notifications/hardware.ts", "utf8"),
    readFile("src/app/api/hardware-jobs/[jobId]/route.ts", "utf8"),
    readFile("src/features/notifications/approvals.ts", "utf8"),
    readFile("src/features/notifications/queries.ts", "utf8"),
    readFile("src/app/api/admin/live-counts/route.ts", "utf8"),
    readFile("src/components/notifications/notification-card.tsx", "utf8"),
    readFile(".env.example", "utf8"),
    readFile("package.json", "utf8"),
  ]);

  assert.match(contracts, /NotificationAntiSpamOptions/);
  assert.match(contracts, /mode\?: "dedupe" \| "aggregate"/);
  assert.match(contracts, /occurrenceId\?: string \| null/);
  assert.match(contracts, /reNotifyRecipients\?: boolean/);

  assert.match(eventService, /pg_advisory_xact_lock/);
  assert.match(eventService, /MAX_TRACKED_OCCURRENCE_IDS/);
  assert.match(eventService, /occurrenceCount/);
  assert.match(eventService, /firstOccurredAt/);
  assert.match(eventService, /lastOccurredAt/);
  assert.match(eventService, /isDuplicateOccurrence/);
  assert.match(eventService, /status: "unread"/);
  assert.match(eventService, /archivedAt: null/);

  assert.match(maintenance, /runNotificationMaintenanceForOrganization/);
  assert.match(maintenance, /requiresAction, false/);
  assert.match(maintenance, /severity, "success"/);
  assert.match(maintenance, /severity, "info"/);
  assert.match(maintenance, /severity, "warning"/);
  assert.doesNotMatch(
    maintenance,
    /severity, "critical"/,
    "Critical events tidak boleh auto-resolve berdasarkan umur.",
  );
  assert.match(maintenance, /status: "resolved"/);
  assert.match(maintenance, /status: "archived"/);
  assert.match(maintenance, /pg_advisory_xact_lock/);

  assert.match(hardware, /hardware_failure_group/);
  assert.match(hardware, /mode: "aggregate"/);
  assert.match(hardware, /occurrenceId: jobId/);
  assert.match(hardware, /markHardwareJobFailureResolved/);
  assert.match(hardwareRoute, /status === "completed"/);
  assert.match(hardwareRoute, /markHardwareJobFailureResolved/);

  assert.match(approvals, /approval\.execution_failed/);
  assert.match(approvals, /mode: "aggregate"/);
  assert.match(approvals, /reNotifyRecipients: true/);

  assert.match(queries, /runNotificationMaintenanceForOrganization/);
  assert.match(liveCounts, /runNotificationMaintenanceForOrganization/);
  assert.match(card, /occurrenceCount/);
  assert.match(card, /kejadian/);

  assert.match(envExample, /NOTIFICATION_SUCCESS_AUTO_RESOLVE_DAYS/);
  assert.match(envExample, /NOTIFICATION_INFO_AUTO_RESOLVE_DAYS/);
  assert.match(envExample, /NOTIFICATION_WARNING_AUTO_RESOLVE_DAYS/);
  assert.match(envExample, /NOTIFICATION_RESOLVED_AUTO_ARCHIVE_DAYS/);
  assert.match(envExample, /NOTIFICATION_ANTI_SPAM_WINDOW_MINUTES/);
  assert.match(packageJson, /check:notifications:v1f/);

  assert.doesNotMatch(
    `${maintenance}\n${eventService}`,
    /delete\(notificationEvents\)|delete\(notificationRecipients\)/,
    "V1-F tidak boleh melakukan hard delete notification audit event.",
  );

  console.log(
    "Notification Center V1-F auto resolution & anti-spam checks passed.",
  );
}

main().catch((error) => {
  console.error("Notification Center V1-F check gagal.", error);
  process.exitCode = 1;
});
