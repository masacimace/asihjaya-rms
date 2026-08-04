import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  artifactPaths,
  readBackupArtifact,
  type DatabaseBackupMetadata,
} from "./database-backup-state";
import {
  buildOffsiteObjectKeys,
  parseOffsiteReceipt,
} from "./database-backup-offsite-state";
import {
  downloadOffsiteBackup,
  listOffsiteReceipts,
  pruneOffsiteBackups,
  uploadBackupOffsite,
  verifyOffsiteReceipt,
  type DatabaseBackupOffsiteConfig,
} from "./database-backup-offsite-service";
import type {
  DatabaseBackupOffsiteStore,
  OffsiteObjectHead,
  OffsitePutInput,
} from "./database-backup-offsite-store";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

type StoredObject = {
  body: Buffer;
  metadata: Record<string, string>;
  retainUntil: Date;
  mode: string;
  etag: string;
};

class MemoryOffsiteStore implements DatabaseBackupOffsiteStore {
  readonly objects = new Map<string, StoredObject>();
  now = new Date("2026-08-03T09:00:00.000Z");

  async put(input: OffsitePutInput): Promise<OffsiteObjectHead> {
    const body = input.filePath
      ? readFileSync(input.filePath)
      : Buffer.from(input.body ?? "", "utf8");
    const stored = {
      body,
      metadata: { ...input.metadata },
      retainUntil: input.retainUntil,
      mode: input.objectLockMode,
      etag: sha256(body).slice(0, 32),
    };
    this.objects.set(input.key, stored);
    return this.toHead(input.key, stored);
  }

  async head(key: string): Promise<OffsiteObjectHead | null> {
    const stored = this.objects.get(key);
    return stored ? this.toHead(key, stored) : null;
  }

  async getText(key: string): Promise<string> {
    const stored = this.objects.get(key);
    assert(stored, `Object memory ${key} tidak ditemukan.`);
    return stored.body.toString("utf8");
  }

  async sha256(key: string): Promise<string> {
    const stored = this.objects.get(key);
    assert(stored, `Object memory ${key} tidak ditemukan.`);
    return sha256(stored.body);
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.objects.keys()].filter((key) => key.startsWith(prefix)).sort();
  }

  async delete(keys: string[]): Promise<void> {
    for (const key of keys) {
      const stored = this.objects.get(key);
      if (!stored) continue;
      assert(stored.retainUntil.getTime() <= this.now.getTime(), `Object Lock masih aktif untuk ${key}.`);
      this.objects.delete(key);
    }
  }

  async download(key: string, filePath: string): Promise<void> {
    const stored = this.objects.get(key);
    assert(stored, `Object memory ${key} tidak ditemukan.`);
    writeFileSync(filePath, stored.body, { mode: 0o600 });
  }

  private toHead(key: string, stored: StoredObject): OffsiteObjectHead {
    return {
      key,
      bytes: stored.body.byteLength,
      etag: stored.etag,
      metadata: { ...stored.metadata },
      objectLockMode: stored.mode,
      objectLockRetainUntil: stored.retainUntil,
    };
  }
}

function createArtifact(root: string, input: {
  kind: "daily" | "weekly" | "pre-deployment" | "manual";
  createdAt: Date;
  protected?: boolean;
}) {
  const backupId = randomUUID();
  const baseName = `asihjaya-production-${input.kind}-${input.createdAt.toISOString().replace(/[-:.]/g, "")}-${backupId.slice(0, 8)}`;
  const paths = artifactPaths(root, baseName);
  const archive = Buffer.from(`PGDMP-offsite-rehearsal-${backupId}`, "utf8");
  writeFileSync(paths.archivePath, archive, { mode: 0o600 });
  const archiveSha = sha256(archive);
  writeFileSync(paths.checksumPath, `${archiveSha}  ${path.basename(paths.archivePath)}\n`, { mode: 0o600 });
  const metadata: DatabaseBackupMetadata = {
    version: 1,
    backupId,
    fileName: path.basename(paths.archivePath),
    createdAt: input.createdAt.toISOString(),
    completedAt: input.createdAt.toISOString(),
    verifiedAt: input.createdAt.toISOString(),
    environment: "production",
    kind: input.kind,
    protected: input.protected ?? false,
    source: {
      databaseName: "asihjaya_rms",
      serverVersion: "17.10",
      serverVersionNumber: 170010,
      pgDumpVersion: "pg_dump (PostgreSQL) 17.10",
      databaseBytes: 4096,
    },
    archive: {
      format: "custom",
      compressionLevel: 6,
      bytes: archive.byteLength,
      sha256: archiveSha,
      listEntryCount: 1,
    },
    verification: {
      status: "verified",
      migrationCount: 13,
      tableRowCounts: {
        organizations: 1,
        outlets: 1,
        registers: 1,
        users: 1,
        customers: 1,
        sales: 1,
        sale_items: 1,
        payments: 1,
      },
      tableConstraintCounts: {
        organizations: 1,
        outlets: 1,
        registers: 1,
        users: 1,
        customers: 1,
        sales: 1,
        sale_items: 1,
        payments: 1,
      },
    },
  };
  writeFileSync(paths.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
  return readBackupArtifact(paths.metadataPath);
}

const root = mkdtempSync(path.join(os.tmpdir(), "asihjaya-offsite-backup-"));
const localRoot = path.join(root, "local");
const downloadRoot = path.join(root, "download");
mkdirSync(localRoot, { recursive: true });
const store = new MemoryOffsiteStore();
const config: DatabaseBackupOffsiteConfig = {
  provider: "backblaze-b2",
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  bucket: "asihjaya-rms-test-backups",
  prefix: "asihjaya-rms/postgres",
  objectLockMode: "COMPLIANCE",
  objectLockDays: 1,
  fullVerification: true,
  maxArchiveBytes: 5 * 1024 * 1024 * 1024,
  statusPath: path.join(root, "status.json"),
  retention: { dailyDays: 2, weeklyWeeks: 4, preDeploymentCount: 2 },
};

try {
  const recentArtifact = createArtifact(localRoot, {
    kind: "daily",
    createdAt: new Date("2026-08-02T09:00:00.000Z"),
  });
  const receipt = await uploadBackupOffsite({
    store,
    artifact: recentArtifact,
    config,
    now: new Date("2026-08-02T10:00:00.000Z"),
  });
  assert(receipt.objects.length === 3, "Upload off-site wajib menghasilkan tiga object data.");
  assert(store.objects.size === 4, "Upload off-site wajib menghasilkan archive, checksum, metadata, dan receipt.");
  const parsedReceipt = parseOffsiteReceipt(await store.getText(receipt.receiptKey));
  assert(parsedReceipt.backup.backupId === recentArtifact.metadata.backupId, "Receipt remote wajib menunjuk backup yang benar.");

  const objectCountBeforeRetry = store.objects.size;
  const retried = await uploadBackupOffsite({
    store,
    artifact: recentArtifact,
    config,
    now: new Date("2026-08-02T11:00:00.000Z"),
  });
  assert(retried.backup.backupId === receipt.backup.backupId, "Retry upload wajib idempotent.");
  assert(store.objects.size === objectCountBeforeRetry, "Retry upload tidak boleh menggandakan object.");

  await verifyOffsiteReceipt({ store, receiptKey: receipt.receiptKey, requireFullVerification: true });
  const downloaded = await downloadOffsiteBackup({ store, receipt, outputDirectory: downloadRoot });
  assert(downloaded.metadata.backupId === recentArtifact.metadata.backupId, "Download off-site wajib mempertahankan metadata.");
  assert(statSync(downloaded.archivePath).size === recentArtifact.metadata.archive.bytes, "Archive download wajib utuh.");

  const archiveKey = buildOffsiteObjectKeys({
    prefix: config.prefix,
    metadata: recentArtifact.metadata,
  }).archiveKey;
  const originalArchive = store.objects.get(archiveKey)!;
  store.objects.set(archiveKey, { ...originalArchive, body: Buffer.from("corrupted") });
  let corruptionRejected = false;
  try {
    await verifyOffsiteReceipt({ store, receiptKey: receipt.receiptKey, requireFullVerification: true });
  } catch (error) {
    corruptionRejected = error instanceof Error && error.message.includes("Ukuran remote archive berubah");
  }
  assert(corruptionRejected, "Corruption remote wajib ditolak.");
  store.objects.set(archiveKey, originalArchive);

  const oldArtifact = createArtifact(localRoot, {
    kind: "daily",
    createdAt: new Date("2026-07-01T09:00:00.000Z"),
  });
  await uploadBackupOffsite({
    store,
    artifact: oldArtifact,
    config,
    now: new Date("2026-07-01T10:00:00.000Z"),
  });
  store.now = new Date("2026-08-03T09:00:00.000Z");
  const prune = await pruneOffsiteBackups({
    store,
    prefix: config.prefix,
    environment: "production",
    policy: config.retention,
    now: store.now,
  });
  assert(prune.deleted === 1, "Retention off-site wajib menghapus daily lama setelah Object Lock berakhir.");
  const receipts = await listOffsiteReceipts({
    store,
    prefix: config.prefix,
    environment: "production",
  });
  assert(receipts.length === 1 && receipts[0]?.backup.backupId === recentArtifact.metadata.backupId, "Retention wajib mempertahankan backup terbaru.");

  console.log("OK: upload, idempotency, full verification, download, corruption rejection, Object Lock, dan retention off-site passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
