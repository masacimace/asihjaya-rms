import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db, pool } from "@/db";
import { hardwareAgentEnrollments } from "@/db/schema/hardware-enrollment";
import {
  hardwareAgents,
  organizations,
  outlets,
  registers,
  users,
} from "@/db/schema";
import {
  claimHardwareAgentEnrollment,
  HardwareAgentEnrollmentClaimError,
} from "@/features/hardware/agent-enrollment-claim";
import { completeHardwareAgentEnrollment } from "@/features/hardware/agent-enrollment-completion";
import { hashHardwareEnrollmentCode } from "@/lib/hardware/enrollment-code";

const INSTALLATION_CODE_A = "AJ-7K4P-9Q2M-X6TR";
const INSTALLATION_CODE_B = "AJ-8M5R-7V3K-4N2Q";

async function createTarget(input: {
  organizationId: string;
  createdByUserId: string;
  outletCode: string;
  registerCode: string;
  installationCode: string;
}) {
  const [outlet] = await db
    .insert(outlets)
    .values({
      organizationId: input.organizationId,
      code: input.outletCode,
      name: `Outlet ${input.outletCode}`,
      isActive: true,
    })
    .returning({ id: outlets.id });
  assert.ok(outlet);

  const [register] = await db
    .insert(registers)
    .values({
      outletId: outlet.id,
      code: input.registerCode,
      name: `Register ${input.registerCode}`,
      isHardwareHub: true,
      isActive: true,
    })
    .returning({ id: registers.id });
  assert.ok(register);

  const codeHash = hashHardwareEnrollmentCode(input.installationCode);
  assert.ok(codeHash);

  const [enrollment] = await db
    .insert(hardwareAgentEnrollments)
    .values({
      organizationId: input.organizationId,
      outletId: outlet.id,
      registerId: register.id,
      createdByUserId: input.createdByUserId,
      codeHash,
      status: "pending",
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    })
    .returning({ id: hardwareAgentEnrollments.id });
  assert.ok(enrollment);

  return {
    outletId: outlet.id,
    outletCode: input.outletCode,
    registerId: register.id,
    registerCode: input.registerCode,
    enrollmentId: enrollment.id,
  };
}

async function main() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);

  const [organization] = await db
    .insert(organizations)
    .values({
      name: `Stage 4 Enrollment ${suffix}`,
      slug: `stage4-enrollment-${suffix}`,
      timezone: "Asia/Jakarta",
      currency: "IDR",
      isActive: true,
    })
    .returning({ id: organizations.id });
  assert.ok(organization);

  const [user] = await db
    .insert(users)
    .values({
      organizationId: organization.id,
      email: `stage4-${suffix}@example.test`,
      username: `stage4_${suffix}`,
      fullName: "Stage 4 Enrollment Test",
      status: "active",
    })
    .returning({ id: users.id });
  assert.ok(user);

  const targetA = await createTarget({
    organizationId: organization.id,
    createdByUserId: user.id,
    outletCode: `OA${suffix.slice(0, 6)}`,
    registerCode: "HUB-A",
    installationCode: INSTALLATION_CODE_A,
  });

  const instanceA = randomUUID();
  const first = await claimHardwareAgentEnrollment({
    installationCode: INSTALLATION_CODE_A,
    instanceId: instanceA,
    machineName: "STAGE4-PC-A",
    installerVersion: "stage4-test",
    ipAddress: "127.0.0.1",
    userAgent: "stage4-integration-test",
  });

  assert.equal(first.idempotent, false);
  assert.equal(first.enrollment.id, targetA.enrollmentId);
  assert.equal(first.enrollment.status, "claimed");
  assert.equal(first.agent.registerId, targetA.registerId);
  assert.equal(first.credential.authMode, "signed");
  assert.equal(first.credential.protocolMode, "v2-preferred");
  assert.equal(first.credential.secret.length, 64);
  assert.ok(first.enrollment.credentialReplayUntil > first.enrollment.claimedAt);

  const retry = await claimHardwareAgentEnrollment({
    installationCode: INSTALLATION_CODE_A,
    instanceId: instanceA,
    machineName: "STAGE4-PC-A",
    installerVersion: "stage4-test",
  });

  assert.equal(retry.idempotent, true);
  assert.equal(retry.agent.id, first.agent.id);
  assert.equal(retry.credential.secret, first.credential.secret);

  await assert.rejects(
    () =>
      claimHardwareAgentEnrollment({
        installationCode: INSTALLATION_CODE_A,
        instanceId: randomUUID(),
      }),
    (error) => {
      assert.ok(error instanceof HardwareAgentEnrollmentClaimError);
      assert.equal(error.code, "ENROLLMENT_CLAIMED_BY_OTHER_INSTANCE");
      return true;
    },
  );

  const completionAuth = {
    authScheme: "signed-v2" as const,
    agent: {
      id: first.agent.id,
      code: first.agent.code,
      name: first.agent.name,
      organizationId: first.agent.organizationId,
      outletId: first.agent.outletId,
      registerId: first.agent.registerId,
      capabilities: {},
    },
    outlet: {
      id: first.agent.outletId,
      code: first.agent.outletCode,
      name: first.agent.outletName,
    },
    register: {
      id: first.agent.registerId,
      code: first.agent.registerCode,
      name: first.agent.registerName,
    },
  };

  const completed = await completeHardwareAgentEnrollment({
    enrollmentId: targetA.enrollmentId,
    instanceId: instanceA,
    auth: completionAuth,
    installerVersion: "stage4-test",
    credentialStoreKind: "windows-dpapi-current-user",
    ipAddress: "127.0.0.1",
    userAgent: "stage4-integration-test",
  });
  assert.equal(completed.idempotent, false);
  assert.equal(completed.enrollment.status, "completed");

  const completedRetry = await completeHardwareAgentEnrollment({
    enrollmentId: targetA.enrollmentId,
    instanceId: instanceA,
    auth: completionAuth,
  });
  assert.equal(completedRetry.idempotent, true);
  assert.equal(
    completedRetry.enrollment.completedAt.getTime(),
    completed.enrollment.completedAt.getTime(),
  );

  await assert.rejects(
    () =>
      claimHardwareAgentEnrollment({
        installationCode: INSTALLATION_CODE_A,
        instanceId: instanceA,
      }),
    (error) => {
      assert.ok(error instanceof HardwareAgentEnrollmentClaimError);
      assert.equal(error.code, "ENROLLMENT_REPLAY_WINDOW_EXPIRED");
      return true;
    },
  );

  const [completedRow] = await db
    .select({
      status: hardwareAgentEnrollments.status,
      completedAt: hardwareAgentEnrollments.completedAt,
    })
    .from(hardwareAgentEnrollments)
    .where(eq(hardwareAgentEnrollments.id, targetA.enrollmentId))
    .limit(1);
  assert.equal(completedRow?.status, "completed");
  assert.ok(completedRow?.completedAt);

  const agentsForTargetA = await db
    .select({ id: hardwareAgents.id })
    .from(hardwareAgents)
    .where(
      and(
        eq(hardwareAgents.registerId, targetA.registerId),
        eq(hardwareAgents.isActive, true),
      ),
    );
  assert.equal(agentsForTargetA.length, 1);

  const targetB = await createTarget({
    organizationId: organization.id,
    createdByUserId: user.id,
    outletCode: `OB${suffix.slice(0, 6)}`,
    registerCode: "HUB-B",
    installationCode: INSTALLATION_CODE_B,
  });

  const competingInstanceA = randomUUID();
  const competingInstanceB = randomUUID();
  const concurrent = await Promise.allSettled([
    claimHardwareAgentEnrollment({
      installationCode: INSTALLATION_CODE_B,
      instanceId: competingInstanceA,
      machineName: "STAGE4-RACE-A",
    }),
    claimHardwareAgentEnrollment({
      installationCode: INSTALLATION_CODE_B,
      instanceId: competingInstanceB,
      machineName: "STAGE4-RACE-B",
    }),
  ]);

  const fulfilled = concurrent.filter(
    (result): result is PromiseFulfilledResult<
      Awaited<ReturnType<typeof claimHardwareAgentEnrollment>>
    > => result.status === "fulfilled",
  );
  const rejected = concurrent.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(fulfilled[0]?.value.idempotent, false);
  assert.ok(rejected[0]?.reason instanceof HardwareAgentEnrollmentClaimError);
  assert.equal(
    (rejected[0]?.reason as HardwareAgentEnrollmentClaimError).code,
    "ENROLLMENT_CLAIMED_BY_OTHER_INSTANCE",
  );

  const agentsForTargetB = await db
    .select({ id: hardwareAgents.id })
    .from(hardwareAgents)
    .where(
      and(
        eq(hardwareAgents.registerId, targetB.registerId),
        eq(hardwareAgents.isActive, true),
      ),
    );
  assert.equal(agentsForTargetB.length, 1);

  console.log(
    "Hardware enrollment DB integration passed: claim idempotency, secure completion, completion idempotency, replay shutdown, and concurrent single-winner invariant.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
