import { randomUUID } from "node:crypto";

import { and, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import { hardwareAgentEnrollments } from "@/db/schema/hardware-enrollment";
import {
  auditLogs,
  hardwareAgents,
  outlets,
  registers,
} from "@/db/schema";
import {
  generateHardwareEnrollmentCode,
  hashHardwareEnrollmentCode,
} from "@/lib/hardware/enrollment-code";

export const HARDWARE_ENROLLMENT_TTL_MINUTES = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HardwareAgentEnrollmentErrorCode =
  | "INVALID_INPUT"
  | "OUTLET_NOT_FOUND"
  | "REGISTER_NOT_FOUND"
  | "ACTIVE_AGENT_EXISTS"
  | "ENROLLMENT_NOT_FOUND"
  | "ENROLLMENT_NOT_PENDING";

export class HardwareAgentEnrollmentError extends Error {
  readonly code: HardwareAgentEnrollmentErrorCode;

  constructor(code: HardwareAgentEnrollmentErrorCode, message: string) {
    super(message);
    this.name = "HardwareAgentEnrollmentError";
    this.code = code;
  }
}

export type CreateHardwareAgentEnrollmentInput = {
  organizationId: string;
  accessibleOutletIds: readonly string[];
  actorUserId: string;
  outletId: string;
  registerId: string;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CreateHardwareAgentEnrollmentResult = {
  enrollment: {
    id: string;
    outletId: string;
    outletCode: string;
    outletName: string;
    registerId: string;
    registerCode: string;
    registerName: string;
    expiresAt: Date;
  };
  installationCode: string;
};

export type RevokeHardwareAgentEnrollmentInput = {
  organizationId: string;
  accessibleOutletIds: readonly string[];
  actorUserId: string;
  enrollmentId: string;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function assertValidUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new HardwareAgentEnrollmentError(
      "INVALID_INPUT",
      `${label} tidak valid.`,
    );
  }
}

export async function createHardwareAgentEnrollment(
  input: CreateHardwareAgentEnrollmentInput,
): Promise<CreateHardwareAgentEnrollmentResult> {
  const organizationId = input.organizationId.trim();
  const actorUserId = input.actorUserId.trim();
  const outletId = input.outletId.trim();
  const registerId = input.registerId.trim();

  assertValidUuid(organizationId, "Organization");
  assertValidUuid(actorUserId, "Pengguna");
  assertValidUuid(outletId, "Outlet");
  assertValidUuid(registerId, "Register");

  if (!input.accessibleOutletIds.includes(outletId)) {
    throw new HardwareAgentEnrollmentError(
      "OUTLET_NOT_FOUND",
      "Outlet tidak tersedia untuk pengguna ini.",
    );
  }

  const installationCode = generateHardwareEnrollmentCode();
  const codeHash = hashHardwareEnrollmentCode(installationCode);
  if (!codeHash) {
    throw new Error("Installation Code gagal dibuat.");
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + HARDWARE_ENROLLMENT_TTL_MINUTES * 60 * 1000,
  );
  const enrollmentId = randomUUID();

  return db.transaction(async (tx) => {
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
      throw new HardwareAgentEnrollmentError(
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
        isHardwareHub: registers.isHardwareHub,
      })
      .from(registers)
      .where(
        and(eq(registers.id, registerId), eq(registers.outletId, outlet.id)),
      )
      .limit(1);

    if (!register || !register.isActive || !register.isHardwareHub) {
      throw new HardwareAgentEnrollmentError(
        "REGISTER_NOT_FOUND",
        "Register Hardware Hub tidak ditemukan atau sudah tidak aktif.",
      );
    }

    const [activeAgent] = await tx
      .select({ id: hardwareAgents.id })
      .from(hardwareAgents)
      .where(
        and(
          eq(hardwareAgents.registerId, register.id),
          eq(hardwareAgents.isActive, true),
        ),
      )
      .limit(1);

    if (activeAgent) {
      throw new HardwareAgentEnrollmentError(
        "ACTIVE_AGENT_EXISTS",
        `Register ${register.name} sudah memiliki Hardware Hub aktif.`,
      );
    }

    await tx
      .update(hardwareAgentEnrollments)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(hardwareAgentEnrollments.organizationId, organizationId),
          eq(hardwareAgentEnrollments.registerId, register.id),
          eq(hardwareAgentEnrollments.status, "pending"),
          lte(hardwareAgentEnrollments.expiresAt, now),
        ),
      );

    await tx
      .update(hardwareAgentEnrollments)
      .set({ status: "revoked", revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(hardwareAgentEnrollments.organizationId, organizationId),
          eq(hardwareAgentEnrollments.registerId, register.id),
          eq(hardwareAgentEnrollments.status, "pending"),
        ),
      );

    const [enrollment] = await tx
      .insert(hardwareAgentEnrollments)
      .values({
        id: enrollmentId,
        organizationId,
        outletId: outlet.id,
        registerId: register.id,
        createdByUserId: actorUserId,
        codeHash,
        status: "pending",
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: hardwareAgentEnrollments.id });

    if (!enrollment) {
      throw new Error("Installation Code gagal dibuat.");
    }

    await tx.insert(auditLogs).values({
      organizationId,
      outletId: outlet.id,
      actorUserId,
      action: "hardware.enrollment.create",
      entityType: "hardware_agent_enrollment",
      entityId: enrollment.id,
      beforeData: null,
      afterData: {
        status: "pending",
        registerId: register.id,
        expiresAt: expiresAt.toISOString(),
      },
      reason: "Installation Code Hardware Hub dibuat melalui dashboard RMS.",
      requestId: input.requestId?.slice(0, 120) ?? null,
      ipAddress: input.ipAddress?.slice(0, 64) ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      metadata: {
        source: "admin.hardware_dashboard",
        installationCodeExposedOnce: true,
        outletCode: outlet.code,
        registerCode: register.code,
        ttlMinutes: HARDWARE_ENROLLMENT_TTL_MINUTES,
      },
      createdAt: now,
    });

    return {
      enrollment: {
        id: enrollment.id,
        outletId: outlet.id,
        outletCode: outlet.code,
        outletName: outlet.name,
        registerId: register.id,
        registerCode: register.code,
        registerName: register.name,
        expiresAt,
      },
      installationCode,
    };
  });
}

export async function revokeHardwareAgentEnrollment(
  input: RevokeHardwareAgentEnrollmentInput,
): Promise<void> {
  const organizationId = input.organizationId.trim();
  const actorUserId = input.actorUserId.trim();
  const enrollmentId = input.enrollmentId.trim();

  assertValidUuid(organizationId, "Organization");
  assertValidUuid(actorUserId, "Pengguna");
  assertValidUuid(enrollmentId, "Enrollment");

  const now = new Date();

  await db.transaction(async (tx) => {
    const [enrollment] = await tx
      .select({
        id: hardwareAgentEnrollments.id,
        outletId: hardwareAgentEnrollments.outletId,
        registerId: hardwareAgentEnrollments.registerId,
        status: hardwareAgentEnrollments.status,
        expiresAt: hardwareAgentEnrollments.expiresAt,
      })
      .from(hardwareAgentEnrollments)
      .where(
        and(
          eq(hardwareAgentEnrollments.id, enrollmentId),
          eq(hardwareAgentEnrollments.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!enrollment || !input.accessibleOutletIds.includes(enrollment.outletId)) {
      throw new HardwareAgentEnrollmentError(
        "ENROLLMENT_NOT_FOUND",
        "Installation Code tidak ditemukan.",
      );
    }

    if (enrollment.status !== "pending") {
      throw new HardwareAgentEnrollmentError(
        "ENROLLMENT_NOT_PENDING",
        "Installation Code ini sudah tidak aktif.",
      );
    }

    if (enrollment.expiresAt <= now) {
      await tx
        .update(hardwareAgentEnrollments)
        .set({ status: "expired", updatedAt: now })
        .where(eq(hardwareAgentEnrollments.id, enrollment.id));
      return;
    }

    await tx
      .update(hardwareAgentEnrollments)
      .set({ status: "revoked", revokedAt: now, updatedAt: now })
      .where(eq(hardwareAgentEnrollments.id, enrollment.id));

    await tx.insert(auditLogs).values({
      organizationId,
      outletId: enrollment.outletId,
      actorUserId,
      action: "hardware.enrollment.revoke",
      entityType: "hardware_agent_enrollment",
      entityId: enrollment.id,
      beforeData: { status: "pending" },
      afterData: { status: "revoked", revokedAt: now.toISOString() },
      reason: "Installation Code Hardware Hub dibatalkan melalui dashboard RMS.",
      requestId: input.requestId?.slice(0, 120) ?? null,
      ipAddress: input.ipAddress?.slice(0, 64) ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      metadata: {
        source: "admin.hardware_dashboard",
        registerId: enrollment.registerId,
      },
      createdAt: now,
    });
  });
}
