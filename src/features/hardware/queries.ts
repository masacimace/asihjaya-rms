import { and, count, desc, eq, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import {
  hardwareAgents,
  hardwareJobs,
  outlets,
  registers,
} from "@/db/schema";
import { getHardwareJobCleanupPreview } from "@/lib/hardware/job-cleanup";
import { getStaleHardwareJobCutoff } from "@/lib/hardware/job-recovery";
import type { AuthContext } from "@/lib/auth/session";
import type {
  HardwareAgentDiagnostics,
  HardwareAgentDisplayStatus,
  HardwareHubDashboard,
  HardwareJobCleanupPreview,
  HardwareJobStatusSummary,
} from "./contracts";

const ONLINE_WINDOW_MS = 90 * 1000;
const STALE_WINDOW_MS = 5 * 60 * 1000;

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

function createEmptyCleanupPreview(now = new Date()): HardwareJobCleanupPreview {
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

  const [
    agentRows,
    recentJobRows,
    statusRows,
    staleJobRows,
    cleanupPreview,
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
      .orderBy(desc(hardwareAgents.lastSeenAt), desc(hardwareAgents.createdAt)),

    db
      .select({
        id: hardwareJobs.id,
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
        agentId: hardwareAgents.id,
        agentCode: hardwareAgents.code,
        agentName: hardwareAgents.name,
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
      .leftJoin(hardwareAgents, eq(hardwareJobs.agentId, hardwareAgents.id))
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
          inArray(hardwareJobs.status, ["claimed", "printing"]),
          lt(hardwareJobs.updatedAt, staleJobCutoff),
        ),
      ),

    getHardwareJobCleanupPreview({
      organizationId: auth.organization.id,
      outletIds,
      now,
    }),
  ]);

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

    return {
      id: row.id,
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
        (row.status === "claimed" || row.status === "printing") &&
        row.updatedAt < staleJobCutoff,
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
    totals: {
      agents: agents.length,
      onlineAgents: agents.filter((agent) => agent.displayStatus === "online")
        .length,
      staleAgents: agents.filter((agent) => agent.displayStatus === "stale")
        .length,
      offlineAgents: agents.filter((agent) => agent.displayStatus === "offline")
        .length,
      disabledAgents: agents.filter((agent) => agent.displayStatus === "disabled")
        .length,
      configurationWarningAgents: agents.filter(
        (agent) => agent.diagnostics.hasConfigWarnings,
      ).length,
      pendingJobs:
        jobStatusSummary.pending +
        jobStatusSummary.claimed +
        jobStatusSummary.processing +
        jobStatusSummary.printing +
        jobStatusSummary.submitted,
      failedJobs:
        jobStatusSummary.failed + jobStatusSummary.unknown_outcome,
      staleJobs,
      cleanupEligibleJobs: cleanupSummary.totalEligible,
    },
  };
}
