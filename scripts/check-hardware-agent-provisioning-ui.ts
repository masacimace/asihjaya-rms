import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  assert(existsSync(file), `${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

const page = read("src/app/(admin)/admin/operasional/hardware/page.tsx");
const setupDialog = read(
  "src/components/hardware/hardware-hub-setup-dialog.tsx",
);
const manageDialog = read(
  "src/components/hardware/hardware-hub-manage-dialog.tsx",
);
const provisioningOptions = read(
  "src/features/hardware/provisioning-options.ts",
);
const provisioningAction = read(
  "src/app/actions/hardware-hub-provisioning.ts",
);

assert(
  page.includes("HardwareHubSetupDialog"),
  "Hardware Hub page wajib memakai setup flow sederhana.",
);
assert(
  page.includes('"hardware.agents.manage"'),
  "Setup Hardware Hub wajib dibatasi permission hardware.agents.manage.",
);
assert(
  page.includes("Diagnostik Lanjutan"),
  "Informasi teknis wajib dipindahkan ke area Diagnostik Lanjutan.",
);
assert(
  page.includes("Sistem hardware berjalan normal") &&
    page.includes("indikator perlu diperiksa"),
  "Halaman utama wajib memprioritaskan ringkasan kesehatan yang mudah dipahami.",
);
assert(
  !page.includes("HardwareAgentProvisioningDialog"),
  "Halaman utama tidak boleh lagi memakai provisioning dialog developer-oriented lama.",
);
assert(
  provisioningOptions.includes("eq(registers.isHardwareHub, true)"),
  "Provisioning options wajib dibatasi ke dedicated Hardware Hub register.",
);
assert(
  setupDialog.includes("Siapkan Hardware Hub"),
  "CTA utama wajib menggunakan istilah user-facing Siapkan Hardware Hub.",
);
assert(
  !setupDialog.includes("Kode Agent") &&
    setupDialog.includes('type="hidden"') &&
    setupDialog.includes('name="code"'),
  "Kode agent wajib dibuat otomatis dan tidak diminta dari staff.",
);
assert(
  !setupDialog.includes("Nama perangkat") && setupDialog.includes('name="name"'),
  "Nama agent wajib dibuat otomatis dan tidak menjadi field setup staff.",
);
assert(
  provisioningAction.includes("provisionDedicatedHardwareHub"),
  "Setup UI wajib melewati server-side dedicated register guard.",
);
assert(
  manageDialog.includes("Ganti Mini PC") &&
    manageDialog.includes("Perbarui Akses") &&
    manageDialog.includes("Nonaktifkan Hardware Hub"),
  "Lifecycle controls wajib tetap tersedia pada UI Kelola terpisah.",
);
assert(
  !page.includes("npm run hardware:agent:create"),
  "Dashboard tidak boleh mengarahkan normal onboarding ke CLI.",
);

console.log("OK: Hardware Hub Stage 1 UI simplification contract siap digunakan.");
