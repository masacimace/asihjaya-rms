import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { hardwareAgentEnrollments } from "@/db/schema/hardware-enrollment";
import { auditLogs } from "@/db/schema";
import type { HardwareAgentAuth } from "@/lib/hardware/agent-auth";

const INSTANCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CompleteHardwareAgentEnrollmentErrorCode =
  | "INVALID_INPUT"
  | "ENROLLMENT_NOT_FOUND"
  | "ENROLLMENT_AGENT_MISMATCH"
  | "ENROLLMENT_INSTANCE_MISMATCH"
  | "ENROLLMENT_NOT_CLAIMED";

export class CompleteHardwareAgentEnrollmentError extends Error {
  readonly code: CompleteHardwareAgentEnrollmentErrorCode;

  constructor(code: CompleteHardwareAgentEnrollmentErrorCode, message: string) {
    super(message);
    this.name = "CompleteHardwareAgentEnrollmentError";
    this.code = code;
  }
}

export type CompleteHardwareAgentEnrollmentInput = {
  enrollmentId: string;
  instanceId: string;
  auth: HardwareAgentAuth;
  installerVersion?: string | null;
  credentialStoreKind?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
};

export type CompleteHardwareAgentEnrollmentResult = {
  idempotent: boolean;
  enrollment: {
    id: string;
    status: "completed";
    claimedAt: Date;
    completedAt: Date;
  };
};

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
}

export async function completeHardwareAgentEnrollment(
  input: CompleteHardwareAgentEnrollmentInput,
): Promise<CompleteHardwareAgentEnrollmentResult> {
  const enrollmentId = input.enrollmentId.trim().toLowerCase();
  const instanceId = input.instanceId.trim().toLowerCase();

  if (!INSTANCE_ID_PATTERN.test(enrollmentId) || !INSTANCE_ID_PATTERN.test(instanceId)) {
    throw new CompleteHardwareAgentEnrollmentError(
      "INVALID_INPUT",
      "Enrollment ID atau instance ID tidak valid.",
    );
  }

  const installerVersion = normalizeOptionalText(input.installerVersion, 64);
  const credentialStoreKind = normalizeOptionalText(input.credentialStoreKind, 80);
  const ipAddress = normalizeOptionalText(input.ipAddress, 64);
  const userAgent = normalizeOptionalText(input.userAgent, 500);
  const now = input.now ?? new Date();

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`hardware-enrollment-complete:${enrollmentId}`}, 0))`,
    );

    const [enrollment] = await tx
      .select({
        id: hardwareAgentEnrollments.id,
        organizationId: hardwareAgentEnrollments.organizationId,
        outletId: hardwareAgentEnrollments.outletId,
        status: hardwareAgentEnrollments.status,
        claimedAt: hardwareAgentEnrollments.claimedAt,
        completedAt: hardwareAgentEnrollments.completedAt,
        claimedByInstanceId: hardwareAgentEnrollments.claimedByInstanceId,
        agentId: hardwareAgentEnrollments.agentId,
      })
      .from(hardwareAgentEnrollments)
      .where(eq(hardwareAgentEnrollments.id, enrollmentId))
      .limit(1);

    if (!enrollment) {
      throw new CompleteHardwareAgentEnrollmentError(
        "ENROLLMENT_NOT_FOUND",
        "Enrollment Hardware Hub tidak ditemukan.",
      );
    }

    if (enrollment.agentId !== input.auth.agent.id) {
      throw new CompleteHardwareAgentEnrollmentError(
        "ENROLLMENT_AGENT_MISMATCH",
        "Hardware Agent tidak sesuai dengan enrollment.",
      );
    }

    if (enrollment.claimedByInstanceId !== instanceId) {
      throw new CompleteHardwareAgentEnrollmentError(
        "ENROLLMENT_INSTANCE_MISMATCH",
        "Installer instance tidak sesuai dengan enrollment.",
      );
    }

    if (
      enrollment.organizationId !== input.auth.agent.organizationId ||
      enrollment.outletId !== input.auth.agent.outletId
    ) {
      throw new CompleteHardwareAgentEnrollmentError(
        "ENROLLMENT_AGENT_MISMATCH",
        "Scope Hardware Agent tidak sesuai dengan enrollment.",
      );
    }

    if (
      enrollment.status === "completed" &&
      enrollment.claimedAt &&
      enrollment.completedAt
    ) {
      return {
        idempotent: true,
        enrollment: {
          id: enrollment.id,
          status: "completed" as const,
          claimedAt: enrollment.claimedAt,
          completedAt: enrollment.completedAt,
        },
      };
    }

    if (enrollment.status !== "claimed" || !enrollment.claimedAt || !enrollment.agentId) {
      throw new CompleteHardwareAgentEnrollmentError(
        "ENROLLMENT_NOT_CLAIMED",
        "Enrollment belum berada pada state claimed.",
      );
    }

    const [completed] = await tx
      .update(hardwareAgentEnrollments)
      .set({
        status: "completed",
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(hardwareAgentEnrollments.id, enrollment.id))
      .returning({ completedAt: hardwareAgentEnrollments.completedAt });

    if (!completed?.completedAt) {
      throw new Error("Enrollment completion timestamp tidak tersedia.");
    }

    await tx.insert(auditLogs).values({
      organizationId: enrollment.organizationId,
      outletId: enrollment.outletId,
      actorUserId: null,
      action: "hardware.enrollment.complete",
      entityType: "hardware_agent_enrollment",
      entityId: enrollment.id,
      beforeData: { status: "claimed" },
      afterData: {
        status: "completed",
        completedAt: completed.completedAt.toISOString(),
        agentId: enrollment.agentId,
      },
      reason: "Installer mengonfirmasi credential Hardware Hub sudah tersimpan secara durable.",
      requestId: null,
      ipAddress,
      userAgent,
      metadata: {
        source: "hardware_hub_installer",
        instanceId,
        installerVersion,
        credentialStoreKind,
        authScheme: input.auth.authScheme,
      },
      createdAt: now,
    });

    return {
      idempotent: false,
      enrollment: {
        id: enrollment.id,
        status: "completed" as const,
        claimedAt: enrollment.claimedAt,
        completedAt: completed.completedAt,
      },
    };
  });
}
