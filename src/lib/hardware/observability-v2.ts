export type HardwareOperationalSeverity = "healthy" | "warning" | "critical";

export type HardwareOperationalMetrics = {
  unknownOutcomeJobs: number;
  staleSubmittedJobs: number;
  offlineAgents: number;
  staleAgents: number;
  oldestPendingAgeSeconds: number | null;
  oldestSubmittedAgeSeconds: number | null;
  completedLast24Hours: number;
  failedLast24Hours: number;
  expiredLast24Hours: number;
};

export type HardwareOperationalThresholds = {
  pendingWarningSeconds: number;
  submittedWarningSeconds: number;
  failureRateWarningPercent: number;
};

export type HardwareOperationalAlert = {
  code:
    | "UNKNOWN_OUTCOME"
    | "STALE_SUBMITTED"
    | "AGENT_OFFLINE"
    | "AGENT_STALE"
    | "PENDING_TOO_OLD"
    | "FAILURE_RATE_HIGH";
  severity: Exclude<HardwareOperationalSeverity, "healthy">;
  message: string;
};

export type HardwareOperationalHealth = {
  status: HardwareOperationalSeverity;
  successRateLast24Hours: number | null;
  failureRateLast24Hours: number | null;
  alerts: HardwareOperationalAlert[];
};

const DEFAULT_PENDING_WARNING_SECONDS = 5 * 60;
const DEFAULT_SUBMITTED_WARNING_SECONDS = 2 * 60;
const DEFAULT_FAILURE_RATE_WARNING_PERCENT = 10;

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function getHardwareOperationalThresholds(): HardwareOperationalThresholds {
  return {
    pendingWarningSeconds: readPositiveNumber(
      process.env.HARDWARE_PENDING_WARNING_SECONDS,
      DEFAULT_PENDING_WARNING_SECONDS,
    ),
    submittedWarningSeconds: readPositiveNumber(
      process.env.HARDWARE_SUBMITTED_WARNING_SECONDS,
      DEFAULT_SUBMITTED_WARNING_SECONDS,
    ),
    failureRateWarningPercent: Math.min(
      100,
      readPositiveNumber(
        process.env.HARDWARE_FAILURE_RATE_WARNING_PERCENT,
        DEFAULT_FAILURE_RATE_WARNING_PERCENT,
      ),
    ),
  };
}

export function getAgeSeconds(
  value: Date | string | null,
  now = new Date(),
) {
  if (!value) {
    return null;
  }

  const resolved = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(resolved.getTime())) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - resolved.getTime()) / 1000));
}

export function evaluateHardwareOperationalHealth(
  metrics: HardwareOperationalMetrics,
  thresholds: HardwareOperationalThresholds = getHardwareOperationalThresholds(),
): HardwareOperationalHealth {
  const alerts: HardwareOperationalAlert[] = [];
  const finishedLast24Hours =
    metrics.completedLast24Hours + metrics.failedLast24Hours;
  const successRateLast24Hours =
    finishedLast24Hours > 0
      ? (metrics.completedLast24Hours / finishedLast24Hours) * 100
      : null;
  const failureRateLast24Hours =
    finishedLast24Hours > 0
      ? (metrics.failedLast24Hours / finishedLast24Hours) * 100
      : null;

  if (metrics.unknownOutcomeJobs > 0) {
    alerts.push({
      code: "UNKNOWN_OUTCOME",
      severity: "critical",
      message: `${metrics.unknownOutcomeJobs} job memiliki hasil fisik yang belum dapat dipastikan.`,
    });
  }

  if (metrics.staleSubmittedJobs > 0) {
    alerts.push({
      code: "STALE_SUBMITTED",
      severity: "critical",
      message: `${metrics.staleSubmittedJobs} job sudah submitted tetapi belum mendapat acknowledgement final.`,
    });
  }

  if (metrics.offlineAgents > 0) {
    alerts.push({
      code: "AGENT_OFFLINE",
      severity: "warning",
      message: `${metrics.offlineAgents} agent aktif sedang offline.`,
    });
  }

  if (metrics.staleAgents > 0) {
    alerts.push({
      code: "AGENT_STALE",
      severity: "warning",
      message: `${metrics.staleAgents} agent terlambat heartbeat dan perlu diperiksa.`,
    });
  }

  if (
    metrics.oldestPendingAgeSeconds !== null &&
    metrics.oldestPendingAgeSeconds >= thresholds.pendingWarningSeconds
  ) {
    alerts.push({
      code: "PENDING_TOO_OLD",
      severity: "warning",
      message: `Job pending tertua sudah menunggu ${metrics.oldestPendingAgeSeconds} detik.`,
    });
  }

  if (
    failureRateLast24Hours !== null &&
    finishedLast24Hours >= 5 &&
    failureRateLast24Hours >= thresholds.failureRateWarningPercent
  ) {
    alerts.push({
      code: "FAILURE_RATE_HIGH",
      severity: "warning",
      message: `Failure rate hardware 24 jam mencapai ${failureRateLast24Hours.toFixed(1)}%.`,
    });
  }

  const status = alerts.some((alert) => alert.severity === "critical")
    ? "critical"
    : alerts.length > 0
      ? "warning"
      : "healthy";

  return {
    status,
    successRateLast24Hours,
    failureRateLast24Hours,
    alerts,
  };
}
