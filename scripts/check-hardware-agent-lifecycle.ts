import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  assert(existsSync(file), `${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

const service = read("src/features/hardware/agent-lifecycle.ts");
const actions = read("src/app/actions/hardware-agent-lifecycle.ts");
const manageDialog = read(
  "src/components/hardware/hardware-hub-manage-dialog.tsx",
);
const reactivate = read(
  "src/components/hardware/hardware-agent-reactivate-button.tsx",
);
const page = read("src/app/(admin)/admin/operasional/hardware/page.tsx");
const schema = read("src/db/schema/index.ts");

assert(
  service.includes("rotateHardwareAgentCredential"),
  "Rotate credential service wajib tersedia.",
);
assert(
  service.includes("disableHardwareAgent"),
  "Disable agent service wajib tersedia.",
);
assert(
  service.includes("replaceHardwareAgentDevice"),
  "Replace device service wajib tersedia.",
);
assert(
  service.includes("reactivateHardwareAgent"),
  "Reactivate agent service wajib tersedia.",
);
assert(
  service.includes('"hardware.agent.reactivate"'),
  "Reactivate agent wajib diaudit.",
);
assert(
  service.includes('"REGISTER_OCCUPIED"'),
  "Reactivate wajib menolak register yang masih memiliki active agent.",
);
assert(
  service.includes("lastSeenAt: null") &&
    service.includes("lastIpAddress: null") &&
    service.includes("lastUserAgent: null"),
  "Reactivate wajib mereset presence lama.",
);
assert(
  service.includes("capabilities: {}"),
  "Reactivate wajib menghapus capability stale sampai heartbeat baru.",
);
assert(
  service.includes("randomBytes(48)"),
  "Lifecycle credential wajib menggunakan secret random kuat.",
);
assert(
  service.includes("encryptHardwareAgentSecret"),
  "Lifecycle credential wajib dienkripsi sebelum disimpan.",
);
assert(
  actions.includes("reactivateHardwareAgentAction"),
  "Reactivate server action wajib tersedia.",
);
assert(
  actions.includes('requirePermission("hardware.agents.manage")'),
  "Lifecycle actions wajib memakai permission hardware.agents.manage.",
);
assert(
  reactivate.includes("Aktifkan Ulang"),
  "Disabled Hardware Hub UI wajib menyediakan Aktifkan Ulang.",
);
assert(
  page.includes("HardwareAgentReactivateButton"),
  "Riwayat perangkat wajib tetap menyediakan reactivation UI.",
);
assert(
  page.includes("HardwareHubManageDialog"),
  "Active Hardware Hub wajib menyediakan UI Kelola yang terpisah dari onboarding.",
);
assert(
  manageDialog.includes("Perbarui Akses") &&
    manageDialog.includes("Ganti Mini PC") &&
    manageDialog.includes("Nonaktifkan Hardware Hub"),
  "Lifecycle controls wajib tetap tersedia di dialog Kelola.",
);
assert(
  manageDialog.includes("rotateHardwareAgentCredentialAction") &&
    manageDialog.includes("replaceHardwareAgentDeviceAction") &&
    manageDialog.includes("disableHardwareAgentAction"),
  "UI Kelola wajib tetap memakai lifecycle server actions existing.",
);
assert(
  schema.includes("hardware_agents_one_active_per_register_uq"),
  "DB guard satu active agent/register wajib tetap tersedia.",
);

console.log(
  "OK: Hardware Hub lifecycle + simplified management contract siap digunakan.",
);
