import { Buffer } from "node:buffer";

import { NextRequest, NextResponse } from "next/server";

import {
  claimHardwareAgentEnrollment,
  HardwareAgentEnrollmentClaimError,
} from "@/features/hardware/agent-enrollment-claim";
import { normalizeHardwareEnrollmentCode } from "@/lib/hardware/enrollment-code";
import { getClientIp } from "@/lib/http/client-ip";
import { consumeSecurityRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const CLAIM_IP_POLICY = {
  limit: 120,
  windowMs: 10 * 60 * 1000,
  blockMs: 10 * 60 * 1000,
} as const;
const CLAIM_CODE_POLICY = {
  limit: 12,
  windowMs: 10 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
} as const;

function jsonNoStore(
  body: Record<string, unknown>,
  init?: { status?: number; headers?: Record<string, string> },
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      ...init?.headers,
    },
  });
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonNoStore(
      { success: false, error: "REQUEST_TOO_LARGE" },
      { status: 413 },
    );
  }

  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const clientRateKey = ipAddress ?? `unresolved:${userAgent ?? "unknown"}`;
  const ipDecision = await consumeSecurityRateLimit({
    scope: "hardware.enrollment.claim.ip",
    key: clientRateKey,
    policy: CLAIM_IP_POLICY,
  });

  if (!ipDecision.allowed) {
    return jsonNoStore(
      { success: false, error: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(ipDecision.retryAfterSeconds) },
      },
    );
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return jsonNoStore(
      { success: false, error: "REQUEST_TOO_LARGE" },
      { status: 413 },
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid-json-object");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonNoStore(
      { success: false, error: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const installationCode = readOptionalString(body.installationCode) ?? "";
  const normalizedCode = normalizeHardwareEnrollmentCode(installationCode);
  const instanceId = readOptionalString(body.instanceId) ?? "";

  if (!normalizedCode || !instanceId.trim()) {
    return jsonNoStore(
      { success: false, error: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const codeDecision = await consumeSecurityRateLimit({
    scope: "hardware.enrollment.claim.code",
    key: normalizedCode,
    policy: CLAIM_CODE_POLICY,
  });
  if (!codeDecision.allowed) {
    return jsonNoStore(
      { success: false, error: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(codeDecision.retryAfterSeconds) },
      },
    );
  }

  try {
    const result = await claimHardwareAgentEnrollment({
      installationCode: normalizedCode,
      instanceId,
      machineName: readOptionalString(body.machineName),
      installerVersion: readOptionalString(body.installerVersion),
      ipAddress,
      userAgent,
    });

    return jsonNoStore({
      success: true,
      idempotent: result.idempotent,
      enrollment: {
        id: result.enrollment.id,
        status: result.enrollment.status,
        claimedAt: result.enrollment.claimedAt.toISOString(),
        credentialReplayUntil:
          result.enrollment.credentialReplayUntil.toISOString(),
      },
      agent: result.agent,
      credential: result.credential,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof HardwareAgentEnrollmentClaimError) {
      if (
        error.code === "ENROLLMENT_NOT_FOUND" ||
        error.code === "ENROLLMENT_EXPIRED" ||
        error.code === "ENROLLMENT_REVOKED"
      ) {
        return jsonNoStore(
          {
            success: false,
            error: "INSTALLATION_CODE_INVALID_OR_EXPIRED",
          },
          { status: 404 },
        );
      }

      if (error.code === "INVALID_INPUT") {
        return jsonNoStore(
          { success: false, error: "INVALID_REQUEST" },
          { status: 400 },
        );
      }

      if (error.code === "ENROLLMENT_CLAIMED_BY_OTHER_INSTANCE") {
        return jsonNoStore(
          { success: false, error: "INSTALLATION_CODE_ALREADY_CLAIMED" },
          { status: 409 },
        );
      }

      if (error.code === "ENROLLMENT_REPLAY_WINDOW_EXPIRED") {
        return jsonNoStore(
          { success: false, error: "INSTALLATION_CODE_REPLAY_WINDOW_EXPIRED" },
          { status: 410 },
        );
      }

      if (
        error.code === "REGISTER_UNAVAILABLE" ||
        error.code === "ACTIVE_AGENT_EXISTS" ||
        error.code === "AGENT_UNAVAILABLE"
      ) {
        return jsonNoStore(
          { success: false, error: "HARDWARE_HUB_TARGET_UNAVAILABLE" },
          { status: 409 },
        );
      }

      if (error.code === "CREDENTIAL_UNAVAILABLE") {
        return jsonNoStore(
          { success: false, error: "CREDENTIAL_UNAVAILABLE" },
          { status: 500 },
        );
      }
    }

    console.error("Hardware Hub enrollment claim failed", error);
    return jsonNoStore(
      { success: false, error: "ENROLLMENT_CLAIM_FAILED" },
      { status: 500 },
    );
  }
}
