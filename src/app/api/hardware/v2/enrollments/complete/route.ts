import { Buffer } from "node:buffer";

import { NextRequest, NextResponse } from "next/server";

import {
  completeHardwareAgentEnrollment,
  CompleteHardwareAgentEnrollmentError,
} from "@/features/hardware/agent-enrollment-completion";
import { authenticateHardwareAgent, getClientIp } from "@/lib/hardware/agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

function jsonNoStore(
  body: Record<string, unknown>,
  init?: { status?: number },
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
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

  const auth = await authenticateHardwareAgent(req);
  if (!auth || auth.authScheme !== "signed-v2") {
    return jsonNoStore(
      { success: false, error: "UNAUTHORIZED_AGENT" },
      { status: 401 },
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

  const enrollmentId = readOptionalString(body.enrollmentId) ?? "";
  const instanceId = readOptionalString(body.instanceId) ?? "";
  if (!enrollmentId.trim() || !instanceId.trim()) {
    return jsonNoStore(
      { success: false, error: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const result = await completeHardwareAgentEnrollment({
      enrollmentId,
      instanceId,
      auth,
      installerVersion: readOptionalString(body.installerVersion),
      credentialStoreKind: readOptionalString(body.credentialStoreKind),
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return jsonNoStore({
      success: true,
      idempotent: result.idempotent,
      enrollment: {
        id: result.enrollment.id,
        status: result.enrollment.status,
        claimedAt: result.enrollment.claimedAt.toISOString(),
        completedAt: result.enrollment.completedAt.toISOString(),
      },
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof CompleteHardwareAgentEnrollmentError) {
      if (error.code === "INVALID_INPUT") {
        return jsonNoStore(
          { success: false, error: "INVALID_REQUEST" },
          { status: 400 },
        );
      }
      if (error.code === "ENROLLMENT_NOT_FOUND") {
        return jsonNoStore(
          { success: false, error: "ENROLLMENT_NOT_FOUND" },
          { status: 404 },
        );
      }
      return jsonNoStore(
        { success: false, error: "ENROLLMENT_COMPLETION_REJECTED" },
        { status: 409 },
      );
    }

    console.error("Hardware Hub enrollment completion failed", error);
    return jsonNoStore(
      { success: false, error: "ENROLLMENT_COMPLETION_FAILED" },
      { status: 500 },
    );
  }
}
