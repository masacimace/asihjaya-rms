import type { NextRequest } from "next/server";

import {
  HARDWARE_JOB_PROTOCOL_V2,
  hardwareCapabilities,
  hardwareJobAttemptStatuses,
  type HardwareCapability,
  type HardwareJobAttemptStatus,
} from "@/lib/hardware/job-protocol-v2";
import { HardwareJobProtocolV2Error } from "@/lib/hardware/job-protocol-v2-error";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/;
const MAX_RESULT_BYTES = 16_384;
const MAX_ERROR_MESSAGE_LENGTH = 2_000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 220;

const agentEventStatuses = [
  "processing",
  "dispatching",
  "submitted",
  "acknowledged",
  "failed_before_dispatch",
  "unknown_after_dispatch",
] as const satisfies readonly HardwareJobAttemptStatus[];

export type HardwareJobAttemptAgentEventStatus =
  (typeof agentEventStatuses)[number];

export type HardwareJobAttemptAgentEvent = {
  status: HardwareJobAttemptAgentEventStatus;
  eventSequence: number;
  idempotencyKey: string;
  occurredAt: Date;
  result: Record<string, unknown>;
  error: {
    code: string;
    message: string;
    retrySafe: boolean;
  } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeJsonValue(
  value: unknown,
  depth = 0,
): string | number | boolean | null | unknown[] | Record<string, unknown> | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value === "string" ? value.slice(0, 2_000) : value;
  }

  if (depth >= 3) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 30)
      .map((entry) => normalizeJsonValue(entry, depth + 1))
      .filter((entry) => entry !== undefined) as unknown[];
  }

  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value).slice(0, 50)) {
      const child = normalizeJsonValue(entry, depth + 1);
      if (child !== undefined) {
        normalized[key.slice(0, 120)] = child;
      }
    }

    return normalized;
  }

  return undefined;
}

function normalizeResult(value: unknown): Record<string, unknown> {
  const normalized = normalizeJsonValue(value);
  const result = isRecord(normalized) ? normalized : {};

  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_RESULT_BYTES) {
    throw new HardwareJobProtocolV2Error({
      code: "RESULT_TOO_LARGE",
      message: `Result metadata melebihi ${MAX_RESULT_BYTES} bytes.`,
      status: 422,
    });
  }

  return result;
}

export function assertHardwareProtocolV2Request(req: NextRequest): void {
  const version = req.headers.get("x-hardware-protocol-version")?.trim();

  if (version !== String(HARDWARE_JOB_PROTOCOL_V2)) {
    throw new HardwareJobProtocolV2Error({
      code: "UNSUPPORTED_PROTOCOL_VERSION",
      message: "Request harus menggunakan Hardware Job Protocol version 2.",
      status: 400,
    });
  }
}

export function assertUuid(value: string, fieldName: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new HardwareJobProtocolV2Error({
      code: "INVALID_IDENTIFIER",
      message: `${fieldName} tidak valid.`,
      status: 400,
    });
  }
}

export async function parseHardwareJobClaimV2Body(
  req: NextRequest,
): Promise<{
  supportedCapabilities: HardwareCapability[];
  agentVersion: string | null;
}> {
  const body = await req.json().catch(() => null);

  if (!isRecord(body) || !Array.isArray(body.supportedCapabilities)) {
    throw new HardwareJobProtocolV2Error({
      code: "INVALID_CLAIM_REQUEST",
      message: "supportedCapabilities wajib berupa array.",
      status: 400,
    });
  }

  const supportedCapabilities = Array.from(
    new Set(
      body.supportedCapabilities.filter(
        (entry): entry is HardwareCapability =>
          typeof entry === "string" &&
          hardwareCapabilities.includes(entry as HardwareCapability),
      ),
    ),
  );

  if (supportedCapabilities.length === 0) {
    throw new HardwareJobProtocolV2Error({
      code: "NO_SUPPORTED_CAPABILITY",
      message: "Agent tidak mengirim capability v2 yang didukung.",
      status: 422,
    });
  }

  return {
    supportedCapabilities,
    agentVersion: readTrimmedString(body.agentVersion, 80),
  };
}

export async function parseHardwareJobAttemptV2Event(
  req: NextRequest,
): Promise<HardwareJobAttemptAgentEvent> {
  const idempotencyKey = readTrimmedString(
    req.headers.get("idempotency-key"),
    MAX_IDEMPOTENCY_KEY_LENGTH,
  );

  if (!idempotencyKey) {
    throw new HardwareJobProtocolV2Error({
      code: "MISSING_IDEMPOTENCY_KEY",
      message: "Header Idempotency-Key wajib diisi.",
      status: 400,
    });
  }

  const body = await req.json().catch(() => null);
  if (!isRecord(body)) {
    throw new HardwareJobProtocolV2Error({
      code: "INVALID_EVENT_REQUEST",
      message: "Body event tidak valid.",
      status: 400,
    });
  }

  const status = body.status;
  if (
    typeof status !== "string" ||
    !agentEventStatuses.includes(status as HardwareJobAttemptAgentEventStatus) ||
    !hardwareJobAttemptStatuses.includes(status as HardwareJobAttemptStatus)
  ) {
    throw new HardwareJobProtocolV2Error({
      code: "INVALID_ATTEMPT_STATUS",
      message: "Status attempt tidak dapat dikirim oleh agent.",
      status: 422,
    });
  }

  const eventSequence = body.eventSequence;
  if (
    !Number.isInteger(eventSequence) ||
    typeof eventSequence !== "number" ||
    eventSequence < 1 ||
    eventSequence > 1_000_000
  ) {
    throw new HardwareJobProtocolV2Error({
      code: "INVALID_EVENT_SEQUENCE",
      message: "eventSequence harus berupa integer positif.",
      status: 422,
    });
  }

  const occurredAtValue = readTrimmedString(body.occurredAt, 80);
  const occurredAt = occurredAtValue ? new Date(occurredAtValue) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    throw new HardwareJobProtocolV2Error({
      code: "INVALID_OCCURRED_AT",
      message: "occurredAt harus berupa datetime ISO yang valid.",
      status: 422,
    });
  }

  let error: HardwareJobAttemptAgentEvent["error"] = null;
  if (body.error !== undefined && body.error !== null) {
    if (!isRecord(body.error)) {
      throw new HardwareJobProtocolV2Error({
        code: "INVALID_EVENT_ERROR",
        message: "error harus berupa object.",
        status: 422,
      });
    }

    const code = readTrimmedString(body.error.code, 80);
    const message = readTrimmedString(
      body.error.message,
      MAX_ERROR_MESSAGE_LENGTH,
    );
    const retrySafe = body.error.retrySafe;

    if (!code || !ERROR_CODE_PATTERN.test(code) || !message) {
      throw new HardwareJobProtocolV2Error({
        code: "INVALID_EVENT_ERROR",
        message: "error.code atau error.message tidak valid.",
        status: 422,
      });
    }

    if (typeof retrySafe !== "boolean") {
      throw new HardwareJobProtocolV2Error({
        code: "INVALID_RETRY_CLASSIFICATION",
        message: "error.retrySafe wajib berupa boolean.",
        status: 422,
      });
    }

    error = { code, message, retrySafe };
  }

  if (status === "failed_before_dispatch" && !error) {
    throw new HardwareJobProtocolV2Error({
      code: "MISSING_FAILURE_DETAIL",
      message: "failed_before_dispatch wajib menyertakan error.",
      status: 422,
    });
  }

  if (status === "unknown_after_dispatch") {
    if (!error) {
      throw new HardwareJobProtocolV2Error({
        code: "MISSING_UNKNOWN_DETAIL",
        message: "unknown_after_dispatch wajib menyertakan error.",
        status: 422,
      });
    }

    if (error.retrySafe) {
      throw new HardwareJobProtocolV2Error({
        code: "UNSAFE_RETRY_CLASSIFICATION",
        message: "unknown_after_dispatch tidak boleh ditandai retry-safe.",
        status: 422,
      });
    }
  }

  return {
    status: status as HardwareJobAttemptAgentEventStatus,
    eventSequence,
    idempotencyKey,
    occurredAt,
    result: normalizeResult(body.result),
    error,
  };
}

export function readHardwareJobLeaseToken(req: NextRequest): string {
  const token = req.headers.get("x-hardware-lease-token")?.trim();

  if (!token || token.length > 256) {
    throw new HardwareJobProtocolV2Error({
      code: "MISSING_LEASE_TOKEN",
      message: "X-Hardware-Lease-Token wajib diisi.",
      status: 401,
    });
  }

  return token;
}
