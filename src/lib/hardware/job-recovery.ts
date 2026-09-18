import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, hardwareJobs } from "@/db/schema";
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
  orphanedV2Failed: number;
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

function applyScopeConditions(
  conditions: ReturnType<typeof eq>[],
  { outletIds, outletId, registerId }: Omit<StaleHardwareJobScope, "organizationId">,
) {
  if (outletId) {
    conditions.push(eq(hardwareJobs.outletId, outletId));
  } else if (outletIds && outletIds.length > 0) {
    conditions.push(inArray(hardwareJobs.outletId, outletIds));
  }

  if (registerId) {
    conditions.push(eq(hardwareJobs.registerId, registerId));
  }

  return conditions;
}

function buildStaleHardwareJobWhere({
  organizationId,
  outletIds,
  outletId,
  registerId,
  cutoff,
}: StaleHardwareJobScope & { cutoff: Date }) {
  const conditions = applyScopeConditions(
    [
      eq(hardwareJobs.organizationId, organizationId),
      // Normal Protocol v2 lease recovery is handled by the claim API and attempt
      // state machine. This legacy path only handles v1 claimed/printing rows.
      eq(hardwareJobs.protocolVersion, 1),
      inArray(hardwareJobs.status, staleRecoverableStatuses),
      lt(hardwareJobs.updatedAt, cutoff),
    ],
    { outletIds, outletId, registerId },
  );

  return and(...conditions);
}

function buildOrphanedV2ClaimWhere({
  organizationId,
  outletIds,
  outletId,
  registerId,
  cutoff,
}: StaleHardwareJobScope & { cutoff: Date }) {
  const conditions = applyScopeConditions(
    [
      eq(hardwareJobs.organizationId, organizationId),
      eq(hardwareJobs.protocolVersion, 2),
      eq(hardwareJobs.status, "claimed"),
      isNull(hardwareJobs.currentAttemptId),
      lt(hardwareJobs.updatedAt, cutoff),
    ],
    { outletIds, outletId, registerId },
  );

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
  const orphanedV2Where = buildOrphanedV2ClaimWhere({
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

  // Historical/pre-attempt Protocol v2 data can contain a claimed job without a
  // current attempt. Current Protocol v2 can never create that shape. A dead
  // agent therefore cannot renew/recover it through the claim endpoint, while
  // lifecycle actions remain blocked forever. Mark only stale orphaned claimed
  // rows failed; never detach a valid Protocol v2 attempt and never auto-retry.
  const orphanedV2Rows = await db
    .update(hardwareJobs)
    .set({
      status: "failed",
      error:
        "Protocol v2 job lama terdeteksi claimed tanpa current attempt. Job dihentikan agar perangkat dapat dikelola dengan aman; retry harus dilakukan manual bila masih diperlukan.",
      lastErrorCode: "ORPHANED_V2_CLAIM",
      lastErrorMessage:
        "Stale Protocol v2 claimed job tidak memiliki current attempt; automatic retry dinonaktifkan.",
      result: {
        ...recoveryMetadata,
        finalStatus: "failed_orphaned_v2_claim",
        retryPolicy: "manual_only",
      },
      failedAt: now,
      updatedAt: now,
    })
    .where(orphanedV2Where)
    .returning({
      id: hardwareJobs.id,
      outletId: hardwareJobs.outletId,
      jobType: hardwareJobs.jobType,
      agentId: hardwareJobs.agentId,
    });

  if (orphanedV2Rows.length > 0) {
    await db.insert(auditLogs).values(
      orphanedV2Rows.map((job) => ({
        organizationId,
        outletId: job.outletId,
        actorUserId: null,
        action: "hardware.job_failed",
        entityType: "hardware_job",
        entityId: job.id,
        beforeData: {
          protocolVersion: 2,
          status: "claimed",
          currentAttemptId: null,
        },
        afterData: {
          protocolVersion: 2,
          status: "failed",
          errorCode: "ORPHANED_V2_CLAIM",
        },
        reason:
          "Stale Protocol v2 claimed job tanpa current attempt dipulihkan oleh maintenance dashboard.",
        metadata: {
          recoveredBy: reason,
          jobType: job.jobType,
          agentId: job.agentId,
          staleMinutes,
        },
        createdAt: now,
      })),
    );
  }

  const requeuedJobIds = requeuedRows.map((row) => row.id);
  const failedJobIds = [
    ...failedRows.map((row) => row.id),
    ...orphanedV2Rows.map((row) => row.id),
  ];

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
    failed: failedJobIds.length,
    orphanedV2Failed: orphanedV2Rows.length,
    requeuedJobIds,
    failedJobIds,
  };
}
