import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  hardwareJobResolutions,
  hardwareJobs,
} from "@/db/schema";
import {
  getHardwareUnknownResolutionDecision,
  type HardwareUnknownResolutionInput,
} from "@/lib/hardware/job-resolution-policy-v2";
import {
  getHardwareJobExpiresAt,
  HARDWARE_JOB_PROTOCOL_V2,
} from "@/lib/hardware/job-protocol-v2";

export class HardwareUnknownResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HardwareUnknownResolutionError";
  }
}

type ResolveHardwareUnknownOutcomeInput = HardwareUnknownResolutionInput & {
  jobId: string;
  organizationId: string;
  accessibleOutletIds: readonly string[];
  resolvedByUserId: string;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export async function resolveHardwareUnknownOutcome({
  jobId,
  organizationId,
  accessibleOutletIds,
  resolvedByUserId,
  resolutionType,
  reason,
  duplicateRiskAcknowledged,
  requestId = null,
  ipAddress = null,
  userAgent = null,
  now = new Date(),
}: ResolveHardwareUnknownOutcomeInput) {
  if (accessibleOutletIds.length === 0) {
    throw new HardwareUnknownResolutionError(
      "Tidak ada outlet yang dapat diakses untuk resolusi ini.",
    );
  }

  const decision = getHardwareUnknownResolutionDecision(resolutionType);

  return db.transaction(async (tx) => {
    const [job] = await tx
      .select({
        id: hardwareJobs.id,
        organizationId: hardwareJobs.organizationId,
        outletId: hardwareJobs.outletId,
        registerId: hardwareJobs.registerId,
        currentAttemptId: hardwareJobs.currentAttemptId,
        protocolVersion: hardwareJobs.protocolVersion,
        jobType: hardwareJobs.jobType,
        deviceType: hardwareJobs.deviceType,
        status: hardwareJobs.status,
        attempts: hardwareJobs.attempts,
        maxAttempts: hardwareJobs.maxAttempts,
        sourceType: hardwareJobs.sourceType,
        sourceId: hardwareJobs.sourceId,
        result: hardwareJobs.result,
        lastErrorCode: hardwareJobs.lastErrorCode,
        lastErrorMessage: hardwareJobs.lastErrorMessage,
      })
      .from(hardwareJobs)
      .where(
        and(
          eq(hardwareJobs.id, jobId),
          eq(hardwareJobs.organizationId, organizationId),
        ),
      )
      .limit(1)
      .for("update");

    if (!job || !accessibleOutletIds.includes(job.outletId)) {
      throw new HardwareUnknownResolutionError(
        "Hardware job tidak ditemukan dalam akses outlet Anda.",
      );
    }

    if (job.protocolVersion !== HARDWARE_JOB_PROTOCOL_V2) {
      throw new HardwareUnknownResolutionError(
        "Resolusi hasil tidak pasti hanya tersedia untuk Hardware Protocol v2.",
      );
    }

    if (job.status !== "unknown_outcome") {
      throw new HardwareUnknownResolutionError(
        "Job ini sudah berubah dan tidak lagi berstatus hasil tidak pasti.",
      );
    }

    const previousResult = toRecord(job.result);
    const resolutionMetadata = {
      resolutionType,
      reason,
      duplicateRiskAcknowledged,
      resolvedAt: now.toISOString(),
      resolvedByUserId,
      previousAttemptId: job.currentAttemptId,
      previousErrorCode: job.lastErrorCode,
      previousErrorMessage: job.lastErrorMessage,
    };

    const commonUpdate = {
      createdByUserId: resolvedByUserId,
      result: {
        ...previousResult,
        manualResolution: resolutionMetadata,
      },
      updatedAt: now,
    };

    const updateValues: Partial<typeof hardwareJobs.$inferInsert> =
      resolutionType === "confirmed_completed"
        ? {
            ...commonUpdate,
            status: "completed",
            completedAt: now,
            failedAt: null,
            cancelledAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            error: null,
          }
        : resolutionType === "retry_authorized"
          ? {
              ...commonUpdate,
              agentId: null,
              currentAttemptId: null,
              status: "pending",
              maxAttempts: Math.max(job.maxAttempts, job.attempts + 1),
              availableAt: now,
              expiresAt: getHardwareJobExpiresAt({
                jobType: job.jobType,
                mode: "manual",
                now,
              }),
              claimedAt: null,
              processingAt: null,
              startedAt: null,
              submittedAt: null,
              completedAt: null,
              failedAt: null,
              unknownAt: null,
              expiredAt: null,
              cancelledAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              error: null,
            }
          : {
              ...commonUpdate,
              status: "cancelled",
              cancelledAt: now,
              lastErrorCode: null,
              lastErrorMessage: null,
              error: null,
            };

    const [updatedJob] = await tx
      .update(hardwareJobs)
      .set(updateValues)
      .where(
        and(
          eq(hardwareJobs.id, job.id),
          eq(hardwareJobs.status, "unknown_outcome"),
        ),
      )
      .returning({
        id: hardwareJobs.id,
        status: hardwareJobs.status,
        outletId: hardwareJobs.outletId,
        registerId: hardwareJobs.registerId,
        currentAttemptId: hardwareJobs.currentAttemptId,
        sourceType: hardwareJobs.sourceType,
        sourceId: hardwareJobs.sourceId,
      });

    if (!updatedJob) {
      throw new HardwareUnknownResolutionError(
        "Hardware job berubah ketika resolusi diproses. Muat ulang halaman.",
      );
    }

    const [resolution] = await tx
      .insert(hardwareJobResolutions)
      .values({
        organizationId,
        outletId: job.outletId,
        jobId: job.id,
        attemptId: job.currentAttemptId,
        resolvedByUserId,
        resolutionType,
        reason,
        duplicateRiskAcknowledged,
        previousStatus: "unknown_outcome",
        nextStatus: decision.nextStatus,
        metadata: resolutionMetadata,
      })
      .returning({ id: hardwareJobResolutions.id });

    await tx.insert(auditLogs).values({
      organizationId,
      outletId: job.outletId,
      actorUserId: resolvedByUserId,
      action: `hardware.job_unknown_${resolutionType}`,
      entityType: "hardware_job",
      entityId: job.id,
      beforeData: {
        status: job.status,
        currentAttemptId: job.currentAttemptId,
        lastErrorCode: job.lastErrorCode,
        lastErrorMessage: job.lastErrorMessage,
      },
      afterData: {
        status: updatedJob.status,
        currentAttemptId: updatedJob.currentAttemptId,
        resolutionId: resolution?.id ?? null,
      },
      reason,
      requestId: requestId?.slice(0, 120) ?? null,
      ipAddress: ipAddress?.slice(0, 64) ?? null,
      userAgent: userAgent?.slice(0, 500) ?? null,
      metadata: {
        resolutionType,
        duplicateRiskAcknowledged,
        attemptId: job.currentAttemptId,
        jobType: job.jobType,
        deviceType: job.deviceType,
        registerId: job.registerId,
        sourceType: job.sourceType,
        sourceId: job.sourceId,
      },
    });

    return {
      jobId: updatedJob.id,
      status: updatedJob.status,
      outletId: updatedJob.outletId,
      registerId: updatedJob.registerId,
      sourceType: updatedJob.sourceType,
      sourceId: updatedJob.sourceId,
      jobType: job.jobType,
      deviceType: job.deviceType,
      resolutionId: resolution?.id ?? null,
      resolutionType,
      reason,
      duplicateRiskAcknowledged,
    };
  });
}
