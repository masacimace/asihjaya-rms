import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
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
