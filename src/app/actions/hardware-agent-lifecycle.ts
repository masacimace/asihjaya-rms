"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  disableHardwareAgent,
  HardwareAgentLifecycleError,
  reactivateHardwareAgent,
  replaceHardwareAgentDevice,
  rotateHardwareAgentCredential,
  type HardwareAgentCredentialResult,
  type HardwareAgentLifecycleErrorCode,
} from "@/features/hardware/agent-lifecycle";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const HARDWARE_DASHBOARD_PATH = "/admin/operasional/hardware";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HardwareAgentLifecycleActionState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      code?: HardwareAgentLifecycleErrorCode;
    }
  | ({
      status: "success";
    } & HardwareAgentCredentialResult);

async function getRequestMetadata() {
  const headerStore = await headers();

  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function redirectWithMessage(
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ type, message });
  redirect(`${HARDWARE_DASHBOARD_PATH}?${params.toString()}`);
}

async function getLifecycleInput(formData: FormData) {
  const auth = await requirePermission("hardware.agents.manage");
  const agentId = String(formData.get("agentId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();

  if (!UUID_PATTERN.test(agentId)) {
    return {
      ok: false as const,
      state: {
        status: "error" as const,
        code: "INVALID_INPUT" as const,
        message: "Hardware Agent tidak valid.",
      },
    };
  }

  const requestMetadata = await getRequestMetadata();

  return {
    ok: true as const,
    auth,
    input: {
      organizationId: auth.organization.id,
      accessibleOutletIds: auth.outlets.map((outlet) => outlet.id),
      actorUserId: auth.user.id,
      agentId,
      requestId: UUID_PATTERN.test(requestId) ? requestId : null,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    },
  };
}

function lifecycleErrorState(
  error: unknown,
): HardwareAgentLifecycleActionState {
  if (error instanceof HardwareAgentLifecycleError) {
    return {
      status: "error",
      code: error.code,
      message: error.message,
    };
  }

  console.error("[hardware] lifecycle Hardware Agent gagal", {
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : "unknown_error",
  });

  return {
    status: "error",
    message: "Lifecycle Hardware Agent gagal diproses.",
  };
}

export async function rotateHardwareAgentCredentialAction(
  _previousState: HardwareAgentLifecycleActionState,
  formData: FormData,
): Promise<HardwareAgentLifecycleActionState> {
  const context = await getLifecycleInput(formData);

  if (!context.ok) {
    return context.state;
  }

  try {
    const result = await rotateHardwareAgentCredential(context.input);

    revalidatePath(HARDWARE_DASHBOARD_PATH);

    return {
      status: "success",
      ...result,
    };
  } catch (error) {
    return lifecycleErrorState(error);
  }
}

export async function reactivateHardwareAgentAction(
  _previousState: HardwareAgentLifecycleActionState,
  formData: FormData,
): Promise<HardwareAgentLifecycleActionState> {
  const context = await getLifecycleInput(formData);

  if (!context.ok) {
    return context.state;
  }

  try {
    const result = await reactivateHardwareAgent(context.input);

    revalidatePath(HARDWARE_DASHBOARD_PATH);

    return {
      status: "success",
      ...result,
    };
  } catch (error) {
    return lifecycleErrorState(error);
  }
}

export async function replaceHardwareAgentDeviceAction(
  _previousState: HardwareAgentLifecycleActionState,
  formData: FormData,
): Promise<HardwareAgentLifecycleActionState> {
  const context = await getLifecycleInput(formData);

  if (!context.ok) {
    return context.state;
  }

  try {
    const result = await replaceHardwareAgentDevice(context.input);

    revalidatePath(HARDWARE_DASHBOARD_PATH);

    return {
      status: "success",
      ...result,
    };
  } catch (error) {
    return lifecycleErrorState(error);
  }
}

export async function disableHardwareAgentAction(
  formData: FormData,
): Promise<void> {
  const context = await getLifecycleInput(formData);

  if (!context.ok) {
    redirectWithMessage("error", context.state.message);
  }

  try {
    const result = await disableHardwareAgent(context.input);

    revalidatePath(HARDWARE_DASHBOARD_PATH);

    redirectWithMessage(
      "success",
      `Hardware Agent ${result.agentName} (${result.agentCode}) sudah dinonaktifkan.`,
    );
  } catch (error) {
    const state = lifecycleErrorState(error);
    redirectWithMessage(
      "error",
      state.status === "error"
        ? state.message
        : "Hardware Agent gagal dinonaktifkan.",
    );
  }
}
