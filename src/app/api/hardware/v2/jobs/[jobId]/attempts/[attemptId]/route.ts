import { NextRequest, NextResponse } from "next/server";

import {
  createHardwareJobFailedNotification,
  createHardwareJobUnknownOutcomeNotification,
  markHardwareJobFailureResolved,
  markHardwareJobSubmittedStaleResolved,
} from "@/features/notifications/hardware";
import { authenticateHardwareAgent } from "@/lib/hardware/agent-auth";
import { touchHardwareAgent } from "@/lib/hardware/agent-presence";
import { applyHardwareJobAttemptV2Event } from "@/lib/hardware/job-attempt-v2";
import { HARDWARE_JOB_PROTOCOL_V2 } from "@/lib/hardware/job-protocol-v2";
import { isHardwareJobProtocolV2Error } from "@/lib/hardware/job-protocol-v2-error";
import {
  assertHardwareProtocolV2Request,
  assertUuid,
  parseHardwareJobAttemptV2Event,
  readHardwareJobLeaseToken,
} from "@/lib/hardware/job-protocol-v2-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    jobId: string;
    attemptId: string;
  }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const now = new Date();

  try {
    assertHardwareProtocolV2Request(req);

    const auth = await authenticateHardwareAgent(req);
    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED_AGENT",
            message: "Unauthorized hardware agent.",
            retryable: false,
          },
          serverTime: now.toISOString(),
        },
        { status: 401 },
      );
    }

    const { jobId, attemptId } = await context.params;
    assertUuid(jobId, "jobId");
    assertUuid(attemptId, "attemptId");

    const leaseToken = readHardwareJobLeaseToken(req);
    const event = await parseHardwareJobAttemptV2Event(req);
    const result = await applyHardwareJobAttemptV2Event({
      auth,
      jobId,
      attemptId,
      leaseToken,
      event,
      now,
    });

    await touchHardwareAgent({ auth, req, now });

    if (!result.duplicate && result.job.status === "failed") {
      await createHardwareJobFailedNotification({
        organizationId: auth.agent.organizationId,
        outletId: auth.agent.outletId,
        registerId: auth.agent.registerId,
        agentId: auth.agent.id,
        jobId,
        jobType: result.job.jobType,
        deviceType: result.job.deviceType,
        error: event.error?.message ?? null,
        source: "agent_v2_update",
      }).catch((notificationError) => {
        console.error(
          "[hardware-v2] gagal membuat failure notification",
          notificationError,
        );
      });
    }

    if (!result.duplicate && result.job.status === "unknown_outcome") {
      await createHardwareJobUnknownOutcomeNotification({
        organizationId: auth.agent.organizationId,
        outletId: auth.agent.outletId,
        registerId: auth.agent.registerId,
        agentId: auth.agent.id,
        jobId,
        attemptId,
        jobType: result.job.jobType,
        deviceType: result.job.deviceType,
        error:
          event.error?.message ??
          "Hasil hardware tidak dapat dipastikan; periksa sebelum retry.",
        source: "agent_v2_unknown_outcome",
      }).catch((notificationError) => {
        console.error(
          "[hardware-v2] gagal membuat unknown-outcome notification",
          notificationError,
        );
      });
    }

    if (!result.duplicate && result.job.status === "completed") {
      await markHardwareJobSubmittedStaleResolved({
        organizationId: auth.agent.organizationId,
        jobId,
        resolvedAt: now,
      }).catch((notificationError) => {
        console.error(
          "[hardware-v2] gagal resolve submitted-stale notification",
          notificationError,
        );
      });

      await markHardwareJobFailureResolved({
        organizationId: auth.agent.organizationId,
        outletId: auth.agent.outletId,
        registerId: auth.agent.registerId,
        agentId: auth.agent.id,
        jobId,
        deviceType: result.job.deviceType,
        resolvedAt: now,
      }).catch((notificationError) => {
        console.error(
          "[hardware-v2] gagal resolve hardware notification",
          notificationError,
        );
      });
    }

    return NextResponse.json({
      success: true,
      protocolVersion: HARDWARE_JOB_PROTOCOL_V2,
      duplicate: result.duplicate,
      disposition: result.disposition,
      job: {
        ...result.job,
        availableAt: result.job.availableAt.toISOString(),
        completedAt: result.job.completedAt?.toISOString() ?? null,
        failedAt: result.job.failedAt?.toISOString() ?? null,
        unknownAt: result.job.unknownAt?.toISOString() ?? null,
      },
      attempt: {
        ...result.attempt,
        leaseExpiresAt: result.attempt.leaseExpiresAt.toISOString(),
      },
      serverTime: now.toISOString(),
    });
  } catch (error) {
    if (isHardwareJobProtocolV2Error(error)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          },
          serverTime: now.toISOString(),
        },
        { status: error.status },
      );
    }

    console.error("[hardware-v2] attempt update failed", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Hardware attempt event gagal diproses.",
          retryable: true,
        },
        serverTime: now.toISOString(),
      },
      { status: 500 },
    );
  }
}
