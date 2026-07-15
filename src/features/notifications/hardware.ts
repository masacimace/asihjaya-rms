import { and, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { hardwareAgents, hardwareJobs, outlets } from "@/db/schema";
import {
  createAdminNotification,
  markUnreadNotificationsReadByEntity,
} from "@/features/notifications/mutations";
import { resolveNotificationEventsByEntity } from "@/features/notifications/event-service";
import type { AuthContext } from "@/lib/auth/session";

const HARDWARE_DASHBOARD_PATH = "/admin/operasional/hardware";
const DEFAULT_AGENT_STALE_MINUTES = 5;
const MIN_AGENT_STALE_MINUTES = 1;
const MAX_AGENT_STALE_MINUTES = 120;
const DEFAULT_ANTI_SPAM_WINDOW_MINUTES = 15;
const MIN_ANTI_SPAM_WINDOW_MINUTES = 1;
const MAX_ANTI_SPAM_WINDOW_MINUTES = 120;

type HardwareJobNotificationInput = {
  organizationId: string;
  outletId: string;
  registerId?: string | null;
  agentId?: string | null;
  jobId: string;
  jobType: string;
  deviceType: string;
  error?: string | null;
  source?: string;
};

type HardwareAgentOfflineInput = {
  organizationId: string;
  outletId: string;
  agentId: string;
  agentName: string;
  outletName?: string | null;
  lastSeenAt?: Date | null;
  reason?: "reported_offline" | "stale_heartbeat";
};

function getAntiSpamWindowMinutes() {
  const value = Number(process.env.NOTIFICATION_ANTI_SPAM_WINDOW_MINUTES);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_ANTI_SPAM_WINDOW_MINUTES;
  }

  return Math.min(
    MAX_ANTI_SPAM_WINDOW_MINUTES,
    Math.max(MIN_ANTI_SPAM_WINDOW_MINUTES, Math.floor(value)),
  );
}

function getTimeBucket(date: Date, windowMinutes: number) {
  return Math.floor(date.getTime() / (windowMinutes * 60_000));
}

function getConfiguredAgentStaleMinutes() {
  const value = Number(process.env.HARDWARE_AGENT_STALE_MINUTES);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_AGENT_STALE_MINUTES;
  }

  return Math.min(
    MAX_AGENT_STALE_MINUTES,
    Math.max(MIN_AGENT_STALE_MINUTES, Math.floor(value)),
  );
}


function getHardwareFailureGroupId({
  outletId,
  registerId,
  agentId,
  deviceType,
}: {
  outletId: string;
  registerId?: string | null;
  agentId?: string | null;
  deviceType: string;
}) {
  return `${agentId ?? registerId ?? outletId}:${deviceType}`.slice(0, 160);
}

function formatRelativeLastSeen(lastSeenAt?: Date | null) {
  if (!lastSeenAt) {
    return "belum pernah melakukan heartbeat";
  }

  return `terakhir heartbeat ${new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(lastSeenAt)}`;
}

export function getHardwareJobLabel(jobType: string) {
  if (jobType === "print_label_sato") return "Print label barcode";
  if (jobType === "print_receipt_certificate") return "Print nota dan sertifikat";
  if (jobType === "open_cash_drawer") return "Buka cash drawer";
  if (jobType === "test_label_printer") return "Test label printer";
  if (jobType === "test_document_printer") return "Test printer dokumen";
  if (jobType === "test_cash_drawer") return "Test cash drawer";

  return "Hardware job";
}

export async function createHardwareJobFailedNotification({
  organizationId,
  outletId,
  registerId = null,
  agentId = null,
  jobId,
  jobType,
  deviceType,
  error,
  source = "hardware_job",
}: HardwareJobNotificationInput) {
  const label = getHardwareJobLabel(jobType);
  const safeError = error?.trim() ? error.trim().slice(0, 180) : null;
  const failureGroupId = getHardwareFailureGroupId({
    outletId,
    registerId,
    agentId,
    deviceType,
  });

  await createAdminNotification({
    organizationId,
    outletId,
    type: "hardware",
    eventType: "hardware.job_failed",
    severity: "warning",
    title: "Hardware job gagal",
    message: safeError
      ? `${label} gagal. ${safeError}`
      : `${label} gagal diproses. Cek status agent dan printer di Hardware Hub.`,
    entityType: "hardware_failure_group",
    entityId: failureGroupId,
    actionUrl: HARDWARE_DASHBOARD_PATH,
    requiresAction: true,
    deduplicationKey: `hardware.job_failed:${failureGroupId}`,
    recipientPermissionCodes: ["admin.access"],
    metadata: {
      latestJobId: jobId,
      jobType,
      deviceType,
      registerId,
      agentId,
      source,
      error: safeError,
    },
    antiSpam: {
      mode: "aggregate",
      occurrenceId: jobId,
      reNotifyRecipients: true,
    },
    dedupeUnread: true,
  });
}

export async function markHardwareJobFailureResolved({
  organizationId,
  outletId,
  registerId = null,
  agentId = null,
  jobId,
  deviceType,
  resolvedAt = new Date(),
}: {
  organizationId: string;
  outletId: string;
  registerId?: string | null;
  agentId?: string | null;
  jobId: string;
  deviceType: string;
  resolvedAt?: Date;
}) {
  const failureGroupId = getHardwareFailureGroupId({
    outletId,
    registerId,
    agentId,
    deviceType,
  });

  const [groupCount, legacyCount] = await Promise.all([
    resolveNotificationEventsByEntity({
      organizationId,
      category: "hardware",
      eventType: "hardware.job_failed",
      entityType: "hardware_failure_group",
      entityId: failureGroupId,
      resolvedAt,
    }),
    resolveNotificationEventsByEntity({
      organizationId,
      category: "hardware",
      eventType: "hardware.job_failed",
      entityType: "hardware_job",
      entityId: jobId,
      resolvedAt,
    }),
  ]);

  return groupCount + legacyCount;
}

export async function createHardwareAgentOfflineNotification({
  organizationId,
  outletId,
  agentId,
  agentName,
  outletName,
  lastSeenAt,
  reason = "stale_heartbeat",
}: HardwareAgentOfflineInput) {
  const location = outletName ? ` di ${outletName}` : "";
  const lastSeenText = formatRelativeLastSeen(lastSeenAt);

  await createAdminNotification({
    organizationId,
    outletId,
    type: "hardware",
    eventType: "hardware.agent_offline",
    severity: reason === "reported_offline" ? "warning" : "critical",
    title: "Hardware Hub offline",
    message: `${agentName}${location} tidak merespons (${lastSeenText}). Cek mini PC, koneksi, dan printer outlet.`,
    entityType: "hardware_agent",
    entityId: agentId,
    actionUrl: HARDWARE_DASHBOARD_PATH,
    requiresAction: true,
    deduplicationKey: `hardware.agent_offline:${agentId}`,
    recipientPermissionCodes: ["admin.access"],
    metadata: {
      agentName,
      outletName,
      lastSeenAt: lastSeenAt?.toISOString() ?? null,
      reason,
    },
    dedupeUnread: true,
  });
}

export async function markHardwareAgentOnlineNotificationResolved({
  organizationId,
  agentId,
  outletId,
  agentName,
  outletName,
}: {
  organizationId: string;
  agentId: string;
  outletId: string;
  agentName: string;
  outletName?: string | null;
}) {
  const resolvedCount = await markUnreadNotificationsReadByEntity({
    organizationId,
    type: "hardware",
    entityType: "hardware_agent",
    entityId: agentId,
  });

  if (resolvedCount === 0) {
    return;
  }

  const location = outletName ? ` di ${outletName}` : "";

  await createAdminNotification({
    organizationId,
    outletId,
    type: "hardware",
    eventType: "hardware.agent_recovered",
    severity: "success",
    title: "Hardware Hub online kembali",
    message: `${agentName}${location} sudah kembali online dan siap memproses job hardware.`,
    entityType: "hardware_agent_recovered",
    entityId: agentId,
    actionUrl: HARDWARE_DASHBOARD_PATH,
    deduplicationKey: `hardware.agent_recovered:${agentId}:${Date.now()}`,
    recipientPermissionCodes: ["admin.access"],
    metadata: {
      agentName,
      outletName,
      recoveredAt: new Date().toISOString(),
    },
  });
}

export async function syncHardwareAgentHealthNotifications(auth: AuthContext) {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    return;
  }

  const now = new Date();
  const staleMinutes = getConfiguredAgentStaleMinutes();
  const staleCutoff = new Date(now.getTime() - staleMinutes * 60 * 1000);

  const agentRows = await db
    .select({
      id: hardwareAgents.id,
      name: hardwareAgents.name,
      organizationId: hardwareAgents.organizationId,
      outletId: hardwareAgents.outletId,
      status: hardwareAgents.status,
      lastSeenAt: hardwareAgents.lastSeenAt,
      outletName: outlets.name,
    })
    .from(hardwareAgents)
    .innerJoin(outlets, eq(hardwareAgents.outletId, outlets.id))
    .where(
      and(
        eq(hardwareAgents.organizationId, auth.organization.id),
        eq(hardwareAgents.isActive, true),
        inArray(hardwareAgents.outletId, outletIds),
        or(
          eq(hardwareAgents.status, "offline"),
          isNull(hardwareAgents.lastSeenAt),
          lt(hardwareAgents.lastSeenAt, staleCutoff),
        )!,
      ),
    );

  await Promise.all(
    agentRows.map((agent) =>
      createHardwareAgentOfflineNotification({
        organizationId: agent.organizationId,
        outletId: agent.outletId,
        agentId: agent.id,
        agentName: agent.name,
        outletName: agent.outletName,
        lastSeenAt: agent.lastSeenAt,
        reason: agent.status === "offline" ? "reported_offline" : "stale_heartbeat",
      }),
    ),
  );

  const onlineRows = await db
    .select({
      id: hardwareAgents.id,
      name: hardwareAgents.name,
      organizationId: hardwareAgents.organizationId,
      outletId: hardwareAgents.outletId,
      outletName: outlets.name,
    })
    .from(hardwareAgents)
    .innerJoin(outlets, eq(hardwareAgents.outletId, outlets.id))
    .where(
      and(
        eq(hardwareAgents.organizationId, auth.organization.id),
        eq(hardwareAgents.isActive, true),
        inArray(hardwareAgents.outletId, outletIds),
        eq(hardwareAgents.status, "online"),
        gte(hardwareAgents.lastSeenAt, staleCutoff),
      ),
    );

  await Promise.all(
    onlineRows.map((agent) =>
      markHardwareAgentOnlineNotificationResolved({
        organizationId: agent.organizationId,
        agentId: agent.id,
        outletId: agent.outletId,
        agentName: agent.name,
        outletName: agent.outletName,
      }),
    ),
  );
}

export async function notifyRecoveredHardwareJobs({
  organizationId,
  requeuedJobIds,
  failedJobIds,
  staleMinutes,
  reason,
}: {
  organizationId: string;
  requeuedJobIds: string[];
  failedJobIds: string[];
  staleMinutes: number;
  reason: string;
}) {
  if (requeuedJobIds.length === 0 && failedJobIds.length === 0) {
    return;
  }

  const occurredAt = new Date();
  const antiSpamWindowMinutes = getAntiSpamWindowMinutes();
  const recoveryBucket = getTimeBucket(occurredAt, antiSpamWindowMinutes);
  const occurrenceId = [...requeuedJobIds, ...failedJobIds]
    .sort()
    .join(":")
    .slice(0, 180);

  await createAdminNotification({
    organizationId,
    type: "hardware",
    eventType: "hardware.jobs_recovered",
    severity: failedJobIds.length > 0 ? "warning" : "info",
    title: "Hardware job macet dipulihkan",
    message: `${requeuedJobIds.length} job masuk ulang antrean dan ${failedJobIds.length} job ditandai gagal setelah macet lebih dari ${staleMinutes} menit.`,
    entityType: "hardware_recovery",
    entityId: `${reason}:${recoveryBucket}`,
    actionUrl: HARDWARE_DASHBOARD_PATH,
    requiresAction: false,
    deduplicationKey: `hardware.jobs_recovered:${reason}:${recoveryBucket}`,
    recipientPermissionCodes: ["admin.access"],
    antiSpam: {
      mode: "aggregate",
      occurrenceId: occurrenceId || `${reason}:${occurredAt.toISOString()}`,
      reNotifyRecipients: false,
    },
    metadata: {
      reason,
      requeuedJobIds,
      failedJobIds,
      staleMinutes,
      antiSpamWindowMinutes,
    },
  });

  if (failedJobIds.length === 0) {
    return;
  }

  const failedRows = await db
    .select({
      id: hardwareJobs.id,
      organizationId: hardwareJobs.organizationId,
      outletId: hardwareJobs.outletId,
      registerId: hardwareJobs.registerId,
      agentId: hardwareJobs.agentId,
      jobType: hardwareJobs.jobType,
      deviceType: hardwareJobs.deviceType,
      error: hardwareJobs.error,
    })
    .from(hardwareJobs)
    .where(
      and(
        eq(hardwareJobs.organizationId, organizationId),
        inArray(hardwareJobs.id, failedJobIds),
      ),
    );

  await Promise.all(
    failedRows.map((job) =>
      createHardwareJobFailedNotification({
        organizationId: job.organizationId,
        outletId: job.outletId,
        registerId: job.registerId,
        agentId: job.agentId,
        jobId: job.id,
        jobType: job.jobType,
        deviceType: job.deviceType,
        error: job.error,
        source: "stale_recovery",
      }),
    ),
  );
}
