import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { hardwareAgents } from "@/db/schema";
import {
  getClientIp,
  type HardwareAgentAuth,
} from "@/lib/hardware/agent-auth";

export async function touchHardwareAgent({
  auth,
  req,
  now = new Date(),
}: {
  auth: HardwareAgentAuth;
  req: NextRequest;
  now?: Date;
}): Promise<void> {
  try {
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
  } catch (error) {
    console.error("[hardware] gagal memperbarui agent presence", error);
  }
}
