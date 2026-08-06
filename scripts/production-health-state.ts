import { readFileSync } from "node:fs";

import { assertReleaseId, writeJsonAtomic } from "./deployment-state";

export const PRODUCTION_HEALTH_RESULT_VERSION = 1 as const;

export type ProductionHealthCheck = {
  name: string;
  url: string;
  status: "passed" | "failed";
  checkedAt: string;
  detail: string | null;
};

export type ProductionHealthResult = {
  version: typeof PRODUCTION_HEALTH_RESULT_VERSION;
  operation: "production-health-check";
  scope: "candidate" | "production";
  releaseId: string;
  revision: string;
  startedAt: string;
  completedAt: string;
  checks: ProductionHealthCheck[];
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

export function parseProductionHealthResult(content: string): ProductionHealthResult {
  const value = JSON.parse(content) as unknown;
  assertObject(value, "Production health result");
  assert(value.version === PRODUCTION_HEALTH_RESULT_VERSION, "Versi production health result tidak didukung.");
  assert(value.operation === "production-health-check", "Operation production health result tidak valid.");
  assert(value.scope === "candidate" || value.scope === "production", "Scope production health result tidak valid.");
  assert(typeof value.releaseId === "string", "releaseId wajib berupa string.");
  assertReleaseId(value.releaseId);
  assert(typeof value.revision === "string" && /^[a-f0-9]{7,64}$/.test(value.revision), "revision tidak valid.");
  assertIsoTimestamp(value.startedAt, "startedAt");
  assertIsoTimestamp(value.completedAt, "completedAt");
  assert(new Date(value.completedAt).valueOf() >= new Date(value.startedAt).valueOf(), "completedAt tidak boleh sebelum startedAt.");
  assert(Array.isArray(value.checks) && value.checks.length > 0, "checks wajib berisi minimal satu pemeriksaan.");

  for (const [index, check] of value.checks.entries()) {
    assertObject(check, `checks[${index}]`);
    assert(typeof check.name === "string" && check.name.trim().length > 0, `checks[${index}].name wajib diisi.`);
    assert(typeof check.url === "string" && /^https?:\/\//.test(check.url), `checks[${index}].url tidak valid.`);
    assert(check.status === "passed" || check.status === "failed", `checks[${index}].status tidak valid.`);
    assertIsoTimestamp(check.checkedAt, `checks[${index}].checkedAt`);
    assert(check.detail === null || typeof check.detail === "string", `checks[${index}].detail harus null atau string.`);
  }

  return value as ProductionHealthResult;
}

export function readProductionHealthResult(filePath: string): ProductionHealthResult {
  return parseProductionHealthResult(readFileSync(filePath, "utf8"));
}

export function writeProductionHealthResult(filePath: string, value: ProductionHealthResult): void {
  parseProductionHealthResult(JSON.stringify(value));
  writeJsonAtomic(filePath, value);
}
