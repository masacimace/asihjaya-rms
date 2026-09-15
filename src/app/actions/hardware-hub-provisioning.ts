"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  HardwareAgentProvisioningError,
} from "@/features/hardware/agent-provisioning";
import { provisionDedicatedHardwareHub } from "@/features/hardware/hardware-hub-provisioning";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const HARDWARE_DASHBOARD_PATH = "/admin/operasional/hardware";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HardwareHubSetupActionState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "success";
      agent: {
        id: string;
        code: string;
        name: string;
        outletName: string;
        registerName: string;
      };
      credential: {
        secret: string;
        authMode: "signed";
        protocolMode: "v2-preferred";
      };
    };

export async function setupHardwareHubAction(
  _previousState: HardwareHubSetupActionState,
  formData: FormData,
): Promise<HardwareHubSetupActionState> {
  const auth = await requirePermission("hardware.agents.manage");
  const outletId = String(formData.get("outletId") ?? "").trim();
  const registerId = String(formData.get("registerId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const headerStore = await headers();

  try {
    const result = await provisionDedicatedHardwareHub({
      organizationId: auth.organization.id,
      accessibleOutletIds: auth.outlets.map((outlet) => outlet.id),
      actorUserId: auth.user.id,
      outletId,
      registerId,
      code,
      name,
      requestId: UUID_PATTERN.test(requestId) ? requestId : null,
      ipAddress: getClientIp(headerStore),
      userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
    });

    revalidatePath(HARDWARE_DASHBOARD_PATH);

    return {
      status: "success",
      agent: {
        id: result.agent.id,
        code: result.agent.code,
        name: result.agent.name,
        outletName: result.agent.outletName,
        registerName: result.agent.registerName,
      },
      credential: result.credential,
    };
  } catch (error) {
    if (error instanceof HardwareAgentProvisioningError) {
      return { status: "error", message: error.message };
    }

    console.error("[hardware] simplified Hardware Hub setup failed", error);
    return {
      status: "error",
      message: "Hardware Hub gagal disiapkan.",
    };
  }
}
