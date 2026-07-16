"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { hardwareAgents, hardwareJobs, outlets, registers } from "@/db/schema";
import { getHardwareJobLabel } from "@/features/notifications/hardware";
import {
  createAdminNotification,
  markUnreadNotificationsReadByEntity,
} from "@/features/notifications/mutations";
import { requirePermission } from "@/lib/auth/session";
import { cleanupHardwareJobs } from "@/lib/hardware/job-cleanup";
import { recoverStaleHardwareJobs } from "@/lib/hardware/job-recovery";
import { buildHardwareTestPayloadV2 } from "@/lib/hardware/job-payload-contracts-v2";
import { createHardwareJobV2 } from "@/lib/hardware/job-producer-v2";
import {
  getEnabledHardwareCapabilities,
  getHardwareJobExpiresAt,
  getRequiredHardwareCapability,
  HARDWARE_JOB_PROTOCOL_V2,
} from "@/lib/hardware/job-protocol-v2";

const HARDWARE_DASHBOARD_PATH = "/admin/operasional/hardware";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const testJobTypes = [
  "test_label_printer",
  "test_document_printer",
  "test_cash_drawer",
] as const;

type TestJobType = (typeof testJobTypes)[number];

function isTestJobType(value: unknown): value is TestJobType {
  return (
    typeof value === "string" && testJobTypes.includes(value as TestJobType)
  );
}

function redirectWithMessage(
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ type, message });

  redirect(`${HARDWARE_DASHBOARD_PATH}?${params.toString()}`);
}

async function getAccessibleHardwareJob(jobId: string) {
  const auth = await requirePermission("admin.access");
  const accessibleOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));

  const [job] = await db
    .select({
      id: hardwareJobs.id,
      organizationId: hardwareJobs.organizationId,
      outletId: hardwareJobs.outletId,
      registerId: hardwareJobs.registerId,
      agentId: hardwareJobs.agentId,
      currentAttemptId: hardwareJobs.currentAttemptId,
      protocolVersion: hardwareJobs.protocolVersion,
      jobType: hardwareJobs.jobType,
      status: hardwareJobs.status,
      attempts: hardwareJobs.attempts,
      maxAttempts: hardwareJobs.maxAttempts,
    })
    .from(hardwareJobs)
    .where(
      and(
        eq(hardwareJobs.id, jobId),
        eq(hardwareJobs.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  if (!job || !accessibleOutletIds.has(job.outletId)) {
    return { auth, job: null };
  }

  return { auth, job };
}

function getTestJobLabel(jobType: TestJobType) {
  if (jobType === "test_label_printer") return "test label printer";
  if (jobType === "test_document_printer") return "test document printer";
  return "test cash drawer";
}

export async function createHardwareTestJobAction(formData: FormData) {
  const auth = await requirePermission("admin.access");
  const agentId = String(formData.get("agentId") ?? "").trim();
  const jobType = String(formData.get("jobType") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();

  if (!UUID_PATTERN.test(agentId)) {
    redirectWithMessage("error", "Agent hardware tidak valid.");
  }

  if (!isTestJobType(jobType)) {
    redirectWithMessage("error", "Tipe test hardware tidak valid.");
  }

  if (!UUID_PATTERN.test(requestId)) {
    redirectWithMessage("error", "Request test hardware tidak valid.");
  }

  const accessibleOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));

  const [agent] = await db
    .select({
      id: hardwareAgents.id,
      code: hardwareAgents.code,
      name: hardwareAgents.name,
      organizationId: hardwareAgents.organizationId,
      outletId: hardwareAgents.outletId,
      registerId: hardwareAgents.registerId,
      isActive: hardwareAgents.isActive,
      status: hardwareAgents.status,
      outletName: outlets.name,
      registerName: registers.name,
      outletIsActive: outlets.isActive,
      registerIsActive: registers.isActive,
      capabilities: hardwareAgents.capabilities,
    })
    .from(hardwareAgents)
    .innerJoin(outlets, eq(hardwareAgents.outletId, outlets.id))
    .innerJoin(registers, eq(hardwareAgents.registerId, registers.id))
    .where(
      and(
        eq(hardwareAgents.id, agentId),
        eq(hardwareAgents.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  if (!agent || !accessibleOutletIds.has(agent.outletId)) {
    redirectWithMessage("error", "Agent hardware tidak ditemukan.");
  }

  if (
    !agent.isActive ||
    agent.status === "disabled" ||
    !agent.outletIsActive ||
    !agent.registerIsActive
  ) {
    redirectWithMessage("error", "Agent hardware tidak aktif.");
  }

  const requiredCapability = getRequiredHardwareCapability(jobType);
  if (
    !getEnabledHardwareCapabilities(agent.capabilities).includes(
      requiredCapability,
    )
  ) {
    redirectWithMessage(
      "error",
      `Agent ${agent.name} belum melaporkan capability ${requiredCapability}.`,
    );
  }

  const now = new Date();
  const label = getTestJobLabel(jobType);
  const payload = buildHardwareTestPayloadV2({
    jobType,
    agentId: agent.id,
    requestedAt: now,
  });

  const createResult = await createHardwareJobV2({
    organizationId: auth.organization.id,
    outletId: agent.outletId,
    registerId: agent.registerId,
    createdByUserId: auth.user.id,
    targetAgentId: agent.id,
    jobType,
    mode: "test",
    payload,
    idempotencyKey: `hardware-test:${requestId}`,
    sourceType: "hardware_test",
    sourceId: requestId,
    now,
    audit: {
      source: "admin.hardware_dashboard",
      requestId,
      reason: `Menjalankan ${label} untuk agent ${agent.code}.`,
    },
  });

  revalidatePath(HARDWARE_DASHBOARD_PATH);

  if (createResult.duplicate) {
    redirectWithMessage(
      "success",
      `Job ${label} untuk ${agent.name} masih aktif di antrean. Sistem tidak membuat duplikat baru.`,
    );
  }

  redirectWithMessage(
    "success",
    `Job ${label} untuk ${agent.name} sudah masuk antrean.`,
  );
}

export async function retryHardwareJobAction(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "").trim();

  if (!UUID_PATTERN.test(jobId)) {
    redirectWithMessage("error", "Hardware job tidak valid.");
  }

  const { auth, job } = await getAccessibleHardwareJob(jobId);

  if (!job) {
    redirectWithMessage("error", "Hardware job tidak ditemukan.");
  }

  const isProtocolV2 = job.protocolVersion === HARDWARE_JOB_PROTOCOL_V2;

  if (isProtocolV2 && job.status !== "failed") {
    redirectWithMessage(
      "error",
      job.status === "unknown_outcome"
        ? "Job dengan hasil tidak pasti tidak boleh dicetak ulang dari Retry biasa. Gunakan alur resolusi manual agar risiko cetak ganda tercatat."
        : "Untuk Protocol v2, hanya job gagal sebelum dispatch yang bisa dijalankan ulang.",
    );
  }

  if (!isProtocolV2 && job.status !== "failed" && job.status !== "cancelled") {
    redirectWithMessage(
      "error",
      "Hanya job gagal atau dibatalkan yang bisa dijalankan ulang.",
    );
  }

  const now = new Date();

  if (isProtocolV2) {
    const nextMaxAttempts = Math.max(job.maxAttempts, job.attempts + 1);

    await db
      .update(hardwareJobs)
      .set({
        agentId: null,
        currentAttemptId: null,
        createdByUserId: auth.user.id,
        status: "pending",
        maxAttempts: nextMaxAttempts,
        error: null,
        result: {
          manualRetryRequestedAt: now.toISOString(),
          manualRetryRequestedByUserId: auth.user.id,
          previousAttemptId: job.currentAttemptId,
        },
        lastErrorCode: null,
        lastErrorMessage: null,
        availableAt: now,
        expiresAt: getHardwareJobExpiresAt({
          jobType: job.jobType,
          mode: "manual",
          now,
        }),
        claimedAt: null,
        processingAt: null,
        startedAt: null,
        submittedAt: null,
        completedAt: null,
        failedAt: null,
        unknownAt: null,
        expiredAt: null,
        cancelledAt: null,
        updatedAt: now,
      })
      .where(
        and(eq(hardwareJobs.id, job.id), eq(hardwareJobs.status, "failed")),
      );
  } else {
    await db
      .update(hardwareJobs)
      .set({
        agentId: null,
        createdByUserId: auth.user.id,
        status: "pending",
        attempts: 0,
        error: null,
        result: {},
        availableAt: now,
        claimedAt: null,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        cancelledAt: null,
        updatedAt: now,
      })
      .where(eq(hardwareJobs.id, job.id));
  }

  await markUnreadNotificationsReadByEntity({
    organizationId: auth.organization.id,
    type: "hardware",
    entityType: "hardware_job",
    entityId: job.id,
  });

  await createAdminNotification({
    organizationId: auth.organization.id,
    outletId: job.outletId,
    type: "hardware",
    severity: "success",
    title: "Hardware job dijalankan ulang",
    message: `${getHardwareJobLabel(job.jobType)} sudah dimasukkan ulang ke antrean.`,
    entityType: "hardware_job_retry",
    entityId: job.id,
    actionUrl: HARDWARE_DASHBOARD_PATH,
    metadata: {
      jobType: job.jobType,
      retriedByUserId: auth.user.id,
      protocolVersion: job.protocolVersion,
      previousAttemptId: job.currentAttemptId,
    },
  });

  revalidatePath(HARDWARE_DASHBOARD_PATH);
  revalidatePath("/admin");
  redirectWithMessage(
    "success",
    "Hardware job sudah dimasukkan ulang ke antrean.",
  );
}

export async function cancelHardwareJobAction(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "").trim();

  if (!UUID_PATTERN.test(jobId)) {
    redirectWithMessage("error", "Hardware job tidak valid.");
  }

  const { auth, job } = await getAccessibleHardwareJob(jobId);

  if (!job) {
    redirectWithMessage("error", "Hardware job tidak ditemukan.");
  }

  if (job.status !== "pending") {
    redirectWithMessage(
      "error",
      "Untuk menjaga konsistensi agent, hanya job berstatus menunggu yang bisa dibatalkan dari dashboard.",
    );
  }

  const now = new Date();

  await db
    .update(hardwareJobs)
    .set({
      agentId: null,
      status: "cancelled",
      error: "Dibatalkan manual dari dashboard Hardware Hub.",
      result: {
        cancelledByUserId: auth.user.id,
        cancelledAt: now.toISOString(),
      },
      cancelledAt: now,
      updatedAt: now,
    })
    .where(eq(hardwareJobs.id, job.id));

  revalidatePath(HARDWARE_DASHBOARD_PATH);
  redirectWithMessage("success", "Hardware job sudah dibatalkan.");
}

export async function recoverStaleHardwareJobsAction() {
  const auth = await requirePermission("admin.access");
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    redirectWithMessage("error", "Tidak ada outlet yang bisa dipulihkan.");
  }

  const result = await recoverStaleHardwareJobs({
    organizationId: auth.organization.id,
    outletIds,
    reason: "manual_dashboard",
  });

  revalidatePath(HARDWARE_DASHBOARD_PATH);
  revalidatePath("/admin");

  if (result.requeued === 0 && result.failed === 0) {
    redirectWithMessage(
      "success",
      `Tidak ada hardware job macet di atas ${result.staleMinutes} menit.`,
    );
  }

  redirectWithMessage(
    "success",
    `Auto-recovery selesai: ${result.requeued} job masuk ulang antrean, ${result.failed} job ditandai gagal.`,
  );
}

export async function cleanupHardwareJobsAction() {
  const auth = await requirePermission("admin.access");
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    redirectWithMessage("error", "Tidak ada outlet yang bisa dibersihkan.");
  }

  const result = await cleanupHardwareJobs({
    organizationId: auth.organization.id,
    outletIds,
  });

  revalidatePath(HARDWARE_DASHBOARD_PATH);

  if (result.deleted.total === 0) {
    redirectWithMessage(
      "success",
      "Tidak ada hardware job lama yang melewati masa retensi.",
    );
  }

  redirectWithMessage(
    "success",
    `Cleanup selesai: ${result.deleted.total} job lama dihapus (${result.deleted.completed} selesai, ${result.deleted.cancelled} dibatalkan, ${result.deleted.failed} gagal).`,
  );
}
