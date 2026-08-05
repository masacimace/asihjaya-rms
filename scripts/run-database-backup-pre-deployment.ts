import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

import { assertReleaseId } from "./deployment-state";
import {
  readDatabaseBackupCommandResult,
  readDatabaseBackupOffsiteCommandResult,
  writeDatabasePreDeploymentBackupResult,
  type DatabasePreDeploymentBackupResult,
} from "./database-backup-pre-deployment-state";

const projectRoot = process.cwd();
const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");

type CliOptions = {
  environmentFile: string;
  releaseId: string;
  resultFile: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} membutuhkan value.`);
  return value;
}

function parseOptions(args: string[]): CliOptions {
  const allowed = new Set(["--env-file", "--release-id", "--result-file"]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    assert(allowed.has(argument), `Argument tidak dikenal: ${argument}.`);
    const value = args[index + 1];
    assert(value && !value.startsWith("--"), `${argument} membutuhkan value.`);
    index += 1;
  }

  const environmentFile = optionValue(args, "--env-file") ?? ".env.production";
  const environmentPath = path.resolve(projectRoot, environmentFile);
  const loaded = loadDotenv({ path: environmentPath, override: true, quiet: true });
  if (loaded.error) throw new Error(`Gagal membaca environment file ${environmentPath}.`);

  const releaseId = optionValue(args, "--release-id") ?? process.env.APP_RELEASE_ID?.trim();
  assert(releaseId, "--release-id atau APP_RELEASE_ID wajib diisi.");
  assertReleaseId(releaseId);

  const configuredResult =
    optionValue(args, "--result-file") ??
    process.env.DATABASE_PRE_DEPLOYMENT_BACKUP_RESULT_PATH?.trim() ??
    path.join(".data", "backups", "pre-deployment", `${releaseId}.json`);

  return {
    environmentFile,
    releaseId,
    resultFile: path.resolve(projectRoot, configuredResult),
  };
}

async function runTypescriptScript(script: string, args: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, path.join(projectRoot, script), ...args], {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${script} gagal dengan exit code ${code ?? "null"}${signal ? ` (${signal})` : ""}.`,
        ),
      );
    });
  });
}

const options = parseOptions(process.argv.slice(2));
const startedAt = new Date().toISOString();
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "asihjaya-pre-deployment-backup-"));

try {
  const backupResultPath = path.join(temporaryRoot, "backup-result.json");
  const offsiteResultPath = path.join(temporaryRoot, "offsite-result.json");

  await runTypescriptScript("scripts/run-database-backup.ts", [
    "--env-file",
    options.environmentFile,
    "--kind",
    "pre-deployment",
    "--label",
    options.releaseId,
    "--release-id",
    options.releaseId,
    "--prune",
    "--skip-if-uninitialized",
    "--result-file",
    backupResultPath,
  ]);

  const backupResult = readDatabaseBackupCommandResult(backupResultPath);
  if (backupResult.status === "skipped-uninitialized") {
    const result: DatabasePreDeploymentBackupResult = {
      version: 1,
      operation: "database-backup-pre-deployment",
      status: "skipped-uninitialized",
      releaseId: options.releaseId,
      startedAt,
      completedAt: new Date().toISOString(),
      local: null,
      offsite: null,
    };
    writeDatabasePreDeploymentBackupResult(options.resultFile, result);
    console.log(
      `SKIP: database belum diinisialisasi; bukti pre-deployment ditulis ke ${options.resultFile}.`,
    );
    process.exit(0);
  }

  assert(
    backupResult.artifact.releaseId === options.releaseId,
    `Backup release ${backupResult.artifact.releaseId ?? "null"} tidak sama dengan candidate ${options.releaseId}.`,
  );

  await runTypescriptScript("scripts/run-database-backup-offsite.ts", [
    "--env-file",
    options.environmentFile,
    "--metadata",
    backupResult.artifact.metadataPath,
    "--prune",
    "--result-file",
    offsiteResultPath,
  ]);

  const offsiteResult = readDatabaseBackupOffsiteCommandResult(offsiteResultPath);
  assert(
    offsiteResult.backupId === backupResult.artifact.backupId,
    "Backup ID off-site tidak sama dengan backup lokal yang baru dibuat.",
  );
  assert(
    offsiteResult.releaseId === options.releaseId,
    `Receipt off-site release ${offsiteResult.releaseId ?? "null"} tidak sama dengan candidate ${options.releaseId}.`,
  );
  assert(
    offsiteResult.fullVerification,
    "Pre-deployment ditolak karena full SHA-256 verification off-site tidak aktif.",
  );

  const result: DatabasePreDeploymentBackupResult = {
    version: 1,
    operation: "database-backup-pre-deployment",
    status: "verified",
    releaseId: options.releaseId,
    startedAt,
    completedAt: new Date().toISOString(),
    local: {
      backupId: backupResult.artifact.backupId,
      metadataPath: backupResult.artifact.metadataPath,
      archivePath: backupResult.artifact.archivePath,
      checksumPath: backupResult.artifact.checksumPath,
      verifiedAt: backupResult.artifact.verifiedAt,
    },
    offsite: {
      receiptPath: offsiteResult.receiptPath,
      receiptKey: offsiteResult.receiptKey,
      verifiedAt: offsiteResult.verifiedAt,
      fullVerification: true,
    },
  };

  writeDatabasePreDeploymentBackupResult(options.resultFile, result);
  console.log(
    `OK: pre-deployment backup ${result.local.backupId} untuk ${options.releaseId} terverifikasi lokal dan off-site.`,
  );
  console.log(`Bukti deployment: ${options.resultFile}`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
