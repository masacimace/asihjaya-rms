import { readFileSync } from "node:fs";

import { assertReleaseId, writeJsonAtomic } from "./deployment-state";

export const DATABASE_DEPLOYMENT_RESULT_VERSION = 1 as const;

export type DatabaseDeploymentResult = {
  version: typeof DATABASE_DEPLOYMENT_RESULT_VERSION;
  operation: "database-deployment";
  status: "checked" | "completed";
  releaseId: string;
  startedAt: string;
  completedAt: string;
  migrationCountBefore: number;
  migrationCountAfter: number;
  pendingCountBefore: number;
  schemaChanged: boolean;
  destructiveOperations: string[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  assert(Boolean(value) && typeof value === "object" && !Array.isArray(value), `${name} harus berupa object.`);
}

function assertIsoTimestamp(value: unknown, name: string): asserts value is string {
  assert(typeof value === "string", `${name} wajib berupa string.`);
  const parsed = new Date(value);
  assert(!Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value, `${name} harus timestamp ISO UTC canonical.`);
}

function assertNonNegativeInteger(value: unknown, name: string): asserts value is number {
  assert(Number.isSafeInteger(value) && Number(value) >= 0, `${name} harus bilangan bulat non-negatif.`);
}

export function parseDatabaseDeploymentResult(content: string): DatabaseDeploymentResult {
  const value = JSON.parse(content) as unknown;
  assertObject(value, "Database deployment result");
  assert(value.version === DATABASE_DEPLOYMENT_RESULT_VERSION, "Versi database deployment result tidak didukung.");
  assert(value.operation === "database-deployment", "Operation database deployment result tidak valid.");
  assert(value.status === "checked" || value.status === "completed", "Status database deployment result tidak valid.");
  assert(typeof value.releaseId === "string", "releaseId wajib berupa string.");
  assertReleaseId(value.releaseId);
  assertIsoTimestamp(value.startedAt, "startedAt");
  assertIsoTimestamp(value.completedAt, "completedAt");
  assert(new Date(value.completedAt).valueOf() >= new Date(value.startedAt).valueOf(), "completedAt tidak boleh sebelum startedAt.");
  assertNonNegativeInteger(value.migrationCountBefore, "migrationCountBefore");
  assertNonNegativeInteger(value.migrationCountAfter, "migrationCountAfter");
  assertNonNegativeInteger(value.pendingCountBefore, "pendingCountBefore");
  assert(
    value.migrationCountAfter >= value.migrationCountBefore,
    "migrationCountAfter tidak boleh lebih kecil daripada migrationCountBefore.",
  );
  assert(
    value.pendingCountBefore === value.migrationCountAfter - value.migrationCountBefore || value.status === "checked",
    "pendingCountBefore tidak konsisten dengan jumlah migration yang diterapkan.",
  );
  assert(typeof value.schemaChanged === "boolean", "schemaChanged wajib boolean.");
  assert(
    value.schemaChanged === (value.migrationCountAfter > value.migrationCountBefore),
    "schemaChanged tidak konsisten dengan migration count.",
  );
  assert(Array.isArray(value.destructiveOperations), "destructiveOperations wajib array.");
  for (const operation of value.destructiveOperations) {
    assert(typeof operation === "string" && operation.trim().length > 0, "destructiveOperations hanya boleh berisi string.");
  }
  return value as DatabaseDeploymentResult;
}

export function readDatabaseDeploymentResult(filePath: string): DatabaseDeploymentResult {
  return parseDatabaseDeploymentResult(readFileSync(filePath, "utf8"));
}

export function writeDatabaseDeploymentResult(filePath: string, value: DatabaseDeploymentResult): void {
  parseDatabaseDeploymentResult(JSON.stringify(value));
  writeJsonAtomic(filePath, value);
}
