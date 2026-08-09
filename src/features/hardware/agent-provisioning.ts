import { randomBytes, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, hardwareAgents, outlets, registers } from "@/db/schema";
import { encryptHardwareAgentSecret } from "@/lib/hardware/agent-credential";

const HARDWARE_AGENT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,79}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HardwareAgentProvisioningErrorCode =
  | "INVALID_INPUT"
  | "OUTLET_NOT_FOUND"
  | "REGISTER_NOT_FOUND"
  | "ACTIVE_AGENT_EXISTS"
  | "CODE_EXISTS";

export class HardwareAgentProvisioningError extends Error {
  readonly code: HardwareAgentProvisioningErrorCode;

  constructor(code: HardwareAgentProvisioningErrorCode, message: string) {
    super(message);
    this.name = "HardwareAgentProvisioningError";
    this.code = code;
  }
}

export type ProvisionHardwareAgentInput = {
  organizationId: string;
  accessibleOutletIds: readonly string[];
  actorUserId: string;
  outletId: string;
  registerId: string;
  code: string;
  name: string;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ProvisionHardwareAgentResult = {
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

function normalizeAgentCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeAgentName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
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

  if (candidate.code === "23505" && candidate.constraint === constraint) {
    return true;
  }

  if (candidate.cause && candidate.cause !== error) {
    return isPostgresUniqueViolation(candidate.cause, constraint);
  }

  return false;
}

export async function provisionHardwareAgent(
  input: ProvisionHardwareAgentInput,
): Promise<ProvisionHardwareAgentResult> {
  const organizationId = input.organizationId.trim();
  const actorUserId = input.actorUserId.trim();
  const outletId = input.outletId.trim();
  const registerId = input.registerId.trim();
  const code = normalizeAgentCode(input.code);
  const name = normalizeAgentName(input.name);

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(actorUserId) ||
    !UUID_PATTERN.test(outletId) ||
    !UUID_PATTERN.test(registerId)
  ) {
    throw new HardwareAgentProvisioningError(
      "INVALID_INPUT",
      "Data organization, outlet, register, atau actor tidak valid.",
    );
  }

  if (!input.accessibleOutletIds.includes(outletId)) {
    throw new HardwareAgentProvisioningError(
      "OUTLET_NOT_FOUND",
      "Outlet tidak tersedia untuk pengguna ini.",
    );
  }

  if (!HARDWARE_AGENT_CODE_PATTERN.test(code)) {
    throw new HardwareAgentProvisioningError(
      "INVALID_INPUT",
      "Kode agent harus 3-80 karakter dan hanya boleh berisi huruf kapital, angka, underscore, atau tanda hubung.",
    );
  }

  if (name.length < 3 || name.length > 160) {
    throw new HardwareAgentProvisioningError(
      "INVALID_INPUT",
      "Nama Hardware Agent harus 3-160 karakter.",
    );
  }

  const now = new Date();
  const agentId = randomUUID();

  // 48 random bytes → 64-character base64url secret.
  const secret = randomBytes(48).toString("base64url");

  try {
    return await db.transaction(async (tx) => {
      const [outlet] = await tx
        .select({
          id: outlets.id,
          code: outlets.code,
          name: outlets.name,
          isActive: outlets.isActive,
        })
        .from(outlets)
        .where(
          and(
            eq(outlets.id, outletId),
            eq(outlets.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!outlet || !outlet.isActive) {
        throw new HardwareAgentProvisioningError(
          "OUTLET_NOT_FOUND",
          "Outlet tidak ditemukan atau sudah tidak aktif.",
        );
      }

      const [register] = await tx
        .select({
          id: registers.id,
          code: registers.code,
          name: registers.name,
          isActive: registers.isActive,
        })
        .from(registers)
        .where(
          and(eq(registers.id, registerId), eq(registers.outletId, outlet.id)),
        )
        .limit(1);

      if (!register || !register.isActive) {
        throw new HardwareAgentProvisioningError(
          "REGISTER_NOT_FOUND",
          "Register tidak ditemukan atau sudah tidak aktif.",
        );
      }

      const [existingActiveAgent] = await tx
        .select({
          id: hardwareAgents.id,
          code: hardwareAgents.code,
          name: hardwareAgents.name,
        })
        .from(hardwareAgents)
        .where(
          and(
            eq(hardwareAgents.registerId, register.id),
            eq(hardwareAgents.isActive, true),
          ),
        )
        .limit(1);

      if (existingActiveAgent) {
        throw new HardwareAgentProvisioningError(
          "ACTIVE_AGENT_EXISTS",
          `Register ${register.name} sudah memiliki Hardware Agent aktif ${existingActiveAgent.name} (${existingActiveAgent.code}).`,
        );
      }

      const [existingCode] = await tx
        .select({ id: hardwareAgents.id })
        .from(hardwareAgents)
        .where(
          and(
            eq(hardwareAgents.organizationId, organizationId),
            eq(hardwareAgents.code, code),
          ),
        )
        .limit(1);

      if (existingCode) {
        throw new HardwareAgentProvisioningError(
          "CODE_EXISTS",
          `Kode Hardware Agent ${code} sudah digunakan.`,
        );
      }

      const encryptedSecret = encryptHardwareAgentSecret(agentId, secret);

      const [agent] = await tx
        .insert(hardwareAgents)
        .values({
          id: agentId,
          organizationId,
          outletId: outlet.id,
          registerId: register.id,
          code,
          name,
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

      if (!agent) {
        throw new Error("Hardware Agent gagal dibuat.");
      }

      await tx.insert(auditLogs).values({
        organizationId,
        outletId: outlet.id,
        actorUserId,
        action: "hardware.agent.create",
        entityType: "hardware_agent",
        entityId: agent.id,
        beforeData: null,
        afterData: {
          code: agent.code,
          name: agent.name,
          status: "offline",
          isActive: true,
          outletId: outlet.id,
          registerId: register.id,
          credentialScheme: "signed-v2",
        },
        reason: "Provisioning Hardware Agent baru melalui dashboard RMS.",
        requestId:
          input.requestId && UUID_PATTERN.test(input.requestId)
            ? input.requestId
            : null,
        ipAddress: input.ipAddress?.slice(0, 64) ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
        metadata: {
          source: "admin.hardware_dashboard",
          credentialScheme: "signed-v2",
          secretExposedOnce: true,
          outletCode: outlet.code,
          registerCode: register.code,
        },
        createdAt: now,
      });

      return {
        agent: {
          id: agent.id,
          code: agent.code,
          name: agent.name,
          outletId: outlet.id,
          outletCode: outlet.code,
          outletName: outlet.name,
          registerId: register.id,
          registerCode: register.code,
          registerName: register.name,
        },
        credential: {
          secret,
          authMode: "signed",
          protocolMode: "v2-preferred",
        },
      };
    });
  } catch (error) {
    if (error instanceof HardwareAgentProvisioningError) {
      throw error;
    }

    if (
      isPostgresUniqueViolation(
        error,
        "hardware_agents_one_active_per_register_uq",
      )
    ) {
      throw new HardwareAgentProvisioningError(
        "ACTIVE_AGENT_EXISTS",
        "Register ini sudah memiliki Hardware Agent aktif.",
      );
    }

    if (isPostgresUniqueViolation(error, "hardware_agents_org_code_uq")) {
      throw new HardwareAgentProvisioningError(
        "CODE_EXISTS",
        `Kode Hardware Agent ${code} sudah digunakan.`,
      );
    }

    throw error;
  }
}
