import { and, count, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  hardwareAgents,
  hardwareJobAttempts,
  hardwareJobResolutions,
  hardwareJobs,
  outlets,
  registers,
  users,
} from "@/db/schema";
import { getHardwareJobCleanupPreview } from "@/lib/hardware/job-cleanup";
import { getStaleHardwareJobCutoff } from "@/lib/hardware/job-recovery";
import {
  evaluateHardwareOperationalHealth,
  getAgeSeconds,
  getHardwareOperationalThresholds,
} from "@/lib/hardware/observability-v2";
import type { AuthContext } from "@/lib/auth/session";
import type {
  HardwareAgentDiagnostics,
  HardwareAgentDisplayStatus,
  HardwareHubDashboard,
  HardwareJobCleanupPreview,
  HardwareJobOperationalDetail,
  HardwareJobStatusSummary,
} from "./contracts";

const ONLINE_WINDOW_MS = 90 * 1000;
const STALE_WINDOW_MS = 5 * 60 * 1000;

const legacyJobAgent = alias(hardwareAgents, "legacy_job_agent");
const attemptJobAgent = alias(hardwareAgents, "attempt_job_agent");
const targetJobAgent = alias(hardwareAgents, "target_job_agent");

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function getAgentDiagnostics(
  capabilities: Record<string, unknown>,
): HardwareAgentDiagnostics {
  return {
    configWarnings: readStringArray(capabilities.config_warnings),
    hasConfigWarnings: readStringArray(capabilities.config_warnings).length > 0,
    agentVersion: readString(capabilities.agent_version),
    nodeVersion: readString(capabilities.node_version),
    platform: readString(capabilities.platform),
    arch: readString(capabilities.arch),
    hostname: readString(capabilities.hostname),
    requestTimeoutMs: readNumber(capabilities.request_timeout_ms),
    printCommandTimeoutMs: readNumber(capabilities.print_command_timeout_ms),
  };
}

function getAgentDisplayStatus({
  dbStatus,
  isActive,
  lastSeenAt,
  now,
}: {
  dbStatus: "online" | "offline" | "disabled";
  isActive: boolean;
  lastSeenAt: Date | null;
  now: Date;
}): HardwareAgentDisplayStatus {
  if (!isActive || dbStatus === "disabled") {
    return "disabled";
  }

  if (!lastSeenAt) {
    return "offline";
  }

  const diffMs = now.getTime() - lastSeenAt.getTime();

  if (dbStatus === "online" && diffMs <= ONLINE_WINDOW_MS) {
    return "online";
  }

  if (diffMs <= STALE_WINDOW_MS) {
    return "stale";
  }

  return "offline";
}

function createEmptyStatusSummary(): HardwareJobStatusSummary {
  return {
    pending: 0,
    claimed: 0,
    processing: 0,
    printing: 0,
    submitted: 0,
    completed: 0,
    failed: 0,
    unknown_outcome: 0,
    expired: 0,
    cancelled: 0,
  };
}

function createEmptyCleanupPreview(
  now = new Date(),
): HardwareJobCleanupPreview {
  return {
    completed: 0,
    cancelled: 0,
    failed: 0,
    totalEligible: 0,
    retentionDays: {
      completed: 30,
      cancelled: 30,
      failed: 90,
    },
    cutoffs: {
      completed: now,
      cancelled: now,
      failed: now,
    },
  };
}

function createEmptyDashboard(): HardwareHubDashboard {
  return {
    agents: [],
    recentJobs: [],
    jobStatusSummary: createEmptyStatusSummary(),
    cleanupPreview: createEmptyCleanupPreview(),
    observability: {
      status: "healthy",
      generatedAt: new Date(),
      thresholds: getHardwareOperationalThresholds(),
      metrics: {
        unknownOutcomeJobs: 0,
        staleSubmittedJobs: 0,
        oldestPendingAgeSeconds: null,
        oldestSubmittedAgeSeconds: null,
        completedLast24Hours: 0,
        failedLast24Hours: 0,
        expiredLast24Hours: 0,
        successRateLast24Hours: null,
        failureRateLast24Hours: null,
      },
      alerts: [],
    },
    totals: {
      agents: 0,
      onlineAgents: 0,
      staleAgents: 0,
      offlineAgents: 0,
      disabledAgents: 0,
      configurationWarningAgents: 0,
      pendingJobs: 0,
      failedJobs: 0,
      staleJobs: 0,
      cleanupEligibleJobs: 0,
    },
  };
}

export async function getHardwareHubDashboard(
  auth: AuthContext,
): Promise<HardwareHubDashboard> {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    return createEmptyDashboard();
  }

  const now = new Date();
  const { cutoff: staleJobCutoff } = getStaleHardwareJobCutoff(now);
  const observabilityThresholds = getHardwareOperationalThresholds();
  const staleSubmittedCutoff = new Date(
    now.getTime() - observabilityThresholds.submittedWarningSeconds * 1000,
  );
  const last24HoursCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    agentRows,
    recentJobRows,
    statusRows,
    staleJobRows,
    cleanupPreview,
    observabilityRows,
  ] = await Promise.all([
      db
        .select({
          id: hardwareAgents.id,
          code: hardwareAgents.code,
          name: hardwareAgents.name,
          dbStatus: hardwareAgents.status,
          isActive: hardwareAgents.isActive,
          capabilities: hardwareAgents.capabilities,
          settings: hardwareAgents.settings,
          lastSeenAt: hardwareAgents.lastSeenAt,
          lastIpAddress: hardwareAgents.lastIpAddress,
          lastUserAgent: hardwareAgents.lastUserAgent,
          createdAt: hardwareAgents.createdAt,
          updatedAt: hardwareAgents.updatedAt,
          outletId: outlets.id,
          outletCode: outlets.code,
          outletName: outlets.name,
          registerId: registers.id,
          registerCode: registers.code,
          registerName: registers.name,
        })
        .from(hardwareAgents)
        .innerJoin(outlets, eq(hardwareAgents.outletId, outlets.id))
        .innerJoin(registers, eq(hardwareAgents.registerId, registers.id))
        .where(
          and(
            eq(hardwareAgents.organizationId, auth.organization.id),
            inArray(hardwareAgents.outletId, outletIds),
          ),
        )
        .orderBy(
          desc(hardwareAgents.lastSeenAt),
          desc(hardwareAgents.createdAt),
        ),

      db
        .select({
          id: hardwareJobs.id,
          protocolVersion: hardwareJobs.protocolVersion,
          jobType: hardwareJobs.jobType,
          deviceType: hardwareJobs.deviceType,
          status: hardwareJobs.status,
          targetDevice: hardwareJobs.targetDevice,
          attempts: hardwareJobs.attempts,
          maxAttempts: hardwareJobs.maxAttempts,
          error: hardwareJobs.error,
          result: hardwareJobs.result,
          sourceType: hardwareJobs.sourceType,
          sourceId: hardwareJobs.sourceId,
          createdAt: hardwareJobs.createdAt,
          updatedAt: hardwareJobs.updatedAt,
          claimedAt: hardwareJobs.claimedAt,
          startedAt: hardwareJobs.startedAt,
          completedAt: hardwareJobs.completedAt,
          failedAt: hardwareJobs.failedAt,
          agentId: sql<
            string | null
          >`coalesce(${attemptJobAgent.id}, ${targetJobAgent.id}, ${legacyJobAgent.id})`,
          agentCode: sql<
            string | null
          >`coalesce(${attemptJobAgent.code}, ${targetJobAgent.code}, ${legacyJobAgent.code})`,
          agentName: sql<
            string | null
          >`coalesce(${attemptJobAgent.name}, ${targetJobAgent.name}, ${legacyJobAgent.name})`,
          outletId: outlets.id,
          outletCode: outlets.code,
          outletName: outlets.name,
          registerId: registers.id,
          registerCode: registers.code,
          registerName: registers.name,
        })
        .from(hardwareJobs)
        .innerJoin(outlets, eq(hardwareJobs.outletId, outlets.id))
        .innerJoin(registers, eq(hardwareJobs.registerId, registers.id))
        .leftJoin(legacyJobAgent, eq(hardwareJobs.agentId, legacyJobAgent.id))
        .leftJoin(
          hardwareJobAttempts,
          eq(hardwareJobs.currentAttemptId, hardwareJobAttempts.id),
        )
        .leftJoin(
          attemptJobAgent,
          eq(hardwareJobAttempts.agentId, attemptJobAgent.id),
        )
        .leftJoin(
          targetJobAgent,
          eq(hardwareJobs.targetAgentId, targetJobAgent.id),
        )
        .where(
          and(
            eq(hardwareJobs.organizationId, auth.organization.id),
            inArray(hardwareJobs.outletId, outletIds),
          ),
        )
        .orderBy(desc(hardwareJobs.createdAt))
        .limit(30),

      db
        .select({
          status: hardwareJobs.status,
          total: count(),
        })
        .from(hardwareJobs)
        .where(
          and(
            eq(hardwareJobs.organizationId, auth.organization.id),
            inArray(hardwareJobs.outletId, outletIds),
          ),
        )
        .groupBy(hardwareJobs.status),

      db
        .select({ total: count() })
        .from(hardwareJobs)
        .where(
          and(
            eq(hardwareJobs.organizationId, auth.organization.id),
            inArray(hardwareJobs.outletId, outletIds),
            // Dashboard stale recovery is a v1 compatibility action. Protocol v2
            // lease recovery is performed atomically by the v2 claim endpoint.
            eq(hardwareJobs.protocolVersion, 1),
            inArray(hardwareJobs.status, ["claimed", "printing"]),
            lt(hardwareJobs.updatedAt, staleJobCutoff),
          ),
        ),

      getHardwareJobCleanupPreview({
        organizationId: auth.organization.id,
        outletIds,
        now,
      }),

      db
        .select({
          unknownOutcomeJobs: sql<number>`count(*) filter (where ${hardwareJobs.status} = 'unknown_outcome')`,
          staleSubmittedJobs: sql<number>`count(*) filter (where ${hardwareJobs.status} = 'submitted' and ${hardwareJobs.updatedAt} < ${staleSubmittedCutoff})`,
          oldestPendingAt: sql<Date | null>`min(${hardwareJobs.createdAt}) filter (where ${hardwareJobs.status} = 'pending')`,
          oldestSubmittedAt: sql<Date | null>`min(${hardwareJobs.submittedAt}) filter (where ${hardwareJobs.status} = 'submitted')`,
          completedLast24Hours: sql<number>`count(*) filter (where ${hardwareJobs.status} = 'completed' and ${hardwareJobs.completedAt} >= ${last24HoursCutoff})`,
          failedLast24Hours: sql<number>`count(*) filter (where ${hardwareJobs.status} = 'failed' and ${hardwareJobs.failedAt} >= ${last24HoursCutoff})`,
          expiredLast24Hours: sql<number>`count(*) filter (where ${hardwareJobs.status} = 'expired' and ${hardwareJobs.expiredAt} >= ${last24HoursCutoff})`,
        })
        .from(hardwareJobs)
        .where(
          and(
            eq(hardwareJobs.organizationId, auth.organization.id),
            inArray(hardwareJobs.outletId, outletIds),
          ),
        ),
    ]);

  const recentJobIds = recentJobRows.map((row) => row.id);
  const resolutionRows =
    recentJobIds.length > 0
      ? await db
          .select({
            jobId: hardwareJobResolutions.jobId,
            resolutionType: hardwareJobResolutions.resolutionType,
            reason: hardwareJobResolutions.reason,
            duplicateRiskAcknowledged:
              hardwareJobResolutions.duplicateRiskAcknowledged,
            resolvedByUserId: hardwareJobResolutions.resolvedByUserId,
            resolvedByName: users.fullName,
            createdAt: hardwareJobResolutions.createdAt,
          })
          .from(hardwareJobResolutions)
          .leftJoin(users, eq(hardwareJobResolutions.resolvedByUserId, users.id))
          .where(inArray(hardwareJobResolutions.jobId, recentJobIds))
          .orderBy(desc(hardwareJobResolutions.createdAt))
      : [];

  const latestResolutionByJobId = new Map<
    string,
    (typeof resolutionRows)[number]
  >();

  for (const resolution of resolutionRows) {
    if (!latestResolutionByJobId.has(resolution.jobId)) {
      latestResolutionByJobId.set(resolution.jobId, resolution);
    }
  }

  const agents = agentRows.map((row) => {
    const capabilities = toRecord(row.capabilities);

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      dbStatus: row.dbStatus,
      displayStatus: getAgentDisplayStatus({
        dbStatus: row.dbStatus,
        isActive: row.isActive,
        lastSeenAt: row.lastSeenAt,
        now,
      }),
      isActive: row.isActive,
      outlet: {
        id: row.outletId,
        code: row.outletCode,
        name: row.outletName,
      },
      register: {
        id: row.registerId,
        code: row.registerCode,
        name: row.registerName,
      },
      capabilities,
      settings: toRecord(row.settings),
      diagnostics: getAgentDiagnostics(capabilities),
      lastSeenAt: row.lastSeenAt,
      lastIpAddress: row.lastIpAddress,
      lastUserAgent: row.lastUserAgent,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });

  const recentJobs = recentJobRows.map((row) => {
    const result = toRecord(row.result);
    const manualResolution = latestResolutionByJobId.get(row.id) ?? null;

    return {
      id: row.id,
      protocolVersion: row.protocolVersion,
      jobType: row.jobType,
      deviceType: row.deviceType,
      status: row.status,
      targetDevice: row.targetDevice,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      error: row.error,
      errorCategory: readString(result.errorCategory),
      errorCode: readString(result.errorCode),
      durationMs: readNumber(result.durationMs),
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      claimedAt: row.claimedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      failedAt: row.failedAt,
      isStale:
        row.protocolVersion === 1 &&
        (row.status === "claimed" || row.status === "printing") &&
        row.updatedAt < staleJobCutoff,
      manualResolution: manualResolution
        ? {
            resolutionType: manualResolution.resolutionType,
            reason: manualResolution.reason,
            duplicateRiskAcknowledged:
              manualResolution.duplicateRiskAcknowledged,
            resolvedByUserId: manualResolution.resolvedByUserId,
            resolvedByName: manualResolution.resolvedByName,
            createdAt: manualResolution.createdAt,
          }
        : null,
      agent: row.agentId
        ? {
            id: row.agentId,
            code: row.agentCode!,
            name: row.agentName!,
          }
        : null,
      outlet: {
        id: row.outletId,
        code: row.outletCode,
        name: row.outletName,
      },
      register: {
        id: row.registerId,
        code: row.registerCode,
        name: row.registerName,
      },
    };
  });

  const jobStatusSummary = createEmptyStatusSummary();

  for (const row of statusRows) {
    jobStatusSummary[row.status] = Number(row.total);
  }

  const staleJobs = Number(staleJobRows[0]?.total ?? 0);
  const observabilityRow = observabilityRows[0];
  const operationalMetrics = {
    unknownOutcomeJobs: Number(observabilityRow?.unknownOutcomeJobs ?? 0),
    staleSubmittedJobs: Number(observabilityRow?.staleSubmittedJobs ?? 0),
    offlineAgents: agents.filter((agent) => agent.displayStatus === "offline")
      .length,
    staleAgents: agents.filter((agent) => agent.displayStatus === "stale")
      .length,
    oldestPendingAgeSeconds: getAgeSeconds(
      observabilityRow?.oldestPendingAt ?? null,
      now,
    ),
    oldestSubmittedAgeSeconds: getAgeSeconds(
      observabilityRow?.oldestSubmittedAt ?? null,
      now,
    ),
    completedLast24Hours: Number(
      observabilityRow?.completedLast24Hours ?? 0,
    ),
    failedLast24Hours: Number(observabilityRow?.failedLast24Hours ?? 0),
    expiredLast24Hours: Number(observabilityRow?.expiredLast24Hours ?? 0),
  };
  const operationalHealth = evaluateHardwareOperationalHealth(
    operationalMetrics,
    observabilityThresholds,
  );
  const cleanupSummary: HardwareJobCleanupPreview = {
    completed: cleanupPreview.completed,
    cancelled: cleanupPreview.cancelled,
    failed: cleanupPreview.failed,
    totalEligible: cleanupPreview.totalEligible,
    retentionDays: {
      completed: cleanupPreview.policy.completedDays,
      cancelled: cleanupPreview.policy.cancelledDays,
      failed: cleanupPreview.policy.failedDays,
    },
    cutoffs: {
      completed: cleanupPreview.policy.completedCutoff,
      cancelled: cleanupPreview.policy.cancelledCutoff,
      failed: cleanupPreview.policy.failedCutoff,
    },
  };

  return {
    agents,
    recentJobs,
    jobStatusSummary,
    cleanupPreview: cleanupSummary,
    observability: {
      status: operationalHealth.status,
      generatedAt: now,
      thresholds: observabilityThresholds,
      metrics: {
        unknownOutcomeJobs: operationalMetrics.unknownOutcomeJobs,
        staleSubmittedJobs: operationalMetrics.staleSubmittedJobs,
        oldestPendingAgeSeconds: operationalMetrics.oldestPendingAgeSeconds,
        oldestSubmittedAgeSeconds:
          operationalMetrics.oldestSubmittedAgeSeconds,
        completedLast24Hours: operationalMetrics.completedLast24Hours,
        failedLast24Hours: operationalMetrics.failedLast24Hours,
        expiredLast24Hours: operationalMetrics.expiredLast24Hours,
        successRateLast24Hours: operationalHealth.successRateLast24Hours,
        failureRateLast24Hours: operationalHealth.failureRateLast24Hours,
      },
      alerts: operationalHealth.alerts,
    },
    totals: {
      agents: agents.length,
      onlineAgents: agents.filter((agent) => agent.displayStatus === "online")
        .length,
      staleAgents: agents.filter((agent) => agent.displayStatus === "stale")
        .length,
      offlineAgents: agents.filter((agent) => agent.displayStatus === "offline")
        .length,
      disabledAgents: agents.filter(
        (agent) => agent.displayStatus === "disabled",
      ).length,
      configurationWarningAgents: agents.filter(
        (agent) => agent.diagnostics.hasConfigWarnings,
      ).length,
      pendingJobs:
        jobStatusSummary.pending +
        jobStatusSummary.claimed +
        jobStatusSummary.processing +
        jobStatusSummary.printing +
        jobStatusSummary.submitted,
      failedJobs: jobStatusSummary.failed + jobStatusSummary.unknown_outcome,
      staleJobs,
      cleanupEligibleJobs: cleanupSummary.totalEligible,
    },
  };
}

export async function getHardwareJobOperationalDetail(
  auth: AuthContext,
  jobId: string,
): Promise<HardwareJobOperationalDetail | null> {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    return null;
  }

  const [row] = await db
    .select({
      id: hardwareJobs.id,
      protocolVersion: hardwareJobs.protocolVersion,
      jobType: hardwareJobs.jobType,
      deviceType: hardwareJobs.deviceType,
      status: hardwareJobs.status,
      targetDevice: hardwareJobs.targetDevice,
      requiredCapability: hardwareJobs.requiredCapability,
      currentAttemptId: hardwareJobs.currentAttemptId,
      attempts: hardwareJobs.attempts,
      maxAttempts: hardwareJobs.maxAttempts,
      payloadHash: hardwareJobs.payloadHash,
      error: hardwareJobs.error,
      lastErrorCode: hardwareJobs.lastErrorCode,
      lastErrorMessage: hardwareJobs.lastErrorMessage,
      result: hardwareJobs.result,
      sourceType: hardwareJobs.sourceType,
      sourceId: hardwareJobs.sourceId,
      createdAt: hardwareJobs.createdAt,
      updatedAt: hardwareJobs.updatedAt,
      claimedAt: hardwareJobs.claimedAt,
      startedAt: hardwareJobs.startedAt,
      submittedAt: hardwareJobs.submittedAt,
      completedAt: hardwareJobs.completedAt,
      failedAt: hardwareJobs.failedAt,
      unknownAt: hardwareJobs.unknownAt,
      expiresAt: hardwareJobs.expiresAt,
      agentId: sql<string | null>`coalesce(${attemptJobAgent.id}, ${targetJobAgent.id}, ${legacyJobAgent.id})`,
      agentCode: sql<string | null>`coalesce(${attemptJobAgent.code}, ${targetJobAgent.code}, ${legacyJobAgent.code})`,
      agentName: sql<string | null>`coalesce(${attemptJobAgent.name}, ${targetJobAgent.name}, ${legacyJobAgent.name})`,
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
      registerId: registers.id,
      registerCode: registers.code,
      registerName: registers.name,
    })
    .from(hardwareJobs)
    .innerJoin(outlets, eq(hardwareJobs.outletId, outlets.id))
    .innerJoin(registers, eq(hardwareJobs.registerId, registers.id))
    .leftJoin(legacyJobAgent, eq(hardwareJobs.agentId, legacyJobAgent.id))
    .leftJoin(
      hardwareJobAttempts,
      eq(hardwareJobs.currentAttemptId, hardwareJobAttempts.id),
    )
    .leftJoin(
      attemptJobAgent,
      eq(hardwareJobAttempts.agentId, attemptJobAgent.id),
    )
    .leftJoin(
      targetJobAgent,
      eq(hardwareJobs.targetAgentId, targetJobAgent.id),
    )
    .where(
      and(
        eq(hardwareJobs.id, jobId),
        eq(hardwareJobs.organizationId, auth.organization.id),
        inArray(hardwareJobs.outletId, outletIds),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const [attemptRows, resolutionRows] = await Promise.all([
    db
      .select({
        id: hardwareJobAttempts.id,
        attemptNumber: hardwareJobAttempts.attemptNumber,
        status: hardwareJobAttempts.status,
        eventSequence: hardwareJobAttempts.eventSequence,
        dispatchStartedAt: hardwareJobAttempts.dispatchStartedAt,
        submittedAt: hardwareJobAttempts.submittedAt,
        serverAcknowledgedAt: hardwareJobAttempts.serverAcknowledgedAt,
        finishedAt: hardwareJobAttempts.finishedAt,
        errorCode: hardwareJobAttempts.errorCode,
        errorMessage: hardwareJobAttempts.errorMessage,
        retrySafe: hardwareJobAttempts.retrySafe,
        createdAt: hardwareJobAttempts.createdAt,
        updatedAt: hardwareJobAttempts.updatedAt,
        agentId: hardwareAgents.id,
        agentCode: hardwareAgents.code,
        agentName: hardwareAgents.name,
      })
      .from(hardwareJobAttempts)
      .innerJoin(
        hardwareAgents,
        eq(hardwareJobAttempts.agentId, hardwareAgents.id),
      )
      .where(eq(hardwareJobAttempts.jobId, row.id))
      .orderBy(desc(hardwareJobAttempts.attemptNumber)),

    db
      .select({
        id: hardwareJobResolutions.id,
        attemptId: hardwareJobResolutions.attemptId,
        resolutionType: hardwareJobResolutions.resolutionType,
        reason: hardwareJobResolutions.reason,
        duplicateRiskAcknowledged:
          hardwareJobResolutions.duplicateRiskAcknowledged,
        previousStatus: hardwareJobResolutions.previousStatus,
        nextStatus: hardwareJobResolutions.nextStatus,
        resolvedByUserId: hardwareJobResolutions.resolvedByUserId,
        resolvedByName: users.fullName,
        createdAt: hardwareJobResolutions.createdAt,
      })
      .from(hardwareJobResolutions)
      .leftJoin(users, eq(hardwareJobResolutions.resolvedByUserId, users.id))
      .where(eq(hardwareJobResolutions.jobId, row.id))
      .orderBy(desc(hardwareJobResolutions.createdAt)),
  ]);

  const result = toRecord(row.result);
  const latestResolution = resolutionRows[0] ?? null;

  return {
    job: {
      id: row.id,
      protocolVersion: row.protocolVersion,
      jobType: row.jobType,
      deviceType: row.deviceType,
      status: row.status,
      targetDevice: row.targetDevice,
      requiredCapability: row.requiredCapability,
      currentAttemptId: row.currentAttemptId,
      payloadHash: row.payloadHash,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      error: row.error,
      lastErrorCode: row.lastErrorCode,
      lastErrorMessage: row.lastErrorMessage,
      errorCategory: readString(result.errorCategory),
      errorCode: readString(result.errorCode),
      durationMs: readNumber(result.durationMs),
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      claimedAt: row.claimedAt,
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
      completedAt: row.completedAt,
      failedAt: row.failedAt,
      unknownAt: row.unknownAt,
      expiresAt: row.expiresAt,
      isStale: false,
      manualResolution: latestResolution
        ? {
            resolutionType: latestResolution.resolutionType,
            reason: latestResolution.reason,
            duplicateRiskAcknowledged:
              latestResolution.duplicateRiskAcknowledged,
            resolvedByUserId: latestResolution.resolvedByUserId,
            resolvedByName: latestResolution.resolvedByName,
            createdAt: latestResolution.createdAt,
          }
        : null,
      agent: row.agentId
        ? {
            id: row.agentId,
            code: row.agentCode!,
            name: row.agentName!,
          }
        : null,
      outlet: {
        id: row.outletId,
        code: row.outletCode,
        name: row.outletName,
      },
      register: {
        id: row.registerId,
        code: row.registerCode,
        name: row.registerName,
      },
    },
    attempts: attemptRows.map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      eventSequence: attempt.eventSequence,
      dispatchStartedAt: attempt.dispatchStartedAt,
      submittedAt: attempt.submittedAt,
      serverAcknowledgedAt: attempt.serverAcknowledgedAt,
      finishedAt: attempt.finishedAt,
      errorCode: attempt.errorCode,
      errorMessage: attempt.errorMessage,
      retrySafe: attempt.retrySafe,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
      agent: {
        id: attempt.agentId,
        code: attempt.agentCode,
        name: attempt.agentName,
      },
    })),
    resolutions: resolutionRows.map((resolution) => ({
      id: resolution.id,
      attemptId: resolution.attemptId,
      resolutionType: resolution.resolutionType,
      reason: resolution.reason,
      duplicateRiskAcknowledged: resolution.duplicateRiskAcknowledged,
      previousStatus: resolution.previousStatus,
      nextStatus: resolution.nextStatus,
      resolvedByUserId: resolution.resolvedByUserId,
      resolvedByName: resolution.resolvedByName,
      createdAt: resolution.createdAt,
    })),
  };
}

