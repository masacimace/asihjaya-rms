import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { outlets, registers } from "@/db/schema";
import {
  HardwareAgentProvisioningError,
  provisionHardwareAgent,
  type ProvisionHardwareAgentInput,
  type ProvisionHardwareAgentResult,
} from "@/features/hardware/agent-provisioning";

/**
 * Public provisioning boundary untuk Hardware Hub.
 *
 * Agent hanya boleh dipasang pada register yang memang ditandai sebagai
 * register Hardware Hub. Guard ini sengaja berada server-side sehingga UI,
 * installer, maupun request buatan tidak dapat memasang agent ke register POS
 * biasa.
 */
export async function provisionDedicatedHardwareHub(
  input: ProvisionHardwareAgentInput,
): Promise<ProvisionHardwareAgentResult> {
  const [target] = await db
    .select({
      registerId: registers.id,
      registerIsActive: registers.isActive,
      isHardwareHub: registers.isHardwareHub,
      outletId: outlets.id,
      outletIsActive: outlets.isActive,
    })
    .from(registers)
    .innerJoin(outlets, eq(registers.outletId, outlets.id))
    .where(
      and(
        eq(registers.id, input.registerId.trim()),
        eq(outlets.id, input.outletId.trim()),
        eq(outlets.organizationId, input.organizationId.trim()),
      ),
    )
    .limit(1);

  if (
    !target ||
    !target.outletIsActive ||
    !target.registerIsActive ||
    !target.isHardwareHub
  ) {
    throw new HardwareAgentProvisioningError(
      "REGISTER_NOT_FOUND",
      "Register tidak tersedia sebagai register Hardware Hub aktif.",
    );
  }

  return provisionHardwareAgent(input);
}
