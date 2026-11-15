import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  collectHardwareInstallerEnvironmentIssues,
  resolveHardwareInstallerDownloadUrl,
  resolveConfiguredHardwareInstallerUrl,
} from "../src/lib/hardware-installer-environment";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

const workflow = read(".github/workflows/build-hardware-hub-installer.yml");
const productionTemplate = read(".env.production.example");
const environmentCli = read("scripts/validate-environment.ts");
const installerRoute = read("src/app/api/hardware/installer/download/route.ts");
const packageJson = JSON.parse(read("hardware-hub/package.json")) as {
  version?: string;
};

assert(
  packageJson.version,
  "hardware-hub/package.json wajib memiliki version release.",
);
const releaseTag = `hardware-hub-v${packageJson.version}`;
const validReleaseUrl = `https://github.com/masacimace/asihjaya-rms/releases/download/${releaseTag}/ASIHJAYA-Hardware-Hub-Setup.exe`;
assert.ok(read(`hardware-hub/installer/release-notes/${packageJson.version}.md`).trim(),
  "Setiap versi installer wajib membawa release notes yang sesuai.");

assert(
  workflow.includes('tags:\n      - "hardware-hub-v*"') &&
    workflow.includes("publish-release:") &&
    workflow.includes("startsWith(github.ref, 'refs/tags/hardware-hub-v')"),
  "Workflow installer wajib memisahkan tagged production release dari build branch/UAT biasa.",
);
assert(
  workflow.includes('git merge-base --is-ancestor "$GITHUB_SHA" origin/main') &&
    workflow.includes('expected_tag="hardware-hub-v${version}"'),
  "Tagged production installer wajib berasal dari commit yang sudah terintegrasi ke main dan tag harus cocok dengan package version.",
);
assert(
  workflow.includes(
    'if ($env:GITHUB_REF -like "refs/tags/hardware-hub-v*" -and $apiUrl -ne "https://ajsystem.id")',
  ) &&
    workflow.includes(
      "Tagged production release wajib embed https://ajsystem.id.",
    ),
  "Tagged installer wajib fail closed jika RMS API bukan https://ajsystem.id.",
);
assert(
  workflow.includes("Verify installer checksum before publishing") &&
    workflow.includes('sha256sum "$setup"') &&
    workflow.includes("tr -d '\\r'") &&
    workflow.includes('[[ ! "$expected" =~ ^[0-9a-f]{64}$ ]]') &&
    workflow.includes('gh release create "$GITHUB_REF_NAME"') &&
    workflow.includes("contents: write"),
  "Production release wajib menormalisasi CRLF checksum lintas Windows/Linux, memvalidasi format SHA-256, lalu publish GitHub Release dengan permission write yang terisolasi pada release job.",
);
assert(
  workflow.includes("actions/upload-artifact@v4") &&
    workflow.includes("retention-days: 14") &&
    workflow.includes("ASIHJAYA-Hardware-Hub-Setup.sha256.txt"),
  "Temporary Actions artifact tetap wajib tersedia untuk review dan membawa checksum.",
);
assert.ok(workflow.includes("npm --prefix hardware-hub run check:ci") &&
  workflow.includes("--notes-file release/RELEASE_NOTES.md"),
  "Build installer wajib menjalankan seluruh Hub checks dan menyertakan release notes versi tersebut.");
assert(
  workflow.includes(
    "Release $GITHUB_REF_NAME already exists; refusing to overwrite immutable production assets.",
  ),
  "Workflow production tidak boleh overwrite release asset immutable yang sudah terbit.",
);

assert.match(
  productionTemplate,
  /^HARDWARE_HUB_INSTALLER_DOWNLOAD_URL=$/m,
  ".env.production.example wajib mendokumentasikan installer release URL sebagai fallback opsional.",
);
assert(
  environmentCli.includes("assertHardwareInstallerEnvironment(process.env);"),
  "Production environment CLI wajib memvalidasi fallback tanpa mewajibkan URL environment.",
);
assert(
  installerRoute.includes("getHardwareInstallerSettings(auth.organization.id)"),
  "Runtime download endpoint wajib membaca link dari organisasi pengguna.",
);

assert.equal(resolveConfiguredHardwareInstallerUrl(validReleaseUrl, {
  HARDWARE_HUB_INSTALLER_DOWNLOAD_URL: "https://example.com/old/ASIHJAYA-Hardware-Hub-Setup.exe",
})?.href, validReleaseUrl, "Link web harus didahulukan dari fallback environment.");
assert.equal(resolveConfiguredHardwareInstallerUrl(validReleaseUrl, {})?.href, validReleaseUrl);
assert.equal(resolveConfiguredHardwareInstallerUrl(null, { HARDWARE_HUB_INSTALLER_DOWNLOAD_URL: validReleaseUrl })?.href, validReleaseUrl);
assert.equal(resolveConfiguredHardwareInstallerUrl(null, {}), null);
assert.equal(resolveConfiguredHardwareInstallerUrl("http://invalid.example/ASIHJAYA-Hardware-Hub-Setup.exe", {
  HARDWARE_HUB_INSTALLER_DOWNLOAD_URL: validReleaseUrl,
}), null, "Data tersimpan yang tidak valid harus ditolak tanpa redirect ke fallback.");
assert.deepEqual(collectHardwareInstallerEnvironmentIssues({}, { required: false }), []);

const settingsAction = read("src/app/actions/hardware-installer-settings.ts");
assert.ok(settingsAction.includes('requirePermission("hardware.agents.manage")') &&
  settingsAction.includes('auth.permissionCodes.includes("admin.access")') &&
  settingsAction.includes("organizationId: auth.organization.id"),
  "Perubahan link wajib dibatasi permission dan organisasi dari session.");

assert.deepEqual(
  collectHardwareInstallerEnvironmentIssues(
    { HARDWARE_HUB_INSTALLER_DOWNLOAD_URL: validReleaseUrl },
    { required: true },
  ),
  [],
  "GitHub Release asset HTTPS yang stabil harus valid.",
);
assert.equal(
  resolveHardwareInstallerDownloadUrl({
    HARDWARE_HUB_INSTALLER_DOWNLOAD_URL: validReleaseUrl,
  })?.href,
  validReleaseUrl,
  "Runtime resolver wajib mengembalikan direct release asset URL yang valid.",
);

for (const invalidUrl of [
  "CHANGE_ME",
  "http://127.0.0.1:3000/ASIHJAYA-Hardware-Hub-Setup.exe",
  "https://github.com/masacimace/asihjaya-rms/actions/runs/123/ASIHJAYA-Hardware-Hub-Setup.exe",
  "https://downloads.example.com/ASIHJAYA-Hardware-Hub-Setup.exe?token=temporary",
  "https://downloads.example.com/not-the-hardware-hub.exe",
]) {
  assert(
    collectHardwareInstallerEnvironmentIssues(
      { HARDWARE_HUB_INSTALLER_DOWNLOAD_URL: invalidUrl },
      { required: true },
    ).length > 0,
    `Installer URL tidak aman wajib ditolak: ${invalidUrl}`,
  );
  assert.equal(
    resolveHardwareInstallerDownloadUrl({
      HARDWARE_HUB_INSTALLER_DOWNLOAD_URL: invalidUrl,
    }),
    null,
    `Runtime resolver wajib fail closed untuk URL tidak aman: ${invalidUrl}`,
  );
}

assert(
  collectHardwareInstallerEnvironmentIssues({}, { required: true }).some(
    (issue) => issue.name === "HARDWARE_HUB_INSTALLER_DOWNLOAD_URL",
  ),
  "Production deployment tanpa installer release URL wajib ditolak.",
);

console.log(
  `OK: Hardware Hub v${packageJson.version} production installer build, immutable GitHub Release, cross-platform checksum, download URL, dan deployment validation contract konsisten.`,
);
