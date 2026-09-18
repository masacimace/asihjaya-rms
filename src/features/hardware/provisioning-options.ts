import { and, asc, eq, gt, inArray } from "drizzle-orm";

import { db } from "@/db";
import { hardwareAgentEnrollments } from "@/db/schema/hardware-enrollment";
import { hardwareAgents, outlets, registers } from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";

export type HardwareHubProvisioningOption = {
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  register: {
    id: string;
    code: string;
    name: string;
  };
  activeAgent: {
    id: string;
    code: string;
    name: string;
  } | null;
  pendingEnrollment: {
    id: string;
    expiresAt: Date;
  } | null;
};

/**
 * Provisioning normal hanya boleh menargetkan register yang secara eksplisit
 * ditandai sebagai Hardware Hub. Service enrollment/provisioning tetap memiliki
 * guard yang sama agar crafted request tidak dapat melewati invariant ini.
 */
export async function getHardwareHubProvisioningOptions(
  auth: AuthContext,
): Promise<HardwareHubProvisioningOption[]> {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    return [];
  }

  const now = new Date();
  const rows = await db
    .select({
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
      registerId: registers.id,
      registerCode: registers.code,
      registerName: registers.name,
      activeAgentId: hardwareAgents.id,
      activeAgentCode: hardwareAgents.code,
      activeAgentName: hardwareAgents.name,
      pendingEnrollmentId: hardwareAgentEnrollments.id,
      pendingEnrollmentExpiresAt: hardwareAgentEnrollments.expiresAt,
    })
    .from(registers)
    .innerJoin(outlets, eq(registers.outletId, outlets.id))
    .leftJoin(
      hardwareAgents,
      and(
        eq(hardwareAgents.registerId, registers.id),
        eq(hardwareAgents.isActive, true),
      ),
    )
    .leftJoin(
      hardwareAgentEnrollments,
      and(
        eq(hardwareAgentEnrollments.registerId, registers.id),
        eq(hardwareAgentEnrollments.status, "pending"),
        gt(hardwareAgentEnrollments.expiresAt, now),
      ),
    )
    .where(
      and(
        eq(outlets.organizationId, auth.organization.id),
        inArray(outlets.id, outletIds),
        eq(outlets.isActive, true),
        eq(registers.isActive, true),
        eq(registers.isHardwareHub, true),
      ),
    )
    .orderBy(asc(outlets.name), asc(registers.name));

  return rows.map((row) => ({
    outlet: {
      id: row.outletId,
      code: row.outletCode,
      name: row.outletName,
    },
    register: {
      id: row.registerId,
      code: row.registerCode,
      name: row.registerName,
    },
    activeAgent:
      row.activeAgentId && row.activeAgentCode && row.activeAgentName
        ? {
            id: row.activeAgentId,
            code: row.activeAgentCode,
            name: row.activeAgentName,
          }
        : null,
    pendingEnrollment:
      row.pendingEnrollmentId && row.pendingEnrollmentExpiresAt
        ? {
            id: row.pendingEnrollmentId,
            expiresAt: row.pendingEnrollmentExpiresAt,
          }
        : null,
  }));
}
