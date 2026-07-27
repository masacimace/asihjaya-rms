import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const HARDWARE_AUTH_VERSION = "2";
export const HARDWARE_AUTH_VERSION_HEADER = "x-hardware-auth-version";
export const HARDWARE_TIMESTAMP_HEADER = "x-hardware-timestamp";
export const HARDWARE_NONCE_HEADER = "x-hardware-nonce";
export const HARDWARE_CONTENT_SHA256_HEADER = "x-hardware-content-sha256";
export const HARDWARE_SIGNATURE_HEADER = "x-hardware-signature";

const SIGNATURE_CONTEXT = "ASIHJAYA-HARDWARE-REQUEST-V2";
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const TIMESTAMP_PATTERN = /^\d{10,16}$/;
const DEFAULT_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const DEFAULT_NONCE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const MAX_REPLAY_NONCES = 32_768;

type ReplayState = {
  nonces: Map<string, number>;
};

const globalReplayState = globalThis as typeof globalThis & {
  __asihjayaHardwareReplayState?: ReplayState;
};

const replayState =
  globalReplayState.__asihjayaHardwareReplayState ??
  (globalReplayState.__asihjayaHardwareReplayState = {
    nonces: new Map<string, number>(),
  });

function positiveInteger(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function clockToleranceMs(): number {
  return positiveInteger(
    "HARDWARE_AGENT_SIGNATURE_TOLERANCE_MS",
    DEFAULT_CLOCK_TOLERANCE_MS,
  );
}

function nonceTtlMs(): number {
  return positiveInteger("HARDWARE_AGENT_NONCE_TTL_MS", DEFAULT_NONCE_TTL_MS);
}

function maxBodyBytes(): number {
  return positiveInteger(
    "HARDWARE_AGENT_SIGNED_BODY_MAX_BYTES",
    DEFAULT_MAX_BODY_BYTES,
  );
}

export function hashHardwareRequestBody(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function createHardwareRequestCanonicalValue(input: {
  agentId: string;
  agentVersion?: string;
  method: string;
  pathAndQuery: string;
  timestamp: string;
  nonce: string;
  contentSha256: string;
  protocolVersion?: string;
  leaseToken?: string;
  idempotencyKey?: string;
}): string {
  return [
    SIGNATURE_CONTEXT,
    input.agentId,
    input.agentVersion?.trim() ?? "",
    input.method.toUpperCase(),
    input.pathAndQuery,
    input.timestamp,
    input.nonce,
    input.contentSha256,
    input.protocolVersion?.trim() ?? "",
    input.leaseToken?.trim() ?? "",
    input.idempotencyKey?.trim() ?? "",
  ].join("\n");
}

export function createHardwareRequestSignature(input: {
  secret: string;
  agentId: string;
  agentVersion?: string;
  method: string;
  pathAndQuery: string;
  timestamp: string;
  nonce: string;
  contentSha256: string;
  protocolVersion?: string;
  leaseToken?: string;
  idempotencyKey?: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(createHardwareRequestCanonicalValue(input), "utf8")
    .digest("base64url");
}

function isCanonicalBase64Url(value: string): boolean {
  try {
    return Buffer.from(value, "base64url").toString("base64url") === value;
  } catch {
    return false;
  }
}

function constantTimeEqualBase64Url(left: string, right: string): boolean {
  if (!isCanonicalBase64Url(left) || !isCanonicalBase64Url(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "base64url");
  const rightBuffer = Buffer.from(right, "base64url");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function pruneExpiredNonces(now: number): void {
  if (replayState.nonces.size < 256) {
    return;
  }

  for (const [key, expiresAt] of replayState.nonces) {
    if (expiresAt <= now) {
      replayState.nonces.delete(key);
    }
  }
}

function consumeNonce(agentId: string, nonce: string, now: number): boolean {
  pruneExpiredNonces(now);
  const key = `${agentId}:${nonce}`;
  const existingExpiry = replayState.nonces.get(key);

  if (existingExpiry && existingExpiry > now) {
    return false;
  }

  if (replayState.nonces.size >= MAX_REPLAY_NONCES) {
    const oldestKey = replayState.nonces.keys().next().value as
      | string
      | undefined;
    if (oldestKey) {
      replayState.nonces.delete(oldestKey);
    }
  }

  replayState.nonces.set(key, now + nonceTtlMs());
  return true;
}

export type HardwareRequestSignatureVerification =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "missing_headers"
        | "invalid_version"
        | "invalid_timestamp"
        | "timestamp_out_of_range"
        | "invalid_nonce"
        | "invalid_content_hash"
        | "body_too_large"
        | "body_hash_mismatch"
        | "invalid_signature"
        | "replayed_nonce"
        | "invalid_request";
    };

export async function verifySignedHardwareRequest(input: {
  request: Request;
  agentId: string;
  secret: string;
  now?: number;
}): Promise<HardwareRequestSignatureVerification> {
  const authVersion = input.request.headers
    .get(HARDWARE_AUTH_VERSION_HEADER)
    ?.trim();
  const timestamp = input.request.headers
    .get(HARDWARE_TIMESTAMP_HEADER)
    ?.trim();
  const nonce = input.request.headers.get(HARDWARE_NONCE_HEADER)?.trim();
  const suppliedContentHash = input.request.headers
    .get(HARDWARE_CONTENT_SHA256_HEADER)
    ?.trim()
    .toLowerCase();
  const suppliedSignature = input.request.headers
    .get(HARDWARE_SIGNATURE_HEADER)
    ?.trim();

  if (
    !authVersion ||
    !timestamp ||
    !nonce ||
    !suppliedContentHash ||
    !suppliedSignature
  ) {
    return { valid: false, reason: "missing_headers" };
  }
  if (authVersion !== HARDWARE_AUTH_VERSION) {
    return { valid: false, reason: "invalid_version" };
  }
  if (!TIMESTAMP_PATTERN.test(timestamp)) {
    return { valid: false, reason: "invalid_timestamp" };
  }

  const timestampMs = Number(timestamp);
  const now = input.now ?? Date.now();
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(now - timestampMs) > clockToleranceMs()
  ) {
    return { valid: false, reason: "timestamp_out_of_range" };
  }
  if (!NONCE_PATTERN.test(nonce)) {
    return { valid: false, reason: "invalid_nonce" };
  }
  if (!SHA256_HEX_PATTERN.test(suppliedContentHash)) {
    return { valid: false, reason: "invalid_content_hash" };
  }

  try {
    const contentLength = Number(input.request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes()) {
      return { valid: false, reason: "body_too_large" };
    }

    const body = new Uint8Array(await input.request.clone().arrayBuffer());
    if (body.byteLength > maxBodyBytes()) {
      return { valid: false, reason: "body_too_large" };
    }

    const actualContentHash = hashHardwareRequestBody(body);
    if (actualContentHash !== suppliedContentHash) {
      return { valid: false, reason: "body_hash_mismatch" };
    }

    const url = new URL(input.request.url);
    const expectedSignature = createHardwareRequestSignature({
      secret: input.secret,
      agentId: input.agentId,
      agentVersion:
        input.request.headers.get("x-hardware-agent-version")?.trim() ?? "",
      method: input.request.method,
      pathAndQuery: `${url.pathname}${url.search}`,
      timestamp,
      nonce,
      contentSha256: actualContentHash,
      protocolVersion:
        input.request.headers.get("x-hardware-protocol-version")?.trim() ?? "",
      leaseToken:
        input.request.headers.get("x-hardware-lease-token")?.trim() ?? "",
      idempotencyKey:
        input.request.headers.get("idempotency-key")?.trim() ?? "",
    });

    if (!constantTimeEqualBase64Url(suppliedSignature, expectedSignature)) {
      return { valid: false, reason: "invalid_signature" };
    }
    if (!consumeNonce(input.agentId, nonce, now)) {
      return { valid: false, reason: "replayed_nonce" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "invalid_request" };
  }
}

export function resetHardwareRequestReplayStateForTests(): void {
  replayState.nonces.clear();
}
