"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  normalizeBuybackDecimal,
  normalizeBuybackMoney,
  normalizeBuybackPurity,
} from "@/features/buybacks/calculations";
import {
  type BuybackProcessingActionState,
  type BuybackProcessingSubmitPayload,
  type NormalizedBuybackProcessingPayload,
} from "@/features/buybacks/processing-contracts";
import {
  BuybackProcessingValidationError,
  completeBuybackProcessingTransaction,
} from "@/features/buybacks/processing-service";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";
import { deleteImageFile, storeImageFile } from "@/lib/storage/image-storage";
import { validateImageFile } from "@/lib/storage/image-validation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): BuybackProcessingActionState {
  return { status: "error", message, fieldErrors };
}

function normalizeNullableText(value: unknown, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function parsePayload(formData: FormData): BuybackProcessingSubmitPayload | null {
  const raw = String(formData.get("payload") ?? "");
  if (!raw || raw.length > 20_000) return null;

  try {
    const parsed = JSON.parse(raw) as BuybackProcessingSubmitPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizePayload(
  raw: BuybackProcessingSubmitPayload,
):
  | { ok: true; value: NormalizedBuybackProcessingPayload }
  | { ok: false; message: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  const processingId = String(raw.processingId ?? "").trim();
  if (!UUID_PATTERN.test(processingId)) {
    fieldErrors.processingId =
      "Item pemrosesan tidak valid. Refresh halaman lalu coba kembali.";
  }

  const productMasterId = String(raw.productMasterId ?? "").trim();
  if (!UUID_PATTERN.test(productMasterId)) {
    fieldErrors.productMasterId = "Pilih Product Master hasil.";
  }

  const displayName = normalizeNullableText(raw.displayName, 220);
  if (!displayName || displayName.length < 2) {
    fieldErrors.displayName = "Nama Produk hasil wajib diisi minimal 2 karakter.";
  }

  const weightGram = normalizeBuybackDecimal(raw.weightGram);
  if (!weightGram) {
    fieldErrors.weightGram =
      "Berat Sesudah wajib lebih besar dari 0 dengan maksimal 3 desimal.";
  }

  const purityPercent = normalizeBuybackPurity(raw.purityPercent, 100);
  if (!purityPercent) {
    fieldErrors.purityPercent =
      "Kadar hasil wajib lebih besar dari 0 dan maksimal 100%.";
  }

  const color = normalizeNullableText(raw.color, 64);
  if (!color) {
    fieldErrors.color = "Warna hasil wajib diisi.";
  }

  const pricePerGram = normalizeBuybackMoney(raw.pricePerGram);
  if (!pricePerGram) {
    fieldErrors.pricePerGram = "Harga/Gram wajib lebih besar dari Rp 0.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Periksa kembali hasil pemrosesan.",
      fieldErrors,
    };
  }

  return {
    ok: true,
    value: {
      processingId,
      productMasterId,
      displayName: displayName!,
      weightGram: weightGram!,
      purityPercent: purityPercent!,
      color: color!,
      pricePerGram: pricePerGram!,
    },
  };
}

async function getRequestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent"),
  };
}

export async function completeBuybackProcessingAction(
  _previousState: BuybackProcessingActionState,
  formData: FormData,
): Promise<BuybackProcessingActionState> {
  const auth = await requirePermission("buybacks.create");
  if (!hasPermission(auth, "pos.access")) {
    return failure("User ini belum memiliki akses POS.");
  }

  const rawPayload = parsePayload(formData);
  if (!rawPayload) {
    return failure(
      "Payload pemrosesan tidak valid. Refresh halaman lalu coba kembali.",
    );
  }

  const normalized = normalizePayload(rawPayload);
  if (!normalized.ok) {
    return failure(normalized.message, normalized.fieldErrors);
  }

  const resultImageValue = formData.get("resultImage");
  const resultImage =
    resultImageValue instanceof File && resultImageValue.size > 0
      ? resultImageValue
      : null;

  if (!resultImage) {
    return failure("Foto sesudah pemrosesan wajib diambil.", {
      resultImage: "Foto Sesudah wajib diisi.",
    });
  }

  const imageValidation = validateImageFile(resultImage);
  if (!imageValidation.valid) {
    return failure("Foto sesudah pemrosesan tidak valid.", {
      resultImage: imageValidation.message,
    });
  }

  const imageEntityId = randomUUID();
  const newProductItemId = randomUUID();
  let resultImageKey: string | null = null;

  try {
    resultImageKey = await storeImageFile({
      file: resultImage,
      organizationId: auth.organization.id,
      entityType: "items",
      entityId: imageEntityId,
    });

    const requestMetadata = await getRequestMetadata();
    const result = await completeBuybackProcessingTransaction({
      auth,
      payload: normalized.value,
      resultImageKey,
      newProductItemId,
      requestMetadata,
    });

    if (result.replayed && resultImageKey) {
      await deleteImageFile(resultImageKey);
    }

    revalidatePath("/pos");
    revalidatePath("/pos/buyback");
    revalidatePath("/pos/buyback/pemrosesan");
    revalidatePath("/admin/inventaris");

    return {
      status: "success",
      message: result.replayed
        ? `${result.buybackNumber} item ini sudah selesai diproses sebelumnya.`
        : `${result.processingType === "cleaning" ? "Cuci" : "Rongsok"} ${result.buybackNumber} selesai. ${result.sku} sekarang tersedia di POS.`,
      result,
    };
  } catch (error) {
    if (resultImageKey) {
      await deleteImageFile(resultImageKey);
    }

    if (error instanceof BuybackProcessingValidationError) {
      return failure(error.message);
    }

    console.error("Gagal menyelesaikan pemrosesan Buyback:", error);
    return failure(
      "Pemrosesan Buyback gagal karena terjadi kendala sistem. Coba ulang.",
    );
  }
}
