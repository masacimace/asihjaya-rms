import os from "node:os";
import path from "node:path";

import {
  readCurrentRelease,
  updateCurrentReleaseCompatibility,
  writeJsonAtomic,
  type ReleaseCheck,
} from "./deployment-state";
import { readProductionHealthResult } from "./production-health-state";
import {
  appendRollbackChecks,
  createRollbackPlan,
  evaluateRollbackGuard,
  promoteRollbackTarget,
  readRollbackRecord,
  validateRollbackRecord,
  writeRollbackHistory,
  type RollbackRecord,
} from "./rollback-state";

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

function now(): string {
  return new Date().toISOString();
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function readRecord(args: string[]): { filePath: string; record: RollbackRecord } {
  const filePath = path.resolve(requiredOption(args, "--file"));
  return { filePath, record: readRollbackRecord(filePath) };
}

function writeRecord(filePath: string, record: RollbackRecord): void {
  validateRollbackRecord(record);
  writeJsonAtomic(filePath, record);
}

function assertDigest(value: string, name: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) throw new Error(`${name} harus sha256 64 karakter.`);
  return normalized;
}

function guardSummary(stateRoot: string, expectedTarget?: string): Record<string, string | boolean> {
  const guard = evaluateRollbackGuard(stateRoot, expectedTarget);
  return {
    allowed: true,
    fromReleaseId: guard.current.releaseId,
    fromRevision: guard.current.revision,
    fromBuildDate: guard.current.createdAt,
    fromAppImage: guard.current.images.app.reference,
    fromAppDigest: guard.current.images.app.digest!,
    fromMigratorImage: guard.current.images.migrator.reference,
    fromMigratorDigest: guard.current.images.migrator.digest!,
    fromOperationsImage: guard.current.images.operations.reference,
    fromOperationsDigest: guard.current.images.operations.digest!,
    toReleaseId: guard.target.releaseId,
    toRevision: guard.target.revision,
    toBuildDate: guard.target.createdAt,
    toAppImage: guard.target.images.app.reference,
    toAppDigest: guard.target.images.app.digest!,
    toMigratorImage: guard.target.images.migrator.reference,
    toMigratorDigest: guard.target.images.migrator.digest!,
    toOperationsImage: guard.target.images.operations.reference,
    toOperationsDigest: guard.target.images.operations.digest!,
    compatibilityReference: guard.compatibilityReference,
  };
}

function printGuardEnvironment(stateRoot: string, expectedTarget?: string): void {
  const values = guardSummary(stateRoot, expectedTarget);
  const mapping: Record<string, string> = {
    FROM_RELEASE_ID: String(values.fromReleaseId),
    FROM_REVISION: String(values.fromRevision),
    FROM_BUILD_DATE: String(values.fromBuildDate),
    FROM_APP_IMAGE: String(values.fromAppImage),
    FROM_APP_DIGEST: String(values.fromAppDigest),
    FROM_MIGRATOR_IMAGE: String(values.fromMigratorImage),
    FROM_MIGRATOR_DIGEST: String(values.fromMigratorDigest),
    FROM_OPERATIONS_IMAGE: String(values.fromOperationsImage),
    FROM_OPERATIONS_DIGEST: String(values.fromOperationsDigest),
    TO_RELEASE_ID: String(values.toReleaseId),
    TO_REVISION: String(values.toRevision),
    TO_BUILD_DATE: String(values.toBuildDate),
    TO_APP_IMAGE: String(values.toAppImage),
    TO_APP_DIGEST: String(values.toAppDigest),
    TO_MIGRATOR_IMAGE: String(values.toMigratorImage),
    TO_MIGRATOR_DIGEST: String(values.toMigratorDigest),
    TO_OPERATIONS_IMAGE: String(values.toOperationsImage),
    TO_OPERATIONS_DIGEST: String(values.toOperationsDigest),
    COMPATIBILITY_REFERENCE: String(values.compatibilityReference),
  };
  for (const [key, value] of Object.entries(mapping)) {
    if (/[\r\n]/.test(value)) throw new Error(`Value ${key} tidak boleh memiliki newline.`);
    process.stdout.write(`${key}=${value}\n`);
  }
}

type RollbackHealthPhase = "preflight" | "candidate" | "production" | "recovery";

const rollbackHealthPhases: readonly RollbackHealthPhase[] = [
  "preflight",
  "candidate",
  "production",
  "recovery",
];

function isRollbackHealthPhase(value: string): value is RollbackHealthPhase {
  return rollbackHealthPhases.includes(value as RollbackHealthPhase);
}

function healthChecksForPhase(
  record: RollbackRecord,
  phase: RollbackHealthPhase,
  resultFile: string,
): ReleaseCheck[] {
  const result = readProductionHealthResult(resultFile);
  const expectedScope = phase === "candidate" ? "candidate" : "production";
  if (result.scope !== expectedScope) throw new Error(`Health scope ${result.scope} tidak cocok untuk phase ${phase}.`);
  const targetPhase = phase === "candidate" || phase === "production";
  const expectedReleaseId = targetPhase ? record.toReleaseId : record.fromReleaseId;
  const expectedRevision = targetPhase ? record.toRevision : record.fromRevision;
  if (result.releaseId !== expectedReleaseId || result.revision !== expectedRevision) {
    throw new Error(`Identitas health ${result.releaseId}/${result.revision} tidak cocok untuk phase ${phase}.`);
  }
  const prefix = targetPhase ? "" : `${phase}-`;
  return result.checks.map((check) => ({
    name: `${prefix}${check.name}`,
    status: check.status,
    checkedAt: check.checkedAt,
    detail: check.detail ? `${check.detail}; revision=${expectedRevision}` : `revision=${expectedRevision}`,
  }));
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "runtime": {
    console.log("OK: rollback contract runtime tersedia.");
    break;
  }
  case "compatibility": {
    const stateRoot = requiredOption(args, "--state-root");
    const decision = requiredOption(args, "--decision");
    if (decision !== "compatible" && decision !== "incompatible") {
      throw new Error("--decision harus compatible atau incompatible.");
    }
    const operator = optionValue(args, "--operator") ?? process.env.SUDO_USER ?? process.env.USER ?? "unknown";
    const hostname = optionValue(args, "--hostname") ?? os.hostname();
    const updated = updateCurrentReleaseCompatibility(
      stateRoot,
      decision,
      requiredOption(args, "--reference"),
      `${operator}@${hostname}`,
    );
    console.log(
      `OK: rollback compatibility release ${updated.releaseId} ditandai ${decision} dengan reference ${updated.database.compatibilityReference}.`,
    );
    break;
  }
  case "guard": {
    const stateRoot = requiredOption(args, "--state-root");
    const expectedTarget = optionValue(args, "--expected-target");
    if (optionValue(args, "--format") === "env") {
      printGuardEnvironment(stateRoot, expectedTarget);
    } else {
      print(guardSummary(stateRoot, expectedTarget));
    }
    break;
  }
  case "plan": {
    const stateRoot = requiredOption(args, "--state-root");
    const guard = evaluateRollbackGuard(stateRoot, optionValue(args, "--expected-target"));
    const record = createRollbackPlan({
      current: guard.current,
      target: guard.target,
      compatibilityReference: guard.compatibilityReference,
      compatibilityEvidence: guard.compatibilityEvidence,
      requestedAt: optionValue(args, "--requested-at"),
      operator: optionValue(args, "--operator") ?? process.env.SUDO_USER ?? process.env.USER ?? "unknown",
      hostname: optionValue(args, "--hostname") ?? os.hostname(),
    });
    const output = path.resolve(requiredOption(args, "--output"));
    writeRecord(output, record);
    print(record);
    break;
  }
  case "images": {
    const { filePath, record } = readRecord(args);
    const observed = {
      fromApp: assertDigest(requiredOption(args, "--from-app-digest"), "--from-app-digest"),
      fromMigrator: assertDigest(requiredOption(args, "--from-migrator-digest"), "--from-migrator-digest"),
      fromOperations: assertDigest(requiredOption(args, "--from-operations-digest"), "--from-operations-digest"),
      toApp: assertDigest(requiredOption(args, "--to-app-digest"), "--to-app-digest"),
      toMigrator: assertDigest(requiredOption(args, "--to-migrator-digest"), "--to-migrator-digest"),
      toOperations: assertDigest(requiredOption(args, "--to-operations-digest"), "--to-operations-digest"),
    };
    if (observed.fromApp !== record.images.fromApp.digest) throw new Error("Current app digest tidak cocok dengan rollback metadata.");
    if (observed.fromMigrator !== record.images.fromMigrator.digest) throw new Error("Current migrator digest tidak cocok dengan rollback metadata.");
    if (observed.fromOperations !== record.images.fromOperations.digest) throw new Error("Current operations digest tidak cocok dengan rollback metadata.");
    if (observed.toApp !== record.images.toApp.digest) throw new Error("Target app digest tidak cocok dengan rollback metadata.");
    if (observed.toMigrator !== record.images.toMigrator.digest) throw new Error("Target migrator digest tidak cocok dengan rollback metadata.");
    if (observed.toOperations !== record.images.toOperations.digest) throw new Error("Target operations digest tidak cocok dengan rollback metadata.");
    const checkedAt = now();
    const updated = appendRollbackChecks(record, [{
      name: "rollback-images",
      status: "passed",
      checkedAt,
      detail: "Current dan target image ID serta OCI identity cocok dengan release metadata.",
    }]);
    writeRecord(filePath, updated);
    console.log(`OK: image identity rollback ${record.rollbackId} terverifikasi.`);
    break;
  }
  case "health": {
    const { filePath, record } = readRecord(args);
    const phase = requiredOption(args, "--phase");
    if (!isRollbackHealthPhase(phase)) {
      throw new Error("--phase harus preflight, candidate, production, atau recovery.");
    }
    const checks = healthChecksForPhase(record, phase, requiredOption(args, "--result-file"));
    const updated = appendRollbackChecks(record, checks);
    writeRecord(filePath, updated);
    if (checks.some((check) => check.status === "failed")) {
      throw new Error(`Health phase ${phase} memiliki pemeriksaan gagal.`);
    }
    console.log(`OK: health phase ${phase} rollback ${record.rollbackId} dicatat.`);
    break;
  }
  case "complete": {
    const { filePath, record } = readRecord(args);
    const stateRoot = requiredOption(args, "--state-root");
    const guard = evaluateRollbackGuard(stateRoot, record.toReleaseId);
    if (guard.current.releaseId !== record.fromReleaseId) throw new Error("Current release berubah sejak rollback direncanakan.");
    const requiredChecks = [
      "rollback-images",
      "preflight-production-local-app",
      "preflight-production-local-database",
      "preflight-production-public-app",
      "preflight-production-public-database",
      "preflight-production-public-login",
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
      if (!check || check.status !== "passed") throw new Error(`Rollback belum boleh complete: check ${checkName} belum passed.`);
    }
    const completedAt = now();
    const completed: RollbackRecord = {
      ...record,
      status: "completed",
      updatedAt: completedAt,
      completedAt,
      failure: null,
    };
    writeRecord(filePath, completed);
    writeRollbackHistory(stateRoot, completed);
    try {
      promoteRollbackTarget({
        stateRoot,
        current: guard.current,
        target: guard.target,
        rollbackId: record.rollbackId,
        completedAt,
      });
    } catch (error) {
      const failedAt = now();
      const failed: RollbackRecord = {
        ...completed,
        status: "failed",
        updatedAt: failedAt,
        completedAt: failedAt,
        failure: {
          stage: "state-promotion",
          message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
          failedAt,
        },
      };
      writeRecord(filePath, failed);
      writeRollbackHistory(stateRoot, failed);
      throw error;
    }
    console.log(`OK: rollback ${record.rollbackId} dipromosikan dari ${record.fromReleaseId} ke ${record.toReleaseId}.`);
    break;
  }
  case "fail": {
    const { filePath, record } = readRecord(args);
    const stateRoot = requiredOption(args, "--state-root");
    const failedAt = now();
    const stage = requiredOption(args, "--stage").trim().slice(0, 80);
    const message = requiredOption(args, "--message").replace(/[\r\n]+/g, " ").trim().slice(0, 500);
    if (!stage || !message) throw new Error("Failure stage dan message wajib diisi.");
    const failed: RollbackRecord = {
      ...record,
      status: "failed",
      updatedAt: failedAt,
      completedAt: failedAt,
      failure: { stage, message, failedAt },
    };
    writeRecord(filePath, failed);
    const target = writeRollbackHistory(stateRoot, failed);
    console.log(`OK: rollback gagal dicatat ke ${target}.`);
    break;
  }
  case "current": {
    const current = readCurrentRelease(requiredOption(args, "--state-root"));
    if (!current) throw new Error("Current release belum tersedia.");
    print(current);
    break;
  }
  default:
    throw new Error(
      "Usage: run-rollback-contract.ts <runtime|compatibility|guard|plan|images|health|complete|fail|current> [options]",
    );
}
