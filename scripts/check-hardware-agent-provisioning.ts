import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath: string): string {
  const absolutePath = path.join(projectRoot, relativePath);

  assert(existsSync(absolutePath), `${relativePath} wajib tersedia.`);

  return readFileSync(absolutePath, "utf8");
}

const schemaSource = read("src/db/schema/index.ts");
const seedSource = read("src/db/seed.ts");
const serviceSource = read("src/features/hardware/agent-provisioning.ts");
const actionSource = read("src/app/actions/hardware.ts");
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
  serviceSource.includes("randomBytes(48)"),
  "Credential Hardware Agent wajib dibuat dari 48 random bytes.",
);

assert(
  serviceSource.includes("encryptHardwareAgentSecret"),
  "Credential Hardware Agent wajib dienkripsi sebelum disimpan.",
);

assert(
  serviceSource.includes('"hardware.agent.create"'),
  "Provisioning Hardware Agent wajib membuat audit log.",
);

assert(
  !serviceSource.includes("metadata: {\n          secret:"),
  "Secret Hardware Agent tidak boleh disimpan pada audit metadata.",
);

assert(
  actionSource.includes('requirePermission("hardware.agents.manage")'),
  "Server action provisioning wajib memakai hardware.agents.manage.",
);

assert(
  actionSource.includes("provisionHardwareAgentAction"),
  "Server action provisioning Hardware Agent wajib tersedia.",
);

const journal = JSON.parse(journalSource) as {
  entries?: Array<{ tag?: string }>;
};

assert(
  journal.entries?.some((entry) => entry.tag?.startsWith("0015_")),
  "Migration 0015 Hardware Agent provisioning wajib tercatat di Drizzle journal.",
);

console.log("OK: Hardware Agent web provisioning contract siap digunakan.");
