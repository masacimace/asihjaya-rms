import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  or,
} from "drizzle-orm";

import { db } from "@/db";
import {
  hardwareJobAttempts,
  hardwareJobs,
} from "@/db/schema";
import type { HardwareAgentAuth } from "@/lib/hardware/agent-auth";
import { createHardwareJobLease } from "@/lib/hardware/job-lease-v2";
import {
  getClaimableHardwareCapabilities,
  getHardwareJobRetryAvailableAt,
  hardwareJobLeaseRequiredStatuses,
  HARDWARE_JOB_PROTOCOL_V2,
  type HardwareCapability,
} from "@/lib/hardware/job-protocol-v2";

const MAX_LEASE_RECOVERY_PER_CLAIM = 25;

export type HardwareJobLeaseRecoveryV2 = {
  expiredPendingJobs: number;
  requeuedAttempts: number;
  failedAttempts: number;
  unknownAttempts: number;
};

export type ClaimedHardwareJobV2 = {
  job: {
    id: string;
    jobType: string;
    deviceType: string;
    requiredCapability: string;
    targetDevice: string | null;
    payload: Record<string, unknown>;
    payloadHash: string;
    expiresAt: Date;
    priority: number;
    sourceType: string | null;
    sourceId: string | null;
  };
  attempt: {
    id: string;
    number: number;
    leaseToken: string;
    leaseExpiresAt: Date;
  };
};

async function expirePendingHardwareJobsV2({
  auth,
  now,
}: {
  auth: HardwareAgentAuth;
  now: Date;
}): Promise<number> {
  const expired = await db
    .update(hardwareJobs)
    .set({
      status: "expired",
      expiredAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(hardwareJobs.organizationId, auth.agent.organizationId),
        eq(hardwareJobs.outletId, auth.agent.outletId),
        eq(hardwareJobs.registerId, auth.agent.registerId),
        eq(hardwareJobs.protocolVersion, HARDWARE_JOB_PROTOCOL_V2),
        eq(hardwareJobs.status, "pending"),
        lte(hardwareJobs.expiresAt, now),
      ),
    )
    .returning({ id: hardwareJobs.id });

  return expired.length;
}

async function recoverExpiredHardwareJobLeasesV2({
  auth,
  now,
}: {
  auth: HardwareAgentAuth;
  now: Date;
}): Promise<Omit<HardwareJobLeaseRecoveryV2, "expiredPendingJobs">> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        jobId: hardwareJobs.id,
        jobStatus: hardwareJobs.status,
        jobAttempts: hardwareJobs.attempts,
        jobMaxAttempts: hardwareJobs.maxAttempts,
        jobExpiresAt: hardwareJobs.expiresAt,
        attemptId: hardwareJobAttempts.id,
        attemptNumber: hardwareJobAttempts.attemptNumber,
        attemptStatus: hardwareJobAttempts.status,
      })
      .from(hardwareJobs)
      .innerJoin(
        hardwareJobAttempts,
        eq(hardwareJobs.currentAttemptId, hardwareJobAttempts.id),
      )
      .where(
        and(
          eq(hardwareJobs.organizationId, auth.agent.organizationId),
          eq(hardwareJobs.outletId, auth.agent.outletId),
          eq(hardwareJobs.registerId, auth.agent.registerId),
          eq(hardwareJobs.protocolVersion, HARDWARE_JOB_PROTOCOL_V2),
          inArray(hardwareJobAttempts.status, [
            ...hardwareJobLeaseRequiredStatuses,
          ]),
          lte(hardwareJobAttempts.leaseExpiresAt, now),
        ),
      )
      .orderBy(asc(hardwareJobAttempts.leaseExpiresAt))
      .limit(MAX_LEASE_RECOVERY_PER_CLAIM)
      .for("update", { skipLocked: true });

    let requeuedAttempts = 0;
    let failedAttempts = 0;
    let unknownAttempts = 0;

    for (const row of rows) {
      if (row.attemptStatus === "dispatching") {
        await tx
          .update(hardwareJobAttempts)
          .set({
            status: "unknown_after_dispatch",
            finishedAt: now,
            errorCode: "LEASE_EXPIRED_AFTER_DISPATCH",
            errorMessage:
              "Lease berakhir setelah dispatch dimulai; hasil hardware tidak dapat dipastikan.",
            retrySafe: false,
            updatedAt: now,
          })
          .where(eq(hardwareJobAttempts.id, row.attemptId));

        await tx
          .update(hardwareJobs)
          .set({
            status: "unknown_outcome",
            unknownAt: now,
            lastErrorCode: "LEASE_EXPIRED_AFTER_DISPATCH",
            lastErrorMessage:
              "Lease berakhir setelah dispatch dimulai; automatic retry dinonaktifkan.",
            updatedAt: now,
          })
          .where(eq(hardwareJobs.id, row.jobId));

        unknownAttempts += 1;
        continue;
      }

      await tx
        .update(hardwareJobAttempts)
        .set({
          status: "lease_expired",
          finishedAt: now,
          errorCode: "LEASE_EXPIRED_BEFORE_DISPATCH",
          errorMessage: "Lease berakhir sebelum dispatch dimulai.",
          retrySafe: true,
          updatedAt: now,
        })
        .where(eq(hardwareJobAttempts.id, row.attemptId));

      const canRetry =
        row.jobAttempts < row.jobMaxAttempts &&
        Boolean(row.jobExpiresAt && row.jobExpiresAt.getTime() > now.getTime());

      if (canRetry) {
        await tx
          .update(hardwareJobs)
          .set({
            agentId: null,
            currentAttemptId: null,
            status: "pending",
            availableAt: getHardwareJobRetryAvailableAt({
              attemptNumber: row.attemptNumber,
              now,
            }),
            claimedAt: null,
            processingAt: null,
            startedAt: null,
            lastErrorCode: "LEASE_EXPIRED_BEFORE_DISPATCH",
            lastErrorMessage: "Attempt akan dicoba ulang setelah backoff.",
            updatedAt: now,
          })
          .where(eq(hardwareJobs.id, row.jobId));

        requeuedAttempts += 1;
      } else {
        await tx
          .update(hardwareJobs)
          .set({
            status: "failed",
            failedAt: now,
            lastErrorCode: "LEASE_EXPIRED_BEFORE_DISPATCH",
            lastErrorMessage:
              "Lease berakhir dan batas attempt atau expiry job telah tercapai.",
            updatedAt: now,
          })
          .where(eq(hardwareJobs.id, row.jobId));

        failedAttempts += 1;
      }
    }

    return { requeuedAttempts, failedAttempts, unknownAttempts };
  });
}

export async function claimHardwareJobV2({
  auth,
  requestedCapabilities,
  now = new Date(),
}: {
  auth: HardwareAgentAuth;
  requestedCapabilities: readonly HardwareCapability[];
  now?: Date;
}): Promise<{
  claimed: ClaimedHardwareJobV2 | null;
  recovery: HardwareJobLeaseRecoveryV2;
  effectiveCapabilities: HardwareCapability[];
}> {
  const effectiveCapabilities = getClaimableHardwareCapabilities({
    storedCapabilities: auth.agent.capabilities,
    requestedCapabilities,
  });

  const [expiredPendingJobs, leaseRecovery] = await Promise.all([
    expirePendingHardwareJobsV2({ auth, now }),
    recoverExpiredHardwareJobLeasesV2({ auth, now }),
  ]);

  const recovery = { expiredPendingJobs, ...leaseRecovery };

  if (effectiveCapabilities.length === 0) {
    return { claimed: null, recovery, effectiveCapabilities };
  }

  const claimed = await db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({
        id: hardwareJobs.id,
        jobType: hardwareJobs.jobType,
        deviceType: hardwareJobs.deviceType,
        requiredCapability: hardwareJobs.requiredCapability,
        targetDevice: hardwareJobs.targetDevice,
        payload: hardwareJobs.payload,
        payloadHash: hardwareJobs.payloadHash,
        expiresAt: hardwareJobs.expiresAt,
        priority: hardwareJobs.priority,
        sourceType: hardwareJobs.sourceType,
        sourceId: hardwareJobs.sourceId,
        attempts: hardwareJobs.attempts,
        maxAttempts: hardwareJobs.maxAttempts,
      })
      .from(hardwareJobs)
      .where(
        and(
          eq(hardwareJobs.organizationId, auth.agent.organizationId),
          eq(hardwareJobs.outletId, auth.agent.outletId),
          eq(hardwareJobs.registerId, auth.agent.registerId),
          eq(hardwareJobs.protocolVersion, HARDWARE_JOB_PROTOCOL_V2),
          eq(hardwareJobs.status, "pending"),
          isNull(hardwareJobs.currentAttemptId),
          lte(hardwareJobs.availableAt, now),
          gt(hardwareJobs.expiresAt, now),
          lt(hardwareJobs.attempts, hardwareJobs.maxAttempts),
          inArray(hardwareJobs.requiredCapability, effectiveCapabilities),
          or(
            isNull(hardwareJobs.targetAgentId),
            eq(hardwareJobs.targetAgentId, auth.agent.id),
          ),
        ),
      )
      .orderBy(asc(hardwareJobs.priority), asc(hardwareJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (
      !candidate ||
      !candidate.requiredCapability ||
      !candidate.payloadHash ||
      !candidate.expiresAt
    ) {
      return null;
    }

    const attemptNumber = candidate.attempts + 1;
    const lease = createHardwareJobLease(now);

    const [attempt] = await tx
      .insert(hardwareJobAttempts)
      .values({
        jobId: candidate.id,
        agentId: auth.agent.id,
        attemptNumber,
        status: "claimed",
        leaseTokenHash: lease.tokenHash,
        leaseExpiresAt: lease.expiresAt,
        payloadHash: candidate.payloadHash,
        eventSequence: 0,
      })
      .returning({
        id: hardwareJobAttempts.id,
        attemptNumber: hardwareJobAttempts.attemptNumber,
      });

    if (!attempt) {
      throw new Error("Gagal membuat hardware job attempt v2.");
    }

    const [updatedJob] = await tx
      .update(hardwareJobs)
      .set({
        agentId: auth.agent.id,
        currentAttemptId: attempt.id,
        status: "claimed",
        attempts: attemptNumber,
        claimedAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(hardwareJobs.id, candidate.id),
          eq(hardwareJobs.status, "pending"),
          isNull(hardwareJobs.currentAttemptId),
        ),
      )
      .returning({ id: hardwareJobs.id });

    if (!updatedJob) {
      throw new Error("Hardware job v2 berubah sebelum claim diselesaikan.");
    }

    return {
      job: {
        id: candidate.id,
        jobType: candidate.jobType,
        deviceType: candidate.deviceType,
        requiredCapability: candidate.requiredCapability,
        targetDevice: candidate.targetDevice,
        payload: candidate.payload,
        payloadHash: candidate.payloadHash,
        expiresAt: candidate.expiresAt,
        priority: candidate.priority,
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
      },
      attempt: {
        id: attempt.id,
        number: attempt.attemptNumber,
        leaseToken: lease.token,
        leaseExpiresAt: lease.expiresAt,
      },
    } satisfies ClaimedHardwareJobV2;
  });

  return { claimed, recovery, effectiveCapabilities };
}
