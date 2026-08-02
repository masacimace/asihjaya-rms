import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const expectedNodeVersion = "24.14.0";
const expectedNpmVersion = "11.9.0";
const expectedPlaywrightVersion = "1.61.0";
const expectedSheetJsVersion = "0.20.3";
const vendoredSheetJs = `file:vendor/xlsx-${expectedSheetJsVersion}.tgz`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readText(relativePath: string): string {
  const absolutePath = path.join(projectRoot, relativePath);
  assert(existsSync(absolutePath), `${relativePath} wajib tersedia.`);
  return readFileSync(absolutePath, "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

type PackageJson = {
  packageManager?: string;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

type PackageLock = {
  lockfileVersion?: number;
  packages?: Record<
    string,
    {
      dependencies?: Record<string, string>;
      engines?: Record<string, string>;
      version?: string;
      resolved?: string;
      integrity?: string;
    }
  >;
};

const packageJson = readJson<PackageJson>("package.json");
const packageLock = readJson<PackageLock>("package-lock.json");
const nvmVersion = readText(".nvmrc").trim();
const npmrc = readText(".npmrc");
const dockerfile = readText("Dockerfile");
const dockerignore = readText(".dockerignore");
const workflow = readText(".github/workflows/ci.yml");

assert(nvmVersion === expectedNodeVersion, `.nvmrc harus ${expectedNodeVersion}.`);
assert(
  packageJson.packageManager === `npm@${expectedNpmVersion}`,
  `packageManager harus npm@${expectedNpmVersion}.`,
);
assert(
  packageJson.engines?.node === ">=24.14.0 <25",
  "engines.node harus >=24.14.0 <25.",
);
assert(
  packageJson.engines?.npm === ">=11.9.0 <12",
  "engines.npm harus >=11.9.0 <12.",
);
assert(packageLock.lockfileVersion === 3, "package-lock.json harus memakai lockfileVersion 3.");
assert(
  packageLock.packages?.[""]?.engines?.node === packageJson.engines?.node &&
    packageLock.packages?.[""]?.engines?.npm === packageJson.engines?.npm,
  "Engine root package-lock.json harus selaras dengan package.json.",
);

for (const requiredSetting of [
  "engine-strict=true",
  "fund=false",
  "package-lock=true",
  "save-exact=true",
  "update-notifier=false",
]) {
  assert(npmrc.includes(requiredSetting), `.npmrc wajib memuat ${requiredSetting}.`);
}

const runtimeNode = process.versions.node;
assert(
  runtimeNode === expectedNodeVersion,
  `Runtime Node harus ${expectedNodeVersion}, ditemukan ${runtimeNode}. Gunakan versi dari .nvmrc.`,
);
function isSupportedNpmRuntime(version: string): boolean {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return false;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major === 11 && minor >= 9;
}

const npmUserAgent = process.env.npm_config_user_agent;
if (npmUserAgent) {
  const runtimeNpm = npmUserAgent.match(/(?:^|\s)npm\/([^\s]+)/)?.[1];
  assert(
    runtimeNpm !== undefined && isSupportedNpmRuntime(runtimeNpm),
    `Runtime npm harus >=11.9.0 <12, ditemukan ${runtimeNpm ?? "unknown"}.`,
  );
}

assert(
  packageJson.dependencies?.playwright === expectedPlaywrightVersion,
  `Dependency Playwright harus dipin ke ${expectedPlaywrightVersion}.`,
);
assert(
  dockerfile.includes(`mcr.microsoft.com/playwright:v${expectedPlaywrightVersion}-noble`),
  "Docker image Playwright harus selaras dengan dependency runtime.",
);
assert(
  dockerfile.includes(`ARG NPM_VERSION=${expectedNpmVersion}`),
  "Dockerfile harus mengunci versi npm toolchain.",
);
assert(
  dockerfile.includes("COPY package.json package-lock.json .npmrc ./"),
  "Docker dependency stage harus menerima package files dan .npmrc saja sebelum npm ci.",
);
assert(dockerfile.includes("npm ci"), "Dockerfile wajib memasang dependency melalui npm ci.");
assert(
  dockerfile.includes("FROM toolchain AS builder"),
  "Docker builder harus memakai npm toolchain yang sama dengan dependency stage.",
);

for (const ignoredPath of [
  ".git",
  ".github",
  ".next",
  ".data",
  ".env*",
  "node_modules",
  "hardware-hub",
  "coverage",
  "playwright-report",
  "test-results",
]) {
  assert(dockerignore.includes(ignoredPath), `.dockerignore wajib mengecualikan ${ignoredPath}.`);
}

const dockerignoreRules = dockerignore
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));
assert(
  !dockerignoreRules.includes("tests") && !dockerignoreRules.includes("tests/"),
  ".dockerignore tidak boleh mengecualikan seluruh folder tests karena runner TypeScript mengimpor tests/integration saat next build.",
);
assert(
  dockerfile.includes("COPY . ."),
  "Docker builder harus menyalin source dan integration suites sebelum build.",
);

assert(workflow.includes("node-version-file: .nvmrc"), "CI harus membaca versi Node dari .nvmrc.");
assert(workflow.includes("  container-build:"), "CI wajib memiliki job container-build.");
assert(workflow.includes("docker build --pull"), "CI wajib membangun production container dari nol.");
assert(
  workflow.includes("npm run build:clean"),
  "CI static quality harus memakai clean production build.",
);

assert(
  packageJson.dependencies?.xlsx === vendoredSheetJs,
  `Dependency xlsx harus ${vendoredSheetJs}. Jalankan npm run vendor:xlsx.`,
);
const vendorArchivePath = path.join(
  projectRoot,
  "vendor",
  `xlsx-${expectedSheetJsVersion}.tgz`,
);
assert(existsSync(vendorArchivePath), "Archive SheetJS vendored belum tersedia. Jalankan npm run vendor:xlsx.");
const vendorBytes = readFileSync(vendorArchivePath);
const vendorDigest = createHash("sha512").update(vendorBytes);
const vendorIntegrity = `sha512-${vendorDigest.copy().digest("base64")}`;
const vendorDigestHex = vendorDigest.digest("hex");
const checksumPath = path.join(
  projectRoot,
  "vendor",
  `xlsx-${expectedSheetJsVersion}.sha512`,
);
assert(existsSync(checksumPath), "Checksum SheetJS vendored belum tersedia.");
assert(
  readFileSync(checksumPath, "utf8").trim() ===
    `${vendorDigestHex}  vendor/xlsx-${expectedSheetJsVersion}.tgz`,
  "Checksum SheetJS vendored tidak cocok dengan archive.",
);
const lockEntry = packageLock.packages?.["node_modules/xlsx"];
assert(lockEntry?.version === expectedSheetJsVersion, "Versi SheetJS pada lockfile tidak sesuai.");
assert(lockEntry?.resolved === vendoredSheetJs, "Resolved SheetJS pada lockfile harus file lokal.");
assert(lockEntry?.integrity === vendorIntegrity, "Integrity SheetJS vendored tidak cocok dengan lockfile.");
assert(
  packageLock.packages?.[""]?.dependencies?.xlsx === vendoredSheetJs,
  "Root package-lock.json harus menunjuk SheetJS vendored.",
);

for (const requiredScript of [
  "clean",
  "build:clean",
  "vendor:xlsx",
  "check:build-baseline",
]) {
  assert(packageJson.scripts?.[requiredScript], `package.json wajib memiliki script ${requiredScript}.`);
}

console.log(
  `OK: build baseline konsisten pada Node ${expectedNodeVersion}, npm ${expectedNpmVersion}, Playwright ${expectedPlaywrightVersion}, dan SheetJS vendored ${expectedSheetJsVersion}.`,
);
