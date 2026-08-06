import os from "node:os";
import path from "node:path";

import { readDatabasePreDeploymentBackupResult } from "./database-backup-pre-deployment-state";
import { readDatabaseDeploymentResult } from "./database-deployment-result";
import {
  createPlannedRelease,
  promoteHealthyRelease,
  readCurrentRelease,
  readReleaseFile,
  validateReleaseRecord,
  writeJsonAtomic,
  writeReleaseHistory,
  type ReleaseCheck,
  type ReleaseRecord,
} from "./deployment-state";
import { readProductionHealthResult } from "./production-health-state";

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} membutuhkan value.`);
  return value;
}

function requiredOption(args: string[], name: string): string {
  const value = optionValue(args, name);
  if (!value) throw new Error(`${name} wajib diisi.`);
  return value;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function now(): string {
  return new Date().toISOString();
}

function readCandidate(args: string[]): { filePath: string; record: ReleaseRecord } {
  const filePath = path.resolve(requiredOption(args, "--file"));
  return { filePath, record: readReleaseFile(filePath) };
}

function writeCandidate(filePath: string, record: ReleaseRecord): void {
  validateReleaseRecord(record);
  writeJsonAtomic(filePath, record);
}

function assertDigest(value: string, name: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) throw new Error(`${name} harus sha256 64 karakter.`);
  return normalized;
}

function appendChecks(record: ReleaseRecord, checks: ReleaseCheck[]): ReleaseCheck[] {
  const names = new Set(checks.map((check) => check.name));
  return [...record.checks.filter((check) => !names.has(check.name)), ...checks];
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "plan": {
    const stateRoot = optionValue(args, "--state-root");
    const current = stateRoot ? readCurrentRelease(stateRoot) : null;
    const record = createPlannedRelease({
      revision: requiredOption(args, "--revision"),
      sourceRef: requiredOption(args, "--source-ref"),
      createdAt: optionValue(args, "--created-at"),
      appRepository: optionValue(args, "--app-repository"),
      migratorRepository: optionValue(args, "--migrator-repository"),
      operationsRepository: optionValue(args, "--operations-repository"),
      previousReleaseId: optionValue(args, "--previous-release-id") ?? current?.releaseId ?? null,
      operator: optionValue(args, "--operator") ?? process.env.SUDO_USER ?? process.env.USER ?? "unknown",
      hostname: optionValue(args, "--hostname") ?? os.hostname(),
    });
    const output = optionValue(args, "--output");
    if (output) writeJsonAtomic(path.resolve(output), record);
    print(record);
    break;
  }
  case "validate": {
    const record = readReleaseFile(requiredOption(args, "--file"));
    validateReleaseRecord(record);
    console.log(`OK: release metadata ${record.releaseId} valid.`);
    break;
  }
  case "record": {
    const stateRoot = requiredOption(args, "--state-root");
    const record = readReleaseFile(requiredOption(args, "--file"));
    const target = writeReleaseHistory(stateRoot, record);
    console.log(`OK: release metadata dicatat ke ${target}.`);
    break;
  }
  case "images": {
    const { filePath, record } = readCandidate(args);
    const updated: ReleaseRecord = {
      ...record,
      status: "deploying",
      updatedAt: now(),
      images: {
        app: { ...record.images.app, digest: assertDigest(requiredOption(args, "--app-digest"), "--app-digest") },
        migrator: {
          ...record.images.migrator,
          digest: assertDigest(requiredOption(args, "--migrator-digest"), "--migrator-digest"),
        },
        operations: {
          ...record.images.operations,
          digest: assertDigest(requiredOption(args, "--operations-digest"), "--operations-digest"),
        },
      },
      checks: appendChecks(record, [
        { name: "immutable-images", status: "passed", checkedAt: now(), detail: "OCI labels dan image IDs sesuai candidate release." },
      ]),
    };
    writeCandidate(filePath, updated);
    console.log(`OK: image digest release ${record.releaseId} dicatat.`);
    break;
  }
  case "backup": {
    const { filePath, record } = readCandidate(args);
    const result = readDatabasePreDeploymentBackupResult(requiredOption(args, "--result-file"));
    if (result.releaseId !== record.releaseId) throw new Error("Release ID bukti backup tidak cocok dengan candidate.");
    const checkedAt = now();
    const updated: ReleaseRecord = {
      ...record,
      updatedAt: checkedAt,
      backup:
        result.status === "verified"
          ? {
              backupId: result.local.backupId,
              metadataPath: result.local.metadataPath,
              offsiteReceiptPath: result.offsite.receiptPath,
              verifiedAt: result.offsite.verifiedAt,
            }
          : null,
      checks: appendChecks(record, [
        {
          name: "pre-deployment-backup",
          status: "passed",
          checkedAt,
          detail:
            result.status === "verified"
              ? `Backup ${result.local.backupId} terverifikasi lokal dan off-site.`
              : "Database belum diinisialisasi; backup dilewati secara eksplisit.",
        },
      ]),
    };
    writeCandidate(filePath, updated);
    console.log(`OK: bukti backup release ${record.releaseId} dicatat.`);
    break;
  }
  case "migration": {
    const { filePath, record } = readCandidate(args);
    const result = readDatabaseDeploymentResult(requiredOption(args, "--result-file"));
    if (result.releaseId !== record.releaseId) throw new Error("Release ID bukti migration tidak cocok dengan candidate.");
    const checkedAt = now();
    const updated: ReleaseRecord = {
      ...record,
      updatedAt: checkedAt,
      database: {
        migrationCountBefore: result.migrationCountBefore,
        migrationCountAfter: result.migrationCountAfter,
        schemaChanged: result.schemaChanged,
        rollbackCompatibility: result.schemaChanged ? "approval-required" : "compatible",
        compatibilityReference: result.schemaChanged ? null : "no-schema-change",
      },
      checks: appendChecks(record, [
        {
          name: "database-migration",
          status: "passed",
          checkedAt,
          detail: result.schemaChanged
            ? `${result.migrationCountAfter - result.migrationCountBefore} migration diterapkan; rollback app membutuhkan evaluasi compatibility.`
            : "Tidak ada perubahan schema; rollback app sebelumnya dapat dipertimbangkan compatible.",
        },
      ]),
    };
    writeCandidate(filePath, updated);
    console.log(`OK: bukti migration release ${record.releaseId} dicatat.`);
    break;
  }
  case "health": {
    const { filePath, record } = readCandidate(args);
    const result = readProductionHealthResult(requiredOption(args, "--result-file"));
    if (result.releaseId !== record.releaseId || result.revision !== record.revision) {
      throw new Error("Identitas bukti health check tidak cocok dengan candidate.");
    }
    const updated: ReleaseRecord = {
      ...record,
      updatedAt: now(),
      checks: appendChecks(
        record,
        result.checks.map((check) => ({
          name: check.name,
          status: check.status,
          checkedAt: check.checkedAt,
          detail: check.detail,
        })),
      ),
    };
    writeCandidate(filePath, updated);
    if (result.checks.some((check) => check.status === "failed")) {
      throw new Error(`${result.scope} health result memiliki pemeriksaan gagal.`);
    }
    console.log(`OK: ${result.scope} health result release ${record.releaseId} dicatat.`);
    break;
  }
  case "healthy": {
    const { filePath, record } = readCandidate(args);
    const requiredChecks = [
      "immutable-images",
      "pre-deployment-backup",
      "database-migration",
      "candidate-local-app",
      "candidate-local-database",
      "production-local-app",
      "production-local-database",
      "production-public-app",
      "production-public-database",
      "production-public-login",
    ];
    for (const checkName of requiredChecks) {
      const check = record.checks.find((item) => item.name === checkName);
      if (!check || check.status !== "passed") throw new Error(`Release belum boleh healthy: check ${checkName} belum passed.`);
    }
    if (record.images.app.digest === null || record.images.migrator.digest === null || record.images.operations.digest === null) {
      throw new Error("Release belum boleh healthy sebelum semua image digest dicatat.");
    }
    if (record.database.schemaChanged === null) throw new Error("Release belum boleh healthy sebelum migration result dicatat.");
    const completedAt = now();
    const updated: ReleaseRecord = {
      ...record,
      status: "healthy",
      updatedAt: completedAt,
      deployment: { ...record.deployment, completedAt },
      failure: null,
    };
    writeCandidate(filePath, updated);
    console.log(`OK: release ${record.releaseId} ditandai healthy.`);
    break;
  }
  case "fail": {
    const { filePath, record } = readCandidate(args);
    const stateRoot = requiredOption(args, "--state-root");
    const stage = requiredOption(args, "--stage").trim().slice(0, 80);
    const message = requiredOption(args, "--message").replace(/[\r\n]+/g, " ").trim().slice(0, 500);
    if (!stage || !message) throw new Error("Failure stage dan message wajib diisi.");
    const failedAt = now();
    const updated: ReleaseRecord = {
      ...record,
      status: "failed",
      updatedAt: failedAt,
      deployment: { ...record.deployment, completedAt: failedAt },
      failure: { stage, message, failedAt },
    };
    writeCandidate(filePath, updated);
    const target = writeReleaseHistory(stateRoot, updated);
    console.log(`OK: release gagal dicatat ke ${target}.`);
    break;
  }
  case "promote": {
    const stateRoot = requiredOption(args, "--state-root");
    const record = readReleaseFile(requiredOption(args, "--file"));
    promoteHealthyRelease(stateRoot, record);
    console.log(`OK: release ${record.releaseId} dipromosikan menjadi current.`);
    break;
  }
  case "current": {
    const record = readCurrentRelease(requiredOption(args, "--state-root"));
    if (!record) {
      console.log("Belum ada current release.");
      process.exitCode = 3;
    } else {
      print(record);
    }
    break;
  }
  default:
    throw new Error(
      "Usage: run-deployment-contract.ts <plan|validate|record|images|backup|migration|health|healthy|fail|promote|current> [options]",
    );
}
