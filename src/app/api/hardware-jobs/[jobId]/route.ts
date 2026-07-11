import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { hardwareAgents, hardwareJobs } from "@/db/schema";
import { createHardwareJobFailedNotification } from "@/features/notifications/hardware";
import {
  authenticateHardwareAgent,
  getClientIp,
} from "@/lib/hardware/agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const updateableStatuses = ["printing", "completed", "failed"] as const;

type UpdateableStatus = (typeof updateableStatuses)[number];

function isUpdateableStatus(value: unknown): value is UpdateableStatus {
  return (
    typeof value === "string" &&
    updateableStatuses.includes(value as UpdateableStatus)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeResult(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      normalized[key] = entry.slice(0, 2000);
    } else if (
      entry === null ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      normalized[key] = entry;
    } else if (Array.isArray(entry)) {
      normalized[key] = entry.slice(0, 20);
    } else if (isRecord(entry)) {
      normalized[key] = entry;
    }
  }

  return normalized;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await authenticateHardwareAgent(req);

  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized hardware agent" },
      { status: 401 },
    );
  }

  const { jobId } = await context.params;

  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;

  if (!isUpdateableStatus(status)) {
    return NextResponse.json(
      { error: "Invalid hardware job status" },
      { status: 400 },
    );
  }

  const now = new Date();
  const result = normalizeResult(body?.result);
  const resultMessage = readString(result.message);
  const errorMessage =
    typeof body?.error === "string" && body.error.trim()
      ? body.error.trim().slice(0, 2000)
      : resultMessage?.slice(0, 2000) ?? null;

  const [updated] = await db
    .update(hardwareJobs)
    .set({
      status,
      error: status === "failed" ? errorMessage : null,
      result,
      startedAt: status === "printing" ? now : undefined,
      completedAt: status === "completed" ? now : undefined,
      failedAt: status === "failed" ? now : undefined,
      updatedAt: now,
    })
    .where(
      and(
        eq(hardwareJobs.id, jobId),
        eq(hardwareJobs.organizationId, auth.agent.organizationId),
        eq(hardwareJobs.outletId, auth.agent.outletId),
        eq(hardwareJobs.registerId, auth.agent.registerId),
        eq(hardwareJobs.agentId, auth.agent.id),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Hardware job not found or not claimed by this agent" },
      { status: 404 },
    );
  }

  if (status === "failed") {
    await createHardwareJobFailedNotification({
      organizationId: updated.organizationId,
      outletId: updated.outletId,
      registerId: updated.registerId,
      agentId: updated.agentId,
      jobId: updated.id,
      jobType: updated.jobType,
      deviceType: updated.deviceType,
      error: errorMessage,
      source: "agent_update",
    });
  }

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

  return NextResponse.json({ success: true, job: updated });
}
