"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

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

  const headerStore = await headers();

  try {
    await cancelProductBatchImportSession({
      auth,
      sessionId,
      requestMetadata: {
        ipAddress: getClientIp(headerStore),
        userAgent: headerStore.get("user-agent"),
      },
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
