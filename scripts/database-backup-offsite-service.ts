import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  readBackupArtifact,
  sha256File,
  type DatabaseBackupArtifact,
} from "./database-backup-state";
import {
  buildOffsiteObjectKeys,
  localOffsiteReceiptPath,
  parseOffsiteReceipt,
  planOffsiteRetention,
  type DatabaseBackupOffsiteReceipt,
  type DatabaseBackupOffsiteRetentionPolicy,
  type DatabaseBackupOffsiteStatus,
  type DatabaseBackupOffsiteObject,
} from "./database-backup-offsite-state";
import type {
  DatabaseBackupOffsiteStore,
  OffsiteObjectHead,
} from "./database-backup-offsite-store";

export type DatabaseBackupOffsiteConfig = {
  provider: "backblaze-b2";
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  objectLockMode: "COMPLIANCE" | "GOVERNANCE";
  objectLockDays: number;
  fullVerification: boolean;
  maxArchiveBytes: number;
  statusPath: string;
  retention: DatabaseBackupOffsiteRetentionPolicy;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function atomicWriteJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const partialPath = `${filePath}.partial`;
  writeFileSync(partialPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(partialPath, filePath);
}

function objectMetadata(input: {
  artifact: DatabaseBackupArtifact;
  role: "archive" | "checksum" | "metadata" | "receipt";
  sha256: string;
}): Record<string, string> {
  return {
    "backup-id": input.artifact.metadata.backupId,
    "backup-kind": input.artifact.metadata.kind,
    "backup-environment": input.artifact.metadata.environment,
    "artifact-role": input.role,
    "artifact-sha256": input.sha256,
  };
}

function assertHeadMatches(input: {
  head: OffsiteObjectHead | null;
  key: string;
  bytes: number;
  sha256: string;
  role: string;
  retainUntil: Date;
  mode: string;
}): OffsiteObjectHead {
  assert(input.head, `Object off-site ${input.key} tidak ditemukan setelah upload.`);
  assert(input.head.bytes === input.bytes, `Ukuran object off-site ${input.role} tidak cocok.`);
  assert(input.head.metadata["artifact-sha256"] === input.sha256, `Metadata checksum object ${input.role} tidak cocok.`);
  assert(input.head.objectLockMode === input.mode, `Object Lock mode ${input.role} tidak cocok.`);
  assert(
    input.head.objectLockRetainUntil &&
      Math.abs(input.head.objectLockRetainUntil.getTime() - input.retainUntil.getTime()) < 1000,
    `Object Lock retention ${input.role} tidak cocok.`,
  );
  return input.head;
}

async function verifyRemoteObject(input: {
  store: DatabaseBackupOffsiteStore;
  object: DatabaseBackupOffsiteObject;
  receipt: DatabaseBackupOffsiteReceipt;
  fullVerification: boolean;
}): Promise<void> {
  const head = input.store.head(input.object.key);
  const resolvedHead = await head;
  assert(resolvedHead, `Object remote ${input.object.role} tidak ditemukan.`);
  assert(resolvedHead.bytes === input.object.bytes, `Ukuran remote ${input.object.role} berubah.`);
  assert(
    resolvedHead.metadata["artifact-sha256"] === input.object.sha256,
    `Metadata SHA-256 remote ${input.object.role} berubah.`,
  );
  assert(
    resolvedHead.objectLockMode === input.receipt.objectLock.mode,
    `Object Lock mode remote ${input.object.role} berubah.`,
  );
  assert(
    resolvedHead.objectLockRetainUntil &&
      Math.abs(
        resolvedHead.objectLockRetainUntil.getTime() -
          Date.parse(input.receipt.objectLock.retainUntil),
      ) < 1000,
    `Object Lock retention remote ${input.object.role} berubah.`,
  );
  if (input.fullVerification) {
    const remoteSha256 = await input.store.sha256(input.object.key);
    assert(remoteSha256 === input.object.sha256, `Full SHA-256 verification remote ${input.object.role} gagal.`);
  }
}

export async function verifyOffsiteReceipt(input: {
  store: DatabaseBackupOffsiteStore;
  receiptKey: string;
  requireFullVerification?: boolean;
}): Promise<DatabaseBackupOffsiteReceipt> {
  const receiptContent = await input.store.getText(input.receiptKey);
  const receipt = parseOffsiteReceipt(receiptContent);
  assert(receipt.receiptKey === input.receiptKey, "Receipt key remote tidak cocok dengan isi receipt.");
  const receiptSha256 = sha256Text(receiptContent);
  const receiptHead = await input.store.head(input.receiptKey);
  assert(receiptHead, "Receipt remote tidak ditemukan saat verifikasi.");
  assert(
    receiptHead.bytes === Buffer.byteLength(receiptContent, "utf8"),
    "Ukuran receipt remote berubah.",
  );
  assert(
    receiptHead.metadata["artifact-sha256"] === receiptSha256,
    "Metadata SHA-256 receipt remote berubah.",
  );
  assert(
    receiptHead.objectLockMode === receipt.objectLock.mode,
    "Object Lock mode receipt remote berubah.",
  );
  assert(
    receiptHead.objectLockRetainUntil &&
      Math.abs(
        receiptHead.objectLockRetainUntil.getTime() - Date.parse(receipt.objectLock.retainUntil),
      ) < 1000,
    "Object Lock retention receipt remote berubah.",
  );
  const fullVerification = input.requireFullVerification ?? receipt.fullVerification;
  for (const object of receipt.objects) {
    await verifyRemoteObject({ store: input.store, object, receipt, fullVerification });
  }
  return receipt;
}

export async function uploadBackupOffsite(input: {
  store: DatabaseBackupOffsiteStore;
  artifact: DatabaseBackupArtifact;
  config: DatabaseBackupOffsiteConfig;
  now?: Date;
}): Promise<DatabaseBackupOffsiteReceipt> {
  const now = input.now ?? new Date();
  assert(!Number.isNaN(now.getTime()), "Timestamp upload off-site tidak valid.");
  assert(existsSync(input.artifact.archivePath), "Archive backup lokal tidak tersedia.");
  assert(existsSync(input.artifact.checksumPath), "Checksum backup lokal tidak tersedia.");
  assert(existsSync(input.artifact.metadataPath), "Metadata backup lokal tidak tersedia.");
  const archiveBytes = statSync(input.artifact.archivePath).size;
  assert(archiveBytes === input.artifact.metadata.archive.bytes, "Ukuran archive lokal tidak cocok dengan metadata.");
  assert(archiveBytes <= input.config.maxArchiveBytes, "Archive melebihi batas single-object upload off-site.");
  const archiveSha256 = await sha256File(input.artifact.archivePath);
  assert(archiveSha256 === input.artifact.metadata.archive.sha256, "Checksum archive lokal tidak cocok.");
  const checksumContent = readFileSync(input.artifact.checksumPath, "utf8");
  assert(
    checksumContent.trim() === `${archiveSha256}  ${input.artifact.metadata.fileName}`,
    "File checksum lokal tidak cocok.",
  );
  const metadataContent = readFileSync(input.artifact.metadataPath, "utf8");
  const checksumSha256 = sha256Text(checksumContent);
  const metadataSha256 = sha256Text(metadataContent);
  const keys = buildOffsiteObjectKeys({ prefix: input.config.prefix, metadata: input.artifact.metadata });

  const existingReceiptHead = await input.store.head(keys.receiptKey);
  if (existingReceiptHead) {
    const existing = await verifyOffsiteReceipt({
      store: input.store,
      receiptKey: keys.receiptKey,
      requireFullVerification: input.config.fullVerification,
    });
    assert(existing.backup.backupId === input.artifact.metadata.backupId, "Receipt remote existing memiliki backupId berbeda.");
    atomicWriteJson(localOffsiteReceiptPath(input.artifact.metadataPath), existing);
    return existing;
  }

  const retainUntil = new Date(now.getTime() + input.config.objectLockDays * 86_400_000);
  const sources = [
    {
      role: "archive" as const,
      key: keys.archiveKey,
      filePath: input.artifact.archivePath,
      bytes: archiveBytes,
      sha256: archiveSha256,
      contentType: "application/octet-stream",
    },
    {
      role: "checksum" as const,
      key: keys.checksumKey,
      filePath: input.artifact.checksumPath,
      bytes: statSync(input.artifact.checksumPath).size,
      sha256: checksumSha256,
      contentType: "text/plain; charset=utf-8",
    },
    {
      role: "metadata" as const,
      key: keys.metadataKey,
      filePath: input.artifact.metadataPath,
      bytes: statSync(input.artifact.metadataPath).size,
      sha256: metadataSha256,
      contentType: "application/json; charset=utf-8",
    },
  ];

  const objects: DatabaseBackupOffsiteObject[] = [];
  for (const source of sources) {
    const uploaded = await input.store.put({
      key: source.key,
      filePath: source.filePath,
      contentType: source.contentType,
      metadata: objectMetadata({ artifact: input.artifact, role: source.role, sha256: source.sha256 }),
      objectLockMode: input.config.objectLockMode,
      retainUntil,
    });
    const head = assertHeadMatches({
      head: await input.store.head(source.key),
      key: source.key,
      bytes: source.bytes,
      sha256: source.sha256,
      role: source.role,
      retainUntil,
      mode: input.config.objectLockMode,
    });
    if (input.config.fullVerification) {
      assert(
        (await input.store.sha256(source.key)) === source.sha256,
        `Full SHA-256 verification ${source.role} gagal setelah upload.`,
      );
    }
    objects.push({
      role: source.role,
      key: source.key,
      bytes: source.bytes,
      sha256: source.sha256,
      etag: head.etag ?? uploaded.etag,
    });
  }

  const receipt: DatabaseBackupOffsiteReceipt = {
    version: 1,
    provider: "backblaze-b2",
    bucket: input.config.bucket,
    endpoint: input.config.endpoint,
    region: input.config.region,
    prefix: input.config.prefix,
    receiptKey: keys.receiptKey,
    uploadedAt: now.toISOString(),
    verifiedAt: new Date().toISOString(),
    fullVerification: input.config.fullVerification,
    objectLock: {
      mode: input.config.objectLockMode,
      retainUntil: retainUntil.toISOString(),
    },
    backup: {
      backupId: input.artifact.metadata.backupId,
      fileName: input.artifact.metadata.fileName,
      createdAt: input.artifact.metadata.createdAt,
      environment: input.artifact.metadata.environment,
      kind: input.artifact.metadata.kind,
      label: input.artifact.metadata.label,
      releaseId: input.artifact.metadata.releaseId,
      protected: input.artifact.metadata.protected,
    },
    objects,
  };
  const receiptContent = `${JSON.stringify(receipt, null, 2)}\n`;
  const receiptSha256 = sha256Text(receiptContent);
  await input.store.put({
    key: keys.receiptKey,
    body: receiptContent,
    contentType: "application/json; charset=utf-8",
    metadata: objectMetadata({ artifact: input.artifact, role: "receipt", sha256: receiptSha256 }),
    objectLockMode: input.config.objectLockMode,
    retainUntil,
  });
  assertHeadMatches({
    head: await input.store.head(keys.receiptKey),
    key: keys.receiptKey,
    bytes: Buffer.byteLength(receiptContent),
    sha256: receiptSha256,
    role: "receipt",
    retainUntil,
    mode: input.config.objectLockMode,
  });
  const verifiedReceipt = await verifyOffsiteReceipt({
    store: input.store,
    receiptKey: keys.receiptKey,
    requireFullVerification: input.config.fullVerification,
  });
  atomicWriteJson(localOffsiteReceiptPath(input.artifact.metadataPath), verifiedReceipt);
  return verifiedReceipt;
}

export async function listOffsiteReceipts(input: {
  store: DatabaseBackupOffsiteStore;
  prefix: string;
  environment?: string;
}): Promise<DatabaseBackupOffsiteReceipt[]> {
  const listPrefix = input.environment
    ? `${input.prefix}/${input.environment}/backups/`
    : `${input.prefix}/`;
  const receiptKeys = (await input.store.list(listPrefix))
    .filter((key) => key.endsWith(".offsite.json"))
    .sort();
  const receipts: DatabaseBackupOffsiteReceipt[] = [];
  for (const key of receiptKeys) {
    try {
      receipts.push(parseOffsiteReceipt(await input.store.getText(key)));
    } catch (error) {
      console.warn(`SKIP off-site receipt ${key}: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }
  return receipts;
}

export async function pruneOffsiteBackups(input: {
  store: DatabaseBackupOffsiteStore;
  prefix: string;
  environment?: string;
  policy: DatabaseBackupOffsiteRetentionPolicy;
  now?: Date;
}): Promise<{ deleted: number; kept: number }> {
  const receipts = await listOffsiteReceipts(input);
  const decisions = planOffsiteRetention(receipts, input.policy, input.now);
  let deleted = 0;
  for (const decision of decisions) {
    if (decision.action === "keep") continue;
    await input.store.delete(
      decision.receipt.objects.map((object) => object.key),
    );
    await input.store.delete([decision.receipt.receiptKey]);
    deleted += 1;
    console.log(`Retention off-site menghapus ${decision.receipt.backup.fileName}: ${decision.reason}.`);
  }
  return { deleted, kept: decisions.length - deleted };
}

export async function downloadOffsiteBackup(input: {
  store: DatabaseBackupOffsiteStore;
  receipt: DatabaseBackupOffsiteReceipt;
  outputDirectory: string;
}): Promise<DatabaseBackupArtifact> {
  mkdirSync(input.outputDirectory, { recursive: true, mode: 0o700 });
  const archiveObject = input.receipt.objects.find((object) => object.role === "archive");
  const checksumObject = input.receipt.objects.find((object) => object.role === "checksum");
  const metadataObject = input.receipt.objects.find((object) => object.role === "metadata");
  assert(archiveObject && checksumObject && metadataObject, "Receipt remote tidak memiliki artifact lengkap.");
  const baseName = input.receipt.backup.fileName.replace(/\.dump$/, "");
  const archivePath = path.join(input.outputDirectory, input.receipt.backup.fileName);
  const checksumPath = path.join(input.outputDirectory, `${baseName}.sha256`);
  const metadataPath = path.join(input.outputDirectory, `${baseName}.json`);
  for (const filePath of [archivePath, checksumPath, metadataPath]) rmSync(`${filePath}.partial`, { force: true });
  await input.store.download(archiveObject.key, `${archivePath}.partial`);
  await input.store.download(checksumObject.key, `${checksumPath}.partial`);
  await input.store.download(metadataObject.key, `${metadataPath}.partial`);
  assert((await sha256File(`${archivePath}.partial`)) === archiveObject.sha256, "Checksum archive hasil download off-site tidak cocok.");
  assert((await sha256File(`${checksumPath}.partial`)) === checksumObject.sha256, "Checksum file SHA hasil download off-site tidak cocok.");
  assert((await sha256File(`${metadataPath}.partial`)) === metadataObject.sha256, "Checksum metadata hasil download off-site tidak cocok.");
  renameSync(`${archivePath}.partial`, archivePath);
  renameSync(`${checksumPath}.partial`, checksumPath);
  renameSync(`${metadataPath}.partial`, metadataPath);
  return readBackupArtifact(metadataPath);
}

export function writeOffsiteStatus(input: {
  statusPath: string;
  receipt: DatabaseBackupOffsiteReceipt;
}): DatabaseBackupOffsiteStatus {
  const status: DatabaseBackupOffsiteStatus = {
    version: 1,
    provider: "backblaze-b2",
    bucket: input.receipt.bucket,
    prefix: input.receipt.prefix,
    latestBackupId: input.receipt.backup.backupId,
    latestReceiptKey: input.receipt.receiptKey,
    latestBackupCreatedAt: input.receipt.backup.createdAt,
    lastSuccessfulUploadAt: input.receipt.uploadedAt,
    lastSuccessfulVerificationAt: input.receipt.verifiedAt,
    fullVerification: input.receipt.fullVerification,
  };
  atomicWriteJson(input.statusPath, status);
  return status;
}
