import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { hardwareJobs } from "@/db/schema";

const activeHardwareJobStatuses = ["pending", "claimed", "printing"] as const;

type HardwareJobInsert = typeof hardwareJobs.$inferInsert;

type DuplicateGuardOptions = {
  organizationId: string;
  outletId: string;
  registerId: string;
  jobType: HardwareJobInsert["jobType"];
  sourceType: string;
  sourceId: string;
  targetDevice?: string | null;
};

export type HardwareJobDuplicate = {
  id: string;
  status: (typeof activeHardwareJobStatuses)[number];
  jobType: HardwareJobInsert["jobType"];
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
};

export type CreateHardwareJobResult = {
  job: typeof hardwareJobs.$inferSelect;
  duplicate: boolean;
};

function getDuplicateConditions(options: DuplicateGuardOptions) {
  const conditions = [
    eq(hardwareJobs.organizationId, options.organizationId),
    eq(hardwareJobs.outletId, options.outletId),
    eq(hardwareJobs.registerId, options.registerId),
    eq(hardwareJobs.jobType, options.jobType),
    eq(hardwareJobs.sourceType, options.sourceType),
    eq(hardwareJobs.sourceId, options.sourceId),
    inArray(hardwareJobs.status, activeHardwareJobStatuses),
  ];

  if (options.targetDevice) {
    conditions.push(eq(hardwareJobs.targetDevice, options.targetDevice));
  }

  return conditions;
}

export async function findActiveDuplicateHardwareJob(
  options: DuplicateGuardOptions,
): Promise<HardwareJobDuplicate | null> {
  const [job] = await db
    .select({
      id: hardwareJobs.id,
      status: hardwareJobs.status,
      jobType: hardwareJobs.jobType,
      sourceType: hardwareJobs.sourceType,
      sourceId: hardwareJobs.sourceId,
      createdAt: hardwareJobs.createdAt,
    })
    .from(hardwareJobs)
    .where(and(...getDuplicateConditions(options)))
    .orderBy(asc(hardwareJobs.createdAt))
    .limit(1);

  if (!job || !activeHardwareJobStatuses.includes(job.status as never)) {
    return null;
  }

  return {
    ...job,
    status: job.status as (typeof activeHardwareJobStatuses)[number],
  };
}

export async function createHardwareJobWithDuplicateGuard(
  values: HardwareJobInsert & {
    sourceType: string;
    sourceId: string;
  },
): Promise<CreateHardwareJobResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: hardwareJobs.id,
        status: hardwareJobs.status,
      })
      .from(hardwareJobs)
      .where(
        and(
          ...getDuplicateConditions({
            organizationId: values.organizationId,
            outletId: values.outletId,
            registerId: values.registerId,
            jobType: values.jobType,
            sourceType: values.sourceType,
            sourceId: values.sourceId,
            targetDevice: values.targetDevice,
          }),
        ),
      )
      .orderBy(asc(hardwareJobs.createdAt))
      .limit(1);

    if (existing) {
      const [job] = await tx
        .select()
        .from(hardwareJobs)
        .where(eq(hardwareJobs.id, existing.id))
        .limit(1);

      if (!job) {
        throw new Error("Active duplicate hardware job tidak ditemukan ulang.");
      }

      return { job, duplicate: true };
    }

    const [job] = await tx.insert(hardwareJobs).values(values).returning();

    if (!job) {
      throw new Error("Gagal membuat hardware job.");
    }

    return { job, duplicate: false };
  });
}
