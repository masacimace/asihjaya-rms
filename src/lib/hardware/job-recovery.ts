import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { hardwareJobs } from "@/db/schema";
import { notifyRecoveredHardwareJobs } from "@/features/notifications/hardware";

const DEFAULT_STALE_JOB_MINUTES = 10;
const MIN_STALE_JOB_MINUTES = 1;
const MAX_STALE_JOB_MINUTES = 120;

const staleRecoverableStatuses = ["claimed", "printing"] as const;

type RecoverStaleHardwareJobsParams = {
  organizationId: string;
  outletIds?: string[];
  outletId?: string;
  registerId?: string;
  now?: Date;
  reason?: string;
};

type StaleHardwareJobScope = {
  organizationId: string;
  outletIds?: string[];
  outletId?: string;
  registerId?: string;
};

export type RecoverStaleHardwareJobsResult = {
  cutoff: Date;
  staleMinutes: number;
  requeued: number;
  failed: number;
  requeuedJobIds: string[];
  failedJobIds: string[];
};

function getConfiguredStaleJobMinutes() {
  const value = Number(process.env.HARDWARE_JOB_STALE_MINUTES);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_STALE_JOB_MINUTES;
  }

  return Math.min(
    MAX_STALE_JOB_MINUTES,
    Math.max(MIN_STALE_JOB_MINUTES, Math.floor(value)),
  );
}

export function getStaleHardwareJobCutoff(now = new Date()) {
  const staleMinutes = getConfiguredStaleJobMinutes();
  const cutoff = new Date(now.getTime() - staleMinutes * 60 * 1000);

  return { cutoff, staleMinutes };
}

function buildStaleHardwareJobWhere({
  organizationId,
  outletIds,
  outletId,
  registerId,
  cutoff,
}: StaleHardwareJobScope & { cutoff: Date }) {
  const conditions = [
    eq(hardwareJobs.organizationId, organizationId),
    // Protocol v2 lease recovery is handled by the claim API and attempt state machine.
    // This legacy recovery path must never detach or requeue a v2 attempt.
    eq(hardwareJobs.protocolVersion, 1),
    inArray(hardwareJobs.status, staleRecoverableStatuses),
    lt(hardwareJobs.updatedAt, cutoff),
  ];

  if (outletId) {
    conditions.push(eq(hardwareJobs.outletId, outletId));
  } else if (outletIds && outletIds.length > 0) {
    conditions.push(inArray(hardwareJobs.outletId, outletIds));
  }

  if (registerId) {
    conditions.push(eq(hardwareJobs.registerId, registerId));
  }

  return and(...conditions);
}

export async function recoverStaleHardwareJobs({
  organizationId,
  outletIds,
  outletId,
  registerId,
  now = new Date(),
  reason = "auto_recovery",
}: RecoverStaleHardwareJobsParams): Promise<RecoverStaleHardwareJobsResult> {
  const { cutoff, staleMinutes } = getStaleHardwareJobCutoff(now);
  const baseWhere = buildStaleHardwareJobWhere({
    organizationId,
    outletIds,
    outletId,
    registerId,
    cutoff,
  });

  const recoveryMetadata = {
    recoveredBy: reason,
    recoveredAt: now.toISOString(),
    staleCutoff: cutoff.toISOString(),
    staleMinutes,
  };

  const requeuedRows = await db
    .update(hardwareJobs)
    .set({
      agentId: null,
      status: "pending",
      error: null,
      result: recoveryMetadata,
      availableAt: now,
      claimedAt: null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      updatedAt: now,
    })
    .where(
      and(
        baseWhere,
        sql`${hardwareJobs.attempts} < ${hardwareJobs.maxAttempts}`,
      ),
    )
    .returning({ id: hardwareJobs.id });

  const failedRows = await db
    .update(hardwareJobs)
    .set({
      status: "failed",
      error:
        "Hardware job macet dan sudah mencapai batas maksimum percobaan. Silakan cek agent/printer lalu jalankan Retry manual dari dashboard.",
      result: {
        ...recoveryMetadata,
        finalStatus: "failed_max_attempts_reached",
      },
      failedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        baseWhere,
        sql`${hardwareJobs.attempts} >= ${hardwareJobs.maxAttempts}`,
      ),
    )
    .returning({ id: hardwareJobs.id });

  const requeuedJobIds = requeuedRows.map((row) => row.id);
  const failedJobIds = failedRows.map((row) => row.id);

  await notifyRecoveredHardwareJobs({
    organizationId,
    requeuedJobIds,
    failedJobIds,
    staleMinutes,
    reason,
  });

  return {
    cutoff,
    staleMinutes,
    requeued: requeuedRows.length,
    failed: failedRows.length,
    requeuedJobIds,
    failedJobIds,
  };
}
