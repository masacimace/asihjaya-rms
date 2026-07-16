import { NextRequest, NextResponse } from "next/server";

import { authenticateHardwareAgent } from "@/lib/hardware/agent-auth";
import { touchHardwareAgent } from "@/lib/hardware/agent-presence";
import { renewHardwareJobAttemptV2Lease } from "@/lib/hardware/job-attempt-v2";
import { HARDWARE_JOB_PROTOCOL_V2 } from "@/lib/hardware/job-protocol-v2";
import { isHardwareJobProtocolV2Error } from "@/lib/hardware/job-protocol-v2-error";
import {
  assertHardwareProtocolV2Request,
  assertUuid,
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

export async function POST(req: NextRequest, context: RouteContext) {
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
    const result = await renewHardwareJobAttemptV2Lease({
      auth,
      jobId,
      attemptId,
      leaseToken,
      now,
    });

    await touchHardwareAgent({ auth, req, now });

    return NextResponse.json({
      success: true,
      protocolVersion: HARDWARE_JOB_PROTOCOL_V2,
      attempt: {
        ...result,
        leaseExpiresAt: result.leaseExpiresAt.toISOString(),
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

    console.error("[hardware-v2] lease renewal failed", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Lease attempt gagal diperpanjang.",
          retryable: true,
        },
        serverTime: now.toISOString(),
      },
      { status: 500 },
    );
  }
}
