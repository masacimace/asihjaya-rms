import { NextResponse } from "next/server";

import { PRODUCT_BATCH_IMPORT_LIMITS } from "@/features/product-batch-import/contracts";
import {
  createProductBatchImportSession,
  ProductBatchImportDuplicateError,
  ProductBatchImportServiceError,
} from "@/features/product-batch-import/session-service";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, code: string, message: string, extra = {}) {
  return NextResponse.json({ code, message, ...extra }, { status });
}

function assertSameOrigin(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && origin !== requestOrigin) {
    throw new ProductBatchImportServiceError(
      "CROSS_ORIGIN_REJECTED",
      "Upload Product Batch Import hanya menerima request same-origin.",
      403,
    );
  }
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new ProductBatchImportServiceError(
      "CROSS_SITE_REJECTED",
      "Upload cross-site tidak diizinkan.",
      403,
    );
  }
}

function readUploadFileName(request: Request) {
  const encoded = request.headers.get("x-product-batch-file-name") ?? "";
  if (!encoded || encoded.length > 768) {
    throw new ProductBatchImportServiceError(
      "UPLOAD_FILE_NAME_MISSING",
      "Header nama file ZIP tidak tersedia.",
      400,
    );
  }
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new ProductBatchImportServiceError(
      "UPLOAD_FILE_NAME_INVALID",
      "Encoding nama file ZIP tidak valid.",
      400,
    );
  }
}

async function readRequestBodyBounded(request: Request, maxBytes: number) {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
      throw new ProductBatchImportServiceError(
        "UPLOAD_CONTENT_LENGTH_INVALID",
        "Content-Length upload tidak valid.",
        400,
      );
    }
    if (contentLength > maxBytes) {
      throw new ProductBatchImportServiceError(
        "UPLOAD_TOO_LARGE",
        "ZIP melebihi batas upload 100 MB.",
        413,
      );
    }
  }

  if (!request.body) {
    throw new ProductBatchImportServiceError(
      "UPLOAD_BODY_MISSING",
      "Body ZIP tidak tersedia.",
      400,
    );
  }

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("Product Batch Import upload limit exceeded");
        throw new ProductBatchImportServiceError(
          "UPLOAD_TOO_LARGE",
          "ZIP melebihi batas upload 100 MB.",
          413,
        );
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  if (total <= 0) {
    throw new ProductBatchImportServiceError(
      "UPLOAD_EMPTY",
      "File ZIP kosong.",
      400,
    );
  }

  return Buffer.concat(chunks, total);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const auth = await getCurrentAuth();
    if (!auth) {
      return jsonError(401, "UNAUTHORIZED", "Login diperlukan.");
    }
    if (!hasPermission(auth, "products.batch_import")) {
      return jsonError(
        403,
        "FORBIDDEN",
        "Permission products.batch_import diperlukan.",
      );
    }

    const contentType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (
      !contentType ||
      ![
        "application/zip",
        "application/x-zip-compressed",
        "application/octet-stream",
      ].includes(contentType)
    ) {
      return jsonError(
        415,
        "UPLOAD_CONTENT_TYPE_INVALID",
        "Endpoint hanya menerima raw ZIP body.",
      );
    }

    const fileName = readUploadFileName(request);
    const buffer = await readRequestBodyBounded(
      request,
      PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes,
    );

    const session = await createProductBatchImportSession({
      auth,
      fileName,
      archiveBuffer: buffer,
      requestMetadata: {
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
    });

    return NextResponse.json(
      {
        message:
          session.status === "ready"
            ? "ZIP berhasil divalidasi dan session siap untuk direview pada halaman preview."
            : "ZIP berhasil masuk staging, tetapi masih memiliki validation error.",
        session: {
          ...session,
          expiresAt: session.expiresAt.toISOString(),
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error) {
    if (error instanceof ProductBatchImportDuplicateError) {
      return jsonError(error.statusCode, error.code, error.message, {
        existingSessionId: error.existingSessionId,
        existingStatus: error.existingStatus,
      });
    }
    if (error instanceof ProductBatchImportServiceError) {
      return jsonError(error.statusCode, error.code, error.message);
    }
    if (error instanceof Error && "code" in error) {
      return jsonError(
        422,
        String((error as { code?: unknown }).code ?? "PACKAGE_INVALID"),
        error.message,
      );
    }

    console.error("Product Batch Import upload failed", error);
    return jsonError(
      500,
      "UPLOAD_FAILED",
      "Upload Product Batch Import gagal karena kendala sistem.",
    );
  }
}
