import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(relativePath: string): string {
  const absolutePath = path.join(projectRoot, relativePath);
  assert(existsSync(absolutePath), `${relativePath} wajib tersedia.`);
  return readFileSync(absolutePath, "utf8");
}

const schemaSource = read("src/db/schema/index.ts");
const enrollmentSchemaSource = read("src/db/schema/hardware-enrollment.ts");
const seedSource = read("src/db/seed.ts");
const coreServiceSource = read("src/features/hardware/agent-provisioning.ts");
const guardedServiceSource = read(
  "src/features/hardware/hardware-hub-provisioning.ts",
);
const enrollmentClaimSource = read(
  "src/features/hardware/agent-enrollment-claim.ts",
);
const enrollmentClaimRouteSource = read(
  "src/app/api/hardware/v2/enrollments/claim/route.ts",
);
const actionSource = read("src/app/actions/hardware-hub-provisioning.ts");
const optionsSource = read("src/features/hardware/provisioning-options.ts");
const journalSource = read("drizzle/meta/_journal.json");

assert(
  schemaSource.includes(
    'uniqueIndex("hardware_agents_one_active_per_register_uq")',
  ),
  "Schema wajib membatasi satu Hardware Agent aktif per register.",
);
assert(
  schemaSource.includes(".where(sql`${table.isActive} = true`)"),
  "Unique active-agent guard harus berbasis is_active=true.",
);
assert(
  seedSource.includes('code: "hardware.agents.manage"'),
  "Permission hardware.agents.manage wajib tersedia.",
);

const managerPermissionSection =
  seedSource.match(/manager:\s*\[([\s\S]*?)\],\s*cashier:/)?.[1] ?? "";
assert(
  !managerPermissionSection.includes('"hardware.agents.manage"'),
  "Manager tidak boleh mendapat permission hardware.agents.manage.",
);

assert(
  coreServiceSource.includes("randomBytes(48)"),
  "Credential Hardware Agent wajib dibuat dari 48 random bytes.",
);
assert(
  coreServiceSource.includes("encryptHardwareAgentSecret"),
  "Credential Hardware Agent wajib dienkripsi sebelum disimpan.",
);
assert(
  coreServiceSource.includes('"hardware.agent.create"'),
  "Provisioning Hardware Agent wajib membuat audit log.",
);
assert(
  !coreServiceSource.includes("metadata: {\n          secret:"),
  "Secret Hardware Agent tidak boleh disimpan pada audit metadata.",
);
assert(
  coreServiceSource.includes("isHardwareHub: registers.isHardwareHub") &&
    coreServiceSource.includes("!register.isHardwareHub"),
  "Core provisioning wajib tetap menolak register non-Hardware-Hub sebagai defense in depth.",
);

assert(
  guardedServiceSource.includes("!target.isHardwareHub") &&
    guardedServiceSource.includes("provisionHardwareAgent(input)"),
  "Direct Hardware Hub provisioning helper wajib tetap enforce dedicated register sebelum core provisioning.",
);
assert(
  optionsSource.includes("eq(registers.isHardwareHub, true)"),
  "Provisioning options wajib hanya menampilkan dedicated Hardware Hub register.",
);
assert(
  actionSource.includes('requirePermission("hardware.agents.manage")'),
  "Server action setup wajib memakai hardware.agents.manage.",
);
assert(
  actionSource.includes("createHardwareAgentEnrollment") &&
    !actionSource.includes("provisionDedicatedHardwareHub"),
  "Normal setup wajib membuat enrollment; agent baru dibuat oleh installer claim flow.",
);

assert(
  enrollmentSchemaSource.includes('claimedByInstanceId: varchar("claimed_by_instance_id"') &&
    enrollmentSchemaSource.includes('status} = \'claimed\'') &&
    enrollmentSchemaSource.includes("agentId} is not null"),
  "Enrollment schema wajib bind claimed state ke instance ID dan Hardware Agent.",
);
assert(
  enrollmentClaimSource.includes("pg_advisory_xact_lock") &&
    enrollmentClaimSource.includes("hardware-enrollment:${codeHash}"),
  "Installer claim wajib memakai transactional advisory lock per Installation Code.",
);
assert(
  enrollmentClaimSource.includes("hashHardwareEnrollmentCode") &&
    !enrollmentClaimSource.includes("eq(hardwareAgentEnrollments.codeHash, input.installationCode)"),
  "Installer claim wajib lookup Installation Code melalui keyed hash, bukan plaintext.",
);
assert(
  enrollmentClaimSource.includes("enrollment.claimedByInstanceId !== instanceId") &&
    enrollmentClaimSource.includes("idempotent: true") &&
    enrollmentClaimSource.includes("decryptHardwareAgentSecret"),
  "Retry claim hanya boleh idempotent untuk persistent instance ID yang sama.",
);
assert(
  enrollmentClaimSource.includes('const secret = randomBytes(48).toString("base64url")') &&
    enrollmentClaimSource.includes("encryptHardwareAgentSecret(agentId, secret)"),
  "Claim pertama wajib membuat signed credential kuat dan menyimpannya terenkripsi.",
);
assert(
  enrollmentClaimSource.includes('status: "claimed"') &&
    enrollmentClaimSource.includes('action: "hardware.enrollment.claim"') &&
    enrollmentClaimSource.includes('source: "hardware_hub_installer"'),
  "Claim pertama wajib mengubah lifecycle menjadi claimed dan menulis audit trail installer.",
);
assert(
  enrollmentClaimRouteSource.includes("consumeSecurityRateLimit") &&
    enrollmentClaimRouteSource.includes('scope: "hardware.enrollment.claim.ip"') &&
    enrollmentClaimRouteSource.includes('scope: "hardware.enrollment.claim.code"'),
  "Public installer claim endpoint wajib memiliki persistent rate limit per client dan per code.",
);
assert(
  enrollmentClaimRouteSource.includes('"Cache-Control": "no-store, max-age=0"') &&
    !enrollmentClaimRouteSource.includes("authenticateHardwareAgent"),
  "Bootstrap claim response wajib no-store dan tidak boleh membutuhkan agent auth sebelum agent dibuat.",
);

const journal = JSON.parse(journalSource) as {
  entries?: Array<{ tag?: string }>;
};
assert(
  journal.entries?.some((entry) => entry.tag?.startsWith("0015_")),
  "Migration Hardware Agent provisioning wajib tetap tercatat di Drizzle journal.",
);
assert(
  journal.entries?.some(
    (entry) => entry.tag === "0026_hardware_agent_enrollments",
  ),
  "Migration Hardware Agent enrollment wajib tercatat di Drizzle journal.",
);

console.log(
  "OK: Hardware Hub provisioning + enrollment + installer claim contract siap digunakan.",
);
