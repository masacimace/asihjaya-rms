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
const installerDownloadRoute = read(
  "src/app/api/hardware/installer/download/route.ts",
);
const installerEnvironmentPolicy = read(
  "src/lib/hardware-installer-environment.ts",
);
const manageDialog = read(
  "src/components/hardware/hardware-hub-manage-dialog.tsx",
);
const provisioningOptions = read(
  "src/features/hardware/provisioning-options.ts",
);
const enrollmentAction = read(
  "src/app/actions/hardware-hub-provisioning.ts",
);
const enrollmentService = read(
  "src/features/hardware/agent-enrollment.ts",
);
const enrollmentCode = read(
  "src/lib/hardware/enrollment-code.ts",
);
const enrollmentSchema = read(
  "src/db/schema/hardware-enrollment.ts",
);
const enrollmentMigration = read(
  "drizzle/0026_hardware_agent_enrollments.sql",
);
const journal = read("drizzle/meta/_journal.json");

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
  "Informasi teknis wajib tetap berada di area Diagnostik Lanjutan.",
);
assert(
  !page.includes("HardwareAgentProvisioningDialog"),
  "Halaman utama tidak boleh kembali memakai provisioning dialog developer-oriented lama.",
);

assert(
  provisioningOptions.includes("eq(registers.isHardwareHub, true)"),
  "Provisioning options wajib dibatasi ke dedicated Hardware Hub register.",
);
assert(
  provisioningOptions.includes("pendingEnrollment"),
  "Provisioning options wajib mengetahui setup yang masih menunggu Mini PC.",
);

assert(
  setupDialog.includes("Buat Installation Code") &&
    setupDialog.includes("Installation Code"),
  "Normal onboarding wajib menggunakan Installation Code.",
);
assert(
  setupDialog.includes("/api/hardware/installer/download") &&
    setupDialog.includes("Download ASIHJAYA Hardware Hub Setup") &&
    setupDialog.includes("Run as administrator"),
  "Stage 5 setup UI wajib menyediakan download Setup.exe dan panduan original-user UAC.",
);
assert(
  installerDownloadRoute.includes('hasPermission(auth, "hardware.agents.manage")') &&
    installerDownloadRoute.includes("resolveHardwareInstallerDownloadUrl(process.env)") &&
    installerDownloadRoute.includes("NextResponse.redirect"),
  "Installer download redirect wajib permission-gated dan memakai shared server-side URL policy.",
);
assert(
  installerEnvironmentPolicy.includes("HARDWARE_HUB_INSTALLER_DOWNLOAD_URL") &&
    installerEnvironmentPolicy.includes('url.protocol !== "https:"') &&
    installerEnvironmentPolicy.includes("isLoopbackHostname(url.hostname)") &&
    installerEnvironmentPolicy.includes('url.pathname.includes("/actions/")') &&
    installerEnvironmentPolicy.includes("/ASIHJAYA-Hardware-Hub-Setup.exe"),
  "Shared installer URL policy wajib menerima hanya stable HTTPS Setup.exe non-loopback dan menolak Actions artifact sementara.",
);
assert(
  setupDialog.includes("revokeHardwareHubEnrollmentAction"),
  "Installation Code aktif wajib dapat dibatalkan dari setup UI.",
);
assert(
  !setupDialog.includes("HARDWARE_AGENT_SECRET") &&
    !setupDialog.includes("HARDWARE_AGENT_ID=") &&
    !setupDialog.includes("Download Konfigurasi") &&
    !setupDialog.includes("hardware-hub.env"),
  "Normal onboarding tidak boleh mengekspos Agent ID/Secret atau download .env.",
);

assert(
  enrollmentAction.includes("createHardwareAgentEnrollment") &&
    !enrollmentAction.includes("provisionHardwareAgent") &&
    !enrollmentAction.includes("provisionDedicatedHardwareHub"),
  "Setup action Stage 2 hanya boleh membuat enrollment; agent dibuat saat installer claim pada Stage 3.",
);
assert(
  enrollmentAction.includes('requirePermission("hardware.agents.manage")'),
  "Create/revoke enrollment wajib dilindungi hardware.agents.manage.",
);

assert(
  enrollmentCode.includes("createHmac") &&
    enrollmentCode.includes("HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY") &&
    enrollmentCode.includes("asihjaya-hardware-enrollment-code-v1"),
  "Installation Code wajib disimpan sebagai domain-separated keyed hash.",
);
assert(
  enrollmentCode.includes("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") &&
    enrollmentCode.includes("AJ-"),
  "Installation Code wajib human-friendly dan menghindari karakter ambigu.",
);

assert(
  enrollmentService.includes("HARDWARE_ENROLLMENT_TTL_MINUTES = 20"),
  "Installation Code wajib memiliki TTL pendek 20 menit.",
);
assert(
  enrollmentService.includes("eq(registers.isHardwareHub") ||
    enrollmentService.includes("!register.isHardwareHub"),
  "Enrollment service wajib enforce dedicated Hardware Hub register.",
);
assert(
  enrollmentService.includes('status: "revoked"') &&
    enrollmentService.includes('status: "expired"'),
  "Enrollment lifecycle wajib mendukung revoke dan expiry.",
);
assert(
  enrollmentService.includes('"hardware.enrollment.create"') &&
    enrollmentService.includes('"hardware.enrollment.revoke"'),
  "Create/revoke enrollment wajib diaudit.",
);

assert(
  enrollmentSchema.includes('"hardware_agent_enrollments"') &&
    enrollmentSchema.includes("hardware_agent_enrollments_one_pending_per_register_uq") &&
    enrollmentSchema.includes("claimedByInstanceId") &&
    enrollmentSchema.includes("agentId"),
  "Schema enrollment wajib mendukung one-pending-per-register dan Stage 3 idempotent claim binding.",
);
assert(
  enrollmentMigration.includes('CREATE TABLE "hardware_agent_enrollments"') &&
    !/DROP\s+(TABLE|COLUMN|TYPE|CONSTRAINT)/i.test(enrollmentMigration) &&
    !/DELETE\s+FROM/i.test(enrollmentMigration),
  "Migration enrollment wajib additive-only dan tidak menambah operasi destruktif.",
);
assert(
  journal.includes('"tag": "0026_hardware_agent_enrollments"') &&
    existsSync(path.join(root, "drizzle/meta/0026_snapshot.json")),
  "Migration enrollment wajib memiliki journal entry dan snapshot Drizzle canonical.",
);

assert(
  manageDialog.includes("Ganti Mini PC") &&
    manageDialog.includes("Perbarui Akses") &&
    manageDialog.includes("Nonaktifkan Hardware Hub"),
  "Lifecycle controls existing wajib tetap tersedia pada UI Kelola terpisah.",
);
assert(
  !page.includes("npm run hardware:agent:create"),
  "Dashboard tidak boleh mengarahkan normal onboarding ke CLI.",
);

console.log(
  "OK: Hardware Hub Installation Code + stable native Setup.exe download contract siap digunakan.",
);
