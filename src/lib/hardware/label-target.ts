import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { hardwareAgents, registers } from "@/db/schema";
import { getEnabledHardwareCapabilities } from "@/lib/hardware/job-protocol-v2";

export type LabelHardwareTarget = {
  agentId: string;
  registerId: string;
  outletId: string;
  agentStatus: "online" | "offline";
  lastSeenAt: Date | null;
};

function uniqueOutletIds(values: readonly string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export async function getLabelHardwareTargets({
  organizationId,
  outletIds,
}: {
  organizationId: string;
  outletIds: readonly string[];
}): Promise<Map<string, LabelHardwareTarget>> {
  const normalizedOutletIds = uniqueOutletIds(outletIds);
  if (normalizedOutletIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      agentId: hardwareAgents.id,
      outletId: hardwareAgents.outletId,
      registerId: hardwareAgents.registerId,
      agentStatus: hardwareAgents.status,
      capabilities: hardwareAgents.capabilities,
      lastSeenAt: hardwareAgents.lastSeenAt,
      registerCreatedAt: registers.createdAt,
    })
    .from(hardwareAgents)
    .innerJoin(registers, eq(hardwareAgents.registerId, registers.id))
    .where(
      and(
        eq(hardwareAgents.organizationId, organizationId),
        inArray(hardwareAgents.outletId, normalizedOutletIds),
        eq(hardwareAgents.isActive, true),
        ne(hardwareAgents.status, "disabled"),
        eq(registers.isActive, true),
        eq(registers.isHardwareHub, true),
      ),
    );

  const compatibleRows = rows
    .filter((row) =>
      getEnabledHardwareCapabilities(row.capabilities).includes(
        "print_label_sato",
      ),
    )
    .sort((left, right) => {
      const onlinePriority =
        Number(right.agentStatus === "online") -
        Number(left.agentStatus === "online");
      if (onlinePriority !== 0) {
        return onlinePriority;
      }

      const lastSeenPriority =
        (right.lastSeenAt?.getTime() ?? 0) - (left.lastSeenAt?.getTime() ?? 0);
      if (lastSeenPriority !== 0) {
        return lastSeenPriority;
      }

      return (
        left.registerCreatedAt.getTime() - right.registerCreatedAt.getTime()
      );
    });

  const targets = new Map<string, LabelHardwareTarget>();

  for (const row of compatibleRows) {
    if (row.agentStatus === "disabled") {
      continue;
    }

    if (targets.has(row.outletId)) {
      continue;
    }

    targets.set(row.outletId, {
      agentId: row.agentId,
      registerId: row.registerId,
      outletId: row.outletId,
      agentStatus: row.agentStatus,
      lastSeenAt: row.lastSeenAt,
    });
  }

  return targets;
}

export async function getLabelHardwareTarget({
  organizationId,
  outletId,
}: {
  organizationId: string;
  outletId: string;
}): Promise<LabelHardwareTarget | null> {
  const targets = await getLabelHardwareTargets({
    organizationId,
    outletIds: [outletId],
  });

  return targets.get(outletId) ?? null;
}
