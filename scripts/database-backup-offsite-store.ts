import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type ObjectLockMode,
} from "@aws-sdk/client-s3";

export type OffsitePutInput = {
  key: string;
  filePath?: string;
  body?: string;
  contentType: string;
  metadata: Record<string, string>;
  objectLockMode: "COMPLIANCE" | "GOVERNANCE";
  retainUntil: Date;
};

export type OffsiteObjectHead = {
  key: string;
  bytes: number;
  etag?: string;
  metadata: Record<string, string>;
  objectLockMode?: string;
  objectLockRetainUntil?: Date;
};

export interface DatabaseBackupOffsiteStore {
  put(input: OffsitePutInput): Promise<OffsiteObjectHead>;
  head(key: string): Promise<OffsiteObjectHead | null>;
  getText(key: string): Promise<string>;
  sha256(key: string): Promise<string>;
  list(prefix: string): Promise<string[]>;
  delete(keys: string[]): Promise<void>;
  download(key: string, filePath: string): Promise<void>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function streamBodyChunks(body: unknown): Promise<AsyncIterable<Uint8Array>> {
  assert(body && typeof body === "object", "Response object storage tidak memiliki body.");
  assert(Symbol.asyncIterator in body, "Body object storage tidak dapat dibaca sebagai stream.");
  return body as AsyncIterable<Uint8Array>;
}

async function bodyToText(body: unknown): Promise<string> {
  const stream = await streamBodyChunks(body);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function normalizeEtag(value: string | undefined): string | undefined {
  return value?.replace(/^"|"$/g, "");
}

async function md5FileBase64(filePath: string): Promise<string> {
  const hash = createHash("md5");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("base64");
}

export class S3DatabaseBackupOffsiteStore implements DatabaseBackupOffsiteStore {
  readonly #client: S3Client;
  readonly #bucket: string;

  constructor(input: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.#bucket = input.bucket;
    this.#client = new S3Client({
      endpoint: input.endpoint,
      region: input.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: input.accessKeyId,
        secretAccessKey: input.secretAccessKey,
      },
      maxAttempts: 4,
    });
  }

  async put(input: OffsitePutInput): Promise<OffsiteObjectHead> {
    assert(Boolean(input.filePath) !== Boolean(input.body), "Upload off-site membutuhkan tepat satu sumber body.");
    const contentLength = input.filePath
      ? statSync(input.filePath).size
      : Buffer.byteLength(input.body ?? "", "utf8");
    const contentMd5 = input.filePath
      ? await md5FileBase64(input.filePath)
      : createHash("md5").update(input.body ?? "", "utf8").digest("base64");
    const response = await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: input.key,
        Body: input.filePath ? createReadStream(input.filePath) : input.body,
        ContentLength: contentLength,
        ContentMD5: contentMd5,
        ContentType: input.contentType,
        Metadata: input.metadata,
        ObjectLockMode: input.objectLockMode as ObjectLockMode,
        ObjectLockRetainUntilDate: input.retainUntil,
      }),
    );
    return {
      key: input.key,
      bytes: contentLength,
      etag: normalizeEtag(response.ETag),
      metadata: input.metadata,
      objectLockMode: input.objectLockMode,
      objectLockRetainUntil: input.retainUntil,
    };
  }

  async head(key: string): Promise<OffsiteObjectHead | null> {
    try {
      const response = await this.#client.send(
        new HeadObjectCommand({ Bucket: this.#bucket, Key: key }),
      );
      return {
        key,
        bytes: Number(response.ContentLength ?? 0),
        etag: normalizeEtag(response.ETag),
        metadata: response.Metadata ?? {},
        objectLockMode: response.ObjectLockMode,
        objectLockRetainUntil: response.ObjectLockRetainUntilDate,
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      const name = (error as { name?: string }).name;
      if (status === 404 || name === "NotFound" || name === "NoSuchKey") return null;
      throw error;
    }
  }

  async getText(key: string): Promise<string> {
    const response = await this.#client.send(
      new GetObjectCommand({ Bucket: this.#bucket, Key: key }),
    );
    return bodyToText(response.Body);
  }

  async sha256(key: string): Promise<string> {
    const response = await this.#client.send(
      new GetObjectCommand({ Bucket: this.#bucket, Key: key }),
    );
    const stream = await streamBodyChunks(response.Body);
    const hash = createHash("sha256");
    for await (const chunk of stream) hash.update(chunk);
    return hash.digest("hex");
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await this.#client.send(
        new ListObjectsV2Command({
          Bucket: this.#bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        }),
      );
      for (const object of response.Contents ?? []) {
        if (object.Key) keys.push(object.Key);
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  }

  async delete(keys: string[]): Promise<void> {
    const versions: Array<{ Key: string; VersionId: string }> = [];
    for (const key of keys) {
      let keyMarker: string | undefined;
      let versionIdMarker: string | undefined;
      do {
        const response = await this.#client.send(
          new ListObjectVersionsCommand({
            Bucket: this.#bucket,
            Prefix: key,
            KeyMarker: keyMarker,
            VersionIdMarker: versionIdMarker,
            MaxKeys: 1000,
          }),
        );
        for (const candidate of [
          ...(response.Versions ?? []),
          ...(response.DeleteMarkers ?? []),
        ]) {
          if (candidate.Key === key && candidate.VersionId) {
            versions.push({ Key: key, VersionId: candidate.VersionId });
          }
        }
        keyMarker = response.IsTruncated ? response.NextKeyMarker : undefined;
        versionIdMarker = response.IsTruncated
          ? response.NextVersionIdMarker
          : undefined;
      } while (keyMarker || versionIdMarker);
    }

    for (let index = 0; index < versions.length; index += 1000) {
      const batch = versions.slice(index, index + 1000);
      const response = await this.#client.send(
        new DeleteObjectsCommand({
          Bucket: this.#bucket,
          Delete: { Objects: batch, Quiet: false },
        }),
      );
      if (response.Errors?.length) {
        throw new Error(
          `Object storage menolak penghapusan version-aware: ${response.Errors.map((error: { Key?: string; Code?: string }) => `${error.Key ?? "unknown"}:${error.Code ?? "unknown"}`).join(", ")}.`,
        );
      }
    }

    for (const key of keys) {
      if (await this.head(key)) {
        throw new Error(`Object ${key} masih tersedia setelah version-aware deletion.`);
      }
    }
  }

  async download(key: string, filePath: string): Promise<void> {
    const response = await this.#client.send(
      new GetObjectCommand({ Bucket: this.#bucket, Key: key }),
    );
    const body = await streamBodyChunks(response.Body);
    await pipeline(body, createWriteStream(filePath, { mode: 0o600 }));
  }
}
