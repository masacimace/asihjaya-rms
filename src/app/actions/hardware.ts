"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { hardwareAgents, hardwareJobs, outlets, registers } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { cleanupHardwareJobs } from "@/lib/hardware/job-cleanup";
import { recoverStaleHardwareJobs } from "@/lib/hardware/job-recovery";
import { createHardwareJobWithDuplicateGuard } from "@/lib/hardware/job-queue";

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

function redirectWithMessage(type: "success" | "error", message: string): never {
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
      jobType: hardwareJobs.jobType,
      status: hardwareJobs.status,
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

function getTestJobDefinition(jobType: TestJobType) {
  const generatedAt = new Date().toISOString();

  if (jobType === "test_label_printer") {
    return {
      deviceType: "label_printer" as const,
      targetDevice: "label_printer",
      payload: {
        sku: "AJ-TEST-LABEL",
        productName: "CINCIN EMAS TEST ASIHJAYA",
        barcode: "AJTEST123456",
        weightGram: "2.350",
        purityPercent: "75",
        exchangePurityPercent: "70",
        size: "12",
        color: "Kuning",
        gemstone: "Zircon",
        sellingAmount: "1850000",
        labelProfile: "jewelry_compact",
        generatedAt,
      },
      label: "test label printer",
    };
  }

  if (jobType === "test_document_printer") {
    return {
      deviceType: "document_printer" as const,
      targetDevice: "document_printer",
      payload: {
        pdfUrl: "/api/sales/receipt-certificate-preview",
        title: "Test Nota & Certificate Asihjaya",
        generatedAt,
      },
      label: "test document printer",
    };
  }

  return {
    deviceType: "cash_drawer" as const,
    targetDevice: "cash_drawer",
    payload: {
      reason: "Test cash drawer dari Admin Hardware Hub",
      generatedAt,
    },
    label: "test cash drawer",
  };
}

export async function createHardwareTestJobAction(formData: FormData) {
  const auth = await requirePermission("admin.access");
  const agentId = String(formData.get("agentId") ?? "").trim();
  const jobType = String(formData.get("jobType") ?? "").trim();

  if (!UUID_PATTERN.test(agentId)) {
    redirectWithMessage("error", "Agent hardware tidak valid.");
  }

  if (!isTestJobType(jobType)) {
    redirectWithMessage("error", "Tipe test hardware tidak valid.");
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

  const definition = getTestJobDefinition(jobType);

  const createResult = await createHardwareJobWithDuplicateGuard({
    organizationId: auth.organization.id,
    outletId: agent.outletId,
    registerId: agent.registerId,
    agentId: null,
    createdByUserId: auth.user.id,
    jobType,
    deviceType: definition.deviceType,
    targetDevice: definition.targetDevice,
    status: "pending",
    priority: 20,
    maxAttempts: 1,
    payload: definition.payload,
    sourceType: "hardware_test",
    sourceId: agent.id,
  });

  revalidatePath(HARDWARE_DASHBOARD_PATH);

  if (createResult.duplicate) {
    redirectWithMessage(
      "success",
      `Job ${definition.label} untuk ${agent.name} masih aktif di antrean. Sistem tidak membuat duplikat baru.`,
    );
  }

  redirectWithMessage(
    "success",
    `Job ${definition.label} untuk ${agent.name} sudah masuk antrean.`,
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

  if (job.status !== "failed" && job.status !== "cancelled") {
    redirectWithMessage(
      "error",
      "Hanya job gagal atau dibatalkan yang bisa dijalankan ulang.",
    );
  }

  const now = new Date();

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

  revalidatePath(HARDWARE_DASHBOARD_PATH);
  redirectWithMessage("success", "Hardware job sudah dimasukkan ulang ke antrean.");
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
