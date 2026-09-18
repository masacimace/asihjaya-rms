"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createHardwareAgentEnrollment,
  HardwareAgentEnrollmentError,
  revokeHardwareAgentEnrollment,
} from "@/features/hardware/agent-enrollment";
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
      enrollment: {
        id: string;
        outletName: string;
        registerName: string;
        expiresAt: string;
      };
      installationCode: string;
    };

export async function setupHardwareHubAction(
  _previousState: HardwareHubSetupActionState,
  formData: FormData,
): Promise<HardwareHubSetupActionState> {
  const auth = await requirePermission("hardware.agents.manage");
  const outletId = String(formData.get("outletId") ?? "").trim();
  const registerId = String(formData.get("registerId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const headerStore = await headers();

  try {
    const result = await createHardwareAgentEnrollment({
      organizationId: auth.organization.id,
      accessibleOutletIds: auth.outlets.map((outlet) => outlet.id),
      actorUserId: auth.user.id,
      outletId,
      registerId,
      requestId: UUID_PATTERN.test(requestId) ? requestId : null,
      ipAddress: getClientIp(headerStore),
      userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
    });

    revalidatePath(HARDWARE_DASHBOARD_PATH);

    return {
      status: "success",
      enrollment: {
        id: result.enrollment.id,
        outletName: result.enrollment.outletName,
        registerName: result.enrollment.registerName,
        expiresAt: result.enrollment.expiresAt.toISOString(),
      },
      installationCode: result.installationCode,
    };
  } catch (error) {
    if (error instanceof HardwareAgentEnrollmentError) {
      return { status: "error", message: error.message };
    }

    console.error("[hardware] Hardware Hub enrollment creation failed", error);
    return {
      status: "error",
      message: "Installation Code gagal dibuat.",
    };
  }
}

export async function revokeHardwareHubEnrollmentAction(
  formData: FormData,
): Promise<void> {
  const auth = await requirePermission("hardware.agents.manage");
  const enrollmentId = String(formData.get("enrollmentId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const headerStore = await headers();

  try {
    await revokeHardwareAgentEnrollment({
      organizationId: auth.organization.id,
      accessibleOutletIds: auth.outlets.map((outlet) => outlet.id),
      actorUserId: auth.user.id,
      enrollmentId,
      requestId: UUID_PATTERN.test(requestId) ? requestId : null,
      ipAddress: getClientIp(headerStore),
      userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
    });
  } catch (error) {
    if (error instanceof HardwareAgentEnrollmentError) {
      redirect(
        `${HARDWARE_DASHBOARD_PATH}?type=error&message=${encodeURIComponent(error.message)}`,
      );
    }

    console.error("[hardware] Hardware Hub enrollment revoke failed", error);
    redirect(
      `${HARDWARE_DASHBOARD_PATH}?type=error&message=${encodeURIComponent("Installation Code gagal dibatalkan.")}`,
    );
  }

  revalidatePath(HARDWARE_DASHBOARD_PATH);
  redirect(
    `${HARDWARE_DASHBOARD_PATH}?type=success&message=${encodeURIComponent("Installation Code dibatalkan.")}`,
  );
}
