import { NextRequest, NextResponse } from "next/server";

import { authenticateHardwareAgent } from "@/lib/hardware/agent-auth";
import { touchHardwareAgent } from "@/lib/hardware/agent-presence";
import { claimHardwareJobV2 } from "@/lib/hardware/job-claim-v2";
import { HARDWARE_JOB_PROTOCOL_V2 } from "@/lib/hardware/job-protocol-v2";
import { isHardwareJobProtocolV2Error } from "@/lib/hardware/job-protocol-v2-error";
import {
  assertHardwareProtocolV2Request,
  parseHardwareJobClaimV2Body,
} from "@/lib/hardware/job-protocol-v2-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

    const body = await parseHardwareJobClaimV2Body(req);
    const result = await claimHardwareJobV2({
      auth,
      requestedCapabilities: body.supportedCapabilities,
      now,
    });

    await touchHardwareAgent({ auth, req, now });

    return NextResponse.json({
      success: true,
      protocolVersion: HARDWARE_JOB_PROTOCOL_V2,
      job: result.claimed
        ? {
            ...result.claimed.job,
            expiresAt: result.claimed.job.expiresAt.toISOString(),
          }
        : null,
      attempt: result.claimed
        ? {
            ...result.claimed.attempt,
            leaseExpiresAt:
              result.claimed.attempt.leaseExpiresAt.toISOString(),
          }
        : null,
      effectiveCapabilities: result.effectiveCapabilities,
      recovery: result.recovery,
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

    console.error("[hardware-v2] claim failed", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Hardware job claim gagal diproses.",
          retryable: true,
        },
        serverTime: now.toISOString(),
      },
      { status: 500 },
    );
  }
}
