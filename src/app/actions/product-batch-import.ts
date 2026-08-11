"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  commitProductBatchImportSession,
  ProductBatchImportCommitError,
} from "@/features/product-batch-import/commit-service";
import {
  cancelProductBatchImportSession,
  ProductBatchImportServiceError,
} from "@/features/product-batch-import/session-service";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductBatchImportCancelActionState = {
  status: "idle" | "success" | "error";
  sessionId?: string;
  message?: string;
};

export type ProductBatchImportCommitActionState = {
  status: "idle" | "success" | "error";
  sessionId?: string;
  message?: string;
  committedMasterCount?: number;
  committedItemCount?: number;
};

async function getRequestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent"),
  };
}

export async function commitProductBatchImportSessionAction(
  _previousState: ProductBatchImportCommitActionState,
  formData: FormData,
): Promise<ProductBatchImportCommitActionState> {
  const auth = await requirePermission("products.batch_import");
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const confirmation = String(formData.get("confirmCommit") ?? "").trim();

  if (!UUID_PATTERN.test(sessionId)) {
    return {
      status: "error",
      sessionId,
      message: "Session import tidak valid.",
    };
  }
  if (confirmation !== "yes") {
    return {
      status: "error",
      sessionId,
      message:
        "Konfirmasi commit wajib dicentang sebelum data bisnis dibuat.",
    };
  }

  try {
    const result = await commitProductBatchImportSession({
      auth,
      sessionId,
      requestMetadata: await getRequestMetadata(),
    });

    revalidatePath("/admin/produk");
    revalidatePath("/admin/inventaris");
    revalidatePath("/admin/produk/import");
    revalidatePath(`/admin/produk/import/${sessionId}`);

    return {
      status: "success",
      sessionId,
      message:
        result.stagingCleanupWarnings > 0
          ? `Commit selesai: ${result.committedMasterCount} Product Master dan ${result.committedItemCount} Product Item dibuat. Ada ${result.stagingCleanupWarnings} warning cleanup staging yang perlu ditinjau.`
          : `Commit selesai: ${result.committedMasterCount} Product Master dan ${result.committedItemCount} Product Item berhasil dibuat secara atomic.`,
      committedMasterCount: result.committedMasterCount,
      committedItemCount: result.committedItemCount,
    };
  } catch (error) {
    return {
      status: "error",
      sessionId,
      message:
        error instanceof ProductBatchImportCommitError || error instanceof Error
          ? error.message
          : "Atomic commit Product Batch Import gagal.",
    };
  }
}

export async function cancelProductBatchImportSessionAction(
  _previousState: ProductBatchImportCancelActionState,
  formData: FormData,
): Promise<ProductBatchImportCancelActionState> {
  const auth = await requirePermission("products.batch_import");
  const sessionId = String(formData.get("sessionId") ?? "").trim();

  if (!UUID_PATTERN.test(sessionId)) {
    return {
      status: "error",
      sessionId,
      message: "Session import tidak valid.",
    };
  }

  try {
    await cancelProductBatchImportSession({
      auth,
      sessionId,
      requestMetadata: await getRequestMetadata(),
    });
  } catch (error) {
    return {
      status: "error",
      sessionId,
      message:
        error instanceof ProductBatchImportServiceError || error instanceof Error
          ? error.message
          : "Session import gagal dibatalkan.",
    };
  }

  revalidatePath("/admin/produk/import");
  revalidatePath(`/admin/produk/import/${sessionId}`);
  return {
    status: "success",
    sessionId,
    message: "Session import dibatalkan dan staging dibersihkan.",
  };
}
