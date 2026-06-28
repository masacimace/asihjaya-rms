import { and, asc, eq, lte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { hardwareAgents, hardwareJobs } from "@/db/schema";
import { recoverStaleHardwareJobs } from "@/lib/hardware/job-recovery";
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

  const now = new Date();
  const recovery = await recoverStaleHardwareJobs({
    organizationId: auth.agent.organizationId,
    outletId: auth.agent.outletId,
    registerId: auth.agent.registerId,
    now,
    reason: "claim_endpoint",
  });

  const claimedJob = await db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: hardwareJobs.id })
      .from(hardwareJobs)
      .where(
        and(
          eq(hardwareJobs.organizationId, auth.agent.organizationId),
          eq(hardwareJobs.outletId, auth.agent.outletId),
          eq(hardwareJobs.registerId, auth.agent.registerId),
          eq(hardwareJobs.status, "pending"),
          lte(hardwareJobs.availableAt, now),
        ),
      )
      .orderBy(asc(hardwareJobs.priority), asc(hardwareJobs.createdAt))
      .limit(1);

    if (!candidate) {
      return null;
    }

    const [claimed] = await tx
      .update(hardwareJobs)
      .set({
        agentId: auth.agent.id,
        status: "claimed",
        claimedAt: now,
        attempts: sql`${hardwareJobs.attempts} + 1`,
        updatedAt: now,
      })
      .where(
        and(eq(hardwareJobs.id, candidate.id), eq(hardwareJobs.status, "pending")),
      )
      .returning();

    return claimed ?? null;
  });

  await db
    .update(hardwareAgents)
    .set({
      status: "online",
      lastSeenAt: now,
      lastIpAddress: getClientIp(req),
      lastUserAgent: req.headers.get("user-agent"),
      updatedAt: now,
    })
    .where(eq(hardwareAgents.id, auth.agent.id));

  return NextResponse.json({
    success: true,
    job: claimedJob,
    recovery,
    serverTime: now.toISOString(),
  });
}
