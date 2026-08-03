import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const scriptsRoot = path.join(projectRoot, "scripts");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson<T>(relativePath: string): T {
  const absolutePath = path.join(projectRoot, relativePath);
  assert(existsSync(absolutePath), `${relativePath} wajib tersedia.`);
  return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
}

type PackageJson = {
  scripts?: Record<string, string>;
};

type CheckManifest = {
  version: number;
  blocking: string[];
  infrastructure: string[];
  manual: string[];
};

const packageJson = readJson<PackageJson>("package.json");
const hardwarePackageJson = readJson<PackageJson>("hardware-hub/package.json");
const manifest = readJson<CheckManifest>("scripts/check-suite-manifest.json");

assert(manifest.version === 2, "Versi check-suite manifest belum didukung.");

const checkFiles = readdirSync(scriptsRoot)
  .filter((fileName) => /^check-.*\.(?:ts|tsx|js|mjs|cjs)$/.test(fileName))
  .sort();

const classifiedFiles = [
  ...manifest.blocking,
  ...manifest.infrastructure,
  ...manifest.manual,
];
const classifiedSet = new Set(classifiedFiles);

assert(
  classifiedSet.size === classifiedFiles.length,
  "Setiap check script hanya boleh berada dalam satu kategori manifest.",
);

const unclassified = checkFiles.filter((fileName) => !classifiedSet.has(fileName));
const missing = classifiedFiles.filter((fileName) => !checkFiles.includes(fileName));

assert(
  unclassified.length === 0,
  `Check script belum diklasifikasikan: ${unclassified.join(", ")}`,
);
assert(
  missing.length === 0,
  `Manifest menunjuk check script yang tidak tersedia: ${missing.join(", ")}`,
);

const requiredRootScripts = [
  "check:quality-config",
  "check:build-baseline",
  "check:production-container",
  "check:production-environment",
  "check:source-hygiene",
  "check:database",
  "check:database:live",
  "check:quality",
  "check:security",
  "check:environment",
  "check:pos-stage-1c",
  "check:transactions",
  "check:business",
  "check:hardware-app",
  "check:hardware",
  "check:manual",
  "check:static",
  "check:all",
  "test:financial",
  "test:financial:local",
  "check:critical",
  "verify:pos-stage-1c",
  "verify:pos-stage-1c:local",
  "container:production:config",
  "container:production:build",
  "container:production:up",
  "container:production:down",
  "test:container:production:local",
  "env:validate",
  "env:validate:production",
  "env:generate-secrets",
  "env:prepare:production",
];

for (const scriptName of requiredRootScripts) {
  assert(
    packageJson.scripts?.[scriptName],
    `package.json wajib memiliki script ${scriptName}.`,
  );
}

assert(
  hardwarePackageJson.scripts?.["check:ci"],
  "hardware-hub/package.json wajib memiliki script check:ci.",
);

for (const [scriptName, command] of Object.entries(packageJson.scripts ?? {})) {
  assert(
    !/(?:^|\s)npx(?:\s|$)/.test(command),
    `Script ${scriptName} tidak boleh memakai npx; gunakan binary dependency lokal melalui npm script.`,
  );
}

const rootCommands = Object.values(packageJson.scripts ?? {}).join("\n");
for (const fileName of classifiedFiles) {
  assert(
    rootCommands.includes(`scripts/${fileName}`),
    `Check script ${fileName} wajib dapat dijalankan melalui package.json.`,
  );
}

const workflowPath = ".github/workflows/ci.yml";
const workflow = readFileSync(path.join(projectRoot, workflowPath), "utf8");
for (const jobId of [
  "static-quality",
  "security-business",
  "database-migrations",
  "financial-concurrency",
  "hardware-hub",
  "container-build",
]) {
  assert(
    workflow.includes(`  ${jobId}:`),
    `${workflowPath} wajib memiliki job ${jobId}.`,
  );
}

assert(
  workflow.includes('- "infra/**"'),
  `${workflowPath} wajib berjalan pada branch infrastructure.`,
);

for (const actionReference of ["actions/checkout@v6", "actions/setup-node@v6"]) {
  assert(
    workflow.includes(actionReference),
    `${workflowPath} wajib memakai ${actionReference}.`,
  );
}

assert(
  workflow.includes("postgres:17"),
  `${workflowPath} wajib melakukan rehearsal dengan PostgreSQL 17.`,
);
assert(
  workflow.includes("npm ci"),
  `${workflowPath} wajib menginstal dependency melalui npm ci.`,
);
assert(
  workflow.includes("npm run db:migrate"),
  `${workflowPath} wajib menjalankan migration nyata.`,
);
assert(
  workflow.includes("npm run check:database:live"),
  `${workflowPath} wajib memeriksa schema hasil migration.`,
);
assert(
  workflow.includes("npm run check:hardware-app"),
  `${workflowPath} wajib menjalankan kontrak hardware sisi aplikasi.`,
);
assert(
  workflow.includes("npm run env:validate -- --mode production"),
  `${workflowPath} wajib memvalidasi environment production.`,
);
assert(
  workflow.includes("docker compose -f compose.production.yaml config --quiet"),
  `${workflowPath} wajib memvalidasi Compose tanpa mencetak resolved secret.`,
);

for (const documentationPath of [
  "docs/development/quality-gates.md",
  "docs/development/environment-configuration.md",
  "docs/development/financial-concurrency-tests.md",
  "docs/development/pos-stage-1c-stabilization.md",
  "docs/development/production-container.md",
  "docs/development/production-environment.md",
  ".github/pull_request_template.md",
  "README.md",
]) {
  assert(existsSync(path.join(projectRoot, documentationPath)), `${documentationPath} wajib tersedia.`);
}

console.log(
  `OK: ${checkFiles.length} check script telah diklasifikasikan dan konfigurasi quality gate konsisten.`,
);
