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
const cleanupActions = read("src/app/actions/hardware-cleanup.ts");
const cleanupButtons = read(
  "src/components/hardware/hardware-cleanup-buttons.tsx",
);
const manageDialog = read(
  "src/components/hardware/hardware-hub-manage-dialog.tsx",
);
const reactivate = read(
  "src/components/hardware/hardware-agent-reactivate-button.tsx",
);
const page = read("src/app/(admin)/admin/operasional/hardware/page.tsx");
const posHardwareStatus = read("src/features/pos/shell-hardware-status.ts");
const posLayout = read("src/app/(pos)/pos/layout.tsx");
const posShellRoute = read("src/app/api/pos/shell-status/route.ts");
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

assert(
  posHardwareStatus.includes("getPosShellStatusWithActiveAgent") &&
    posHardwareStatus.includes("eq(hardwareAgents.isActive, true)") &&
    posHardwareStatus.includes("eq(hardwareAgents.outletId, outletId)") &&
    posHardwareStatus.includes("innerJoin(registers"),
  "Status Hardware Hub di POS wajib berasal langsung dari active agent pada outlet POS.",
);
assert(
  !posHardwareStatus.includes("getDefaultPosRegisterCondition") &&
    !posHardwareStatus.includes("eq(hardwareAgents.registerId, register.id)") &&
    !posHardwareStatus.includes("eq(registers.isActive, true)") &&
    !posHardwareStatus.includes("eq(registers.isHardwareHub, true)"),
  "Live status POS tidak boleh digagalkan oleh preselection atau lifecycle register setelah active agent ditemukan.",
);
assert(
  posHardwareStatus.includes("90 * 1000") &&
    posHardwareStatus.includes("5 * 60 * 1000") &&
    posHardwareStatus.includes("activeAgent?.registerName ?? baseStatus.registerName"),
  "Threshold dan register POS wajib mengikuti active agent yang sama dengan dashboard Hardware Hub.",
);
assert(
  posLayout.includes("getPosShellStatusWithActiveAgent") &&
    posShellRoute.includes("getPosShellStatusWithActiveAgent"),
  "Initial POS shell dan live polling wajib memakai active-agent reconciliation yang sama.",
);

assert(
  cleanupActions.includes("deleteFailedHardwareJobAction") &&
    cleanupActions.includes('job.status !== "failed"') &&
    cleanupActions.includes("hardwareJobResolutions") &&
    cleanupActions.includes('"hardware.job_delete_failed"'),
  "Delete individual hardware job wajib hanya menerima status failed, menjaga manual resolution, dan menulis audit log.",
);
assert(
  cleanupActions.includes("purgeInactiveHardwareAgentAction") &&
    cleanupActions.includes('requirePermission("hardware.agents.manage")') &&
    cleanupActions.includes("hardwareJobAttempts") &&
    cleanupActions.includes("hardwareAgentEnrollments") &&
    cleanupActions.includes("hardwareJobs.targetAgentId") &&
    cleanupActions.includes("enrollment.status !== \"completed\"") &&
    cleanupActions.includes(".delete(hardwareAgentEnrollments)") &&
    cleanupActions.includes('"hardware.enrollment_archive_for_agent_purge"') &&
    cleanupActions.includes("Enrollment ${enrollment.id}") &&
    cleanupActions.includes("HardwareCleanupRaceError") &&
    cleanupActions.includes("eq(hardwareAgents.isActive, false)") &&
    cleanupActions.includes('eq(hardwareAgents.status, "disabled")') &&
    cleanupActions.includes('"hardware.agent_purge_inactive"'),
  "Purge Hardware Agent wajib menolak dependency operasional, mengarsipkan completed enrollment, menyebut enrollment non-final secara spesifik, rollback saat race, dan diaudit.",
);
assert(
  cleanupButtons.includes("window.confirm") &&
    cleanupButtons.includes("DeleteFailedHardwareJobButton") &&
    cleanupButtons.includes("PurgeInactiveHardwareAgentButton"),
  "Destructive hardware cleanup UI wajib memakai konfirmasi eksplisit.",
);
assert(
  page.includes("DeleteFailedHardwareJobButton") &&
    page.includes("PurgeInactiveHardwareAgentButton"),
  "Dashboard Hardware Hub wajib mengekspos delete failed job dan safe purge inactive agent.",
);
assert(
  !page.includes("  Clock3,\n"),
  "Hardware Hub page tidak boleh menyisakan import Clock3 yang tidak digunakan.",
);

console.log(
  "OK: Hardware Hub lifecycle, outlet-active POS status, dan guarded cleanup contract siap digunakan.",
);
