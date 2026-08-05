import os from "node:os";
import path from "node:path";

import {
  createPlannedRelease,
  promoteHealthyRelease,
  readCurrentRelease,
  readReleaseFile,
  validateReleaseRecord,
  writeJsonAtomic,
  writeReleaseHistory,
} from "./deployment-state";

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
      "Usage: run-deployment-contract.ts <plan|validate|record|promote|current> [options]",
    );
}
