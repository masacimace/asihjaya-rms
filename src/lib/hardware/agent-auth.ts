import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { hardwareAgents, outlets, registers } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";

export type HardwareAgentAuth = {
  agent: {
    id: string;
    code: string;
    name: string;
    organizationId: string;
    outletId: string;
    registerId: string;
    capabilities: Record<string, unknown>;
  };
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
};

type HeaderReader = {
  get(name: string): string | null;
};

export function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function authenticateHardwareAgentHeaders(
  headers: HeaderReader,
): Promise<HardwareAgentAuth | null> {
  const agentId = headers.get("x-hardware-agent-id")?.trim();
  const agentSecret = headers.get("x-hardware-agent-secret")?.trim();

  if (!agentId || !agentSecret) {
    return null;
  }

  const [row] = await db
    .select({
      agentId: hardwareAgents.id,
      agentCode: hardwareAgents.code,
      agentName: hardwareAgents.name,
      organizationId: hardwareAgents.organizationId,
      outletId: hardwareAgents.outletId,
      registerId: hardwareAgents.registerId,
      secretHash: hardwareAgents.secretHash,
      isActive: hardwareAgents.isActive,
      status: hardwareAgents.status,
      capabilities: hardwareAgents.capabilities,
      outletCode: outlets.code,
      outletName: outlets.name,
      outletIsActive: outlets.isActive,
      registerCode: registers.code,
      registerName: registers.name,
      registerIsActive: registers.isActive,
    })
    .from(hardwareAgents)
    .innerJoin(outlets, eq(hardwareAgents.outletId, outlets.id))
    .innerJoin(registers, eq(hardwareAgents.registerId, registers.id))
    .where(eq(hardwareAgents.id, agentId))
    .limit(1);

  if (
    !row ||
    !row.isActive ||
    row.status === "disabled" ||
    !row.outletIsActive ||
    !row.registerIsActive
  ) {
    return null;
  }

  const isValidSecret = await verifyPassword(agentSecret, row.secretHash);

  if (!isValidSecret) {
    return null;
  }

  return {
    agent: {
      id: row.agentId,
      code: row.agentCode,
      name: row.agentName,
      organizationId: row.organizationId,
      outletId: row.outletId,
      registerId: row.registerId,
      capabilities: row.capabilities ?? {},
    },
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
  };
}

export async function authenticateHardwareAgent(
  req: NextRequest,
): Promise<HardwareAgentAuth | null> {
  return authenticateHardwareAgentHeaders(req.headers);
}
