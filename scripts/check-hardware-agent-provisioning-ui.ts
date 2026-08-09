import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath: string) {
  const file = path.join(root, relativePath);

  assert(existsSync(file), `${relativePath} tidak ditemukan.`);

  return readFileSync(file, "utf8");
}

const page = read("src/app/(admin)/admin/operasional/hardware/page.tsx");

const component = read(
  "src/components/hardware/hardware-agent-provisioning-dialog.tsx",
);

const queries = read("src/features/hardware/queries.ts");

assert(
  page.includes("HardwareAgentProvisioningDialog"),
  "Hardware Hub page wajib menampilkan provisioning dialog.",
);

assert(
  page.includes('"hardware.agents.manage"'),
  "Provisioning UI wajib dibatasi permission hardware.agents.manage.",
);

assert(
  queries.includes("getHardwareAgentProvisioningOptions"),
  "Provisioning options query wajib tersedia.",
);

assert(
  queries.includes("eq(hardwareAgents.isActive, true)"),
  "Provisioning options wajib mendeteksi active agent per register.",
);

assert(
  component.includes("provisionHardwareAgentAction"),
  "Provisioning dialog wajib memakai server action.",
);

assert(
  component.includes("Download hardware-hub.env"),
  "Provisioning dialog wajib menyediakan download konfigurasi.",
);

assert(
  component.includes("HARDWARE_ADAPTER_MODE=fake"),
  "Credential download wajib menggunakan safe-first fake adapter.",
);

assert(
  component.includes("HARDWARE_AGENT_REQUEST_AUTH_MODE=signed"),
  "Credential download wajib menggunakan signed authentication.",
);

assert(
  component.includes("window.location.assign"),
  "One-time credential harus dibersihkan dari client state setelah selesai.",
);

assert(
  !page.includes("npm run hardware:agent:create"),
  "Dashboard tidak boleh lagi mengarahkan provisioning normal ke CLI.",
);

console.log("OK: Hardware Agent provisioning UI contract siap digunakan.");
