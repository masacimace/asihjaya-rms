import { and, count, eq, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { hardwareJobResolutions, hardwareJobs } from "@/db/schema";

const DEFAULT_COMPLETED_RETENTION_DAYS = 30;
const DEFAULT_CANCELLED_RETENTION_DAYS = 30;
const DEFAULT_FAILED_RETENTION_DAYS = 90;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 365;

type CleanupHardwareJobStatus = "completed" | "cancelled" | "failed";

type HardwareJobCleanupScope = {
  organizationId: string;
  outletIds?: string[];
  now?: Date;
};

export type HardwareJobRetentionPolicy = {
  completedDays: number;
  cancelledDays: number;
  failedDays: number;
  completedCutoff: Date;
  cancelledCutoff: Date;
  failedCutoff: Date;
};

export type HardwareJobCleanupPreview = {
  policy: HardwareJobRetentionPolicy;
  completed: number;
  cancelled: number;
  failed: number;
  totalEligible: number;
};

export type CleanupHardwareJobsResult = HardwareJobCleanupPreview & {
  deleted: {
    completed: number;
    cancelled: number;
    failed: number;
    total: number;
  };
};

function readRetentionDays(envName: string, fallbackDays: number) {
  const value = Number(process.env[envName]);

  if (!Number.isFinite(value) || value <= 0) {
    return fallbackDays;
  }

  return Math.min(
    MAX_RETENTION_DAYS,
    Math.max(MIN_RETENTION_DAYS, Math.floor(value)),
  );
}

function subtractDays(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function getHardwareJobRetentionPolicy(
  now = new Date(),
): HardwareJobRetentionPolicy {
  const completedDays = readRetentionDays(
    "HARDWARE_JOB_COMPLETED_RETENTION_DAYS",
    DEFAULT_COMPLETED_RETENTION_DAYS,
  );
  const cancelledDays = readRetentionDays(
    "HARDWARE_JOB_CANCELLED_RETENTION_DAYS",
    DEFAULT_CANCELLED_RETENTION_DAYS,
  );
  const failedDays = readRetentionDays(
    "HARDWARE_JOB_FAILED_RETENTION_DAYS",
    DEFAULT_FAILED_RETENTION_DAYS,
  );

  return {
    completedDays,
    cancelledDays,
    failedDays,
    completedCutoff: subtractDays(now, completedDays),
    cancelledCutoff: subtractDays(now, cancelledDays),
    failedCutoff: subtractDays(now, failedDays),
  };
}

function getStatusCompletedAtExpression(status: CleanupHardwareJobStatus) {
  if (status === "completed") {
    return sql`coalesce(${hardwareJobs.completedAt}, ${hardwareJobs.updatedAt})`;
  }

  if (status === "cancelled") {
    return sql`coalesce(${hardwareJobs.cancelledAt}, ${hardwareJobs.updatedAt})`;
  }

  return sql`coalesce(${hardwareJobs.failedAt}, ${hardwareJobs.updatedAt})`;
}

function buildCleanupWhere({
  organizationId,
  outletIds,
  status,
  cutoff,
}: {
  organizationId: string;
  outletIds?: string[];
  status: CleanupHardwareJobStatus;
  cutoff: Date;
}) {
  const conditions = [
    eq(hardwareJobs.organizationId, organizationId),
    eq(hardwareJobs.status, status),
    lt(getStatusCompletedAtExpression(status), cutoff),
    sql`not exists (
      select 1
      from ${hardwareJobResolutions}
      where ${hardwareJobResolutions.jobId} = ${hardwareJobs.id}
    )`,
  ];

  if (outletIds && outletIds.length > 0) {
    conditions.push(inArray(hardwareJobs.outletId, outletIds));
  }

  return and(...conditions);
}

async function countCleanupEligibleJobs({
  organizationId,
  outletIds,
  status,
  cutoff,
}: {
  organizationId: string;
  outletIds?: string[];
  status: CleanupHardwareJobStatus;
  cutoff: Date;
}) {
  const [row] = await db
    .select({ total: count() })
    .from(hardwareJobs)
    .where(buildCleanupWhere({ organizationId, outletIds, status, cutoff }));

  return Number(row?.total ?? 0);
}

export async function getHardwareJobCleanupPreview({
  organizationId,
  outletIds,
  now = new Date(),
}: HardwareJobCleanupScope): Promise<HardwareJobCleanupPreview> {
  const policy = getHardwareJobRetentionPolicy(now);

  const [completed, cancelled, failed] = await Promise.all([
    countCleanupEligibleJobs({
      organizationId,
      outletIds,
      status: "completed",
      cutoff: policy.completedCutoff,
    }),
    countCleanupEligibleJobs({
      organizationId,
      outletIds,
      status: "cancelled",
      cutoff: policy.cancelledCutoff,
    }),
    countCleanupEligibleJobs({
      organizationId,
      outletIds,
      status: "failed",
      cutoff: policy.failedCutoff,
    }),
  ]);

  return {
    policy,
    completed,
    cancelled,
    failed,
    totalEligible: completed + cancelled + failed,
  };
}

async function deleteCleanupEligibleJobs({
  organizationId,
  outletIds,
  status,
  cutoff,
}: {
  organizationId: string;
  outletIds?: string[];
  status: CleanupHardwareJobStatus;
  cutoff: Date;
}) {
  const rows = await db
    .delete(hardwareJobs)
    .where(buildCleanupWhere({ organizationId, outletIds, status, cutoff }))
    .returning({ id: hardwareJobs.id });

  return rows.length;
}

export async function cleanupHardwareJobs({
  organizationId,
  outletIds,
  now = new Date(),
}: HardwareJobCleanupScope): Promise<CleanupHardwareJobsResult> {
  const preview = await getHardwareJobCleanupPreview({
    organizationId,
    outletIds,
    now,
  });

  const [completed, cancelled, failed] = await Promise.all([
    deleteCleanupEligibleJobs({
      organizationId,
      outletIds,
      status: "completed",
      cutoff: preview.policy.completedCutoff,
    }),
    deleteCleanupEligibleJobs({
      organizationId,
      outletIds,
      status: "cancelled",
      cutoff: preview.policy.cancelledCutoff,
    }),
    deleteCleanupEligibleJobs({
      organizationId,
      outletIds,
      status: "failed",
      cutoff: preview.policy.failedCutoff,
    }),
  ]);

  return {
    ...preview,
    deleted: {
      completed,
      cancelled,
      failed,
      total: completed + cancelled + failed,
    },
  };
}
