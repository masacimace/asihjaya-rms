import { NextResponse } from "next/server";

import {
  createProductBatchImportSession,
  getProductBatchImportUploadLimit,
  normalizeProductBatchImportFileName,
  ProductBatchImportDuplicateError,
  ProductBatchImportServiceError,
} from "@/features/product-batch-import/session-service";
import {
  commitProductBatchImportSession,
  ProductBatchImportCommitError,
} from "@/features/product-batch-import/commit-service";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { getClientIp } from "@/lib/http/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, code: string, message: string, extra = {}) {
  return NextResponse.json({ code, message, ...extra }, { status });
}

function assertSameOrigin(request: Request) {
  const expectedOrigin = serverEnv.APP_URL;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && origin !== expectedOrigin) {
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
      "Header nama file upload tidak tersedia.",
      400,
    );
  }
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new ProductBatchImportServiceError(
      "UPLOAD_FILE_NAME_INVALID",
      "Encoding nama file upload tidak valid.",
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
        "File melebihi batas upload 100 MB.",
        413,
      );
    }
  }

  if (!request.body) {
    throw new ProductBatchImportServiceError(
      "UPLOAD_BODY_MISSING",
      "Body file upload tidak tersedia.",
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
          "File melebihi batas upload 100 MB.",
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
      "File upload kosong.",
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

    const fileName = normalizeProductBatchImportFileName(readUploadFileName(request));
    const contentType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    const allowedContentTypes = fileName.toLocaleLowerCase("en-US").endsWith(".xlsx")
      ? [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/octet-stream",
        ]
      : [
          "application/zip",
          "application/x-zip-compressed",
          "application/octet-stream",
        ];
    if (!contentType || !allowedContentTypes.includes(contentType)) {
      return jsonError(
        415,
        "UPLOAD_CONTENT_TYPE_INVALID",
        "Content-Type tidak sesuai dengan file .zip atau .xlsx yang dipilih.",
      );
    }

    const buffer = await readRequestBodyBounded(
      request,
      getProductBatchImportUploadLimit(fileName),
    );

    const requestMetadata = {
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    };
    const session = await createProductBatchImportSession({
      auth,
      fileName,
      archiveBuffer: buffer,
      requestMetadata,
    });

    const autoCommit = session.templateVersion === 2 && session.status === "ready";
    let commitResult = null;
    let commitFailure: ProductBatchImportCommitError | null = null;

    if (autoCommit) {
      try {
        commitResult = await commitProductBatchImportSession({
          auth,
          sessionId: session.id,
          requestMetadata,
        });
      } catch (error) {
        if (error instanceof ProductBatchImportCommitError) {
          commitFailure = error;
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json(
      {
        message: commitResult
          ? `Import selesai. ${commitResult.committedItemCount} item berhasil dibuat dan langsung tersedia.`
          : commitFailure
            ? "Import atomic gagal diproses. Tidak ada data bisnis parsial yang disimpan."
            : session.status === "ready"
              ? "File template v1 berhasil divalidasi dan siap direview."
              : "File berhasil diperiksa, tetapi masih memiliki validation error. Tidak ada produk yang dibuat.",
        session: {
          ...session,
          status: commitResult ? "completed" : commitFailure ? "failed" : session.status,
          expiresAt: session.expiresAt.toISOString(),
        },
        commitFailure: commitFailure
          ? { code: commitFailure.code, message: commitFailure.message }
          : null,
        commitResult: commitResult
          ? {
              ...commitResult,
              committedAt: commitResult.committedAt.toISOString(),
            }
          : null,
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
    if (error instanceof ProductBatchImportCommitError) {
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
