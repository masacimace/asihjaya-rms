import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export const DEPLOYMENT_STATE_SCHEMA_VERSION = 2 as const;
export const DEPLOYMENT_STATE_DIRECTORY_MODE = 0o750;
export const DEPLOYMENT_STATE_FILE_MODE = 0o640;

export type ReleaseStatus =
  | "planned"
  | "deploying"
  | "healthy"
  | "failed"
  | "rolled-back";

export type RollbackCompatibility =
  | "not-evaluated"
  | "compatible"
  | "incompatible"
  | "approval-required";

export type ReleaseImage = {
  repository: string;
  tag: string;
  reference: string;
  digest: string | null;
};

export type ReleaseCheck = {
  name: string;
  status: "passed" | "failed";
  checkedAt: string;
  detail: string | null;
};

export type ReleaseRecord = {
  schemaVersion: typeof DEPLOYMENT_STATE_SCHEMA_VERSION;
  releaseId: string;
  revision: string;
  shortRevision: string;
  sourceRef: string;
  createdAt: string;
  updatedAt: string;
  status: ReleaseStatus;
  previousReleaseId: string | null;
  images: {
    app: ReleaseImage;
    migrator: ReleaseImage;
    operations: ReleaseImage;
  };
  deployment: {
    operator: string;
    hostname: string;
    startedAt: string;
    completedAt: string | null;
  };
  database: {
    migrationCountBefore: number | null;
    migrationCountAfter: number | null;
    schemaChanged: boolean | null;
    rollbackCompatibility: RollbackCompatibility;
    compatibilityReference: string | null;
  };
  backup: {
    backupId: string;
    metadataPath: string;
    offsiteReceiptPath: string;
    verifiedAt: string;
  } | null;
  checks: ReleaseCheck[];
  failure: {
    stage: string;
    message: string;
    failedAt: string;
  } | null;
};

export type CreateReleasePlanInput = {
  revision: string;
  sourceRef: string;
  createdAt?: string;
  appRepository?: string;
  migratorRepository?: string;
  operationsRepository?: string;
  previousReleaseId?: string | null;
  operator?: string;
  hostname?: string;
};

export type DeploymentStatePaths = {
  root: string;
  current: string;
  previous: string;
  history: string;
  failed: string;
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

function normalizeRevision(revision: string): string {
  const normalized = revision.trim().toLowerCase();
  assert(/^[a-f0-9]{7,64}$/.test(normalized), "Git revision harus berupa 7 sampai 64 karakter hexadecimal.");
  return normalized;
}

function normalizeRepository(repository: string, name: string): string {
  const normalized = repository.trim();
  assert(normalized.length > 0, `${name} wajib diisi.`);
  assert(!/\s/.test(normalized), `${name} tidak boleh mengandung whitespace.`);
  assert(!normalized.includes("@"), `${name} hanya boleh berisi repository tanpa digest.`);

  const lastSlash = normalized.lastIndexOf("/");
  const lastColon = normalized.lastIndexOf(":");
  assert(
    lastColon <= lastSlash,
    `${name} hanya boleh berisi repository tanpa image tag. Gunakan release ID sebagai tag immutable.`,
  );
  assert(
    /^[a-zA-Z0-9._/-]+(?::[0-9]+\/[a-zA-Z0-9._/-]+)?$/.test(normalized),
    `${name} bukan repository image yang valid.`,
  );
  return normalized;
}

function compactTimestamp(isoTimestamp: string): string {
  assertIsoTimestamp(isoTimestamp, "createdAt");
  return isoTimestamp.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function createReleaseId(createdAt: string, revision: string): string {
  const normalizedRevision = normalizeRevision(revision);
  const releaseId = `${compactTimestamp(createdAt)}-${normalizedRevision.slice(0, 12)}`;
  assertReleaseId(releaseId);
  return releaseId;
}

export function assertReleaseId(value: string): void {
  const match = /^(\d{8}T\d{6}Z)-([a-f0-9]{7,12})$/.exec(value);
  assert(match, "Release ID harus memakai format YYYYMMDDTHHMMSSZ-<git-sha>." );

  const compact = match[1]!;
  const iso = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T${compact.slice(9, 11)}:${compact.slice(11, 13)}:${compact.slice(13, 15)}.000Z`;
  const parsed = new Date(iso);
  assert(!Number.isNaN(parsed.valueOf()), "Timestamp pada release ID tidak valid.");
  assert(compactTimestamp(parsed.toISOString()) === compact, "Timestamp pada release ID tidak canonical.");
}

export function buildImmutableImage(repository: string, releaseId: string): ReleaseImage {
  const normalizedRepository = normalizeRepository(repository, "Image repository");
  assertReleaseId(releaseId);
  return {
    repository: normalizedRepository,
    tag: releaseId,
    reference: `${normalizedRepository}:${releaseId}`,
    digest: null,
  };
}

export function assertImmutableImageReference(reference: string, expectedReleaseId?: string): void {
  const normalized = reference.trim();
  assert(normalized.length > 0, "Image reference wajib diisi.");
  assert(!/\s/.test(normalized), "Image reference tidak boleh mengandung whitespace.");
  assert(!normalized.endsWith(":latest"), "Image tag latest tidak boleh digunakan untuk deployment.");
  assert(!normalized.endsWith(":production"), "Image tag production bersifat mutable dan tidak boleh digunakan untuk deployment.");

  if (normalized.includes("@")) {
    assert(/@sha256:[a-f0-9]{64}$/.test(normalized), "Image digest harus memakai sha256 64 karakter.");
    return;
  }

  const lastSlash = normalized.lastIndexOf("/");
  const lastColon = normalized.lastIndexOf(":");
  assert(lastColon > lastSlash, "Image reference wajib memiliki immutable tag atau digest.");
  const tag = normalized.slice(lastColon + 1);
  assertReleaseId(tag);
  if (expectedReleaseId) {
    assert(tag === expectedReleaseId, `Image tag ${tag} tidak sama dengan release ID ${expectedReleaseId}.`);
  }
}

export function createPlannedRelease(input: CreateReleasePlanInput): ReleaseRecord {
  const revision = normalizeRevision(input.revision);
  const createdAt = input.createdAt ?? new Date().toISOString();
  assertIsoTimestamp(createdAt, "createdAt");
  const releaseId = createReleaseId(createdAt, revision);
  const previousReleaseId = input.previousReleaseId ?? null;
  if (previousReleaseId) assertReleaseId(previousReleaseId);

  const record: ReleaseRecord = {
    schemaVersion: DEPLOYMENT_STATE_SCHEMA_VERSION,
    releaseId,
    revision,
    shortRevision: revision.slice(0, 12),
    sourceRef: input.sourceRef.trim(),
    createdAt,
    updatedAt: createdAt,
    status: "planned",
    previousReleaseId,
    images: {
      app: buildImmutableImage(input.appRepository ?? "asihjaya-rms", releaseId),
      migrator: buildImmutableImage(input.migratorRepository ?? "asihjaya-rms-migrator", releaseId),
      operations: buildImmutableImage(input.operationsRepository ?? "asihjaya-rms-operations", releaseId),
    },
    deployment: {
      operator: input.operator?.trim() || "unknown",
      hostname: input.hostname?.trim() || "unknown",
      startedAt: createdAt,
      completedAt: null,
    },
    database: {
      migrationCountBefore: null,
      migrationCountAfter: null,
      schemaChanged: null,
      rollbackCompatibility: "not-evaluated",
      compatibilityReference: null,
    },
    backup: null,
    checks: [],
    failure: null,
  };

  assert(record.sourceRef.length > 0, "Source ref wajib diisi.");
  validateReleaseRecord(record);
  return record;
}

function assertNullableInteger(value: unknown, name: string): void {
  assert(
    value === null || (Number.isSafeInteger(value) && Number(value) >= 0),
    `${name} harus null atau bilangan bulat non-negatif.`,
  );
}

function validateReleaseImage(value: unknown, name: string, releaseId: string): void {
  assertPlainObject(value, name);
  assert(typeof value.repository === "string", `${name}.repository wajib berupa string.`);
  assert(typeof value.tag === "string", `${name}.tag wajib berupa string.`);
  assert(typeof value.reference === "string", `${name}.reference wajib berupa string.`);
  assert(value.digest === null || typeof value.digest === "string", `${name}.digest harus null atau string.`);
  normalizeRepository(value.repository, `${name}.repository`);
  assert(value.tag === releaseId, `${name}.tag harus sama dengan release ID.`);
  assert(value.reference === `${value.repository}:${releaseId}`, `${name}.reference tidak konsisten.`);
  assertImmutableImageReference(value.reference, releaseId);
  if (value.digest !== null) {
    assert(/^sha256:[a-f0-9]{64}$/.test(value.digest), `${name}.digest harus berupa sha256 64 karakter.`);
  }
}

export function validateReleaseRecord(value: unknown): asserts value is ReleaseRecord {
  assertPlainObject(value, "Release record");
  assert(value.schemaVersion === DEPLOYMENT_STATE_SCHEMA_VERSION, "Versi deployment state belum didukung.");
  assert(typeof value.releaseId === "string", "releaseId wajib berupa string.");
  assertReleaseId(value.releaseId);
  assert(typeof value.revision === "string", "revision wajib berupa string.");
  const revision = normalizeRevision(value.revision);
  assert(typeof value.shortRevision === "string", "shortRevision wajib berupa string.");
  assert(value.shortRevision === revision.slice(0, 12), "shortRevision tidak konsisten dengan revision.");
  assert(typeof value.sourceRef === "string" && value.sourceRef.trim().length > 0, "sourceRef wajib diisi.");
  assert(typeof value.createdAt === "string", "createdAt wajib berupa string.");
  assert(typeof value.updatedAt === "string", "updatedAt wajib berupa string.");
  assert(value.releaseId === createReleaseId(value.createdAt, revision), "releaseId tidak konsisten dengan createdAt dan revision.");
  assertIsoTimestamp(value.createdAt, "createdAt");
  assertIsoTimestamp(value.updatedAt, "updatedAt");
  assert(new Date(value.updatedAt).valueOf() >= new Date(value.createdAt).valueOf(), "updatedAt tidak boleh lebih awal dari createdAt.");
  assert(
    ["planned", "deploying", "healthy", "failed", "rolled-back"].includes(String(value.status)),
    "Status release tidak valid.",
  );
  assert(value.previousReleaseId === null || typeof value.previousReleaseId === "string", "previousReleaseId harus null atau string.");
  if (typeof value.previousReleaseId === "string") assertReleaseId(value.previousReleaseId);

  assertPlainObject(value.images, "images");
  validateReleaseImage(value.images.app, "images.app", value.releaseId);
  validateReleaseImage(value.images.migrator, "images.migrator", value.releaseId);
  validateReleaseImage(value.images.operations, "images.operations", value.releaseId);

  assertPlainObject(value.deployment, "deployment");
  assert(typeof value.deployment.operator === "string" && value.deployment.operator.length > 0, "deployment.operator wajib diisi.");
  assert(typeof value.deployment.hostname === "string" && value.deployment.hostname.length > 0, "deployment.hostname wajib diisi.");
  assert(typeof value.deployment.startedAt === "string", "deployment.startedAt wajib berupa string.");
  assertIsoTimestamp(value.deployment.startedAt, "deployment.startedAt");
  assert(value.deployment.completedAt === null || typeof value.deployment.completedAt === "string", "deployment.completedAt harus null atau string.");
  if (typeof value.deployment.completedAt === "string") assertIsoTimestamp(value.deployment.completedAt, "deployment.completedAt");

  assertPlainObject(value.database, "database");
  assertNullableInteger(value.database.migrationCountBefore, "database.migrationCountBefore");
  assertNullableInteger(value.database.migrationCountAfter, "database.migrationCountAfter");
  assert(value.database.schemaChanged === null || typeof value.database.schemaChanged === "boolean", "database.schemaChanged harus null atau boolean.");
  assert(
    ["not-evaluated", "compatible", "incompatible", "approval-required"].includes(String(value.database.rollbackCompatibility)),
    "database.rollbackCompatibility tidak valid.",
  );
  assert(
    value.database.compatibilityReference === null || typeof value.database.compatibilityReference === "string",
    "database.compatibilityReference harus null atau string.",
  );

  assert(value.backup === null || (typeof value.backup === "object" && !Array.isArray(value.backup)), "backup harus null atau object.");
  if (value.backup !== null) {
    assertPlainObject(value.backup, "backup");
    for (const name of ["backupId", "metadataPath", "offsiteReceiptPath", "verifiedAt"] as const) {
      assert(typeof value.backup[name] === "string" && value.backup[name].length > 0, `backup.${name} wajib diisi.`);
    }
    assertIsoTimestamp(value.backup.verifiedAt as string, "backup.verifiedAt");
  }

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

export function parseReleaseRecord(content: string): ReleaseRecord {
  const parsed = JSON.parse(content) as unknown;
  validateReleaseRecord(parsed);
  return parsed;
}

export function resolveDeploymentStatePaths(rootDirectory: string): DeploymentStatePaths {
  const root = path.resolve(rootDirectory);
  assert(root !== path.parse(root).root, "Deployment state root tidak boleh menunjuk root filesystem.");
  return {
    root,
    current: path.join(root, "current.json"),
    previous: path.join(root, "previous.json"),
    history: path.join(root, "history"),
    failed: path.join(root, "failed"),
  };
}

export function ensureDeploymentStateDirectories(rootDirectory: string): DeploymentStatePaths {
  const paths = resolveDeploymentStatePaths(rootDirectory);
  for (const directory of [paths.root, paths.history, paths.failed]) {
    mkdirSync(directory, { recursive: true, mode: DEPLOYMENT_STATE_DIRECTORY_MODE });
  }
  return paths;
}

function syncFile(filePath: string): void {
  // Windows requires a write-capable handle for FlushFileBuffers, which is
  // what Node uses to implement fsync. POSIX accepts a read-only descriptor.
  const descriptor = openSync(filePath, process.platform === "win32" ? "r+" : "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function syncDirectory(directory: string): void {
  // Directory fsync is a POSIX durability primitive and is not supported by
  // Windows. The production deployment runtime is Linux, so keep the stronger
  // guarantee there while allowing local Windows validation to run.
  if (process.platform === "win32") return;

  const descriptor = openSync(directory, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export function writeJsonAtomic(filePath: string, value: unknown): void {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);
  mkdirSync(directory, { recursive: true, mode: DEPLOYMENT_STATE_DIRECTORY_MODE });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(absolutePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: DEPLOYMENT_STATE_FILE_MODE,
      flag: "wx",
    });
    syncFile(temporaryPath);
    renameSync(temporaryPath, absolutePath);
    syncDirectory(directory);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}

export function writeReleaseHistory(rootDirectory: string, record: ReleaseRecord): string {
  validateReleaseRecord(record);
  const paths = ensureDeploymentStateDirectories(rootDirectory);
  const directory = record.status === "failed" ? paths.failed : paths.history;
  const target = path.join(directory, `${record.releaseId}.json`);
  writeJsonAtomic(target, record);
  return target;
}

export function readReleaseFile(filePath: string): ReleaseRecord {
  assert(existsSync(filePath), `Release metadata tidak ditemukan: ${filePath}.`);
  return parseReleaseRecord(readFileSync(filePath, "utf8"));
}

export function readCurrentRelease(rootDirectory: string): ReleaseRecord | null {
  const paths = resolveDeploymentStatePaths(rootDirectory);
  if (!existsSync(paths.current)) return null;
  return readReleaseFile(paths.current);
}

export function readPreviousRelease(rootDirectory: string): ReleaseRecord | null {
  const paths = resolveDeploymentStatePaths(rootDirectory);
  if (!existsSync(paths.previous)) return null;
  return readReleaseFile(paths.previous);
}

function assertCompatibilityReference(value: string): string {
  const normalized = value.trim();
  assert(
    /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$/.test(normalized),
    "Compatibility reference harus 3-200 karakter dan hanya memakai huruf, angka, titik, underscore, colon, slash, atau dash.",
  );
  assert(normalized !== "no-schema-change", "Reference no-schema-change hanya boleh dibuat otomatis oleh migration no-op.");
  return normalized;
}

export function updateCurrentReleaseCompatibility(
  rootDirectory: string,
  decision: "compatible" | "incompatible",
  reference: string,
  evaluatedBy: string,
  evaluatedAt = new Date().toISOString(),
): ReleaseRecord {
  const paths = ensureDeploymentStateDirectories(rootDirectory);
  const current = readCurrentRelease(rootDirectory);
  assert(current, "Current release belum tersedia.");
  assert(current.status === "healthy", "Compatibility hanya boleh dievaluasi untuk current release yang healthy.");
  assert(current.database.schemaChanged === true, "Compatibility manual hanya diperlukan ketika deployment mengubah schema.");
  assertIsoTimestamp(evaluatedAt, "evaluatedAt");

  const normalizedReference = assertCompatibilityReference(reference);
  const normalizedEvaluator = evaluatedBy.replace(/[\r\n]+/g, " ").trim().slice(0, 160);
  assert(normalizedEvaluator.length > 0, "Evaluator compatibility wajib diisi.");
  const check: ReleaseCheck = {
    name: "rollback-compatibility",
    status: decision === "compatible" ? "passed" : "failed",
    checkedAt: evaluatedAt,
    detail: `${decision}; reference=${normalizedReference}; evaluatedBy=${normalizedEvaluator}`,
  };
  const updated: ReleaseRecord = {
    ...current,
    updatedAt: evaluatedAt,
    database: {
      ...current.database,
      rollbackCompatibility: decision,
      compatibilityReference: normalizedReference,
    },
    checks: [...current.checks.filter((item) => item.name !== check.name), check],
  };
  validateReleaseRecord(updated);
  writeReleaseHistory(rootDirectory, updated);
  writeJsonAtomic(paths.current, updated);
  return updated;
}

export function promoteHealthyRelease(rootDirectory: string, record: ReleaseRecord): void {
  validateReleaseRecord(record);
  assert(record.status === "healthy", "Hanya release berstatus healthy yang boleh dipromosikan menjadi current.");
  const paths = ensureDeploymentStateDirectories(rootDirectory);
  const current = existsSync(paths.current) ? readReleaseFile(paths.current) : null;

  if (current) {
    assert(
      record.previousReleaseId === current.releaseId,
      `previousReleaseId harus menunjuk current release ${current.releaseId}.`,
    );
    writeJsonAtomic(paths.previous, current);
  } else {
    assert(record.previousReleaseId === null, "Release pertama tidak boleh memiliki previousReleaseId.");
    rmSync(paths.previous, { force: true });
  }

  writeReleaseHistory(rootDirectory, record);
  writeJsonAtomic(paths.current, record);
}
