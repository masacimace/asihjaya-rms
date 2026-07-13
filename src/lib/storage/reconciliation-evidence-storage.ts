import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

import { validateImageFile } from "@/lib/storage/image-validation";

const EVIDENCE_KEY_PATTERN =
  /^organizations\/[0-9a-f-]{36}\/payment-reconciliation\/[0-9a-f-]{36}\.webp$/i;

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
      : path.resolve(
          /* turbopackIgnore: true */ process.cwd(),
          configured,
        )
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

function normalizeEvidenceKey(key: string) {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");
  return EVIDENCE_KEY_PATTERN.test(normalized) ? normalized : null;
}

function getAbsolutePath(key: string) {
  const normalized = normalizeEvidenceKey(key);
  if (!normalized) throw new Error("Kunci bukti rekonsiliasi pembayaran tidak valid.");

  const root = getStorageRoot();
  const absolutePath = path.resolve(
    /* turbopackIgnore: true */ root,
    normalized,
  );

  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Lokasi bukti rekonsiliasi pembayaran tidak valid.");
  }

  return absolutePath;
}

export function reconciliationEvidenceKeyBelongsToOrganization(
  key: string,
  organizationId: string,
) {
  const normalized = normalizeEvidenceKey(key);
  return normalized?.startsWith(
    `organizations/${organizationId}/payment-reconciliation/`,
  ) ?? false;
}

export function getReconciliationEvidenceUrl(key: string | null) {
  if (!key || !normalizeEvidenceKey(key)) return null;
  return `/media/payment-reconciliation/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export async function storeReconciliationEvidenceFile({
  file,
  organizationId,
}: {
  file: File;
  organizationId: string;
}) {
  const validation = validateImageFile(file);
  if (!validation.valid) throw new Error(validation.message);

  const key = `organizations/${organizationId}/payment-reconciliation/${randomUUID()}.webp`;
  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  if (getStorageDriver() === "s3") {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: requiredEnvironment("IMAGE_STORAGE_BUCKET"),
        Key: key,
        Body: output,
        ContentType: "image/webp",
        CacheControl: "private, no-store",
      }),
    );
  } else {
    const absolutePath = getAbsolutePath(key);
    await mkdir(
      /* turbopackIgnore: true */ path.dirname(absolutePath),
      { recursive: true },
    );
    await writeFile(
      /* turbopackIgnore: true */ absolutePath,
      output,
      { flag: "wx" },
    );
  }

  return {
    key,
    sizeBytes: output.byteLength,
  };
}

export async function deleteReconciliationEvidenceFile(key: string) {
  const normalized = normalizeEvidenceKey(key);
  if (!normalized) throw new Error("Kunci bukti rekonsiliasi pembayaran tidak valid.");

  if (getStorageDriver() === "s3") {
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: requiredEnvironment("IMAGE_STORAGE_BUCKET"),
        Key: normalized,
      }),
    );
    return;
  }

  await unlink(
    /* turbopackIgnore: true */ getAbsolutePath(normalized),
  ).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function readReconciliationEvidenceFile(key: string) {
  const normalized = normalizeEvidenceKey(key);
  if (!normalized) throw new Error("Kunci bukti rekonsiliasi pembayaran tidak valid.");

  if (getStorageDriver() === "s3") {
    const response = await getS3Client().send(
      new GetObjectCommand({
        Bucket: requiredEnvironment("IMAGE_STORAGE_BUCKET"),
        Key: normalized,
      }),
    );
    if (!response.Body) throw new Error("Bukti rekonsiliasi pembayaran tidak ditemukan.");
    return Buffer.from(await response.Body.transformToByteArray());
  }

  return readFile(
    /* turbopackIgnore: true */ getAbsolutePath(normalized),
  );
}
