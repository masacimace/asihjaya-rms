import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { hardwareJobAttempts, hardwareJobs } from "@/db/schema";
import type { HardwareAgentAuth } from "@/lib/hardware/agent-auth";
import {
  getHardwareJobLeaseExpiresAt,
  isHardwareJobLeaseExpired,
  verifyHardwareJobLeaseToken,
} from "@/lib/hardware/job-lease-v2";
import {
  doesHardwareJobAttemptRequireLiveLease,
  getHardwareJobRetryAvailableAt,
  HARDWARE_JOB_PROTOCOL_V2,
  isHardwareJobAttemptTransitionAllowed,
  isHardwareJobV2TransitionAllowed,
  type HardwareJobAttemptStatus,
  type HardwareJobV2Status,
} from "@/lib/hardware/job-protocol-v2";
import { HardwareJobProtocolV2Error } from "@/lib/hardware/job-protocol-v2-error";
import type { HardwareJobAttemptAgentEvent } from "@/lib/hardware/job-protocol-v2-http";

export type HardwareJobAttemptV2MutationResult = {
  duplicate: boolean;
  disposition: "updated" | "requeued";
  job: {
    id: string;
    jobType: string;
    deviceType: string;
    status: HardwareJobV2Status;
    currentAttemptId: string | null;
    availableAt: Date;
    completedAt: Date | null;
    failedAt: Date | null;
    unknownAt: Date | null;
  };
  attempt: {
    id: string;
    status: HardwareJobAttemptStatus;
    eventSequence: number;
    leaseExpiresAt: Date;
  };
};

function assertJobTransition(
  from: HardwareJobV2Status,
  to: HardwareJobV2Status,
  context: {
    dispatchStarted?: boolean;
    retrySafe?: boolean;
  } = {},
): void {
  if (!isHardwareJobV2TransitionAllowed(from, to, context)) {
    throw new HardwareJobProtocolV2Error({
      code: "INVALID_JOB_STATE_TRANSITION",
      message: `Job tidak dapat berubah dari ${from} ke ${to}.`,
      status: 409,
    });
  }
}

export async function applyHardwareJobAttemptV2Event({
  auth,
  jobId,
  attemptId,
  leaseToken,
  event,
  now = new Date(),
}: {
  auth: HardwareAgentAuth;
  jobId: string;
  attemptId: string;
  leaseToken: string;
  event: HardwareJobAttemptAgentEvent;
  now?: Date;
}): Promise<HardwareJobAttemptV2MutationResult> {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select({
        id: hardwareJobs.id,
        jobType: hardwareJobs.jobType,
        deviceType: hardwareJobs.deviceType,
        status: hardwareJobs.status,
        currentAttemptId: hardwareJobs.currentAttemptId,
        attempts: hardwareJobs.attempts,
        maxAttempts: hardwareJobs.maxAttempts,
        expiresAt: hardwareJobs.expiresAt,
        availableAt: hardwareJobs.availableAt,
        completedAt: hardwareJobs.completedAt,
        failedAt: hardwareJobs.failedAt,
        unknownAt: hardwareJobs.unknownAt,
        payloadHash: hardwareJobs.payloadHash,
      })
      .from(hardwareJobs)
      .where(
        and(
          eq(hardwareJobs.id, jobId),
          eq(hardwareJobs.organizationId, auth.agent.organizationId),
          eq(hardwareJobs.outletId, auth.agent.outletId),
          eq(hardwareJobs.registerId, auth.agent.registerId),
          eq(hardwareJobs.protocolVersion, HARDWARE_JOB_PROTOCOL_V2),
        ),
      )
      .limit(1)
      .for("update");

    if (!job) {
      throw new HardwareJobProtocolV2Error({
        code: "JOB_NOT_FOUND",
        message: "Hardware job v2 tidak ditemukan dalam scope agent.",
        status: 404,
      });
    }

    if (job.currentAttemptId !== attemptId) {
      throw new HardwareJobProtocolV2Error({
        code: "STALE_ATTEMPT",
        message: "Attempt bukan current attempt untuk job ini.",
        status: 409,
      });
    }

    const [attempt] = await tx
      .select({
        id: hardwareJobAttempts.id,
        agentId: hardwareJobAttempts.agentId,
        status: hardwareJobAttempts.status,
        eventSequence: hardwareJobAttempts.eventSequence,
        leaseTokenHash: hardwareJobAttempts.leaseTokenHash,
        leaseExpiresAt: hardwareJobAttempts.leaseExpiresAt,
        attemptNumber: hardwareJobAttempts.attemptNumber,
        payloadHash: hardwareJobAttempts.payloadHash,
      })
      .from(hardwareJobAttempts)
      .where(
        and(
          eq(hardwareJobAttempts.id, attemptId),
          eq(hardwareJobAttempts.jobId, jobId),
        ),
      )
      .limit(1)
      .for("update");

    if (!attempt || attempt.agentId !== auth.agent.id) {
      throw new HardwareJobProtocolV2Error({
        code: "ATTEMPT_NOT_FOUND",
        message: "Attempt tidak ditemukan atau tidak dimiliki agent ini.",
        status: 404,
      });
    }

    if (!verifyHardwareJobLeaseToken(leaseToken, attempt.leaseTokenHash)) {
      throw new HardwareJobProtocolV2Error({
        code: "INVALID_LEASE_TOKEN",
        message: "Lease token tidak valid.",
        status: 401,
      });
    }

    if (!job.payloadHash || job.payloadHash !== attempt.payloadHash) {
      throw new HardwareJobProtocolV2Error({
        code: "PAYLOAD_HASH_MISMATCH",
        message: "Payload hash job dan attempt tidak konsisten.",
        status: 409,
      });
    }

    if (event.eventSequence < attempt.eventSequence) {
      return {
        duplicate: true,
        disposition: "updated",
        job: {
          id: job.id,
          jobType: job.jobType,
          deviceType: job.deviceType,
          status: job.status as HardwareJobV2Status,
          currentAttemptId: job.currentAttemptId,
          availableAt: job.availableAt,
          completedAt: job.completedAt,
          failedAt: job.failedAt,
          unknownAt: job.unknownAt,
        },
        attempt: {
          id: attempt.id,
          status: attempt.status,
          eventSequence: attempt.eventSequence,
          leaseExpiresAt: attempt.leaseExpiresAt,
        },
      };
    }

    if (event.eventSequence === attempt.eventSequence) {
      if (event.status !== attempt.status) {
        throw new HardwareJobProtocolV2Error({
          code: "EVENT_SEQUENCE_CONFLICT",
          message: "Sequence yang sama sudah dipakai oleh status berbeda.",
          status: 409,
        });
      }

      return {
        duplicate: true,
        disposition: "updated",
        job: {
          id: job.id,
          jobType: job.jobType,
          deviceType: job.deviceType,
          status: job.status as HardwareJobV2Status,
          currentAttemptId: job.currentAttemptId,
          availableAt: job.availableAt,
          completedAt: job.completedAt,
          failedAt: job.failedAt,
          unknownAt: job.unknownAt,
        },
        attempt: {
          id: attempt.id,
          status: attempt.status,
          eventSequence: attempt.eventSequence,
          leaseExpiresAt: attempt.leaseExpiresAt,
        },
      };
    }

    if (event.eventSequence !== attempt.eventSequence + 1) {
      throw new HardwareJobProtocolV2Error({
        code: "EVENT_SEQUENCE_GAP",
        message: `Event berikutnya harus menggunakan sequence ${attempt.eventSequence + 1}.`,
        status: 409,
      });
    }

    if (
      doesHardwareJobAttemptRequireLiveLease(attempt.status) &&
      isHardwareJobLeaseExpired(attempt.leaseExpiresAt, now)
    ) {
      throw new HardwareJobProtocolV2Error({
        code: "LEASE_EXPIRED",
        message: "Lease attempt telah kedaluwarsa.",
        status: 409,
      });
    }

    if (!isHardwareJobAttemptTransitionAllowed(attempt.status, event.status)) {
      throw new HardwareJobProtocolV2Error({
        code: "INVALID_ATTEMPT_STATE_TRANSITION",
        message: `Attempt tidak dapat berubah dari ${attempt.status} ke ${event.status}.`,
        status: 409,
      });
    }

    const jobStatus = job.status as HardwareJobV2Status;
    const attemptUpdate: Partial<typeof hardwareJobAttempts.$inferInsert> = {
      status: event.status,
      eventSequence: event.eventSequence,
      result: {
        ...event.result,
        agentOccurredAt: event.occurredAt.toISOString(),
        idempotencyKey: event.idempotencyKey,
      },
      errorCode: event.error?.code ?? null,
      errorMessage: event.error?.message ?? null,
      retrySafe: event.error?.retrySafe ?? null,
      updatedAt: now,
    };

    let nextJobStatus = jobStatus;
    let disposition: HardwareJobAttemptV2MutationResult["disposition"] =
      "updated";
    const jobUpdate: Partial<typeof hardwareJobs.$inferInsert> = {
      result: event.result,
      updatedAt: now,
    };

    switch (event.status) {
      case "processing": {
        assertJobTransition(jobStatus, "processing");
        nextJobStatus = "processing";
        jobUpdate.status = "processing";
        jobUpdate.processingAt = now;
        break;
      }

      case "dispatching": {
        if (jobStatus !== "processing") {
          throw new HardwareJobProtocolV2Error({
            code: "INVALID_JOB_STATE_TRANSITION",
            message: "Dispatch hanya dapat dimulai dari job processing.",
            status: 409,
          });
        }
        attemptUpdate.dispatchStartedAt = now;
        jobUpdate.startedAt = now;
        break;
      }

      case "submitted": {
        assertJobTransition(jobStatus, "submitted");
        nextJobStatus = "submitted";
        attemptUpdate.submittedAt = now;
        attemptUpdate.serverAcknowledgedAt = now;
        jobUpdate.status = "submitted";
        jobUpdate.submittedAt = now;
        break;
      }

      case "acknowledged": {
        assertJobTransition(jobStatus, "completed");
        nextJobStatus = "completed";
        attemptUpdate.finishedAt = now;
        jobUpdate.status = "completed";
        jobUpdate.completedAt = now;
        jobUpdate.lastErrorCode = null;
        jobUpdate.lastErrorMessage = null;
        break;
      }

      case "failed_before_dispatch": {
        const retrySafe = event.error?.retrySafe === true;
        const canRetry =
          retrySafe &&
          job.attempts < job.maxAttempts &&
          Boolean(job.expiresAt && job.expiresAt.getTime() > now.getTime());

        attemptUpdate.finishedAt = now;

        if (canRetry) {
          assertJobTransition(jobStatus, "pending", {
            dispatchStarted: false,
            retrySafe: true,
          });
          nextJobStatus = "pending";
          disposition = "requeued";
          jobUpdate.agentId = null;
          jobUpdate.currentAttemptId = null;
          jobUpdate.status = "pending";
          jobUpdate.availableAt = getHardwareJobRetryAvailableAt({
            attemptNumber: attempt.attemptNumber,
            now,
          });
          jobUpdate.claimedAt = null;
          jobUpdate.processingAt = null;
          jobUpdate.startedAt = null;
          jobUpdate.lastErrorCode = event.error?.code ?? "UNKNOWN_ERROR";
          jobUpdate.lastErrorMessage =
            event.error?.message ?? "Attempt gagal sebelum dispatch.";
        } else {
          assertJobTransition(jobStatus, "failed", {
            dispatchStarted: false,
          });
          nextJobStatus = "failed";
          jobUpdate.status = "failed";
          jobUpdate.failedAt = now;
          jobUpdate.lastErrorCode = event.error?.code ?? "UNKNOWN_ERROR";
          jobUpdate.lastErrorMessage =
            event.error?.message ?? "Attempt gagal sebelum dispatch.";
        }
        break;
      }

      case "unknown_after_dispatch": {
        assertJobTransition(jobStatus, "unknown_outcome", {
          dispatchStarted: true,
        });
        nextJobStatus = "unknown_outcome";
        attemptUpdate.finishedAt = now;
        jobUpdate.status = "unknown_outcome";
        jobUpdate.unknownAt = now;
        jobUpdate.lastErrorCode = event.error?.code ?? "DEVICE_RESULT_UNKNOWN";
        jobUpdate.lastErrorMessage =
          event.error?.message ?? "Hasil hardware tidak dapat dipastikan.";
        break;
      }
    }

    const [updatedAttempt] = await tx
      .update(hardwareJobAttempts)
      .set(attemptUpdate)
      .where(
        and(
          eq(hardwareJobAttempts.id, attempt.id),
          eq(hardwareJobAttempts.eventSequence, attempt.eventSequence),
        ),
      )
      .returning({
        id: hardwareJobAttempts.id,
        status: hardwareJobAttempts.status,
        eventSequence: hardwareJobAttempts.eventSequence,
        leaseExpiresAt: hardwareJobAttempts.leaseExpiresAt,
      });

    if (!updatedAttempt) {
      throw new HardwareJobProtocolV2Error({
        code: "ATTEMPT_UPDATE_CONFLICT",
        message: "Attempt berubah saat event diproses.",
        status: 409,
      });
    }

    const [updatedJob] = await tx
      .update(hardwareJobs)
      .set(jobUpdate)
      .where(eq(hardwareJobs.id, job.id))
      .returning({
        id: hardwareJobs.id,
        jobType: hardwareJobs.jobType,
        deviceType: hardwareJobs.deviceType,
        status: hardwareJobs.status,
        currentAttemptId: hardwareJobs.currentAttemptId,
        availableAt: hardwareJobs.availableAt,
        completedAt: hardwareJobs.completedAt,
        failedAt: hardwareJobs.failedAt,
        unknownAt: hardwareJobs.unknownAt,
      });

    if (!updatedJob) {
      throw new HardwareJobProtocolV2Error({
        code: "JOB_UPDATE_CONFLICT",
        message: "Job gagal diperbarui setelah attempt event.",
        status: 409,
      });
    }

    return {
      duplicate: false,
      disposition,
      job: {
        ...updatedJob,
        status: nextJobStatus,
      },
      attempt: updatedAttempt,
    };
  });
}

export async function renewHardwareJobAttemptV2Lease({
  auth,
  jobId,
  attemptId,
  leaseToken,
  now = new Date(),
}: {
  auth: HardwareAgentAuth;
  jobId: string;
  attemptId: string;
  leaseToken: string;
  now?: Date;
}): Promise<{
  attemptId: string;
  status: HardwareJobAttemptStatus;
  leaseExpiresAt: Date;
}> {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select({ currentAttemptId: hardwareJobs.currentAttemptId })
      .from(hardwareJobs)
      .where(
        and(
          eq(hardwareJobs.id, jobId),
          eq(hardwareJobs.organizationId, auth.agent.organizationId),
          eq(hardwareJobs.outletId, auth.agent.outletId),
          eq(hardwareJobs.registerId, auth.agent.registerId),
          eq(hardwareJobs.protocolVersion, HARDWARE_JOB_PROTOCOL_V2),
        ),
      )
      .limit(1)
      .for("update");

    if (!job || job.currentAttemptId !== attemptId) {
      throw new HardwareJobProtocolV2Error({
        code: "STALE_ATTEMPT",
        message: "Attempt bukan current attempt untuk job ini.",
        status: 409,
      });
    }

    const [attempt] = await tx
      .select({
        id: hardwareJobAttempts.id,
        agentId: hardwareJobAttempts.agentId,
        status: hardwareJobAttempts.status,
        leaseTokenHash: hardwareJobAttempts.leaseTokenHash,
        leaseExpiresAt: hardwareJobAttempts.leaseExpiresAt,
      })
      .from(hardwareJobAttempts)
      .where(
        and(
          eq(hardwareJobAttempts.id, attemptId),
          eq(hardwareJobAttempts.jobId, jobId),
        ),
      )
      .limit(1)
      .for("update");

    if (!attempt || attempt.agentId !== auth.agent.id) {
      throw new HardwareJobProtocolV2Error({
        code: "ATTEMPT_NOT_FOUND",
        message: "Attempt tidak ditemukan atau tidak dimiliki agent ini.",
        status: 404,
      });
    }

    if (!verifyHardwareJobLeaseToken(leaseToken, attempt.leaseTokenHash)) {
      throw new HardwareJobProtocolV2Error({
        code: "INVALID_LEASE_TOKEN",
        message: "Lease token tidak valid.",
        status: 401,
      });
    }

    if (!doesHardwareJobAttemptRequireLiveLease(attempt.status)) {
      throw new HardwareJobProtocolV2Error({
        code: "LEASE_NOT_RENEWABLE",
        message: `Lease tidak dapat diperpanjang pada status ${attempt.status}.`,
        status: 409,
      });
    }

    if (isHardwareJobLeaseExpired(attempt.leaseExpiresAt, now)) {
      throw new HardwareJobProtocolV2Error({
        code: "LEASE_EXPIRED",
        message: "Lease attempt telah kedaluwarsa.",
        status: 409,
      });
    }

    const leaseExpiresAt = getHardwareJobLeaseExpiresAt(now);
    const [updated] = await tx
      .update(hardwareJobAttempts)
      .set({ leaseExpiresAt, updatedAt: now })
      .where(eq(hardwareJobAttempts.id, attempt.id))
      .returning({
        attemptId: hardwareJobAttempts.id,
        status: hardwareJobAttempts.status,
        leaseExpiresAt: hardwareJobAttempts.leaseExpiresAt,
      });

    if (!updated) {
      throw new HardwareJobProtocolV2Error({
        code: "LEASE_RENEWAL_CONFLICT",
        message: "Lease gagal diperpanjang.",
        status: 409,
      });
    }

    return updated;
  });
}
