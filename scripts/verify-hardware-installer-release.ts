import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  collectHardwareInstallerEnvironmentIssues,
  resolveHardwareInstallerDownloadUrl,
} from "../src/lib/hardware-installer-environment";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const workflow = read(".github/workflows/build-hardware-hub-installer.yml");
const productionTemplate = read(".env.production.example");
const environmentCli = read("scripts/validate-environment.ts");
const installerRoute = read("src/app/api/hardware/installer/download/route.ts");
const packageJson = JSON.parse(read("hardware-hub/package.json")) as {
  version?: string;
};

assert(packageJson.version, "hardware-hub/package.json wajib memiliki version release.");
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
  workflow.includes('if ($env:GITHUB_REF -like "refs/tags/hardware-hub-v*" -and $apiUrl -ne "https://ajsystem.id")') &&
    workflow.includes("Tagged production release wajib embed https://ajsystem.id."),
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
assert(
  workflow.includes("Release $GITHUB_REF_NAME already exists; refusing to overwrite immutable production assets."),
  "Workflow production tidak boleh overwrite release asset immutable yang sudah terbit.",
);

assert.match(
  productionTemplate,
  /^HARDWARE_HUB_INSTALLER_DOWNLOAD_URL=CHANGE_ME$/m,
  ".env.production.example wajib mendokumentasikan installer release URL sebagai deployment-specific value.",
);
assert(
  productionTemplate.includes("/releases/download/hardware-hub-v0.9.0/ASIHJAYA-Hardware-Hub-Setup.exe"),
  "Production template wajib menjelaskan bentuk GitHub Release asset URL yang stabil.",
);
assert(
  environmentCli.includes("assertHardwareInstallerEnvironment") &&
    environmentCli.includes("required: requireDeployment"),
  "Production environment CLI wajib mewajibkan installer release URL pada deployment profile.",
);
assert(
  installerRoute.includes("resolveHardwareInstallerDownloadUrl(process.env)"),
  "Runtime download endpoint wajib memakai URL policy yang sama dengan production validator.",
);

const validReleaseUrl =
  "https://github.com/masacimace/asihjaya-rms/releases/download/hardware-hub-v0.9.0/ASIHJAYA-Hardware-Hub-Setup.exe";
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
