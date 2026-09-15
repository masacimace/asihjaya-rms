import { randomBytes, randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { hardwareAgentEnrollments } from "@/db/schema/hardware-enrollment";
import { auditLogs, hardwareAgents, outlets, registers } from "@/db/schema";
import {
  decryptHardwareAgentSecret,
  encryptHardwareAgentSecret,
} from "@/lib/hardware/agent-credential";
import { hashHardwareEnrollmentCode } from "@/lib/hardware/enrollment-code";

const INSTANCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HardwareAgentEnrollmentClaimErrorCode =
  | "INVALID_INPUT"
  | "ENROLLMENT_NOT_FOUND"
  | "ENROLLMENT_EXPIRED"
  | "ENROLLMENT_REVOKED"
  | "ENROLLMENT_CLAIMED_BY_OTHER_INSTANCE"
  | "REGISTER_UNAVAILABLE"
  | "ACTIVE_AGENT_EXISTS"
  | "AGENT_UNAVAILABLE"
  | "CREDENTIAL_UNAVAILABLE";

export class HardwareAgentEnrollmentClaimError extends Error {
  readonly code: HardwareAgentEnrollmentClaimErrorCode;

  constructor(code: HardwareAgentEnrollmentClaimErrorCode, message: string) {
    super(message);
    this.name = "HardwareAgentEnrollmentClaimError";
    this.code = code;
  }
}

export type ClaimHardwareAgentEnrollmentInput = {
  installationCode: string;
  instanceId: string;
  machineName?: string | null;
  installerVersion?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ClaimHardwareAgentEnrollmentResult = {
  idempotent: boolean;
  enrollment: {
    id: string;
    status: "claimed" | "completed";
    claimedAt: Date;
  };
  agent: {
    id: string;
    code: string;
    name: string;
    organizationId: string;
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

type TransactionResult =
  | { ok: true; value: ClaimHardwareAgentEnrollmentResult }
  | { ok: false; error: HardwareAgentEnrollmentClaimError };

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
}

function buildAgentCode(registerCode: string, agentId: string): string {
  const registerPart = registerCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 40) || "REGISTER";
  const suffix = agentId.replaceAll("-", "").slice(0, 12).toUpperCase();
  return `HUB-${registerPart}-${suffix}`;
}

function buildAgentName(input: {
  outletName: string;
  registerName: string;
  machineName: string | null;
}): string {
  const label = input.machineName
    ? `Hardware Hub ${input.registerName} · ${input.machineName}`
    : `Hardware Hub ${input.outletName} · ${input.registerName}`;
  return label.slice(0, 160);
}

function isPostgresUniqueViolation(
  error: unknown,
  constraint: string,
): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    constraint?: unknown;
    cause?: unknown;
  };
  if (candidate.code === "23505" && candidate.constraint === constraint) {
    return true;
  }
  return Boolean(
    candidate.cause &&
      candidate.cause !== error &&
      isPostgresUniqueViolation(candidate.cause, constraint),
  );
}

export async function claimHardwareAgentEnrollment(
  input: ClaimHardwareAgentEnrollmentInput,
): Promise<ClaimHardwareAgentEnrollmentResult> {
  const codeHash = hashHardwareEnrollmentCode(input.installationCode);
  const instanceId = input.instanceId.trim().toLowerCase();

  if (!codeHash || !INSTANCE_ID_PATTERN.test(instanceId)) {
    throw new HardwareAgentEnrollmentClaimError(
      "INVALID_INPUT",
      "Installation Code atau instance ID tidak valid.",
    );
  }

  const machineName = normalizeOptionalText(input.machineName, 120);
  const installerVersion = normalizeOptionalText(input.installerVersion, 64);
  const ipAddress = normalizeOptionalText(input.ipAddress, 64);
  const userAgent = normalizeOptionalText(input.userAgent, 500);
  const now = new Date();

  try {
    const result = await db.transaction<TransactionResult>(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`hardware-enrollment:${codeHash}`}, 0))`,
      );

      const [enrollment] = await tx
        .select({
          id: hardwareAgentEnrollments.id,
          organizationId: hardwareAgentEnrollments.organizationId,
          outletId: hardwareAgentEnrollments.outletId,
          registerId: hardwareAgentEnrollments.registerId,
          status: hardwareAgentEnrollments.status,
          expiresAt: hardwareAgentEnrollments.expiresAt,
          claimedAt: hardwareAgentEnrollments.claimedAt,
          claimedByInstanceId: hardwareAgentEnrollments.claimedByInstanceId,
          agentId: hardwareAgentEnrollments.agentId,
          outletCode: outlets.code,
          outletName: outlets.name,
          outletIsActive: outlets.isActive,
          registerCode: registers.code,
          registerName: registers.name,
          registerIsActive: registers.isActive,
          registerIsHardwareHub: registers.isHardwareHub,
        })
        .from(hardwareAgentEnrollments)
        .innerJoin(outlets, eq(hardwareAgentEnrollments.outletId, outlets.id))
        .innerJoin(registers, eq(hardwareAgentEnrollments.registerId, registers.id))
        .where(eq(hardwareAgentEnrollments.codeHash, codeHash))
        .limit(1);

      if (!enrollment) {
        return {
          ok: false,
          error: new HardwareAgentEnrollmentClaimError(
            "ENROLLMENT_NOT_FOUND",
            "Installation Code tidak ditemukan.",
          ),
        };
      }

      if (!enrollment.outletIsActive || !enrollment.registerIsActive || !enrollment.registerIsHardwareHub) {
        return {
          ok: false,
          error: new HardwareAgentEnrollmentClaimError(
            "REGISTER_UNAVAILABLE",
            "Outlet atau register Hardware Hub sudah tidak tersedia.",
          ),
        };
      }

      if (enrollment.status === "expired") {
        return {
          ok: false,
          error: new HardwareAgentEnrollmentClaimError(
            "ENROLLMENT_EXPIRED",
            "Installation Code sudah kedaluwarsa.",
          ),
        };
      }

      if (enrollment.status === "revoked") {
        return {
          ok: false,
          error: new HardwareAgentEnrollmentClaimError(
            "ENROLLMENT_REVOKED",
            "Installation Code sudah dibatalkan.",
          ),
        };
      }

      if (enrollment.status === "claimed" || enrollment.status === "completed") {
        if (enrollment.claimedByInstanceId !== instanceId) {
          return {
            ok: false,
            error: new HardwareAgentEnrollmentClaimError(
              "ENROLLMENT_CLAIMED_BY_OTHER_INSTANCE",
              "Installation Code sudah digunakan oleh Mini PC lain.",
            ),
          };
        }

        if (!enrollment.agentId || !enrollment.claimedAt) {
          return {
            ok: false,
            error: new HardwareAgentEnrollmentClaimError(
              "AGENT_UNAVAILABLE",
              "Hardware Agent hasil enrollment tidak tersedia.",
            ),
          };
        }

        const [agent] = await tx
          .select({
            id: hardwareAgents.id,
            code: hardwareAgents.code,
            name: hardwareAgents.name,
            organizationId: hardwareAgents.organizationId,
            outletId: hardwareAgents.outletId,
            registerId: hardwareAgents.registerId,
            secretHash: hardwareAgents.secretHash,
            isActive: hardwareAgents.isActive,
          })
          .from(hardwareAgents)
          .where(
            and(
              eq(hardwareAgents.id, enrollment.agentId),
              eq(hardwareAgents.organizationId, enrollment.organizationId),
              eq(hardwareAgents.outletId, enrollment.outletId),
              eq(hardwareAgents.registerId, enrollment.registerId),
            ),
          )
          .limit(1);

        if (!agent || !agent.isActive) {
          return {
            ok: false,
            error: new HardwareAgentEnrollmentClaimError(
              "AGENT_UNAVAILABLE",
              "Hardware Agent hasil enrollment sudah tidak aktif.",
            ),
          };
        }

        const secret = decryptHardwareAgentSecret(agent.id, agent.secretHash);
        if (!secret) {
          return {
            ok: false,
            error: new HardwareAgentEnrollmentClaimError(
              "CREDENTIAL_UNAVAILABLE",
              "Credential Hardware Agent tidak dapat dipulihkan.",
            ),
          };
        }

        return {
          ok: true,
          value: {
            idempotent: true,
            enrollment: {
              id: enrollment.id,
              status: enrollment.status,
              claimedAt: enrollment.claimedAt,
            },
            agent: {
              id: agent.id,
              code: agent.code,
              name: agent.name,
              organizationId: agent.organizationId,
              outletId: agent.outletId,
              outletCode: enrollment.outletCode,
              outletName: enrollment.outletName,
              registerId: agent.registerId,
              registerCode: enrollment.registerCode,
              registerName: enrollment.registerName,
            },
            credential: {
              secret,
              authMode: "signed",
              protocolMode: "v2-preferred",
            },
          },
        };
      }

      if (enrollment.status !== "pending") {
        return {
          ok: false,
          error: new HardwareAgentEnrollmentClaimError(
            "ENROLLMENT_NOT_FOUND",
            "Installation Code sudah tidak aktif.",
          ),
        };
      }

      if (enrollment.expiresAt <= now) {
        await tx
          .update(hardwareAgentEnrollments)
          .set({ status: "expired", updatedAt: now })
          .where(eq(hardwareAgentEnrollments.id, enrollment.id));
        return {
          ok: false,
          error: new HardwareAgentEnrollmentClaimError(
            "ENROLLMENT_EXPIRED",
            "Installation Code sudah kedaluwarsa.",
          ),
        };
      }

      const [activeAgent] = await tx
        .select({ id: hardwareAgents.id })
        .from(hardwareAgents)
        .where(
          and(
            eq(hardwareAgents.registerId, enrollment.registerId),
            eq(hardwareAgents.isActive, true),
          ),
        )
        .limit(1);

      if (activeAgent) {
        return {
          ok: false,
          error: new HardwareAgentEnrollmentClaimError(
            "ACTIVE_AGENT_EXISTS",
            "Register ini sudah memiliki Hardware Agent aktif.",
          ),
        };
      }

      const agentId = randomUUID();
      const secret = randomBytes(48).toString("base64url");
      const agentCode = buildAgentCode(enrollment.registerCode, agentId);
      const agentName = buildAgentName({
        outletName: enrollment.outletName,
        registerName: enrollment.registerName,
        machineName,
      });
      const encryptedSecret = encryptHardwareAgentSecret(agentId, secret);

      const [agent] = await tx
        .insert(hardwareAgents)
        .values({
          id: agentId,
          organizationId: enrollment.organizationId,
          outletId: enrollment.outletId,
          registerId: enrollment.registerId,
          code: agentCode,
          name: agentName,
          secretHash: encryptedSecret,
          status: "offline",
          isActive: true,
          capabilities: {},
          settings: {
            enrollment: {
              instanceId,
              machineName,
              installerVersion,
            },
          },
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: hardwareAgents.id,
          code: hardwareAgents.code,
          name: hardwareAgents.name,
        });

      if (!agent) {
        throw new Error("Hardware Agent gagal dibuat dari enrollment.");
      }

      const [claimedEnrollment] = await tx
        .update(hardwareAgentEnrollments)
        .set({
          status: "claimed",
          claimedAt: now,
          claimedByInstanceId: instanceId,
          claimedIpAddress: ipAddress,
          claimedUserAgent: userAgent,
          agentId: agent.id,
          updatedAt: now,
        })
        .where(
          and(
            eq(hardwareAgentEnrollments.id, enrollment.id),
            eq(hardwareAgentEnrollments.status, "pending"),
          ),
        )
        .returning({ id: hardwareAgentEnrollments.id });

      if (!claimedEnrollment) {
        throw new Error("Enrollment gagal di-bind ke Hardware Agent.");
      }

      await tx.insert(auditLogs).values([
        {
          organizationId: enrollment.organizationId,
          outletId: enrollment.outletId,
          actorUserId: null,
          action: "hardware.agent.create",
          entityType: "hardware_agent",
          entityId: agent.id,
          beforeData: null,
          afterData: {
            code: agent.code,
            name: agent.name,
            status: "offline",
            isActive: true,
            registerId: enrollment.registerId,
            credentialScheme: "signed-v2",
          },
          reason: "Hardware Agent dibuat saat installer mengklaim Installation Code.",
          requestId: null,
          ipAddress,
          userAgent,
          metadata: {
            source: "hardware_hub_installer",
            enrollmentId: enrollment.id,
            instanceId,
            machineName,
            installerVersion,
            credentialScheme: "signed-v2",
          },
          createdAt: now,
        },
        {
          organizationId: enrollment.organizationId,
          outletId: enrollment.outletId,
          actorUserId: null,
          action: "hardware.enrollment.claim",
          entityType: "hardware_agent_enrollment",
          entityId: enrollment.id,
          beforeData: { status: "pending" },
          afterData: {
            status: "claimed",
            claimedAt: now.toISOString(),
            agentId: agent.id,
          },
          reason: "Installation Code diklaim oleh installer Hardware Hub.",
          requestId: null,
          ipAddress,
          userAgent,
          metadata: {
            source: "hardware_hub_installer",
            instanceId,
            machineName,
            installerVersion,
          },
          createdAt: now,
        },
      ]);

      return {
        ok: true,
        value: {
          idempotent: false,
          enrollment: {
            id: enrollment.id,
            status: "claimed",
            claimedAt: now,
          },
          agent: {
            id: agent.id,
            code: agent.code,
            name: agent.name,
            organizationId: enrollment.organizationId,
            outletId: enrollment.outletId,
            outletCode: enrollment.outletCode,
            outletName: enrollment.outletName,
            registerId: enrollment.registerId,
            registerCode: enrollment.registerCode,
            registerName: enrollment.registerName,
          },
          credential: {
            secret,
            authMode: "signed",
            protocolMode: "v2-preferred",
          },
        },
      };
    });

    if (!result.ok) throw result.error;
    return result.value;
  } catch (error) {
    if (error instanceof HardwareAgentEnrollmentClaimError) throw error;

    if (
      isPostgresUniqueViolation(
        error,
        "hardware_agents_one_active_per_register_uq",
      )
    ) {
      throw new HardwareAgentEnrollmentClaimError(
        "ACTIVE_AGENT_EXISTS",
        "Register ini sudah memiliki Hardware Agent aktif.",
      );
    }

    throw error;
  }
}
