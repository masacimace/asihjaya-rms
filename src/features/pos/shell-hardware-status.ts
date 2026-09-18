import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { hardwareAgents, registers } from "@/db/schema";
import {
  getPosShellStatus,
  type PosShellNotification,
  type PosShellStatus,
} from "@/features/pos/queries";

const HARDWARE_ONLINE_WINDOW_MS = 90 * 1000;
const HARDWARE_STALE_WINDOW_MS = 5 * 60 * 1000;

function readConfigWarnings(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const warnings = (value as Record<string, unknown>).config_warnings;
  return Array.isArray(warnings)
    ? warnings.filter(
        (warning): warning is string => typeof warning === "string",
      )
    : [];
}

function resolveActiveHardwareStatus({
  agent,
  now,
}: {
  agent: {
    name: string;
    status: "online" | "offline" | "disabled";
    isActive: boolean;
    lastSeenAt: Date | null;
    capabilities: Record<string, unknown> | null;
  } | null;
  now: Date;
}): PosShellStatus["hardware"] {
  if (!agent) {
    return {
      status: "not_configured",
      label: "Hardware Hub belum aktif",
      agentName: null,
      lastSeenAt: null,
      hasConfigWarnings: false,
    };
  }

  const hasConfigWarnings = readConfigWarnings(agent.capabilities).length > 0;

  if (!agent.isActive || agent.status === "disabled") {
    return {
      status: "disabled",
      label: "Hardware Hub nonaktif",
      agentName: agent.name,
      lastSeenAt: agent.lastSeenAt,
      hasConfigWarnings,
    };
  }

  if (!agent.lastSeenAt) {
    return {
      status: "offline",
      label: "Hardware Hub offline",
      agentName: agent.name,
      lastSeenAt: null,
      hasConfigWarnings,
    };
  }

  const diffMs = now.getTime() - agent.lastSeenAt.getTime();

  if (agent.status === "online" && diffMs <= HARDWARE_ONLINE_WINDOW_MS) {
    return {
      status: "online",
      label: "Printer siap",
      agentName: agent.name,
      lastSeenAt: agent.lastSeenAt,
      hasConfigWarnings,
    };
  }

  if (diffMs <= HARDWARE_STALE_WINDOW_MS) {
    return {
      status: "stale",
      label: "Hardware perlu cek",
      agentName: agent.name,
      lastSeenAt: agent.lastSeenAt,
      hasConfigWarnings,
    };
  }

  return {
    status: "offline",
    label: "Hardware Hub offline",
    agentName: agent.name,
    lastSeenAt: agent.lastSeenAt,
    hasConfigWarnings,
  };
}

function reconcileNotifications(
  notifications: PosShellNotification[],
  hardware: PosShellStatus["hardware"],
): PosShellNotification[] {
  const next = notifications
    .filter(
      (notification) =>
        notification.id !== "hardware-status" &&
        notification.id !== "hardware-config-warning",
    )
    .map((notification) => {
      if (notification.id !== "active-print-jobs") {
        return notification;
      }

      return {
        ...notification,
        description:
          hardware.status === "online"
            ? "Hardware Hub sedang mengambil antrean cetak otomatis."
            : "Nota akan tercetak otomatis saat Hardware Hub kembali online.",
        tone: hardware.status === "online" ? "info" : "warning",
      } satisfies PosShellNotification;
    });

  if (hardware.status !== "online") {
    next.push({
      id: "hardware-status",
      title: hardware.label,
      description: hardware.agentName
        ? `Perangkat ${hardware.agentName} perlu dicek sebelum silent print berjalan normal.`
        : "Hardware Hub belum siap untuk silent print nota dan certificate.",
      href: "/pos/shift",
      actionLabel: "Cek Perangkat",
      tone: hardware.status === "stale" ? "warning" : "danger",
      icon: "hardware",
    });
  } else if (hardware.hasConfigWarnings) {
    next.push({
      id: "hardware-config-warning",
      title: "Konfigurasi Hardware perlu dicek",
      description:
        "Hardware Hub online dan silent print tetap aktif, tetapi ada peringatan konfigurasi yang perlu ditinjau di dashboard Hardware Hub.",
      href: "/admin/operasional/hardware",
      actionLabel: "Lihat Hardware Hub",
      tone: "warning",
      icon: "hardware",
    });
  }

  return next;
}

export async function getPosShellStatusWithActiveAgent({
  organizationId,
  outletId,
}: {
  organizationId: string;
  outletId?: string | null;
}): Promise<PosShellStatus> {
  const baseStatus = await getPosShellStatus({ organizationId, outletId });

  if (!outletId) {
    return baseStatus;
  }

  const [activeAgent] = await db
    .select({
      name: hardwareAgents.name,
      status: hardwareAgents.status,
      isActive: hardwareAgents.isActive,
      lastSeenAt: hardwareAgents.lastSeenAt,
      capabilities: hardwareAgents.capabilities,
      registerName: registers.name,
    })
    .from(hardwareAgents)
    .innerJoin(registers, eq(hardwareAgents.registerId, registers.id))
    .where(
      and(
        eq(hardwareAgents.organizationId, organizationId),
        eq(hardwareAgents.outletId, outletId),
        eq(hardwareAgents.isActive, true),
      ),
    )
    .orderBy(
      sql`case when ${hardwareAgents.status} = 'online' then 0 else 1 end`,
      sql`${hardwareAgents.lastSeenAt} desc nulls last`,
      desc(hardwareAgents.updatedAt),
    )
    .limit(1);

  const hardware = resolveActiveHardwareStatus({
    agent: activeAgent ?? null,
    now: new Date(),
  });

  return {
    ...baseStatus,
    registerName: activeAgent?.registerName ?? baseStatus.registerName,
    hardware,
    notifications: reconcileNotifications(baseStatus.notifications, hardware),
  };
}
