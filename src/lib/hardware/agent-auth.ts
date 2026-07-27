import { createHash, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { hardwareAgents, outlets, registers } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import {
  decryptHardwareAgentSecret,
  isEncryptedHardwareAgentCredential,
} from "@/lib/hardware/agent-credential";
import {
  HARDWARE_AUTH_VERSION_HEADER,
  HARDWARE_SIGNATURE_HEADER,
  verifySignedHardwareRequest,
} from "@/lib/hardware/request-signing";
import { getClientIp as resolveClientIp } from "@/lib/http/client-ip";

export type HardwareAgentAuth = {
  authScheme: "signed-v2" | "legacy-secret";
  agent: {
    id: string;
    code: string;
    name: string;
    organizationId: string;
    outletId: string;
    registerId: string;
    capabilities: Record<string, unknown>;
  };
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  register: {
    id: string;
    code: string;
    name: string;
  };
};

type HardwareAgentAuthMode = "dual" | "signed-only" | "legacy-only";

type FailureBucket = {
  count: number;
  resetAt: number;
};

type FailureState = {
  byAgent: Map<string, FailureBucket>;
  byIp: Map<string, FailureBucket>;
};

const MAX_FAILURE_BUCKETS = 4096;
const HARDWARE_AGENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const globalFailureState = globalThis as typeof globalThis & {
  __asihjayaHardwareAuthFailureState?: FailureState;
};

const failureState =
  globalFailureState.__asihjayaHardwareAuthFailureState ??
  (globalFailureState.__asihjayaHardwareAuthFailureState = {
    byAgent: new Map<string, FailureBucket>(),
    byIp: new Map<string, FailureBucket>(),
  });

function positiveInteger(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getAuthMode(): HardwareAgentAuthMode {
  const configured = process.env.HARDWARE_AGENT_AUTH_MODE?.trim().toLowerCase();
  if (!configured) {
    return "dual";
  }
  if (
    configured === "dual" ||
    configured === "signed-only" ||
    configured === "legacy-only"
  ) {
    return configured;
  }
  throw new Error(
    "HARDWARE_AGENT_AUTH_MODE harus dual, signed-only, atau legacy-only.",
  );
}

function failureWindowMs(): number {
  return positiveInteger(
    "HARDWARE_AGENT_AUTH_FAILURE_WINDOW_MS",
    5 * 60 * 1000,
  );
}

function failureLimitPerAgent(): number {
  return positiveInteger("HARDWARE_AGENT_AUTH_FAILURE_LIMIT_PER_AGENT", 20);
}

function failureLimitPerIp(): number {
  return positiveInteger("HARDWARE_AGENT_AUTH_FAILURE_LIMIT_PER_IP", 60);
}

function pruneFailureMap(
  map: Map<string, FailureBucket>,
  now: number,
): void {
  if (map.size < 256) return;
  for (const [key, bucket] of map) {
    if (bucket.resetAt <= now) {
      map.delete(key);
    }
  }
}

function readBucket(
  map: Map<string, FailureBucket>,
  key: string | null,
  now: number,
): FailureBucket | null {
  if (!key) return null;
  const current = map.get(key);
  if (!current) return null;
  if (current.resetAt <= now) {
    map.delete(key);
    return null;
  }
  return current;
}

function incrementBucket(
  map: Map<string, FailureBucket>,
  key: string | null,
  now: number,
): void {
  if (!key) return;
  pruneFailureMap(map, now);
  if (map.size >= MAX_FAILURE_BUCKETS && !map.has(key)) {
    const oldestKey = map.keys().next().value as string | undefined;
    if (oldestKey) map.delete(oldestKey);
  }
  const current = readBucket(map, key, now);
  if (current) {
    current.count += 1;
    return;
  }
  map.set(key, { count: 1, resetAt: now + failureWindowMs() });
}

function isFailureLimited(agentId: string | null, ip: string | null): boolean {
  const now = Date.now();
  const agentBucket = readBucket(failureState.byAgent, agentId, now);
  const ipBucket = readBucket(failureState.byIp, ip, now);
  return (
    (agentBucket?.count ?? 0) >= failureLimitPerAgent() ||
    (ipBucket?.count ?? 0) >= failureLimitPerIp()
  );
}

function recordFailure(agentId: string | null, ip: string | null): void {
  const now = Date.now();
  incrementBucket(failureState.byAgent, agentId, now);
  incrementBucket(failureState.byIp, ip, now);
}

function clearAgentFailures(agentId: string): void {
  failureState.byAgent.delete(agentId);
}

function constantTimeEqualText(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function getClientIp(req: Request | NextRequest): string | null {
  return resolveClientIp(req);
}

async function loadHardwareAgent(agentId: string) {
  const [row] = await db
    .select({
      agentId: hardwareAgents.id,
      agentCode: hardwareAgents.code,
      agentName: hardwareAgents.name,
      organizationId: hardwareAgents.organizationId,
      outletId: hardwareAgents.outletId,
      registerId: hardwareAgents.registerId,
      encodedCredential: hardwareAgents.secretHash,
      isActive: hardwareAgents.isActive,
      status: hardwareAgents.status,
      capabilities: hardwareAgents.capabilities,
      outletCode: outlets.code,
      outletName: outlets.name,
      outletIsActive: outlets.isActive,
      registerCode: registers.code,
      registerName: registers.name,
      registerIsActive: registers.isActive,
    })
    .from(hardwareAgents)
    .innerJoin(outlets, eq(hardwareAgents.outletId, outlets.id))
    .innerJoin(registers, eq(hardwareAgents.registerId, registers.id))
    .where(eq(hardwareAgents.id, agentId))
    .limit(1);

  if (
    !row ||
    !row.isActive ||
    row.status === "disabled" ||
    !row.outletIsActive ||
    !row.registerIsActive
  ) {
    return null;
  }

  return row;
}

function toAuth(
  row: NonNullable<Awaited<ReturnType<typeof loadHardwareAgent>>>,
  authScheme: HardwareAgentAuth["authScheme"],
): HardwareAgentAuth {
  return {
    authScheme,
    agent: {
      id: row.agentId,
      code: row.agentCode,
      name: row.agentName,
      organizationId: row.organizationId,
      outletId: row.outletId,
      registerId: row.registerId,
      capabilities: row.capabilities ?? {},
    },
    outlet: {
      id: row.outletId,
      code: row.outletCode,
      name: row.outletName,
    },
    register: {
      id: row.registerId,
      code: row.registerCode,
      name: row.registerName,
    },
  };
}

export async function authenticateHardwareAgent(
  req: Request | NextRequest,
): Promise<HardwareAgentAuth | null> {
  const agentId = req.headers.get("x-hardware-agent-id")?.trim() || null;
  const ip = getClientIp(req);

  if (!agentId || !HARDWARE_AGENT_ID_PATTERN.test(agentId)) {
    recordFailure(null, ip);
    return null;
  }
  if (isFailureLimited(agentId, ip)) {
    return null;
  }

  const row = await loadHardwareAgent(agentId);
  if (!row) {
    recordFailure(null, ip);
    return null;
  }

  const mode = getAuthMode();
  const signedRequestAttempted = Boolean(
    req.headers.get(HARDWARE_AUTH_VERSION_HEADER) ||
      req.headers.get(HARDWARE_SIGNATURE_HEADER),
  );
  const encryptedCredential = isEncryptedHardwareAgentCredential(
    row.encodedCredential,
  );
  const decryptedSecret = encryptedCredential
    ? decryptHardwareAgentSecret(row.agentId, row.encodedCredential)
    : null;

  if (encryptedCredential && !decryptedSecret) {
    recordFailure(row.agentId, ip);
    return null;
  }

  if (mode !== "legacy-only" && signedRequestAttempted) {
    if (decryptedSecret) {
      const signature = await verifySignedHardwareRequest({
        request: req,
        agentId: row.agentId,
        secret: decryptedSecret,
      });

      if (signature.valid) {
        clearAgentFailures(row.agentId);
        return toAuth(row, "signed-v2");
      }

      recordFailure(row.agentId, ip);
      return null;
    }

    if (mode === "signed-only") {
      recordFailure(row.agentId, ip);
      return null;
    }
    // Mode dual boleh turun ke legacy hanya untuk credential scrypt lama yang
    // belum diprovisikan ulang. Credential terenkripsi tidak pernah downgrade.
  }

  if (mode === "signed-only") {
    recordFailure(row.agentId, ip);
    return null;
  }

  const suppliedLegacySecret = req.headers
    .get("x-hardware-agent-secret")
    ?.trim();
  if (!suppliedLegacySecret) {
    recordFailure(row.agentId, ip);
    return null;
  }

  const legacySecretValid = decryptedSecret
    ? constantTimeEqualText(suppliedLegacySecret, decryptedSecret)
    : await verifyPassword(suppliedLegacySecret, row.encodedCredential);

  if (!legacySecretValid) {
    recordFailure(row.agentId, ip);
    return null;
  }

  clearAgentFailures(row.agentId);
  return toAuth(row, "legacy-secret");
}

export function resetHardwareAgentAuthFailureStateForTests(): void {
  failureState.byAgent.clear();
  failureState.byIp.clear();
}
