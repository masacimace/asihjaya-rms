import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

import { validateImageFile } from "@/lib/storage/image-validation";

const ORGANIZATION_KEY_PATTERN = /^[0-9a-f-]{36}$/i;
const ENTITY_KEY_PATTERN = /^[0-9a-f-]{36}$/i;
const FILE_KEY_PATTERN = /^[0-9a-f-]{36}\.webp$/i;

type ImageStorageDriver = "local" | "s3";

let cachedS3Client: S3Client | null = null;

function getStorageDriver(): ImageStorageDriver {
  const configured = process.env.IMAGE_STORAGE_DRIVER?.trim().toLowerCase();

  if (!configured || configured === "local") {
    return "local";
  }

  if (configured === "s3") {
    return "s3";
  }

  throw new Error(
    "IMAGE_STORAGE_DRIVER harus bernilai local atau s3.",
  );
}

function getStorageRoot(): string {
  const configured = process.env.IMAGE_STORAGE_ROOT?.trim();

  if (!configured) {
    return path.resolve(
      /* turbopackIgnore: true */ process.cwd(),
      ".data",
      "uploads",
    );
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(
        /* turbopackIgnore: true */ process.cwd(),
        configured,
      );
}

function requiredStorageEnvironment(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur.`);
  }

  return value;
}

function getS3Client(): S3Client {
  if (cachedS3Client) {
    return cachedS3Client;
  }

  const endpoint = process.env.IMAGE_STORAGE_ENDPOINT?.trim();
  const region = process.env.IMAGE_STORAGE_REGION?.trim() || "auto";
  const accessKeyId = requiredStorageEnvironment(
    "IMAGE_STORAGE_ACCESS_KEY_ID",
  );
  const secretAccessKey = requiredStorageEnvironment(
    "IMAGE_STORAGE_SECRET_ACCESS_KEY",
  );
  const forcePathStyle =
    process.env.IMAGE_STORAGE_FORCE_PATH_STYLE?.trim().toLowerCase() ===
    "true";

  cachedS3Client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedS3Client;
}

function getS3Bucket(): string {
  return requiredStorageEnvironment("IMAGE_STORAGE_BUCKET");
}

function normalizeImageKey(key: string): string | null {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalized.split("/");

  if (
    segments.length !== 5 ||
    segments[0] !== "organizations" ||
    !ORGANIZATION_KEY_PATTERN.test(segments[1] ?? "") ||
    !["products", "items"].includes(segments[2] ?? "") ||
    !ENTITY_KEY_PATTERN.test(segments[3] ?? "") ||
    !FILE_KEY_PATTERN.test(segments[4] ?? "")
  ) {
    return null;
  }

  return segments.join("/");
}

function getAbsoluteImagePath(key: string): string {
  const normalized = normalizeImageKey(key);

  if (!normalized) {
    throw new Error("Kunci foto tidak valid.");
  }

  const root = getStorageRoot();
  const absolutePath = path.resolve(
    /* turbopackIgnore: true */ root,
    normalized,
  );

  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Lokasi foto tidak valid.");
  }

  return absolutePath;
}

async function writeImageBuffer(
  imageKey: string,
  imageBuffer: Buffer,
): Promise<void> {
  if (getStorageDriver() === "s3") {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
        Key: imageKey,
        Body: imageBuffer,
        ContentType: "image/webp",
        CacheControl: "private, max-age=31536000, immutable",
      }),
    );
    return;
  }

  const absolutePath = getAbsoluteImagePath(imageKey);
  await mkdir(
    /* turbopackIgnore: true */ path.dirname(absolutePath),
    { recursive: true },
  );
  await writeFile(
    /* turbopackIgnore: true */ absolutePath,
    imageBuffer,
    { flag: "wx" },
  );
}

async function readS3Image(imageKey: string): Promise<Buffer> {
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: imageKey,
    }),
  );

  if (!response.Body) {
    throw new Error("Isi foto tidak ditemukan.");
  }

  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}

export function getImageUrl(imageKey: string | null): string | null {
  if (!imageKey || !normalizeImageKey(imageKey)) {
    return null;
  }

  return `/media/${imageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export function imageKeyBelongsToOrganization(
  imageKey: string,
  organizationId: string,
): boolean {
  const normalized = normalizeImageKey(imageKey);

  return normalized?.startsWith(`organizations/${organizationId}/`) ?? false;
}

export async function storeImageFile({
  file,
  organizationId,
  entityType,
  entityId,
}: {
  file: File;
  organizationId: string;
  entityType: "products" | "items";
  entityId: string;
}): Promise<string> {
  const validation = validateImageFile(file);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const key = `organizations/${organizationId}/${entityType}/${entityId}/${randomUUID()}.webp`;
  const input = Buffer.from(await file.arrayBuffer());

  const output = await sharp(input, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();

  await writeImageBuffer(key, output);

  return key;
}

export async function readImageFile(imageKey: string): Promise<Buffer> {
  const normalized = normalizeImageKey(imageKey);

  if (!normalized) {
    throw new Error("Kunci foto tidak valid.");
  }

  if (getStorageDriver() === "s3") {
    return readS3Image(normalized);
  }

  return readFile(
    /* turbopackIgnore: true */ getAbsoluteImagePath(normalized),
  );
}

export async function deleteImageFile(imageKey: string | null): Promise<void> {
  if (!imageKey) {
    return;
  }

  const normalized = normalizeImageKey(imageKey);

  if (!normalized) {
    return;
  }

  try {
    if (getStorageDriver() === "s3") {
      await getS3Client().send(
        new DeleteObjectCommand({
          Bucket: getS3Bucket(),
          Key: normalized,
        }),
      );
      return;
    }

    await rm(
      /* turbopackIgnore: true */ getAbsoluteImagePath(normalized),
      { force: true },
    );
  } catch (error) {
    console.error("Gagal menghapus file foto:", error);
  }
}
