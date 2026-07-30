import { storeImageBuffer } from "@/lib/storage/image-storage";
import {
  getLegacyImageAllowedHosts,
  isLegacyImageUrlAllowed,
} from "@/lib/storage/legacy-image-url-policy";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ACCEPTED_REMOTE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type LegacyImageImportResult = {
  imageKey: string;
  sourceUrl: string;
  finalUrl: string;
  contentType: string;
  sourceBytes: number;
};

export class LegacyImageImportError extends Error {
  constructor(
    public readonly code:
      | "INVALID_URL"
      | "HOST_NOT_ALLOWED"
      | "DOWNLOAD_TIMEOUT"
      | "DOWNLOAD_FAILED"
      | "TOO_MANY_REDIRECTS"
      | "INVALID_CONTENT_TYPE"
      | "IMAGE_TOO_LARGE"
      | "INVALID_IMAGE",
    message: string,
  ) {
    super(message);
    this.name = "LegacyImageImportError";
  }
}

function readBoundedPositiveNumber(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

function validateLegacyImageUrl(value: string, allowedHosts: string[]): URL {
  if (!isLegacyImageUrlAllowed(value, allowedHosts)) {
    throw new LegacyImageImportError(
      "HOST_NOT_ALLOWED",
      "URL foto legacy harus memakai HTTPS dan host yang diizinkan.",
    );
  }

  return new URL(value);
}

async function readResponseBody(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new LegacyImageImportError(
      "IMAGE_TOO_LARGE",
      "Ukuran foto legacy melebihi batas download.",
    );
  }
  if (!response.body) {
    throw new LegacyImageImportError(
      "DOWNLOAD_FAILED",
      "Server legacy tidak mengirim isi foto.",
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();
    if (result.done) break;
    totalBytes += result.value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new LegacyImageImportError(
        "IMAGE_TOO_LARGE",
        "Ukuran foto legacy melebihi batas download.",
      );
    }
    chunks.push(result.value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
}

async function downloadLegacyImage(
  sourceUrl: string,
): Promise<{
  buffer: Buffer;
  finalUrl: string;
  contentType: string;
}> {
  const allowedHosts = getLegacyImageAllowedHosts();
  const timeoutMs = readBoundedPositiveNumber(
    process.env.LEGACY_IMAGE_DOWNLOAD_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    60_000,
  );
  const maxMegabytes = readBoundedPositiveNumber(
    process.env.LEGACY_IMAGE_DOWNLOAD_MAX_MB,
    DEFAULT_MAX_BYTES / 1024 / 1024,
    25,
  );
  const maxBytes = Math.floor(maxMegabytes * 1024 * 1024);
  let currentUrl = validateLegacyImageUrl(sourceUrl, allowedHosts);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "image/jpeg,image/png,image/webp",
          "User-Agent": "Asihjaya-RMS-Legacy-Photo-Migration/1.0",
        },
        cache: "no-store",
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) {
          throw new LegacyImageImportError(
            "DOWNLOAD_FAILED",
            "Redirect foto legacy tidak memiliki tujuan.",
          );
        }
        if (redirectCount === MAX_REDIRECTS) {
          throw new LegacyImageImportError(
            "TOO_MANY_REDIRECTS",
            "Redirect foto legacy terlalu banyak.",
          );
        }
        currentUrl = validateLegacyImageUrl(
          new URL(location, currentUrl).toString(),
          allowedHosts,
        );
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new LegacyImageImportError(
          "DOWNLOAD_FAILED",
          `Server legacy merespons HTTP ${response.status}.`,
        );
      }

      const contentType = (response.headers.get("content-type") ?? "")
        .split(";", 1)[0]
        ?.trim()
        .toLowerCase();
      if (!contentType || !ACCEPTED_REMOTE_IMAGE_TYPES.has(contentType)) {
        await response.body?.cancel();
        throw new LegacyImageImportError(
          "INVALID_CONTENT_TYPE",
          "Respons URL legacy bukan JPG, PNG, atau WebP.",
        );
      }

      return {
        buffer: await readResponseBody(response, maxBytes),
        finalUrl: currentUrl.toString(),
        contentType,
      };
    } catch (error) {
      if (error instanceof LegacyImageImportError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new LegacyImageImportError(
          "DOWNLOAD_TIMEOUT",
          "Download foto legacy melewati batas waktu.",
        );
      }
      throw new LegacyImageImportError(
        "DOWNLOAD_FAILED",
        "Foto legacy tidak dapat diunduh.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new LegacyImageImportError(
    "TOO_MANY_REDIRECTS",
    "Redirect foto legacy terlalu banyak.",
  );
}

export async function importLegacyImageToPrivateStorage({
  sourceUrl,
  organizationId,
  itemId,
}: {
  sourceUrl: string;
  organizationId: string;
  itemId: string;
}): Promise<LegacyImageImportResult> {
  const downloaded = await downloadLegacyImage(sourceUrl);

  try {
    const imageKey = await storeImageBuffer({
      input: downloaded.buffer,
      organizationId,
      entityType: "items",
      entityId: itemId,
    });

    return {
      imageKey,
      sourceUrl,
      finalUrl: downloaded.finalUrl,
      contentType: downloaded.contentType,
      sourceBytes: downloaded.buffer.length,
    };
  } catch (error) {
    if (error instanceof LegacyImageImportError) throw error;
    throw new LegacyImageImportError(
      "INVALID_IMAGE",
      "Isi foto legacy rusak atau tidak dapat diproses.",
    );
  }
}
