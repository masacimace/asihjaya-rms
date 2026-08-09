import { randomBytes, randomUUID } from "node:crypto";

import { and, eq, inArray, ne, or } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  hardwareAgents,
  hardwareJobs,
  outlets,
  registers,
} from "@/db/schema";
import { encryptHardwareAgentSecret } from "@/lib/hardware/agent-credential";

const ACTIVE_JOB_STATUSES = [
  "pending",
  "claimed",
  "processing",
  "printing",
  "submitted",
] as const;

export type HardwareAgentLifecycleErrorCode =
  | "INVALID_INPUT"
  | "AGENT_NOT_FOUND"
  | "ACTIVE_JOBS_EXIST"
  | "AGENT_ALREADY_DISABLED"
  | "AGENT_ALREADY_ACTIVE"
  | "REGISTER_OCCUPIED"
  | "LOCATION_INACTIVE"
  | "REPLACEMENT_CODE_EXHAUSTED";

export class HardwareAgentLifecycleError extends Error {
  readonly code: HardwareAgentLifecycleErrorCode;

  constructor(code: HardwareAgentLifecycleErrorCode, message: string) {
    super(message);
    this.name = "HardwareAgentLifecycleError";
    this.code = code;
  }
}

type LifecycleBaseInput = {
  organizationId: string;
  accessibleOutletIds: readonly string[];
  actorUserId: string;
  agentId: string;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type HardwareAgentCredentialResult = {
  agent: {
    id: string;
    code: string;
    name: string;
    outletId: string;
    outletCode: string;
    outletName: string;
    registerId: string;
    registerCode: string;
    registerName: string;
  };
  credential: {
    secret: string;
    authMode: "signed";
    protocolMode: "v2-preferred";
  };
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertLifecycleInput(input: LifecycleBaseInput) {
  if (
    !UUID_PATTERN.test(input.organizationId) ||
    !UUID_PATTERN.test(input.actorUserId) ||
    !UUID_PATTERN.test(input.agentId)
  ) {
    throw new HardwareAgentLifecycleError(
      "INVALID_INPUT",
      "Organization, actor, atau Hardware Agent tidak valid.",
    );
  }
}

function normalizeRequestId(value?: string | null) {
  return value && UUID_PATTERN.test(value) ? value : null;
}

function normalizeIp(value?: string | null) {
  return value?.slice(0, 64) ?? null;
}

function normalizeUserAgent(value?: string | null) {
  return value?.slice(0, 500) ?? null;
}

async function assertNoActiveJobs(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    organizationId: string;
    agentId: string;
  },
) {
  const [activeJob] = await tx
    .select({
      id: hardwareJobs.id,
      status: hardwareJobs.status,
      jobType: hardwareJobs.jobType,
    })
    .from(hardwareJobs)
    .where(
      and(
        eq(hardwareJobs.organizationId, input.organizationId),
        inArray(hardwareJobs.status, [...ACTIVE_JOB_STATUSES]),
        or(
          eq(hardwareJobs.targetAgentId, input.agentId),
          eq(hardwareJobs.agentId, input.agentId),
        ),
      ),
    )
    .limit(1);

  if (activeJob) {
    throw new HardwareAgentLifecycleError(
      "ACTIVE_JOBS_EXIST",
      `Agent masih memiliki hardware job aktif (${activeJob.status}, ${activeJob.jobType}). Selesaikan atau batalkan job terlebih dahulu.`,
    );
  }
}

async function getAccessibleAgent(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: LifecycleBaseInput,
) {
  const [agent] = await tx
    .select({
      id: hardwareAgents.id,
      organizationId: hardwareAgents.organizationId,
      outletId: hardwareAgents.outletId,
      registerId: hardwareAgents.registerId,
      code: hardwareAgents.code,
      name: hardwareAgents.name,
      status: hardwareAgents.status,
      isActive: hardwareAgents.isActive,
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
    .where(
      and(
        eq(hardwareAgents.id, input.agentId),
        eq(hardwareAgents.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!agent || !input.accessibleOutletIds.includes(agent.outletId)) {
    throw new HardwareAgentLifecycleError(
      "AGENT_NOT_FOUND",
      "Hardware Agent tidak ditemukan atau tidak dapat diakses.",
    );
  }

  return agent;
}

function createCredentialResult(
  agent: Awaited<ReturnType<typeof getAccessibleAgent>>,
  secret: string,
): HardwareAgentCredentialResult {
  return {
    agent: {
      id: agent.id,
      code: agent.code,
      name: agent.name,
      outletId: agent.outletId,
      outletCode: agent.outletCode,
      outletName: agent.outletName,
      registerId: agent.registerId,
      registerCode: agent.registerCode,
      registerName: agent.registerName,
    },
    credential: {
      secret,
      authMode: "signed",
      protocolMode: "v2-preferred",
    },
  };
}

async function getReplacementCode(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  currentCode: string,
): Promise<string> {
  for (let revision = 2; revision <= 999; revision += 1) {
    const suffix = `-R${revision}`;
    const base = currentCode.slice(0, Math.max(1, 80 - suffix.length));
    const candidate = `${base}${suffix}`;

    const [existing] = await tx
      .select({ id: hardwareAgents.id })
      .from(hardwareAgents)
      .where(
        and(
          eq(hardwareAgents.organizationId, organizationId),
          eq(hardwareAgents.code, candidate),
        ),
      )
      .limit(1);

    if (!existing) {
      return candidate;
    }
  }

  throw new HardwareAgentLifecycleError(
    "REPLACEMENT_CODE_EXHAUSTED",
    "Tidak dapat membuat kode replacement Hardware Agent secara otomatis.",
  );
}

export async function rotateHardwareAgentCredential(
  input: LifecycleBaseInput,
): Promise<HardwareAgentCredentialResult> {
  assertLifecycleInput(input);

  return db.transaction(async (tx) => {
    const agent = await getAccessibleAgent(tx, input);

    if (!agent.isActive || agent.status === "disabled") {
      throw new HardwareAgentLifecycleError(
        "AGENT_ALREADY_DISABLED",
        "Agent sedang nonaktif. Gunakan workflow replacement atau aktivasi sebelum rotasi credential.",
      );
    }

    await assertNoActiveJobs(tx, {
      organizationId: input.organizationId,
      agentId: agent.id,
    });

    const secret = randomBytes(48).toString("base64url");
    const encryptedSecret = encryptHardwareAgentSecret(agent.id, secret);
    const now = new Date();

    await tx
      .update(hardwareAgents)
      .set({
        secretHash: encryptedSecret,
        status: "offline",
        updatedAt: now,
      })
      .where(eq(hardwareAgents.id, agent.id));

    await tx.insert(auditLogs).values({
      organizationId: input.organizationId,
      outletId: agent.outletId,
      actorUserId: input.actorUserId,
      action: "hardware.agent.rotate_credential",
      entityType: "hardware_agent",
      entityId: agent.id,
      beforeData: {
        status: agent.status,
        isActive: agent.isActive,
      },
      afterData: {
        status: "offline",
        isActive: true,
        credentialRotated: true,
      },
      reason: "Credential Hardware Agent dirotasi melalui dashboard RMS.",
      requestId: normalizeRequestId(input.requestId),
      ipAddress: normalizeIp(input.ipAddress),
      userAgent: normalizeUserAgent(input.userAgent),
      metadata: {
        source: "admin.hardware_dashboard",
        agentCode: agent.code,
        outletCode: agent.outletCode,
        registerCode: agent.registerCode,
        secretExposedOnce: true,
      },
      createdAt: now,
    });

    return createCredentialResult(
      {
        ...agent,
        status: "offline",
        isActive: true,
      },
      secret,
    );
  });
}

export async function disableHardwareAgent(
  input: LifecycleBaseInput,
): Promise<{
  agentId: string;
  agentCode: string;
  agentName: string;
}> {
  assertLifecycleInput(input);

  return db.transaction(async (tx) => {
    const agent = await getAccessibleAgent(tx, input);

    if (!agent.isActive || agent.status === "disabled") {
      throw new HardwareAgentLifecycleError(
        "AGENT_ALREADY_DISABLED",
        "Hardware Agent sudah nonaktif.",
      );
    }

    await assertNoActiveJobs(tx, {
      organizationId: input.organizationId,
      agentId: agent.id,
    });

    const now = new Date();

    await tx
      .update(hardwareAgents)
      .set({
        isActive: false,
        status: "disabled",
        updatedAt: now,
      })
      .where(eq(hardwareAgents.id, agent.id));

    await tx.insert(auditLogs).values({
      organizationId: input.organizationId,
      outletId: agent.outletId,
      actorUserId: input.actorUserId,
      action: "hardware.agent.disable",
      entityType: "hardware_agent",
      entityId: agent.id,
      beforeData: {
        status: agent.status,
        isActive: agent.isActive,
      },
      afterData: {
        status: "disabled",
        isActive: false,
      },
      reason: "Hardware Agent dinonaktifkan melalui dashboard RMS.",
      requestId: normalizeRequestId(input.requestId),
      ipAddress: normalizeIp(input.ipAddress),
      userAgent: normalizeUserAgent(input.userAgent),
      metadata: {
        source: "admin.hardware_dashboard",
        agentCode: agent.code,
        outletCode: agent.outletCode,
        registerCode: agent.registerCode,
      },
      createdAt: now,
    });

    return {
      agentId: agent.id,
      agentCode: agent.code,
      agentName: agent.name,
    };
  });
}

function isPostgresUniqueViolation(
  error: unknown,
  constraint: string,
): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    constraint?: unknown;
    cause?: unknown;
  };

  if (
    candidate.code === "23505" &&
    candidate.constraint === constraint
  ) {
    return true;
  }

  if (candidate.cause && candidate.cause !== error) {
    return isPostgresUniqueViolation(candidate.cause, constraint);
  }

  return false;
}

export async function reactivateHardwareAgent(
  input: LifecycleBaseInput,
): Promise<HardwareAgentCredentialResult> {
  assertLifecycleInput(input);

  try {
    return await db.transaction(async (tx) => {
      const agent = await getAccessibleAgent(tx, input);

      if (agent.isActive && agent.status !== "disabled") {
        throw new HardwareAgentLifecycleError(
          "AGENT_ALREADY_ACTIVE",
          "Hardware Agent masih aktif.",
        );
      }

      if (!agent.outletIsActive || !agent.registerIsActive) {
        throw new HardwareAgentLifecycleError(
          "LOCATION_INACTIVE",
          "Outlet atau register Hardware Agent sedang tidak aktif.",
        );
      }

      await assertNoActiveJobs(tx, {
        organizationId: input.organizationId,
        agentId: agent.id,
      });

      const [activePeer] = await tx
        .select({
          id: hardwareAgents.id,
          code: hardwareAgents.code,
          name: hardwareAgents.name,
        })
        .from(hardwareAgents)
        .where(
          and(
            eq(hardwareAgents.organizationId, input.organizationId),
            eq(hardwareAgents.registerId, agent.registerId),
            eq(hardwareAgents.isActive, true),
            ne(hardwareAgents.id, agent.id),
          ),
        )
        .limit(1);

      if (activePeer) {
        throw new HardwareAgentLifecycleError(
          "REGISTER_OCCUPIED",
          `Register ${agent.registerName} masih digunakan Hardware Agent aktif ${activePeer.name} (${activePeer.code}). Nonaktifkan agent aktif tersebut terlebih dahulu.`,
        );
      }

      const secret = randomBytes(48).toString("base64url");
      const encryptedSecret = encryptHardwareAgentSecret(
        agent.id,
        secret,
      );
      const now = new Date();

      await tx
        .update(hardwareAgents)
        .set({
          secretHash: encryptedSecret,
          isActive: true,
          status: "offline",
          capabilities: {},
          lastSeenAt: null,
          lastIpAddress: null,
          lastUserAgent: null,
          updatedAt: now,
        })
        .where(eq(hardwareAgents.id, agent.id));

      await tx.insert(auditLogs).values({
        organizationId: input.organizationId,
        outletId: agent.outletId,
        actorUserId: input.actorUserId,
        action: "hardware.agent.reactivate",
        entityType: "hardware_agent",
        entityId: agent.id,
        beforeData: {
          status: agent.status,
          isActive: agent.isActive,
        },
        afterData: {
          status: "offline",
          isActive: true,
          credentialRotated: true,
          presenceReset: true,
        },
        reason:
          "Hardware Agent diaktifkan ulang dengan credential baru melalui dashboard RMS.",
        requestId: normalizeRequestId(input.requestId),
        ipAddress: normalizeIp(input.ipAddress),
        userAgent: normalizeUserAgent(input.userAgent),
        metadata: {
          source: "admin.hardware_dashboard",
          agentCode: agent.code,
          outletCode: agent.outletCode,
          registerCode: agent.registerCode,
          secretExposedOnce: true,
        },
        createdAt: now,
      });

      return createCredentialResult(
        {
          ...agent,
          status: "offline",
          isActive: true,
        },
        secret,
      );
    });
  } catch (error) {
    if (error instanceof HardwareAgentLifecycleError) {
      throw error;
    }

    if (
      isPostgresUniqueViolation(
        error,
        "hardware_agents_one_active_per_register_uq",
      )
    ) {
      throw new HardwareAgentLifecycleError(
        "REGISTER_OCCUPIED",
        "Register ini sudah memiliki Hardware Agent aktif.",
      );
    }

    throw error;
  }
}

export async function replaceHardwareAgentDevice(
  input: LifecycleBaseInput,
): Promise<HardwareAgentCredentialResult> {
  assertLifecycleInput(input);

  return db.transaction(async (tx) => {
    const oldAgent = await getAccessibleAgent(tx, input);

    if (!oldAgent.isActive || oldAgent.status === "disabled") {
      throw new HardwareAgentLifecycleError(
        "AGENT_ALREADY_DISABLED",
        "Agent lama sudah nonaktif. Buat agent baru pada register ini melalui provisioning normal.",
      );
    }

    await assertNoActiveJobs(tx, {
      organizationId: input.organizationId,
      agentId: oldAgent.id,
    });

    const newAgentId = randomUUID();
    const secret = randomBytes(48).toString("base64url");
    const encryptedSecret = encryptHardwareAgentSecret(newAgentId, secret);
    const replacementCode = await getReplacementCode(
      tx,
      input.organizationId,
      oldAgent.code,
    );
    const now = new Date();

    await tx
      .update(hardwareAgents)
      .set({
        isActive: false,
        status: "disabled",
        updatedAt: now,
      })
      .where(eq(hardwareAgents.id, oldAgent.id));

    const [newAgent] = await tx
      .insert(hardwareAgents)
      .values({
        id: newAgentId,
        organizationId: input.organizationId,
        outletId: oldAgent.outletId,
        registerId: oldAgent.registerId,
        code: replacementCode,
        name: oldAgent.name,
        secretHash: encryptedSecret,
        status: "offline",
        isActive: true,
        capabilities: {},
        settings: {},
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: hardwareAgents.id,
        code: hardwareAgents.code,
        name: hardwareAgents.name,
      });

    if (!newAgent) {
      throw new Error("Replacement Hardware Agent gagal dibuat.");
    }

    await tx.insert(auditLogs).values([
      {
        organizationId: input.organizationId,
        outletId: oldAgent.outletId,
        actorUserId: input.actorUserId,
        action: "hardware.agent.replace_old_device",
        entityType: "hardware_agent",
        entityId: oldAgent.id,
        beforeData: {
          status: oldAgent.status,
          isActive: true,
          code: oldAgent.code,
        },
        afterData: {
          status: "disabled",
          isActive: false,
          replacementAgentId: newAgent.id,
          replacementAgentCode: newAgent.code,
        },
        reason: "Mini PC lama diganti melalui dashboard RMS.",
        requestId: normalizeRequestId(input.requestId),
        ipAddress: normalizeIp(input.ipAddress),
        userAgent: normalizeUserAgent(input.userAgent),
        metadata: {
          source: "admin.hardware_dashboard",
          registerCode: oldAgent.registerCode,
        },
        createdAt: now,
      },
      {
        organizationId: input.organizationId,
        outletId: oldAgent.outletId,
        actorUserId: input.actorUserId,
        action: "hardware.agent.replace_new_device",
        entityType: "hardware_agent",
        entityId: newAgent.id,
        beforeData: null,
        afterData: {
          status: "offline",
          isActive: true,
          code: newAgent.code,
          replacedAgentId: oldAgent.id,
          replacedAgentCode: oldAgent.code,
        },
        reason: "Mini PC replacement diprovisikan melalui dashboard RMS.",
        requestId: normalizeRequestId(input.requestId),
        ipAddress: normalizeIp(input.ipAddress),
        userAgent: normalizeUserAgent(input.userAgent),
        metadata: {
          source: "admin.hardware_dashboard",
          outletCode: oldAgent.outletCode,
          registerCode: oldAgent.registerCode,
          secretExposedOnce: true,
        },
        createdAt: now,
      },
    ]);

    return {
      agent: {
        id: newAgent.id,
        code: newAgent.code,
        name: newAgent.name,
        outletId: oldAgent.outletId,
        outletCode: oldAgent.outletCode,
        outletName: oldAgent.outletName,
        registerId: oldAgent.registerId,
        registerCode: oldAgent.registerCode,
        registerName: oldAgent.registerName,
      },
      credential: {
        secret,
        authMode: "signed",
        protocolMode: "v2-preferred",
      },
    };
  });
}
