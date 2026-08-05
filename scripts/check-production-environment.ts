import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CORE_SECRET_NAMES,
  GENERATED_PRODUCTION_SECRET_NAMES,
  PRODUCTION_ENVIRONMENT_TEMPLATE_NAMES,
  assertServerEnvironment,
  collectServerEnvironmentIssues,
} from "../src/lib/env";

function parseEnvironment(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const name = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[name] = value;
  }
  return result;
}

const projectRoot = process.cwd();
const productionTemplatePath = path.join(projectRoot, ".env.production.example");
const templateContent = readFileSync(productionTemplatePath, "utf8");
const templateEnvironment = parseEnvironment(templateContent);

function run(
  command: string,
  args: string[],
  options: { cwd?: string; allowFailure?: boolean } = {},
) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    encoding: "utf8",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} gagal dengan exit code ${result.status}.\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

function assertOutputDoesNotContainSecrets(
  output: string,
  environment: Record<string, string>,
): void {
  for (const name of GENERATED_PRODUCTION_SECRET_NAMES) {
    const value = environment[name];
    if (value && value !== "CHANGE_ME") {
      assert(
        !output.includes(value),
        `Output generator tidak boleh membocorkan value ${name}.`,
      );
    }
  }
}

const templateNames = Object.keys(templateEnvironment);
assert.equal(
  new Set(templateNames).size,
  templateNames.length,
  ".env.production.example tidak boleh memiliki variable duplikat.",
);
for (const name of PRODUCTION_ENVIRONMENT_TEMPLATE_NAMES) {
  assert(
    Object.hasOwn(templateEnvironment, name),
    `.env.production.example wajib mendokumentasikan ${name}.`,
  );
}

for (const name of GENERATED_PRODUCTION_SECRET_NAMES) {
  assert.equal(
    templateEnvironment[name],
    "CHANGE_ME",
    `.env.production.example wajib memakai CHANGE_ME untuk ${name}.`,
  );
}
assert.equal(templateEnvironment.NODE_ENV, "production");
assert.equal(templateEnvironment.ASIHJAYA_BIND_ADDRESS, "127.0.0.1");
assert.equal(templateEnvironment.ASIHJAYA_MIGRATOR_IMAGE, "asihjaya-rms-migrator:production");
assert.equal(templateEnvironment.APP_RELEASE_ID, "unknown");
assert.equal(templateEnvironment.DATABASE_MIGRATION_ALLOW_DESTRUCTIVE, "false");
assert.equal(templateEnvironment.DATABASE_MIGRATION_APPROVAL_REFERENCE, "");
assert.equal(templateEnvironment.DATABASE_BACKUP_ROOT, ".data/backups/postgres");
assert.equal(templateEnvironment.DATABASE_BACKUP_KIND, "daily");
assert.equal(templateEnvironment.DATABASE_BACKUP_COMPRESSION_LEVEL, "6");
assert.equal(templateEnvironment.DATABASE_BACKUP_DAILY_RETENTION_DAYS, "7");
assert.equal(templateEnvironment.DATABASE_BACKUP_WEEKLY_RETENTION_WEEKS, "4");
assert.equal(templateEnvironment.DATABASE_BACKUP_OFFSITE_ENABLED, "false");
assert.equal(templateEnvironment.DATABASE_BACKUP_OFFSITE_PROVIDER, "backblaze-b2");
assert.equal(templateEnvironment.DATABASE_BACKUP_OFFSITE_ACCESS_KEY_ID, "CHANGE_ME");
assert.equal(templateEnvironment.DATABASE_BACKUP_OFFSITE_SECRET_ACCESS_KEY, "CHANGE_ME");
assert.equal(templateEnvironment.DATABASE_BACKUP_OFFSITE_OBJECT_LOCK_MODE, "COMPLIANCE");
assert.equal(templateEnvironment.DATABASE_BACKUP_OFFSITE_OBJECT_LOCK_DAYS, "14");
assert.equal(templateEnvironment.DATABASE_BACKUP_OFFSITE_FULL_VERIFY, "true");
assert.equal(templateEnvironment.DATABASE_RESTORE_ALLOW_PRODUCTION, "false");
assert.equal(templateEnvironment.DATABASE_RESTORE_APPROVAL_REFERENCE, "");
assert.equal(templateEnvironment.TRUST_PROXY, "true");
assert.equal(templateEnvironment.ASIHJAYA_ENV_FILE, ".env.production");

const gitIgnore = readFileSync(path.join(projectRoot, ".gitignore"), "utf8");
assert.match(gitIgnore, /^\.env\.\*$/m);
assert.match(gitIgnore, /^!\.env\.production\.example$/m);
assert.equal(
  run("git", ["check-ignore", "-q", ".env.production"], {
    allowFailure: true,
  }).status,
  0,
  ".env.production wajib di-ignore oleh Git.",
);
assert.notEqual(
  run("git", ["check-ignore", "-q", ".env.production.example"], {
    allowFailure: true,
  }).status,
  0,
  ".env.production.example wajib dapat dilacak Git.",
);

const dockerIgnore = readFileSync(path.join(projectRoot, ".dockerignore"), "utf8");
assert.match(dockerIgnore, /^\.env\*$/m);
assert.doesNotMatch(dockerIgnore, /^!\.env\.production/m);

const dockerfile = readFileSync(path.join(projectRoot, "Dockerfile"), "utf8");
assert.doesNotMatch(dockerfile, /COPY\s+.*\.env/i);
for (const name of [
  ...CORE_SECRET_NAMES,
  "POSTGRES_PASSWORD",
  "DATABASE_BACKUP_OFFSITE_ACCESS_KEY_ID",
  "DATABASE_BACKUP_OFFSITE_SECRET_ACCESS_KEY",
]) {
  assert(
    !dockerfile.includes(name),
    `Dockerfile tidak boleh menerima atau menyimpan ${name}.`,
  );
}

const compose = readFileSync(path.join(projectRoot, "compose.production.yaml"), "utf8");
assert.match(compose, /env_file:\s*\n\s*- \$\{ASIHJAYA_ENV_FILE:-\.env\.production\}/);
for (const name of CORE_SECRET_NAMES) {
  assert(
    !compose.includes(`${name}:`),
    `compose.production.yaml tidak boleh menanam ${name} secara langsung.`,
  );
}

const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, "package.json"), "utf8"),
) as { scripts?: Record<string, string> };
assert.match(
  packageJson.scripts?.["container:production:config"] ?? "",
  /config --quiet$/,
  "container:production:config wajib memakai --quiet agar secret tidak tercetak.",
);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "asihjaya-production-env-"));
const generatedPath = path.join(temporaryRoot, ".env.production");
try {
  const generation = run(process.execPath, [
    "scripts/generate-environment-secrets.mjs",
    "--write",
    generatedPath,
    "--template",
    productionTemplatePath,
  ]);
  const generatedContent = readFileSync(generatedPath, "utf8");
  const generatedEnvironment = parseEnvironment(generatedContent);
  const generationOutput = `${generation.stdout}\n${generation.stderr}`;
  assertOutputDoesNotContainSecrets(generationOutput, generatedEnvironment);

  for (const name of GENERATED_PRODUCTION_SECRET_NAMES) {
    const value = generatedEnvironment[name];
    assert(value && value !== "CHANGE_ME", `${name} wajib berhasil digenerate.`);
  }
  for (const name of CORE_SECRET_NAMES) {
    const value = generatedEnvironment[name];
    assert(value, `${name} wajib tersedia setelah generation.`);
    assert(
      value.length >= 43,
      `${name} wajib memiliki minimal entropy 256-bit dalam format base64url.`,
    );
  }
  assert.equal(
    new Set(CORE_SECRET_NAMES.map((name) => generatedEnvironment[name])).size,
    CORE_SECRET_NAMES.length,
    "Setiap core secret wajib berbeda.",
  );

  const generatedDatabaseUrl = generatedEnvironment.DATABASE_URL;
  assert(generatedDatabaseUrl, "DATABASE_URL wajib tersedia setelah generation.");
  const databaseUrl = new URL(generatedDatabaseUrl);
  assert.equal(decodeURIComponent(databaseUrl.username), generatedEnvironment.POSTGRES_USER);
  assert.equal(decodeURIComponent(databaseUrl.password), generatedEnvironment.POSTGRES_PASSWORD);
  assert.equal(
    decodeURIComponent(databaseUrl.pathname.replace(/^\//, "")),
    generatedEnvironment.POSTGRES_DB,
  );

  assert.doesNotThrow(() => {
    assertServerEnvironment(generatedEnvironment, {
      mode: "production",
      requireCore: true,
      requireDeployment: true,
    });
  });

  if (process.platform !== "win32") {
    assert.equal(
      statSync(generatedPath).mode & 0o777,
      0o600,
      "Environment production hasil generator wajib memiliki permission 600.",
    );
  }

  const beforeSecondRun = readFileSync(generatedPath, "utf8");
  run(process.execPath, [
    "scripts/generate-environment-secrets.mjs",
    "--write",
    generatedPath,
  ]);
  assert.equal(
    readFileSync(generatedPath, "utf8"),
    beforeSecondRun,
    "Generator tidak boleh mengganti secret existing tanpa --rotate.",
  );

  const localEnvironmentPath = path.join(temporaryRoot, ".env");
  const localGeneration = run(process.execPath, [
    "scripts/generate-environment-secrets.mjs",
    "--write",
    localEnvironmentPath,
    "--template",
    path.join(projectRoot, ".env.example"),
  ]);
  const localEnvironment = parseEnvironment(
    readFileSync(localEnvironmentPath, "utf8"),
  );
  assert(localEnvironment.SESSION_SECRET !== "CHANGE_ME");
  assert(
    !Object.hasOwn(localEnvironment, "POSTGRES_PASSWORD"),
    "Generator local tidak boleh menambahkan deployment credential yang tidak ada di template.",
  );
  assertOutputDoesNotContainSecrets(
    `${localGeneration.stdout}
${localGeneration.stderr}`,
    localEnvironment,
  );

  const sessionBeforeRotation = generatedEnvironment.SESSION_SECRET;
  const rotation = run(process.execPath, [
    "scripts/generate-environment-secrets.mjs",
    "--write",
    generatedPath,
    "--rotate",
    "SESSION_SECRET",
  ]);
  const rotatedEnvironment = parseEnvironment(readFileSync(generatedPath, "utf8"));
  assert.notEqual(rotatedEnvironment.SESSION_SECRET, sessionBeforeRotation);
  assert.equal(
    rotatedEnvironment.RECEIPT_VERIFICATION_SECRET,
    generatedEnvironment.RECEIPT_VERIFICATION_SECRET,
  );
  assertOutputDoesNotContainSecrets(
    `${rotation.stdout}\n${rotation.stderr}`,
    rotatedEnvironment,
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

const unsafeMigrationEnvironment = {
  ...templateEnvironment,
  DATABASE_MIGRATION_ALLOW_DESTRUCTIVE: "true",
  DATABASE_MIGRATION_APPROVAL_REFERENCE: "",
};
const unsafeMigrationIssues = collectServerEnvironmentIssues(unsafeMigrationEnvironment, {
  mode: "production",
  requireCore: true,
  requireDeployment: true,
});
assert(
  unsafeMigrationIssues.some((issue) => issue.name === "DATABASE_MIGRATION_APPROVAL_REFERENCE"),
  "Destructive migration tanpa approval reference wajib ditolak validator production.",
);

const unsafeRestoreEnvironment = {
  ...templateEnvironment,
  DATABASE_RESTORE_ALLOW_PRODUCTION: "true",
  DATABASE_RESTORE_APPROVAL_REFERENCE: "",
};
const unsafeRestoreIssues = collectServerEnvironmentIssues(unsafeRestoreEnvironment, {
  mode: "production",
  requireCore: true,
  requireDeployment: true,
});
assert(
  unsafeRestoreIssues.some((issue) => issue.name === "DATABASE_RESTORE_APPROVAL_REFERENCE"),
  "Restore database aktif tanpa approval reference wajib ditolak validator production.",
);

const invalidOffsiteEnvironment = {
  ...templateEnvironment,
  DATABASE_BACKUP_OFFSITE_ENABLED: "true",
};
const invalidOffsiteIssues = collectServerEnvironmentIssues(invalidOffsiteEnvironment, {
  mode: "production",
  requireCore: true,
  requireDeployment: true,
});
for (const name of [
  "DATABASE_BACKUP_OFFSITE_ENDPOINT",
  "DATABASE_BACKUP_OFFSITE_REGION",
  "DATABASE_BACKUP_OFFSITE_BUCKET",
  "DATABASE_BACKUP_OFFSITE_ACCESS_KEY_ID",
  "DATABASE_BACKUP_OFFSITE_SECRET_ACCESS_KEY",
]) {
  assert(
    invalidOffsiteIssues.some((issue) => issue.name === name),
    `${name} wajib ditolak saat off-site backup aktif tetapi masih placeholder.`,
  );
}

const validOffsiteEnvironment = {
  ...templateEnvironment,
  DATABASE_BACKUP_OFFSITE_ENABLED: "true",
  DATABASE_BACKUP_OFFSITE_ENDPOINT: "https://s3.us-east-005.backblazeb2.com",
  DATABASE_BACKUP_OFFSITE_REGION: "us-east-005",
  DATABASE_BACKUP_OFFSITE_BUCKET: "asihjaya-rms-postgres-backups",
  DATABASE_BACKUP_OFFSITE_ACCESS_KEY_ID: "0050000000000000000000000",
  DATABASE_BACKUP_OFFSITE_SECRET_ACCESS_KEY: "example-only-non-secret-application-key",
};
const validOffsiteIssues = collectServerEnvironmentIssues(validOffsiteEnvironment, {
  mode: "production",
  requireCore: true,
  requireDeployment: true,
});
assert(
  !validOffsiteIssues.some((issue) => issue.name.startsWith("DATABASE_BACKUP_OFFSITE_")),
  "Konfigurasi Backblaze B2 yang lengkap tidak boleh menghasilkan issue off-site.",
);

const placeholderIssues = collectServerEnvironmentIssues(templateEnvironment, {
  mode: "production",
  requireCore: true,
  requireDeployment: true,
});
for (const name of [...CORE_SECRET_NAMES, "POSTGRES_PASSWORD"]) {
  assert(
    placeholderIssues.some((issue) => issue.name === name),
    `Placeholder ${name} wajib ditolak oleh production validator.`,
  );
}
const serializedIssues = JSON.stringify(placeholderIssues);
assert(
  !serializedIssues.includes("postgresql://asihjaya_app:CHANGE_ME"),
  "Pesan validator tidak boleh memuat DATABASE_URL lengkap.",
);

console.log(
  `OK: template production, generator non-leaking, permission, rotation, Git/Docker ignore, dan deployment validator konsisten untuk ${templateNames.length} variable.`,
);
