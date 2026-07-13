"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { ReturnInspectionDecision } from "@/features/returns/contracts";
import {
  RETURN_INSPECT_PERMISSION,
  RETURN_RECEIVE_PERMISSION,
} from "@/features/returns/authorization";
import {
  inspectSaleReturnItem,
  receiveSaleReturnItem,
  ReturnWorkflowError,
} from "@/features/returns/transaction-service";
import { requirePermission } from "@/lib/auth/session";
import {
  deleteReturnInspectionPhoto,
  storeReturnInspectionPhoto,
} from "@/lib/storage/return-inspection-storage";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function isReturnInspectionDecision(
  value: string,
): value is ReturnInspectionDecision {
  return ["restock", "repair", "damaged", "reject"].includes(value);
}

function getReturnPageHref(saleId: string) {
  return UUID_PATTERN.test(saleId)
    ? `/admin/penjualan/${saleId}/retur`
    : "/admin/penjualan";
}

function redirectWithFeedback({
  saleId,
  type,
  message,
}: {
  saleId: string;
  type: "success" | "error" | "info";
  message: string;
}): never {
  const params = new URLSearchParams({
    feedbackType: type,
    feedbackMessage: message,
  });

  redirect(`${getReturnPageHref(saleId)}?${params.toString()}`);
}

async function getRequestMetadata() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");

  return {
    ipAddress:
      forwardedFor?.split(",")[0]?.trim().slice(0, 64) ??
      headerStore.get("x-real-ip")?.slice(0, 64) ??
      null,
    userAgent: headerStore.get("user-agent"),
  };
}

function revalidateReturnPaths(saleId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/inventaris");
  revalidatePath("/admin/penjualan");
  revalidatePath(`/admin/penjualan/${saleId}`);
  revalidatePath(`/admin/penjualan/${saleId}/retur`);
  revalidatePath("/pos");
}

export async function receiveSaleReturnItemAction(formData: FormData) {
  const auth = await requirePermission(RETURN_RECEIVE_PERMISSION);
  const saleId = readText(formData, "saleId");
  const returnItemId = readText(formData, "returnItemId");
  const scannedCode = readText(formData, "scannedCode");

  if (!UUID_PATTERN.test(saleId) || !UUID_PATTERN.test(returnItemId)) {
    redirectWithFeedback({
      saleId,
      type: "error",
      message: "Transaksi atau item retur tidak valid.",
    });
  }

  let result: Awaited<ReturnType<typeof receiveSaleReturnItem>>;

  try {
    result = await receiveSaleReturnItem({
      organizationId: auth.organization.id,
      accessibleOutletIds: auth.outlets.map((outlet) => outlet.id),
      saleId,
      returnItemId,
      scannedCode,
      actor: {
        id: auth.user.id,
        fullName: auth.user.fullName,
      },
      requestMetadata: await getRequestMetadata(),
    });
  } catch (error) {
    const message =
      error instanceof ReturnWorkflowError
        ? error.message
        : "Penerimaan item retur gagal. Tidak ada perubahan inventory yang disimpan.";

    console.error("Failed to receive sale return item", {
      saleId,
      returnItemId,
      error,
    });

    redirectWithFeedback({ saleId, type: "error", message });
  }

  revalidateReturnPaths(saleId);

  redirectWithFeedback({
    saleId,
    type: "success",
    message: `Item ${result.invoiceNumber} berhasil diterima dan dikarantina untuk pemeriksaan (${result.nextReceivedCount}/${result.expectedItemCount}).`,
  });
}

export async function inspectSaleReturnItemAction(formData: FormData) {
  const auth = await requirePermission(RETURN_INSPECT_PERMISSION);
  const saleId = readText(formData, "saleId");
  const returnItemId = readText(formData, "returnItemId");
  const actualWeightGram = readText(formData, "actualWeightGram");
  const decisionRaw = readText(formData, "decision");
  const notes = readText(formData, "notes");
  const photoValue = formData.get("photo");

  if (!UUID_PATTERN.test(saleId) || !UUID_PATTERN.test(returnItemId)) {
    redirectWithFeedback({
      saleId,
      type: "error",
      message: "Transaksi atau item retur tidak valid.",
    });
  }

  if (!isReturnInspectionDecision(decisionRaw)) {
    redirectWithFeedback({
      saleId,
      type: "error",
      message: "Keputusan pemeriksaan tidak valid.",
    });
  }

  let photoKey: string | null = null;
  let result: Awaited<ReturnType<typeof inspectSaleReturnItem>>;

  try {
    if (photoValue instanceof File && photoValue.size > 0) {
      photoKey = await storeReturnInspectionPhoto({
        file: photoValue,
        organizationId: auth.organization.id,
      });
    }

    result = await inspectSaleReturnItem({
      organizationId: auth.organization.id,
      accessibleOutletIds: auth.outlets.map((outlet) => outlet.id),
      saleId,
      returnItemId,
      actualWeightGram,
      identityConfirmed: readCheckbox(formData, "identityConfirmed"),
      certificateComplete: readCheckbox(formData, "certificateComplete"),
      packagingComplete: readCheckbox(formData, "packagingComplete"),
      conditionGood: readCheckbox(formData, "conditionGood"),
      decision: decisionRaw,
      notes,
      photoKey,
      actor: {
        id: auth.user.id,
        fullName: auth.user.fullName,
      },
      requestMetadata: await getRequestMetadata(),
    });
  } catch (error) {
    if (photoKey) {
      await deleteReturnInspectionPhoto(photoKey).catch((cleanupError) => {
        console.error("Failed to clean up return inspection photo", {
          photoKey,
          cleanupError,
        });
      });
    }

    const message =
      error instanceof ReturnWorkflowError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Pemeriksaan item retur gagal. Tidak ada perubahan inventory yang disimpan.";

    console.error("Failed to inspect sale return item", {
      saleId,
      returnItemId,
      error,
    });

    redirectWithFeedback({ saleId, type: "error", message });
  }

  revalidateReturnPaths(saleId);

  redirectWithFeedback({
    saleId,
    type: "success",
    message: `Pemeriksaan ${result.invoiceNumber} berhasil disimpan. Keputusan: ${result.decision}. Progress ${result.inspectedItemCount}/${result.expectedItemCount}.`,
  });
}
