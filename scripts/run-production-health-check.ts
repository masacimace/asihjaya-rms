import { pathToFileURL } from "node:url";

import { writeProductionHealthResult, type ProductionHealthCheck } from "./production-health-state";
import { assertReleaseId } from "./deployment-state";

export type ProductionHealthOptions = {
  releaseId: string;
  revision: string;
  scope: "candidate" | "production";
  localOrigin: string;
  publicOrigin?: string;
  resultFile: string;
  attempts: number;
  intervalMs: number;
  timeoutMs: number;
};

type JsonRecord = Record<string, unknown>;

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

function parsePositiveInteger(value: string | undefined, fallback: number, name: string, maximum: number): number {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} harus bilangan bulat positif.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(`${name} harus berada pada rentang 1 sampai ${maximum}.`);
  }
  return parsed;
}

function normalizeOrigin(value: string, name: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} harus origin HTTP(S) tanpa credential, query, atau hash.`);
  }
  return url.origin;
}

function parseOptions(args: string[]): ProductionHealthOptions {
  const releaseId = requiredOption(args, "--release-id");
  assertReleaseId(releaseId);
  const revision = requiredOption(args, "--revision").trim().toLowerCase();
  if (!/^[a-f0-9]{7,64}$/.test(revision)) throw new Error("--revision harus Git SHA hexadecimal.");
  const scope = requiredOption(args, "--scope");
  if (scope !== "candidate" && scope !== "production") throw new Error("--scope harus candidate atau production.");

  const publicOriginRaw = optionValue(args, "--public-origin") ?? process.env.APP_URL?.trim();
  if (scope === "production" && !publicOriginRaw) {
    throw new Error("--public-origin atau APP_URL wajib diatur untuk production health check.");
  }

  return {
    releaseId,
    revision,
    scope,
    localOrigin: normalizeOrigin(requiredOption(args, "--local-origin"), "--local-origin"),
    publicOrigin: publicOriginRaw ? normalizeOrigin(publicOriginRaw, "--public-origin") : undefined,
    resultFile: requiredOption(args, "--result-file"),
    attempts: parsePositiveInteger(optionValue(args, "--attempts"), 30, "--attempts", 120),
    intervalMs: parsePositiveInteger(optionValue(args, "--interval-ms"), 2_000, "--interval-ms", 60_000),
    timeoutMs: parsePositiveInteger(optionValue(args, "--timeout-ms"), 6_000, "--timeout-ms", 60_000),
  };
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function asObject(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("response bukan JSON object.");
  return value as JsonRecord;
}

function assertReleasePayload(value: JsonRecord, releaseId: string, revision: string): void {
  const release = asObject(value.release);
  if (release.releaseId !== releaseId) {
    throw new Error(`releaseId ${String(release.releaseId)} tidak sama dengan ${releaseId}.`);
  }
  if (release.revision !== revision) {
    throw new Error(`revision ${String(release.revision)} tidak sama dengan ${revision}.`);
  }
}

async function fetchJson(url: string, timeoutMs: number): Promise<JsonRecord> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "User-Agent": "asihjaya-rms-deployment-health/1",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}.`);
  return asObject(await response.json());
}

async function checkJsonEndpoint(
  name: string,
  url: string,
  timeoutMs: number,
  releaseId: string,
  revision: string,
  validate: (payload: JsonRecord) => void,
): Promise<ProductionHealthCheck> {
  const checkedAt = new Date().toISOString();
  try {
    const payload = await fetchJson(url, timeoutMs);
    validate(payload);
    assertReleasePayload(payload, releaseId, revision);
    return { name, url, status: "passed", checkedAt, detail: null };
  } catch (error) {
    return {
      name,
      url,
      status: "failed",
      checkedAt,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkPage(name: string, url: string, timeoutMs: number): Promise<ProductionHealthCheck> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      headers: { "Cache-Control": "no-cache", "User-Agent": "asihjaya-rms-deployment-health/1" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}.`);
    return { name, url, status: "passed", checkedAt, detail: null };
  } catch (error) {
    return {
      name,
      url,
      status: "failed",
      checkedAt,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeChecks(options: ProductionHealthOptions): Promise<ProductionHealthCheck[]> {
  const checks = [
    await checkJsonEndpoint(
      `${options.scope}-local-app`,
      `${options.localOrigin}/api/health`,
      options.timeoutMs,
      options.releaseId,
      options.revision,
      (payload) => {
        if (payload.status !== "ok" || payload.service !== "asihjaya-rms") throw new Error("status aplikasi tidak valid.");
      },
    ),
    await checkJsonEndpoint(
      `${options.scope}-local-database`,
      `${options.localOrigin}/api/health/database`,
      options.timeoutMs,
      options.releaseId,
      options.revision,
      (payload) => {
        if (payload.status !== "healthy" || payload.database !== "connected") throw new Error("status database tidak valid.");
      },
    ),
  ];

  if (options.scope === "production" && options.publicOrigin) {
    checks.push(
      await checkJsonEndpoint(
        "production-public-app",
        `${options.publicOrigin}/api/health`,
        options.timeoutMs,
        options.releaseId,
        options.revision,
        (payload) => {
          if (payload.status !== "ok" || payload.service !== "asihjaya-rms") throw new Error("status aplikasi tidak valid.");
        },
      ),
      await checkJsonEndpoint(
        "production-public-database",
        `${options.publicOrigin}/api/health/database`,
        options.timeoutMs,
        options.releaseId,
        options.revision,
        (payload) => {
          if (payload.status !== "healthy" || payload.database !== "connected") throw new Error("status database tidak valid.");
        },
      ),
      await checkPage("production-public-login", `${options.publicOrigin}/login`, options.timeoutMs),
    );
  }

  return checks;
}

export async function runProductionHealthCheck(options: ProductionHealthOptions): Promise<void> {
  const startedAt = new Date().toISOString();
  let checks: ProductionHealthCheck[] = [];

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    checks = await executeChecks(options);
    const failures = checks.filter((check) => check.status === "failed");
    if (failures.length === 0) {
      const result = {
        version: 1 as const,
        operation: "production-health-check" as const,
        scope: options.scope,
        releaseId: options.releaseId,
        revision: options.revision,
        startedAt,
        completedAt: new Date().toISOString(),
        checks,
      };
      writeProductionHealthResult(options.resultFile, result);
      console.log(`OK: ${options.scope} health check lulus untuk release ${options.releaseId}.`);
      console.log(`Bukti health check: ${options.resultFile}`);
      return;
    }

    const detail = failures.map((check) => `${check.name}: ${check.detail ?? "gagal"}`).join("; ");
    console.log(`Health attempt ${attempt}/${options.attempts} belum lulus: ${detail}`);
    if (attempt < options.attempts) await sleep(options.intervalMs);
  }

  const finalResult = {
    version: 1 as const,
    operation: "production-health-check" as const,
    scope: options.scope,
    releaseId: options.releaseId,
    revision: options.revision,
    startedAt,
    completedAt: new Date().toISOString(),
    checks,
  };
  writeProductionHealthResult(options.resultFile, finalResult);
  throw new Error(`${options.scope} health check gagal setelah ${options.attempts} percobaan.`);
}

async function main(): Promise<void> {
  await runProductionHealthCheck(parseOptions(process.argv.slice(2)));
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entryPoint === import.meta.url) {
  main().catch((error) => {
    console.error(`Production health check gagal: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
