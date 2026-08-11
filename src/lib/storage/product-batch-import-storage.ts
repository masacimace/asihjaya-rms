import { mkdir, readdir, readFile, stat, statfs, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const PRODUCT_BATCH_IMPORT_KEY_PATTERN =
  /^organizations\/([0-9a-f-]{36})\/product-batch-import\/([0-9a-f-]{36})\/(archive\.zip|media\/[0-9a-f-]{36}\.bin)$/i;

type StorageDriver = "local" | "s3";
let cachedS3Client: S3Client | null = null;

function getStorageDriver(): StorageDriver {
  const configured = process.env.IMAGE_STORAGE_DRIVER?.trim().toLowerCase();
  if (!configured || configured === "local") return "local";
  if (configured === "s3") return "s3";
  throw new Error("IMAGE_STORAGE_DRIVER harus bernilai local atau s3.");
}

function getStorageRoot() {
  const configured = process.env.IMAGE_STORAGE_ROOT?.trim();
  return configured
    ? path.isAbsolute(configured)
      ? configured
      : path.resolve(/* turbopackIgnore: true */ process.cwd(), configured)
    : path.resolve(
        /* turbopackIgnore: true */ process.cwd(),
        ".data",
        "uploads",
      );
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Environment variable ${name} belum diatur.`);
  return value;
}

function getS3Client() {
  if (cachedS3Client) return cachedS3Client;
  cachedS3Client = new S3Client({
    region: process.env.IMAGE_STORAGE_REGION?.trim() || "auto",
    endpoint: process.env.IMAGE_STORAGE_ENDPOINT?.trim() || undefined,
    forcePathStyle:
      process.env.IMAGE_STORAGE_FORCE_PATH_STYLE?.trim().toLowerCase() ===
      "true",
    credentials: {
      accessKeyId: requiredEnvironment("IMAGE_STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnvironment("IMAGE_STORAGE_SECRET_ACCESS_KEY"),
    },
  });
  return cachedS3Client;
}

function normalizeKey(key: string) {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");
  return PRODUCT_BATCH_IMPORT_KEY_PATTERN.test(normalized) ? normalized : null;
}

function getAbsolutePath(key: string) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    throw new Error("Kunci staging Product Batch Import tidak valid.");
  }
  const root = getStorageRoot();
  const absolutePath = path.resolve(
    /* turbopackIgnore: true */ root,
    normalized,
  );
  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Lokasi staging Product Batch Import tidak valid.");
  }
  return absolutePath;
}

export function buildProductBatchImportArchiveStorageKey({
  organizationId,
  sessionId,
}: {
  organizationId: string;
  sessionId: string;
}) {
  return `organizations/${organizationId}/product-batch-import/${sessionId}/archive.zip`;
}

export function buildProductBatchImportMediaStorageKey({
  organizationId,
  sessionId,
  mediaId,
}: {
  organizationId: string;
  sessionId: string;
  mediaId: string;
}) {
  return `organizations/${organizationId}/product-batch-import/${sessionId}/media/${mediaId}.bin`;
}

export function productBatchImportStorageKeyBelongsToSession({
  key,
  organizationId,
  sessionId,
}: {
  key: string;
  organizationId: string;
  sessionId: string;
}) {
  const normalized = normalizeKey(key);
  return (
    normalized?.startsWith(
      `organizations/${organizationId}/product-batch-import/${sessionId}/`,
    ) ?? false
  );
}

export async function storeProductBatchImportStagingFile({
  key,
  buffer,
  contentType,
}: {
  key: string;
  buffer: Buffer;
  contentType: string;
}) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    throw new Error("Kunci staging Product Batch Import tidak valid.");
  }

  if (getStorageDriver() === "s3") {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: requiredEnvironment("IMAGE_STORAGE_BUCKET"),
        Key: normalized,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "private, no-store",
      }),
    );
    return;
  }

  const absolutePath = getAbsolutePath(normalized);
  await mkdir(/* turbopackIgnore: true */ path.dirname(absolutePath), {
    recursive: true,
  });
  await writeFile(/* turbopackIgnore: true */ absolutePath, buffer, {
    flag: "wx",
  });
}

export async function readProductBatchImportStagingFile(key: string) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    throw new Error("Kunci staging Product Batch Import tidak valid.");
  }

  if (getStorageDriver() === "s3") {
    const response = await getS3Client().send(
      new GetObjectCommand({
        Bucket: requiredEnvironment("IMAGE_STORAGE_BUCKET"),
        Key: normalized,
      }),
    );
    if (!response.Body) {
      throw new Error("File staging Product Batch Import tidak ditemukan.");
    }
    return Buffer.from(await response.Body.transformToByteArray());
  }

  return readFile(/* turbopackIgnore: true */ getAbsolutePath(normalized));
}

export async function deleteProductBatchImportStagingFile(key: string) {
  const normalized = normalizeKey(key);
  if (!normalized) {
    throw new Error("Kunci staging Product Batch Import tidak valid.");
  }

  if (getStorageDriver() === "s3") {
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: requiredEnvironment("IMAGE_STORAGE_BUCKET"),
        Key: normalized,
      }),
    );
    return;
  }

  await unlink(/* turbopackIgnore: true */ getAbsolutePath(normalized)).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    },
  );
}

export async function deleteProductBatchImportStagingFiles(keys: string[]) {
  const unique = Array.from(new Set(keys));
  const failures: Array<{ key: string; message: string }> = [];

  for (const key of unique) {
    try {
      await deleteProductBatchImportStagingFile(key);
    } catch (error) {
      failures.push({
        key,
        message:
          error instanceof Error ? error.message : "Cleanup staging gagal.",
      });
    }
  }

  return failures;
}


export type ProductBatchImportStagingObject = {
  key: string;
  byteSize: number;
  modifiedAt: Date | null;
};

export type ProductBatchImportStorageReport = {
  driver: StorageDriver;
  objectCount: number;
  totalBytes: number;
  truncated: boolean;
  diskTotalBytes: number | null;
  diskAvailableBytes: number | null;
  diskUsedPercent: number | null;
  objects: ProductBatchImportStagingObject[];
};

export function getProductBatchImportStorageDriver(): StorageDriver {
  return getStorageDriver();
}

async function listLocalOrganizationStagingObjects({
  organizationId,
  maxObjects,
}: {
  organizationId: string;
  maxObjects: number;
}) {
  const root = getStorageRoot();
  const base = path.join(
    root,
    "organizations",
    organizationId,
    "product-batch-import",
  );
  const objects: ProductBatchImportStagingObject[] = [];
  let truncated = false;

  const sessionEntries = await readdir(base, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );

  for (const sessionEntry of sessionEntries) {
    if (!sessionEntry.isDirectory()) continue;
    const sessionBase = path.join(base, sessionEntry.name);
    const candidates = [path.join(sessionBase, "archive.zip")];
    const mediaBase = path.join(sessionBase, "media");
    const mediaEntries = await readdir(mediaBase, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      },
    );
    for (const mediaEntry of mediaEntries) {
      if (mediaEntry.isFile()) {
        candidates.push(path.join(mediaBase, mediaEntry.name));
      }
    }

    for (const absolutePath of candidates) {
      if (objects.length >= maxObjects) {
        truncated = true;
        break;
      }
      const relative = path
        .relative(root, absolutePath)
        .split(path.sep)
        .join("/");
      const normalized = normalizeKey(relative);
      if (!normalized) continue;
      const metadata = await stat(absolutePath).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        },
      );
      if (!metadata?.isFile()) continue;
      objects.push({
        key: normalized,
        byteSize: metadata.size,
        modifiedAt: metadata.mtime,
      });
    }
    if (truncated) break;
  }

  return { objects, truncated };
}

async function listS3OrganizationStagingObjects({
  organizationId,
  maxObjects,
}: {
  organizationId: string;
  maxObjects: number;
}) {
  const objects: ProductBatchImportStagingObject[] = [];
  let continuationToken: string | undefined;
  let truncated = false;
  const prefix = `organizations/${organizationId}/product-batch-import/`;

  do {
    const remaining = maxObjects - objects.length;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const response = await getS3Client().send(
      new ListObjectsV2Command({
        Bucket: requiredEnvironment("IMAGE_STORAGE_BUCKET"),
        Prefix: prefix,
        MaxKeys: Math.min(1_000, remaining),
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of response.Contents ?? []) {
      if (!object.Key) continue;
      const normalized = normalizeKey(object.Key);
      if (!normalized) continue;
      objects.push({
        key: normalized,
        byteSize: Number(object.Size ?? 0),
        modifiedAt: object.LastModified ?? null,
      });
    }
    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
    if (response.IsTruncated && !continuationToken) {
      truncated = true;
      break;
    }
  } while (continuationToken);

  if (continuationToken) truncated = true;
  return { objects, truncated };
}

export async function listProductBatchImportStagingObjects({
  organizationIds,
  maxObjectsPerOrganization = 10_000,
}: {
  organizationIds: string[];
  maxObjectsPerOrganization?: number;
}) {
  const boundedMax = Math.max(
    1,
    Math.min(50_000, Math.trunc(maxObjectsPerOrganization)),
  );
  const uniqueOrganizationIds = Array.from(new Set(organizationIds));
  const objects: ProductBatchImportStagingObject[] = [];
  let truncated = false;

  for (const organizationId of uniqueOrganizationIds) {
    const result =
      getStorageDriver() === "s3"
        ? await listS3OrganizationStagingObjects({
            organizationId,
            maxObjects: boundedMax,
          })
        : await listLocalOrganizationStagingObjects({
            organizationId,
            maxObjects: boundedMax,
          });
    objects.push(...result.objects);
    truncated ||= result.truncated;
  }

  return { objects, truncated };
}

export async function getProductBatchImportStorageReport({
  organizationIds,
  maxObjectsPerOrganization = 10_000,
}: {
  organizationIds: string[];
  maxObjectsPerOrganization?: number;
}): Promise<ProductBatchImportStorageReport> {
  const listing = await listProductBatchImportStagingObjects({
    organizationIds,
    maxObjectsPerOrganization,
  });
  const totalBytes = listing.objects.reduce(
    (total, object) => total + object.byteSize,
    0,
  );

  if (getStorageDriver() === "s3") {
    return {
      driver: "s3",
      objectCount: listing.objects.length,
      totalBytes,
      truncated: listing.truncated,
      diskTotalBytes: null,
      diskAvailableBytes: null,
      diskUsedPercent: null,
      objects: listing.objects,
    };
  }

  const root = getStorageRoot();
  const filesystem = await statfs(root).catch(async () => statfs(path.dirname(root)));
  const diskTotalBytes = filesystem.blocks * filesystem.bsize;
  const diskAvailableBytes = filesystem.bavail * filesystem.bsize;
  const diskUsedPercent =
    diskTotalBytes > 0
      ? Math.round((1 - diskAvailableBytes / diskTotalBytes) * 10_000) / 100
      : null;

  return {
    driver: "local",
    objectCount: listing.objects.length,
    totalBytes,
    truncated: listing.truncated,
    diskTotalBytes,
    diskAvailableBytes,
    diskUsedPercent,
    objects: listing.objects,
  };
}
