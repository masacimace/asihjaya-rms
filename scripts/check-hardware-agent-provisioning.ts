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
const seedSource = read("src/db/seed.ts");
const coreServiceSource = read("src/features/hardware/agent-provisioning.ts");
const guardedServiceSource = read(
  "src/features/hardware/hardware-hub-provisioning.ts",
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
  "Normal Stage 2 setup wajib membuat enrollment; agent baru dibuat oleh claim flow Stage 3.",
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

console.log("OK: Hardware Hub provisioning + enrollment boundary contract siap digunakan.");
