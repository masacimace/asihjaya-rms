"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  hardwareAgents,
  hardwareJobAttempts,
  hardwareJobResolutions,
  hardwareJobs,
} from "@/db/schema";
import { hardwareAgentEnrollments } from "@/db/schema/hardware-enrollment";
import { markUnreadNotificationsReadByEntity } from "@/features/notifications/mutations";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const HARDWARE_DASHBOARD_PATH = "/admin/operasional/hardware";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function redirectWithMessage(
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ type, message });
  redirect(`${HARDWARE_DASHBOARD_PATH}?${params.toString()}`);
}

async function getRequestMetadata() {
  const headerStore = await headers();

  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

export async function deleteFailedHardwareJobAction(
  formData: FormData,
): Promise<void> {
  const auth = await requirePermission("admin.access");
  const jobId = String(formData.get("jobId") ?? "").trim();

  if (!UUID_PATTERN.test(jobId)) {
    redirectWithMessage("error", "Hardware job tidak valid.");
  }

  const accessibleOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));
  const requestMetadata = await getRequestMetadata();

  const result = await db.transaction(async (tx) => {
    const [job] = await tx
      .select({
        id: hardwareJobs.id,
        organizationId: hardwareJobs.organizationId,
        outletId: hardwareJobs.outletId,
        registerId: hardwareJobs.registerId,
        jobType: hardwareJobs.jobType,
        protocolVersion: hardwareJobs.protocolVersion,
        status: hardwareJobs.status,
        sourceType: hardwareJobs.sourceType,
        sourceId: hardwareJobs.sourceId,
        error: hardwareJobs.error,
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
      return {
        ok: false as const,
        message: "Hardware job tidak ditemukan atau tidak dapat diakses.",
      };
    }

    if (job.status !== "failed") {
      return {
        ok: false as const,
        message: "Hanya hardware job berstatus Gagal yang dapat dihapus manual.",
      };
    }

    const [resolution] = await tx
      .select({ id: hardwareJobResolutions.id })
      .from(hardwareJobResolutions)
      .where(eq(hardwareJobResolutions.jobId, job.id))
      .limit(1);

    if (resolution) {
      return {
        ok: false as const,
        message:
          "Hardware job ini memiliki resolution/audit manual dan tidak boleh dihapus.",
      };
    }

    await tx.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: job.outletId,
      actorUserId: auth.user.id,
      action: "hardware.job_delete_failed",
      entityType: "hardware_job",
      entityId: job.id,
      beforeData: {
        status: job.status,
        jobType: job.jobType,
        protocolVersion: job.protocolVersion,
        sourceType: job.sourceType,
        sourceId: job.sourceId,
        error: job.error,
      },
      afterData: { deleted: true },
      reason: "Hardware job gagal dihapus manual dari dashboard Hardware Hub.",
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        source: "admin.hardware_dashboard",
        registerId: job.registerId,
      },
    });

    const deleted = await tx
      .delete(hardwareJobs)
      .where(
        and(
          eq(hardwareJobs.id, job.id),
          eq(hardwareJobs.organizationId, auth.organization.id),
          eq(hardwareJobs.status, "failed"),
        ),
      )
      .returning({ id: hardwareJobs.id });

    if (deleted.length !== 1) {
      return {
        ok: false as const,
        message:
          "Status hardware job berubah saat proses penghapusan. Muat ulang halaman lalu coba lagi.",
      };
    }

    return { ok: true as const, jobId: job.id };
  });

  if (!result.ok) {
    redirectWithMessage("error", result.message);
  }

  await markUnreadNotificationsReadByEntity({
    organizationId: auth.organization.id,
    type: "hardware",
    entityType: "hardware_job",
    entityId: result.jobId,
  }).catch((error) => {
    console.error("[hardware] gagal menutup notification job yang dihapus", error);
  });

  revalidatePath(HARDWARE_DASHBOARD_PATH);
  revalidatePath("/admin");
  redirectWithMessage("success", "Hardware job gagal sudah dihapus.");
}

export async function purgeInactiveHardwareAgentAction(
  formData: FormData,
): Promise<void> {
  const auth = await requirePermission("hardware.agents.manage");
  const agentId = String(formData.get("agentId") ?? "").trim();

  if (!UUID_PATTERN.test(agentId)) {
    redirectWithMessage("error", "Hardware Agent tidak valid.");
  }

  const accessibleOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));
  const requestMetadata = await getRequestMetadata();

  const result = await db.transaction(async (tx) => {
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
      })
      .from(hardwareAgents)
      .where(
        and(
          eq(hardwareAgents.id, agentId),
          eq(hardwareAgents.organizationId, auth.organization.id),
        ),
      )
      .limit(1);

    if (!agent || !accessibleOutletIds.has(agent.outletId)) {
      return {
        ok: false as const,
        message: "Hardware Agent tidak ditemukan atau tidak dapat diakses.",
      };
    }

    if (agent.isActive || agent.status !== "disabled") {
      return {
        ok: false as const,
        message: "Hanya Hardware Agent nonaktif yang dapat dihapus permanen.",
      };
    }

    const [jobReference, attemptReference, enrollmentReference] =
      await Promise.all([
        tx
          .select({ id: hardwareJobs.id })
          .from(hardwareJobs)
          .where(
            and(
              eq(hardwareJobs.organizationId, auth.organization.id),
              or(
                eq(hardwareJobs.agentId, agent.id),
                eq(hardwareJobs.targetAgentId, agent.id),
              ),
            ),
          )
          .limit(1),
        tx
          .select({ id: hardwareJobAttempts.id })
          .from(hardwareJobAttempts)
          .where(eq(hardwareJobAttempts.agentId, agent.id))
          .limit(1),
        tx
          .select({ id: hardwareAgentEnrollments.id })
          .from(hardwareAgentEnrollments)
          .where(
            and(
              eq(hardwareAgentEnrollments.organizationId, auth.organization.id),
              eq(hardwareAgentEnrollments.agentId, agent.id),
            ),
          )
          .limit(1),
      ]);

    if (jobReference[0] || attemptReference[0] || enrollmentReference[0]) {
      const dependencies = [
        jobReference[0] ? "riwayat job" : null,
        attemptReference[0] ? "attempt job" : null,
        enrollmentReference[0] ? "riwayat enrollment" : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(", ");

      return {
        ok: false as const,
        message: `Perangkat belum aman dihapus karena masih memiliki ${dependencies}. Riwayat audit tersebut harus dipertahankan.`,
      };
    }

    await tx.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: agent.outletId,
      actorUserId: auth.user.id,
      action: "hardware.agent_purge_inactive",
      entityType: "hardware_agent",
      entityId: agent.id,
      beforeData: {
        code: agent.code,
        name: agent.name,
        status: agent.status,
        isActive: agent.isActive,
        registerId: agent.registerId,
      },
      afterData: { deleted: true },
      reason:
        "Hardware Agent nonaktif tanpa dependency dihapus permanen dari dashboard Hardware Hub.",
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        source: "admin.hardware_dashboard",
        agentCode: agent.code,
      },
    });

    const deleted = await tx
      .delete(hardwareAgents)
      .where(
        and(
          eq(hardwareAgents.id, agent.id),
          eq(hardwareAgents.organizationId, auth.organization.id),
          eq(hardwareAgents.isActive, false),
          eq(hardwareAgents.status, "disabled"),
        ),
      )
      .returning({ id: hardwareAgents.id });

    if (deleted.length !== 1) {
      return {
        ok: false as const,
        message:
          "Status Hardware Agent berubah saat proses penghapusan. Muat ulang halaman lalu coba lagi.",
      };
    }

    return {
      ok: true as const,
      agentName: agent.name,
      agentCode: agent.code,
    };
  });

  if (!result.ok) {
    redirectWithMessage("error", result.message);
  }

  revalidatePath(HARDWARE_DASHBOARD_PATH);
  revalidatePath("/admin");
  redirectWithMessage(
    "success",
    `Hardware Agent ${result.agentName} (${result.agentCode}) sudah dihapus permanen.`,
  );
}
