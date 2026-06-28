import { and, count, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { hardwareAgents, hardwareJobs } from "@/db/schema";
import {
  authenticateHardwareAgent,
  getClientIp,
} from "@/lib/hardware/agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateHardwareAgent(req);

  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized hardware agent" },
      { status: 401 },
    );
  }

  let capabilities: Record<string, unknown> | undefined;
  let status: "online" | "offline" = "online";

  try {
    const body = await req.json();
    if (body && typeof body.capabilities === "object" && body.capabilities) {
      capabilities = body.capabilities as Record<string, unknown>;
    }
    if (body?.status === "offline") {
      status = "offline";
    }
  } catch {
    capabilities = undefined;
  }

  const now = new Date();

  const [pendingCountRow] = await db
    .select({ count: count() })
    .from(hardwareJobs)
    .where(
      and(
        eq(hardwareJobs.organizationId, auth.agent.organizationId),
        eq(hardwareJobs.outletId, auth.agent.outletId),
        eq(hardwareJobs.registerId, auth.agent.registerId),
        eq(hardwareJobs.status, "pending"),
      ),
    )
    .limit(1);

  await db
    .update(hardwareAgents)
    .set({
      status,
      lastSeenAt: now,
      lastIpAddress: getClientIp(req),
      lastUserAgent: req.headers.get("user-agent"),
      ...(capabilities ? { capabilities } : {}),
      updatedAt: now,
    })
    .where(eq(hardwareAgents.id, auth.agent.id));

  return NextResponse.json({
    success: true,
    agent: auth.agent,
    outlet: auth.outlet,
    register: auth.register,
    pendingJobsApprox: pendingCountRow?.count ?? 0,
    serverTime: now.toISOString(),
  });
}
