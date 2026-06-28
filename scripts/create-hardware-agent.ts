import "dotenv/config";

import { and, eq } from "drizzle-orm";

import { db } from "../src/db";
import { hardwareAgents, organizations, outlets, registers } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur.`);
  }

  return value;
}

async function main() {
  const organizationSlug = (
    process.env.HARDWARE_AGENT_ORGANIZATION_SLUG ??
    process.env.DEFAULT_ORGANIZATION_SLUG ??
    process.env.BOOTSTRAP_ORGANIZATION_SLUG
  )?.trim();
  const outletCode = (
    process.env.HARDWARE_AGENT_OUTLET_CODE ?? process.env.BOOTSTRAP_OUTLET_CODE
  )?.trim();
  const registerCode = (
    process.env.HARDWARE_AGENT_REGISTER_CODE ??
    process.env.BOOTSTRAP_REGISTER_CODE
  )?.trim();
  const agentCode = required("HARDWARE_AGENT_CODE");
  const agentName = process.env.HARDWARE_AGENT_NAME?.trim() || agentCode;
  const agentSecret = required("HARDWARE_AGENT_SECRET");

  if (!organizationSlug || !outletCode || !registerCode) {
    throw new Error(
      "Atur HARDWARE_AGENT_ORGANIZATION_SLUG, HARDWARE_AGENT_OUTLET_CODE, dan HARDWARE_AGENT_REGISTER_CODE.",
    );
  }

  if (agentSecret.length < 32) {
    throw new Error("HARDWARE_AGENT_SECRET minimal harus 32 karakter.");
  }

  const [organization] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.slug, organizationSlug.toLowerCase()))
    .limit(1);

  if (!organization) {
    throw new Error(`Organization ${organizationSlug} tidak ditemukan.`);
  }

  const [outlet] = await db
    .select({ id: outlets.id, name: outlets.name })
    .from(outlets)
    .where(
      and(
        eq(outlets.organizationId, organization.id),
        eq(outlets.code, outletCode.toUpperCase()),
      ),
    )
    .limit(1);

  if (!outlet) {
    throw new Error(`Outlet ${outletCode} tidak ditemukan.`);
  }

  const [register] = await db
    .select({ id: registers.id, name: registers.name })
    .from(registers)
    .where(
      and(
        eq(registers.outletId, outlet.id),
        eq(registers.code, registerCode.toUpperCase()),
      ),
    )
    .limit(1);

  if (!register) {
    throw new Error(`Register ${registerCode} tidak ditemukan.`);
  }

  const secretHash = await hashPassword(agentSecret);
  const now = new Date();

  const [existing] = await db
    .select({ id: hardwareAgents.id })
    .from(hardwareAgents)
    .where(
      and(
        eq(hardwareAgents.organizationId, organization.id),
        eq(hardwareAgents.code, agentCode),
      ),
    )
    .limit(1);

  const rows = existing
    ? await db
        .update(hardwareAgents)
        .set({
          name: agentName,
          outletId: outlet.id,
          registerId: register.id,
          secretHash,
          status: "offline",
          isActive: true,
          updatedAt: now,
        })
        .where(eq(hardwareAgents.id, existing.id))
        .returning()
    : await db
        .insert(hardwareAgents)
        .values({
          organizationId: organization.id,
          outletId: outlet.id,
          registerId: register.id,
          code: agentCode,
          name: agentName,
          secretHash,
          status: "offline",
          isActive: true,
        })
        .returning();

  const agent = rows[0];

  if (!agent) {
    throw new Error("Hardware agent gagal disimpan.");
  }

  console.log("Hardware agent berhasil disiapkan.");
  console.log(`Agent ID     : ${agent.id}`);
  console.log(`Agent Code   : ${agent.code}`);
  console.log(`Agent Name   : ${agent.name}`);
  console.log(`Organization : ${organization.name}`);
  console.log(`Outlet       : ${outlet.name}`);
  console.log(`Register     : ${register.name}`);
  console.log("");
  console.log("Masukkan ke hardware-hub/.env:");
  console.log(`HARDWARE_AGENT_ID=${agent.id}`);
  console.log(`HARDWARE_AGENT_SECRET=${agentSecret}`);
}

main().catch((error: unknown) => {
  console.error("Gagal membuat hardware agent:", error);
  process.exitCode = 1;
});
