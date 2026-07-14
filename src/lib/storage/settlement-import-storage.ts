import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { SETTLEMENT_IMPORT_MAX_FILE_BYTES } from "@/features/reconciliation/import-contracts";

const IMPORT_KEY_PATTERN =
  /^organizations\/[0-9a-f-]{36}\/settlement-import\/[0-9a-f-]{36}\.csv$/i;

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

function normalizeImportKey(key: string) {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");
  return IMPORT_KEY_PATTERN.test(normalized) ? normalized : null;
}

function getAbsolutePath(key: string) {
  const normalized = normalizeImportKey(key);
  if (!normalized) throw new Error("Kunci file import settlement tidak valid.");
  const root = getStorageRoot();
  const absolutePath = path.resolve(
    /* turbopackIgnore: true */ root,
    normalized,
  );
  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Lokasi file import settlement tidak valid.");
  }
  return absolutePath;
}

export function settlementImportKeyBelongsToOrganization(
  key: string,
  organizationId: string,
) {
  const normalized = normalizeImportKey(key);
  return (
    normalized?.startsWith(
      `organizations/${organizationId}/settlement-import/`,
    ) ?? false
  );
}

export function getSettlementImportFileUrl(key: string | null) {
  if (!key || !normalizeImportKey(key)) return null;
  return `/media/settlement-import/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export function validateSettlementImportFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("File settlement harus menggunakan format CSV.");
  }
  if (file.size <= 0 || file.size > SETTLEMENT_IMPORT_MAX_FILE_BYTES) {
    throw new Error("Ukuran file CSV harus lebih dari 0 dan maksimal 5 MB.");
  }
  const allowedTypes = new Set([
    "",
    "text/csv",
    "text/plain",
    "application/csv",
    "application/vnd.ms-excel",
  ]);
  if (!allowedTypes.has(file.type.toLowerCase())) {
    throw new Error("Tipe file tidak dikenali sebagai CSV.");
  }
}

export async function storeSettlementImportFile({
  buffer,
  organizationId,
}: {
  buffer: Buffer;
  organizationId: string;
}) {
  const key = `organizations/${organizationId}/settlement-import/${randomUUID()}.csv`;
  if (getStorageDriver() === "s3") {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: requiredEnvironment("IMAGE_STORAGE_BUCKET"),
        Key: key,
        Body: buffer,
        ContentType: "text/csv; charset=utf-8",
        CacheControl: "private, no-store",
        ContentDisposition: "attachment",
      }),
    );
  } else {
    const absolutePath = getAbsolutePath(key);
    await mkdir(/* turbopackIgnore: true */ path.dirname(absolutePath), {
      recursive: true,
    });
    await writeFile(/* turbopackIgnore: true */ absolutePath, buffer, {
      flag: "wx",
    });
  }
  return { key, sizeBytes: buffer.byteLength };
}

export async function readSettlementImportFile(key: string) {
  const normalized = normalizeImportKey(key);
  if (!normalized) throw new Error("Kunci file import settlement tidak valid.");
  if (getStorageDriver() === "s3") {
    const response = await getS3Client().send(
      new GetObjectCommand({
        Bucket: requiredEnvironment("IMAGE_STORAGE_BUCKET"),
        Key: normalized,
      }),
    );
    if (!response.Body) throw new Error("File import settlement tidak ditemukan.");
    return Buffer.from(await response.Body.transformToByteArray());
  }
  return readFile(/* turbopackIgnore: true */ getAbsolutePath(normalized));
}

export async function deleteSettlementImportFile(key: string) {
  const normalized = normalizeImportKey(key);
  if (!normalized) throw new Error("Kunci file import settlement tidak valid.");
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
