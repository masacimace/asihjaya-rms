import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getHardwareUnknownResolutionDecision,
  parseHardwareUnknownResolutionInput,
} from "../src/lib/hardware/job-resolution-policy-v2";
import { evaluateHardwareOperationalHealth } from "../src/lib/hardware/observability-v2";

function assertThrowsMessage(callback: () => unknown, pattern: RegExp) {
  assert.throws(callback, pattern);
}

async function main() {
  const completedDecision = getHardwareUnknownResolutionDecision(
    "confirmed_completed",
  );
  assert.equal(completedDecision.nextStatus, "completed");
  assert.equal(completedDecision.shouldCreateNewAttempt, false);
  
  const retryDecision = getHardwareUnknownResolutionDecision("retry_authorized");
  assert.equal(retryDecision.nextStatus, "pending");
  assert.equal(retryDecision.requiresDuplicateRiskAcknowledgement, true);
  
  assertThrowsMessage(
    () =>
      parseHardwareUnknownResolutionInput({
        resolutionType: "retry_authorized",
        reason: "Printer sudah diperiksa tetapi perlu dicoba ulang.",
        duplicateRiskAcknowledged: false,
      }),
    /risiko cetak ganda/i,
  );
  
  const parsedRetry = parseHardwareUnknownResolutionInput({
    resolutionType: "retry_authorized",
    reason: "  Printer sudah diperiksa dan staff meminta satu retry manual.  ",
    duplicateRiskAcknowledged: "on",
  });
  assert.equal(parsedRetry.duplicateRiskAcknowledged, true);
  assert.equal(
    parsedRetry.reason,
    "Printer sudah diperiksa dan staff meminta satu retry manual.",
  );
  
  const criticalHealth = evaluateHardwareOperationalHealth(
    {
      unknownOutcomeJobs: 1,
      staleSubmittedJobs: 0,
      offlineAgents: 0,
      staleAgents: 0,
      oldestPendingAgeSeconds: 0,
      oldestSubmittedAgeSeconds: 0,
      completedLast24Hours: 10,
      failedLast24Hours: 0,
      expiredLast24Hours: 0,
    },
    {
      pendingWarningSeconds: 300,
      submittedWarningSeconds: 120,
      failureRateWarningPercent: 10,
    },
  );
  assert.equal(criticalHealth.status, "critical");
  assert.ok(
    criticalHealth.alerts.some((alert) => alert.code === "UNKNOWN_OUTCOME"),
  );
  
  const warningHealth = evaluateHardwareOperationalHealth(
    {
      unknownOutcomeJobs: 0,
      staleSubmittedJobs: 0,
      offlineAgents: 0,
      staleAgents: 1,
      oldestPendingAgeSeconds: 400,
      oldestSubmittedAgeSeconds: null,
      completedLast24Hours: 8,
      failedLast24Hours: 2,
      expiredLast24Hours: 0,
    },
    {
      pendingWarningSeconds: 300,
      submittedWarningSeconds: 120,
      failureRateWarningPercent: 10,
    },
  );
  assert.equal(warningHealth.status, "warning");
  assert.equal(warningHealth.failureRateLast24Hours, 20);
  
  const healthy = evaluateHardwareOperationalHealth(
    {
      unknownOutcomeJobs: 0,
      staleSubmittedJobs: 0,
      offlineAgents: 0,
      staleAgents: 0,
      oldestPendingAgeSeconds: null,
      oldestSubmittedAgeSeconds: null,
      completedLast24Hours: 0,
      failedLast24Hours: 0,
      expiredLast24Hours: 0,
    },
    {
      pendingWarningSeconds: 300,
      submittedWarningSeconds: 120,
      failureRateWarningPercent: 10,
    },
  );
  assert.equal(healthy.status, "healthy");
  assert.equal(healthy.successRateLast24Hours, null);
  
  const [
    actionsSource,
    attemptRouteSource,
    claimRouteSource,
    schemaSource,
    cleanupSource,
    notificationQuerySource,
  ] = await Promise.all([
    readFile("src/app/actions/hardware.ts", "utf8"),
    readFile(
      "src/app/api/hardware/v2/jobs/[jobId]/attempts/[attemptId]/route.ts",
      "utf8",
    ),
    readFile("src/app/api/hardware/v2/jobs/claim/route.ts", "utf8"),
    readFile("src/db/schema/index.ts", "utf8"),
    readFile("src/lib/hardware/job-cleanup.ts", "utf8"),
    readFile("src/features/notifications/queries.ts", "utf8"),
  ]);

  assert.match(actionsSource, /requirePermission\("hardware\.resolve_unknown"\)/);
  assert.match(actionsSource, /resolveHardwareUnknownOutcome/);
  assert.match(
    attemptRouteSource,
    /createHardwareJobUnknownOutcomeNotification/,
  );
  assert.match(claimRouteSource, /notifyHardwareJobV2LeaseRecovery/);
  assert.match(schemaSource, /hardware_job_resolutions/);
  assert.match(schemaSource, /hardware_job_resolutions_retry_ack_ck/);
  assert.match(cleanupSource, /not exists/);
  assert.match(cleanupSource, /hardwareJobResolutions/);
  assert.match(
    notificationQuerySource,
    /syncHardwareJobOperationalNotifications/,
  );

  console.log("Hardware Protocol v2 operational resolution checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
