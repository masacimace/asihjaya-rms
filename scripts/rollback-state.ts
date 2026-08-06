import {
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";

import {
  DEPLOYMENT_STATE_DIRECTORY_MODE,
  assertReleaseId,
  type ReleaseCheck,
  type ReleaseImage,
  type ReleaseRecord,
  readCurrentRelease,
  readPreviousRelease,
  validateReleaseRecord,
  writeJsonAtomic,
} from "./deployment-state";

export const ROLLBACK_STATE_SCHEMA_VERSION = 1 as const;

export type RollbackStatus = "planned" | "completed" | "failed";

export type RollbackRecord = {
  schemaVersion: typeof ROLLBACK_STATE_SCHEMA_VERSION;
  rollbackId: string;
  status: RollbackStatus;
  fromReleaseId: string;
  fromRevision: string;
  fromBuildDate: string;
  toReleaseId: string;
  toRevision: string;
  toBuildDate: string;
  requestedAt: string;
  updatedAt: string;
  completedAt: string | null;
  operator: string;
  hostname: string;
  compatibility: {
    decision: "compatible";
    reference: string;
    evidence: string;
  };
  images: {
    fromApp: ReleaseImage;
    fromMigrator: ReleaseImage;
    fromOperations: ReleaseImage;
    toApp: ReleaseImage;
    toMigrator: ReleaseImage;
    toOperations: ReleaseImage;
  };
  checks: ReleaseCheck[];
  failure: {
    stage: string;
    message: string;
    failedAt: string;
  } | null;
};

export type RollbackGuardResult = {
  current: ReleaseRecord;
  target: ReleaseRecord;
  compatibilityReference: string;
  compatibilityEvidence: string;
};

export type RollbackStatePaths = {
  root: string;
  rollbacks: string;
  work: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertPlainObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  assert(Boolean(value) && typeof value === "object" && !Array.isArray(value), `${name} harus berupa object.`);
}

function assertIsoTimestamp(value: string, name: string): void {
  const parsed = new Date(value);
  assert(!Number.isNaN(parsed.valueOf()), `${name} harus berupa timestamp ISO yang valid.`);
  assert(parsed.toISOString() === value, `${name} harus memakai format ISO UTC canonical.`);
}

function compactTimestamp(isoTimestamp: string): string {
  assertIsoTimestamp(isoTimestamp, "requestedAt");
  return isoTimestamp.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function releaseSuffix(releaseId: string): string {
  const match = /-([a-f0-9]{7,12})$/.exec(releaseId);
  assert(match, `Release ID tidak valid: ${releaseId}.`);
  return match[1]!;
}

export function createRollbackId(requestedAt: string, fromReleaseId: string, toReleaseId: string): string {
  const rollbackId = `rb-${compactTimestamp(requestedAt)}-${releaseSuffix(fromReleaseId)}-${releaseSuffix(toReleaseId)}`;
  assertRollbackId(rollbackId);
  return rollbackId;
}

export function assertRollbackId(value: string): void {
  assert(
    /^rb-\d{8}T\d{6}Z-[a-f0-9]{7,12}-[a-f0-9]{7,12}$/.test(value),
    "Rollback ID harus memakai format rb-YYYYMMDDTHHMMSSZ-<from-sha>-<to-sha>.",
  );
}

function cloneImage(image: ReleaseImage): ReleaseImage {
  return { ...image };
}

function assertRollbackCompatibility(current: ReleaseRecord): {
  reference: string;
  evidence: string;
} {
  assert(current.database.schemaChanged !== null, "Current release belum memiliki bukti migration.");

  if (current.database.schemaChanged === false) {
    assert(current.database.rollbackCompatibility === "compatible", "Migration no-op harus ditandai compatible.");
    assert(current.database.compatibilityReference === "no-schema-change", "Migration no-op harus memakai reference no-schema-change.");
    return {
      reference: "no-schema-change",
      evidence: "Deployment current tidak mengubah schema database.",
    };
  }

  if (current.database.rollbackCompatibility === "incompatible") {
    const reference = current.database.compatibilityReference?.trim() || "tanpa reference";
    throw new Error(
      `Rollback ditolak: deployment current dinyatakan tidak kompatibel dengan schema saat ini (${reference}).`,
    );
  }
  assert(
    current.database.rollbackCompatibility === "compatible",
    "Rollback ditolak: deployment current mengubah schema dan belum memiliki approval compatibility eksplisit.",
  );
  const reference = current.database.compatibilityReference?.trim() ?? "";
  assert(reference.length >= 3 && reference !== "no-schema-change", "Compatibility reference manual belum valid.");
  const evaluation = current.checks.find(
    (check) =>
      check.name === "rollback-compatibility" &&
      check.status === "passed" &&
      check.detail?.includes(`reference=${reference}`),
  );
  assert(evaluation, "Bukti evaluasi compatibility manual tidak ditemukan pada current release metadata.");
  return {
    reference,
    evidence: evaluation.detail ?? `Compatibility disetujui dengan reference ${reference}.`,
  };
}

export function evaluateRollbackGuard(
  stateRoot: string,
  expectedTargetReleaseId?: string,
): RollbackGuardResult {
  const current = readCurrentRelease(stateRoot);
  const target = readPreviousRelease(stateRoot);
  assert(current, "Current release belum tersedia.");
  assert(target, "Previous release belum tersedia; rollback tidak dapat dilakukan.");
  assert(current.status === "healthy", "Current release harus berstatus healthy sebelum rollback.");
  assert(target.status === "healthy", "Previous release harus berstatus healthy sebelum menjadi target rollback.");
  assert(current.releaseId !== target.releaseId, "Current dan previous release tidak boleh sama.");
  assert(
    current.previousReleaseId === target.releaseId,
    `Previous pointer ${target.releaseId} tidak sama dengan previousReleaseId current ${current.previousReleaseId ?? "null"}.`,
  );
  if (expectedTargetReleaseId) {
    assert(
      target.releaseId === expectedTargetReleaseId,
      `Target rollback aktual ${target.releaseId} tidak sama dengan target yang diminta ${expectedTargetReleaseId}.`,
    );
  }

  for (const [name, image] of Object.entries(current.images)) {
    assert(image.digest !== null, `Current ${name} image belum memiliki digest.`);
  }
  for (const [name, image] of Object.entries(target.images)) {
    assert(image.digest !== null, `Target ${name} image belum memiliki digest.`);
  }

  const compatibility = assertRollbackCompatibility(current);
  return {
    current,
    target,
    compatibilityReference: compatibility.reference,
    compatibilityEvidence: compatibility.evidence,
  };
}

export function createRollbackPlan(input: {
  current: ReleaseRecord;
  target: ReleaseRecord;
  compatibilityReference: string;
  compatibilityEvidence: string;
  requestedAt?: string;
  operator?: string;
  hostname?: string;
}): RollbackRecord {
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  assertIsoTimestamp(requestedAt, "requestedAt");
  const record: RollbackRecord = {
    schemaVersion: ROLLBACK_STATE_SCHEMA_VERSION,
    rollbackId: createRollbackId(requestedAt, input.current.releaseId, input.target.releaseId),
    status: "planned",
    fromReleaseId: input.current.releaseId,
    fromRevision: input.current.revision,
    fromBuildDate: input.current.createdAt,
    toReleaseId: input.target.releaseId,
    toRevision: input.target.revision,
    toBuildDate: input.target.createdAt,
    requestedAt,
    updatedAt: requestedAt,
    completedAt: null,
    operator: (input.operator?.trim() || "unknown").replace(/[\r\n]+/g, " "),
    hostname: (input.hostname?.trim() || "unknown").replace(/[\r\n]+/g, " "),
    compatibility: {
      decision: "compatible",
      reference: input.compatibilityReference,
      evidence: input.compatibilityEvidence,
    },
    images: {
      fromApp: cloneImage(input.current.images.app),
      fromMigrator: cloneImage(input.current.images.migrator),
      fromOperations: cloneImage(input.current.images.operations),
      toApp: cloneImage(input.target.images.app),
      toMigrator: cloneImage(input.target.images.migrator),
      toOperations: cloneImage(input.target.images.operations),
    },
    checks: [],
    failure: null,
  };
  validateRollbackRecord(record);
  return record;
}

function validateImage(value: unknown, name: string, expectedReleaseId: string): void {
  assertPlainObject(value, name);
  assert(typeof value.repository === "string" && value.repository.length > 0, `${name}.repository wajib diisi.`);
  assert(typeof value.tag === "string" && value.tag.length > 0, `${name}.tag wajib diisi.`);
  assert(value.tag === expectedReleaseId, `${name}.tag harus sama dengan release ID ${expectedReleaseId}.`);
  assert(typeof value.reference === "string" && value.reference.length > 0, `${name}.reference wajib diisi.`);
  assert(typeof value.digest === "string" && /^sha256:[a-f0-9]{64}$/.test(value.digest), `${name}.digest wajib sha256.`);
  assert(value.reference === `${value.repository}:${value.tag}`, `${name}.reference tidak konsisten.`);
}

export function validateRollbackRecord(value: unknown): asserts value is RollbackRecord {
  assertPlainObject(value, "Rollback record");
  assert(value.schemaVersion === ROLLBACK_STATE_SCHEMA_VERSION, "Versi rollback state belum didukung.");
  assert(typeof value.rollbackId === "string", "rollbackId wajib berupa string.");
  assertRollbackId(value.rollbackId);
  assert(["planned", "completed", "failed"].includes(String(value.status)), "Status rollback tidak valid.");
  assert(typeof value.fromReleaseId === "string", "fromReleaseId wajib berupa string.");
  assertReleaseId(value.fromReleaseId);
  assert(typeof value.fromRevision === "string" && /^[a-f0-9]{7,64}$/.test(value.fromRevision), "fromRevision tidak valid.");
  assert(typeof value.fromBuildDate === "string", "fromBuildDate wajib berupa string.");
  assertIsoTimestamp(value.fromBuildDate, "fromBuildDate");
  assert(typeof value.toReleaseId === "string", "toReleaseId wajib berupa string.");
  assertReleaseId(value.toReleaseId);
  assert(typeof value.toRevision === "string" && /^[a-f0-9]{7,64}$/.test(value.toRevision), "toRevision tidak valid.");
  assert(typeof value.toBuildDate === "string", "toBuildDate wajib berupa string.");
  assertIsoTimestamp(value.toBuildDate, "toBuildDate");
  assert(value.fromReleaseId !== value.toReleaseId, "fromReleaseId dan toReleaseId tidak boleh sama.");
  assert(typeof value.requestedAt === "string", "requestedAt wajib berupa string.");
  assert(typeof value.updatedAt === "string", "updatedAt wajib berupa string.");
  assertIsoTimestamp(value.requestedAt, "requestedAt");
  assertIsoTimestamp(value.updatedAt, "updatedAt");
  assert(
    value.rollbackId === createRollbackId(value.requestedAt, value.fromReleaseId, value.toReleaseId),
    "rollbackId tidak konsisten dengan requestedAt/fromReleaseId/toReleaseId.",
  );
  assert(new Date(value.updatedAt) >= new Date(value.requestedAt), "updatedAt tidak boleh sebelum requestedAt.");
  assert(value.completedAt === null || typeof value.completedAt === "string", "completedAt harus null atau string.");
  if (typeof value.completedAt === "string") {
    assertIsoTimestamp(value.completedAt, "completedAt");
    assert(new Date(value.completedAt) >= new Date(value.requestedAt), "completedAt tidak boleh sebelum requestedAt.");
  }
  if (value.status === "planned") assert(value.completedAt === null, "Rollback planned belum boleh memiliki completedAt.");
  if (value.status === "completed") assert(value.completedAt !== null, "Rollback completed wajib memiliki completedAt.");
  assert(typeof value.operator === "string" && value.operator.length > 0, "operator wajib diisi.");
  assert(!/[\r\n]/.test(value.operator), "operator tidak boleh memiliki newline.");
  assert(typeof value.hostname === "string" && value.hostname.length > 0, "hostname wajib diisi.");
  assert(!/[\r\n]/.test(value.hostname), "hostname tidak boleh memiliki newline.");

  assertPlainObject(value.compatibility, "compatibility");
  assert(value.compatibility.decision === "compatible", "Rollback plan hanya boleh dibuat setelah compatibility passed.");
  assert(typeof value.compatibility.reference === "string" && value.compatibility.reference.length > 0, "Compatibility reference wajib diisi.");
  assert(typeof value.compatibility.evidence === "string" && value.compatibility.evidence.length > 0, "Compatibility evidence wajib diisi.");

  assertPlainObject(value.images, "images");
  validateImage(value.images.fromApp, "images.fromApp", value.fromReleaseId);
  validateImage(value.images.fromMigrator, "images.fromMigrator", value.fromReleaseId);
  validateImage(value.images.fromOperations, "images.fromOperations", value.fromReleaseId);
  validateImage(value.images.toApp, "images.toApp", value.toReleaseId);
  validateImage(value.images.toMigrator, "images.toMigrator", value.toReleaseId);
  validateImage(value.images.toOperations, "images.toOperations", value.toReleaseId);

  assert(Array.isArray(value.checks), "checks harus berupa array.");
  for (const [index, check] of value.checks.entries()) {
    assertPlainObject(check, `checks[${index}]`);
    assert(typeof check.name === "string" && check.name.length > 0, `checks[${index}].name wajib diisi.`);
    assert(["passed", "failed"].includes(String(check.status)), `checks[${index}].status tidak valid.`);
    assert(typeof check.checkedAt === "string", `checks[${index}].checkedAt wajib berupa string.`);
    assertIsoTimestamp(check.checkedAt, `checks[${index}].checkedAt`);
    assert(check.detail === null || typeof check.detail === "string", `checks[${index}].detail harus null atau string.`);
  }

  assert(value.failure === null || (typeof value.failure === "object" && !Array.isArray(value.failure)), "failure harus null atau object.");
  if (value.failure !== null) {
    assertPlainObject(value.failure, "failure");
    assert(typeof value.failure.stage === "string" && value.failure.stage.length > 0, "failure.stage wajib diisi.");
    assert(typeof value.failure.message === "string" && value.failure.message.length > 0, "failure.message wajib diisi.");
    assert(typeof value.failure.failedAt === "string", "failure.failedAt wajib berupa string.");
    assertIsoTimestamp(value.failure.failedAt, "failure.failedAt");
  }
}

export function parseRollbackRecord(content: string): RollbackRecord {
  const parsed = JSON.parse(content) as unknown;
  validateRollbackRecord(parsed);
  return parsed;
}

export function readRollbackRecord(filePath: string): RollbackRecord {
  assert(existsSync(filePath), `Rollback metadata tidak ditemukan: ${filePath}.`);
  return parseRollbackRecord(readFileSync(filePath, "utf8"));
}

export function resolveRollbackStatePaths(stateRoot: string): RollbackStatePaths {
  const root = path.resolve(stateRoot);
  return {
    root,
    rollbacks: path.join(root, "rollbacks"),
    work: path.join(root, "rollback-work"),
  };
}

export function ensureRollbackStateDirectories(stateRoot: string): RollbackStatePaths {
  const paths = resolveRollbackStatePaths(stateRoot);
  for (const directory of [paths.rollbacks, paths.work]) {
    mkdirSync(directory, { recursive: true, mode: DEPLOYMENT_STATE_DIRECTORY_MODE });
  }
  return paths;
}

export function writeRollbackHistory(stateRoot: string, record: RollbackRecord): string {
  validateRollbackRecord(record);
  const paths = ensureRollbackStateDirectories(stateRoot);
  const target = path.join(paths.rollbacks, `${record.rollbackId}.json`);
  writeJsonAtomic(target, record);
  return target;
}

export function appendRollbackChecks(record: RollbackRecord, checks: ReleaseCheck[]): RollbackRecord {
  const names = new Set(checks.map((check) => check.name));
  const updated: RollbackRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
    checks: [...record.checks.filter((check) => !names.has(check.name)), ...checks],
  };
  validateRollbackRecord(updated);
  return updated;
}

export function createRollbackCurrentSnapshot(input: {
  target: ReleaseRecord;
  outgoing: ReleaseRecord;
  rollbackId: string;
  completedAt: string;
}): ReleaseRecord {
  const check: ReleaseCheck = {
    name: "application-rollback",
    status: "passed",
    checkedAt: input.completedAt,
    detail: `${input.rollbackId}; from=${input.outgoing.releaseId}; to=${input.target.releaseId}; database-unchanged`,
  };
  const snapshot: ReleaseRecord = {
    ...input.target,
    updatedAt: input.completedAt,
    previousReleaseId: input.outgoing.releaseId,
    database: {
      migrationCountBefore: input.outgoing.database.migrationCountAfter,
      migrationCountAfter: input.outgoing.database.migrationCountAfter,
      schemaChanged: false,
      rollbackCompatibility: "compatible",
      compatibilityReference: "no-schema-change",
    },
    checks: [...input.target.checks.filter((item) => item.name !== check.name), check],
    failure: null,
  };
  validateReleaseRecord(snapshot);
  return snapshot;
}

export function promoteRollbackTarget(input: {
  stateRoot: string;
  current: ReleaseRecord;
  target: ReleaseRecord;
  rollbackId: string;
  completedAt: string;
}): ReleaseRecord {
  const currentOnDisk = readCurrentRelease(input.stateRoot);
  const previousOnDisk = readPreviousRelease(input.stateRoot);
  assert(currentOnDisk?.releaseId === input.current.releaseId, "Current release berubah selama rollback.");
  assert(previousOnDisk?.releaseId === input.target.releaseId, "Previous release berubah selama rollback.");

  const snapshot = createRollbackCurrentSnapshot({
    target: input.target,
    outgoing: input.current,
    rollbackId: input.rollbackId,
    completedAt: input.completedAt,
  });
  const deploymentPaths = {
    current: path.join(path.resolve(input.stateRoot), "current.json"),
    previous: path.join(path.resolve(input.stateRoot), "previous.json"),
  };
  writeJsonAtomic(deploymentPaths.previous, input.current);
  writeJsonAtomic(deploymentPaths.current, snapshot);
  return snapshot;
}
