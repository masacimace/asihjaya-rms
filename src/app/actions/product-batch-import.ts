"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  commitProductBatchImportSession,
  ProductBatchImportCommitError,
} from "@/features/product-batch-import/commit-service";
import {
  printProductBatchImportLabels,
  ProductBatchImportLabelError,
} from "@/features/product-batch-import/label-service";
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

export type ProductBatchImportLabelActionState = {
  status: "idle" | "success" | "error";
  sessionId?: string;
  message?: string;
  createdCount?: number;
  duplicateCount?: number;
  skippedCount?: number;
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

export async function printProductBatchImportLabelsAction(
  _previousState: ProductBatchImportLabelActionState,
  formData: FormData,
): Promise<ProductBatchImportLabelActionState> {
  const auth = await requirePermission("products.batch_import");
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const mode = String(formData.get("mode") ?? "selected").trim();
  const selectedItemIds = formData
    .getAll("itemId")
    .map((value) => String(value).trim());

  if (!UUID_PATTERN.test(sessionId) || !UUID_PATTERN.test(requestId)) {
    return {
      status: "error",
      sessionId,
      message: "Intent cetak label Batch Import tidak valid.",
    };
  }
  if (mode !== "all" && mode !== "selected") {
    return {
      status: "error",
      sessionId,
      message: "Mode cetak label Batch Import tidak valid.",
    };
  }

  try {
    const result = await printProductBatchImportLabels({
      auth,
      sessionId,
      requestId,
      mode,
      selectedItemIds,
      requestMetadata: await getRequestMetadata(),
    });

    revalidatePath(`/admin/produk/import/${sessionId}`);
    return {
      status: "success",
      sessionId,
      message: `Job label dibuat: ${result.createdCount} baru, ${result.duplicateCount} duplicate-safe, ${result.skippedCount} dilewati karena belum eligible.`,
      createdCount: result.createdCount,
      duplicateCount: result.duplicateCount,
      skippedCount: result.skippedCount,
    };
  } catch (error) {
    return {
      status: "error",
      sessionId,
      message:
        error instanceof ProductBatchImportLabelError || error instanceof Error
          ? error.message
          : "Pembuatan job label Batch Import gagal.",
    };
  }
}
