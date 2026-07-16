import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, hardwareJobs } from "@/db/schema";
import { assertHardwareJobPayloadV2 } from "@/lib/hardware/job-payload-contracts-v2";
import { hashHardwareJobPayloadV2 } from "@/lib/hardware/job-payload-v2";
import {
  getHardwareJobExpiresAt,
  getRequiredHardwareCapability,
  HARDWARE_JOB_PROTOCOL_V2,
  type HardwareJobCreationMode,
  type HardwareJobType,
} from "@/lib/hardware/job-protocol-v2";

export type HardwareJobTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

type HardwareJobV2AuditInput = {
  source: string;
  reason?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CreateHardwareJobV2Input = {
  organizationId: string;
  outletId: string;
  registerId: string;
  createdByUserId?: string | null;
  targetAgentId?: string | null;
  jobType: HardwareJobType;
  mode: HardwareJobCreationMode;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  sourceType: string;
  sourceId: string;
  priority?: number;
  maxAttempts?: number;
  availableAt?: Date;
  now?: Date;
  audit?: HardwareJobV2AuditInput;
};

export type CreateHardwareJobV2Result = {
  job: typeof hardwareJobs.$inferSelect;
  duplicate: boolean;
};

function getDeviceDefinition(jobType: HardwareJobType) {
  switch (jobType) {
    case "print_label_sato":
    case "test_label_printer":
      return {
        deviceType: "label_printer" as const,
        targetDevice: "label_printer",
      };
    case "print_receipt_certificate":
    case "test_document_printer":
      return {
        deviceType: "document_printer" as const,
        targetDevice: "document_printer",
      };
    case "open_cash_drawer":
    case "test_cash_drawer":
      return {
        deviceType: "cash_drawer" as const,
        targetDevice: "cash_drawer",
      };
  }
}

function getDefaultPriority(
  jobType: HardwareJobType,
  mode: HardwareJobCreationMode,
) {
  if (mode === "test" || jobType.startsWith("test_")) return 20;
  if (jobType === "open_cash_drawer") return 10;
  if (jobType === "print_receipt_certificate") {
    return mode === "manual" ? 25 : 30;
  }
  return 50;
}

function getDefaultMaxAttempts(
  jobType: HardwareJobType,
  mode: HardwareJobCreationMode,
) {
  if (mode === "test" || jobType.startsWith("test_")) return 1;
  if (jobType === "open_cash_drawer") return 1;
  return 2;
}

function normalizeKey(value: string, field: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${field} wajib diisi.`);
  }
  if (normalized.length > maxLength) {
    throw new TypeError(`${field} melebihi ${maxLength} karakter.`);
  }
  return normalized;
}

export function buildHardwareJobV2Insert(
  input: CreateHardwareJobV2Input,
): typeof hardwareJobs.$inferInsert {
  const now = input.now ?? new Date();
  const availableAt = input.availableAt ?? now;
  const idempotencyKey = normalizeKey(
    input.idempotencyKey,
    "Hardware idempotency key",
    160,
  );
  const sourceType = normalizeKey(input.sourceType, "Hardware source type", 80);
  const sourceId = normalizeKey(input.sourceId, "Hardware source ID", 160);

  assertHardwareJobPayloadV2(input.jobType, input.payload);
  const device = getDeviceDefinition(input.jobType);

  return {
    organizationId: input.organizationId,
    outletId: input.outletId,
    registerId: input.registerId,
    agentId: null,
    targetAgentId: input.targetAgentId ?? null,
    currentAttemptId: null,
    createdByUserId: input.createdByUserId ?? null,
    protocolVersion: HARDWARE_JOB_PROTOCOL_V2,
    jobType: input.jobType,
    deviceType: device.deviceType,
    requiredCapability: getRequiredHardwareCapability(input.jobType),
    targetDevice: device.targetDevice,
    status: "pending",
    priority: input.priority ?? getDefaultPriority(input.jobType, input.mode),
    attempts: 0,
    maxAttempts:
      input.maxAttempts ?? getDefaultMaxAttempts(input.jobType, input.mode),
    payload: input.payload,
    payloadHash: hashHardwareJobPayloadV2(input.payload),
    result: {},
    error: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    idempotencyKey,
    sourceType,
    sourceId,
    availableAt,
    expiresAt: getHardwareJobExpiresAt({
      jobType: input.jobType,
      mode: input.mode,
      now,
    }),
    createdAt: now,
    updatedAt: now,
  };
}

async function getExistingJobByIdempotencyKey(
  transaction: HardwareJobTransaction,
  organizationId: string,
  idempotencyKey: string,
) {
  const [existing] = await transaction
    .select()
    .from(hardwareJobs)
    .where(
      and(
        eq(hardwareJobs.organizationId, organizationId),
        eq(hardwareJobs.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  return existing ?? null;
}

export async function createHardwareJobV2InTransaction(
  transaction: HardwareJobTransaction,
  input: CreateHardwareJobV2Input,
): Promise<CreateHardwareJobV2Result> {
  const values = buildHardwareJobV2Insert(input);
  const [inserted] = await transaction
    .insert(hardwareJobs)
    .values(values)
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    if (input.audit) {
      await transaction.insert(auditLogs).values({
        organizationId: input.organizationId,
        outletId: input.outletId,
        actorUserId: input.createdByUserId ?? null,
        action: "hardware.job_created",
        entityType: "hardware_job",
        entityId: inserted.id,
        afterData: {
          protocolVersion: HARDWARE_JOB_PROTOCOL_V2,
          jobType: inserted.jobType,
          status: inserted.status,
          requiredCapability: inserted.requiredCapability,
          targetAgentId: inserted.targetAgentId,
          sourceType: inserted.sourceType,
          sourceId: inserted.sourceId,
          expiresAt: inserted.expiresAt?.toISOString() ?? null,
        },
        reason: input.audit.reason ?? null,
        requestId: input.audit.requestId?.slice(0, 120) ?? null,
        ipAddress: input.audit.ipAddress?.slice(0, 64) ?? null,
        userAgent: input.audit.userAgent ?? null,
        metadata: {
          source: input.audit.source,
          payloadHash: inserted.payloadHash,
          idempotencyKey: inserted.idempotencyKey,
          creationMode: input.mode,
        },
        createdAt: input.now ?? new Date(),
      });
    }

    return { job: inserted, duplicate: false };
  }

  const existing = await getExistingJobByIdempotencyKey(
    transaction,
    input.organizationId,
    values.idempotencyKey!,
  );

  if (!existing) {
    throw new Error(
      "Hardware job tidak tersimpan dan tidak ditemukan berdasarkan idempotency key.",
    );
  }

  if (
    existing.jobType !== input.jobType ||
    existing.sourceType !== values.sourceType ||
    existing.sourceId !== values.sourceId
  ) {
    throw new Error(
      "Hardware idempotency key sudah digunakan oleh intent bisnis yang berbeda.",
    );
  }

  return { job: existing, duplicate: true };
}

export function createHardwareJobV2(
  input: CreateHardwareJobV2Input,
): Promise<CreateHardwareJobV2Result> {
  return db.transaction((transaction) =>
    createHardwareJobV2InTransaction(transaction, input),
  );
}
