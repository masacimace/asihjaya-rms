"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { buybacks } from "@/db/schema";
import {
  normalizeBuybackDecimal,
  normalizeBuybackMoney,
  normalizeBuybackPurity,
} from "@/features/buybacks/calculations";
import {
  BUYBACK_MAX_ITEMS,
  type BuybackActionState,
  type BuybackExistingSearchResult,
  type BuybackPayoutMethod,
  type BuybackProcessingType,
  type BuybackSubmitPayload,
  type NormalizedBuybackItem,
  type NormalizedBuybackPayload,
  type NormalizedBuybackPayout,
} from "@/features/buybacks/contracts";
import { searchBuybackExistingItems } from "@/features/buybacks/queries";
import {
  BuybackValidationError,
  completeBuybackTransaction,
  getExistingBuybackReplayResult,
  type BuybackItemArtifact,
} from "@/features/buybacks/service";
import { RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY } from "@/features/sales/documents/receipt-certificate-render-modes";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { buildBuybackReceiptDocumentPayloadV2 } from "@/lib/hardware/job-payload-contracts-v2";
import { createHardwareJobV2 } from "@/lib/hardware/job-producer-v2";
import { getClientIp } from "@/lib/http/client-ip";
import { deleteImageFile, storeImageFile } from "@/lib/storage/image-storage";
import { validateImageFile } from "@/lib/storage/image-validation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_KEY_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;
const PAYOUT_METHODS = new Set<BuybackPayoutMethod>([
  "cash",
  "bank_transfer",
  "customer_deposit",
]);
const PROCESSING_TYPES = new Set<BuybackProcessingType>([
  "cleaning",
  "recondition",
]);

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): BuybackActionState {
  return { status: "error", message, fieldErrors };
}

async function getRequestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent"),
  };
}

function normalizeNullableText(value: unknown, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function parseRawPayload(formData: FormData): BuybackSubmitPayload | null {
  const raw = String(formData.get("payload") ?? "");
  if (!raw || raw.length > 100_000) return null;
  try {
    const parsed = JSON.parse(raw) as BuybackSubmitPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizePayload(raw: BuybackSubmitPayload):
  | { ok: true; value: NormalizedBuybackPayload }
  | { ok: false; message: string; fieldErrors?: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  const idempotencyKey = String(raw.idempotencyKey ?? "").trim();
  if (!UUID_PATTERN.test(idempotencyKey)) {
    fieldErrors.idempotencyKey =
      "Sesi Buyback tidak valid. Refresh halaman lalu coba kembali.";
  }

  const customerId = String(raw.customerId ?? "").trim();
  if (!UUID_PATTERN.test(customerId)) {
    fieldErrors.customerId = "Pilih customer terdaftar terlebih dahulu.";
  }

  const notes = normalizeNullableText(raw.notes, 1000);
  if (String(raw.notes ?? "").trim().length > 1000) {
    fieldErrors.notes = "Catatan maksimal 1.000 karakter.";
  }

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    fieldErrors.items = "Tambahkan minimal satu item Buyback.";
  } else if (raw.items.length > BUYBACK_MAX_ITEMS) {
    fieldErrors.items = `Maksimal ${BUYBACK_MAX_ITEMS} item dalam satu Buyback.`;
  }

  const normalizedItems: NormalizedBuybackItem[] = [];
  const seenClientKeys = new Set<string>();
  const seenProductItemIds = new Set<string>();

  for (const [index, rawItem] of (raw.items ?? []).entries()) {
    const prefix = `items.${index}`;
    const clientKey = String(rawItem?.clientKey ?? "").trim();
    const source = rawItem?.source;

    if (!CLIENT_KEY_PATTERN.test(clientKey) || seenClientKeys.has(clientKey)) {
      fieldErrors[`${prefix}.clientKey`] = "Identitas item Buyback tidak valid.";
      continue;
    }
    seenClientKeys.add(clientKey);

    if (source !== "asihjaya" && source !== "external") {
      fieldErrors[`${prefix}.source`] = "Sumber item Buyback tidak valid.";
      continue;
    }

    const productItemId = normalizeNullableText(rawItem.productItemId, 36);
    if (source === "asihjaya") {
      if (!productItemId || !UUID_PATTERN.test(productItemId)) {
        fieldErrors[`${prefix}.productItemId`] =
          "Pilih produk ASIHJAYA yang valid.";
      } else if (seenProductItemIds.has(productItemId)) {
        fieldErrors[`${prefix}.productItemId`] =
          "Produk ASIHJAYA yang sama tidak boleh ditambahkan dua kali.";
      } else {
        seenProductItemIds.add(productItemId);
      }
    }

    const displayName = normalizeNullableText(rawItem.displayName, 220);
    if (!displayName || displayName.length < 2) {
      fieldErrors[`${prefix}.displayName`] =
        "Nama Produk wajib diisi minimal 2 karakter.";
    }

    const categoryId = String(rawItem.categoryId ?? "").trim();
    if (!UUID_PATTERN.test(categoryId)) {
      fieldErrors[`${prefix}.categoryId`] = "Pilih Kategori yang valid.";
    }

    const processingType = rawItem.processingType;
    if (!PROCESSING_TYPES.has(processingType as BuybackProcessingType)) {
      fieldErrors[`${prefix}.processingType`] =
        "Pilih kondisi barang: Cuci atau Rongsok.";
    }

    const weightGram = normalizeBuybackDecimal(rawItem.weightGram);
    const purityPercent = normalizeBuybackPurity(rawItem.purityPercent, 100);
    const totalAmountText = normalizeBuybackMoney(rawItem.totalAmount);
    const color = String(rawItem.color ?? "").trim();

    if (!weightGram) {
      fieldErrors[`${prefix}.weightGram`] =
        "Berat wajib lebih besar dari 0 dengan maksimal 3 desimal.";
    }
    if (!purityPercent) {
      fieldErrors[`${prefix}.purityPercent`] =
        "Kadar wajib lebih besar dari 0 dan maksimal 100%.";
    }
    if (color.length < 1 || color.length > 64) {
      fieldErrors[`${prefix}.color`] =
        "Warna wajib diisi, maksimal 64 karakter.";
    }
    if (!totalAmountText) {
      fieldErrors[`${prefix}.totalAmount`] =
        "Total Harga Buyback wajib lebih besar dari Rp 0.";
    }

    if (
      !displayName ||
      displayName.length < 2 ||
      !UUID_PATTERN.test(categoryId) ||
      !PROCESSING_TYPES.has(processingType as BuybackProcessingType) ||
      !weightGram ||
      !purityPercent ||
      !color ||
      !totalAmountText
    ) {
      continue;
    }

    normalizedItems.push({
      clientKey,
      source,
      productItemId: source === "asihjaya" ? productItemId : null,
      displayName,
      categoryId,
      processingType: processingType as BuybackProcessingType,
      weightGram,
      purityPercent,
      color,
      finalAmount: Number(totalAmountText),
    });
  }

  const rawPayouts = Array.isArray(raw.payouts) ? raw.payouts : [];
  const normalizedPayouts: NormalizedBuybackPayout[] = [];
  const seenPayoutMethods = new Set<BuybackPayoutMethod>();

  for (const [index, payout] of rawPayouts.entries()) {
    const method = payout?.method;
    if (!PAYOUT_METHODS.has(method as BuybackPayoutMethod)) {
      fieldErrors[`payouts.${index}.method`] = "Metode payout tidak valid.";
      continue;
    }
    const typedMethod = method as BuybackPayoutMethod;
    if (seenPayoutMethods.has(typedMethod)) {
      fieldErrors[`payouts.${index}.method`] =
        "Metode payout yang sama hanya boleh digunakan sekali.";
      continue;
    }
    seenPayoutMethods.add(typedMethod);

    const amountText = normalizeBuybackMoney(payout.amount);
    if (!amountText) {
      fieldErrors[`payouts.${index}.amount`] =
        "Nominal payout harus lebih besar dari Rp 0.";
      continue;
    }

    const reference = normalizeNullableText(payout.reference, 160);
    if (String(payout.reference ?? "").trim().length > 160) {
      fieldErrors[`payouts.${index}.reference`] =
        "Referensi maksimal 160 karakter.";
      continue;
    }

    normalizedPayouts.push({
      method: typedMethod,
      amount: Number(amountText),
      reference,
    });
  }

  const totalAmount = normalizedItems.reduce(
    (total, item) => total + item.finalAmount,
    0,
  );
  const payoutTotal = normalizedPayouts.reduce(
    (total, payout) => total + payout.amount,
    0,
  );

  if (normalizedPayouts.length === 0) {
    fieldErrors.payouts = "Isi minimal satu metode payout Buyback.";
  } else if (payoutTotal !== totalAmount) {
    fieldErrors.payouts =
      "Total payout harus sama persis dengan Total Buyback.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Periksa kembali data Buyback.",
      fieldErrors,
    };
  }

  return {
    ok: true,
    value: {
      idempotencyKey,
      customerId,
      notes,
      items: normalizedItems,
      payouts: normalizedPayouts,
      totalAmount,
    },
  };
}

export async function searchBuybackExistingItemsAction(
  query: string,
): Promise<BuybackExistingSearchResult> {
  const auth = await requirePermission("buybacks.create");
  if (!hasPermission(auth, "pos.access")) {
    return {
      status: "error",
      message: "User ini belum memiliki akses POS.",
      items: [],
    };
  }

  try {
    const items = await searchBuybackExistingItems({
      organizationId: auth.organization.id,
      query,
    });
    return { status: "success", items };
  } catch (error) {
    console.error("Gagal mencari item existing untuk Buyback:", error);
    return {
      status: "error",
      message: "Produk ASIHJAYA belum bisa dicari. Coba ulang.",
      items: [],
    };
  }
}

export async function completeBuybackAction(
  _previousState: BuybackActionState,
  formData: FormData,
): Promise<BuybackActionState> {
  const auth = await requirePermission("buybacks.create");
  if (!hasPermission(auth, "pos.access")) {
    return failure("User ini belum memiliki akses POS.");
  }

  const rawPayload = parseRawPayload(formData);
  if (!rawPayload) {
    return failure(
      "Payload Buyback tidak valid. Refresh halaman lalu coba kembali.",
    );
  }

  const normalized = normalizePayload(rawPayload);
  if (!normalized.ok) {
    return failure(normalized.message, normalized.fieldErrors);
  }
  const payload = normalized.value;

  try {
    const existingReplay = await getExistingBuybackReplayResult({
      organizationId: auth.organization.id,
      payload,
    });
    if (existingReplay) {
      return {
        status: "success",
        message: `Buyback ${existingReplay.buybackNumber} sudah pernah berhasil diproses.`,
        result: existingReplay,
      };
    }
  } catch (error) {
    if (error instanceof BuybackValidationError) {
      return failure(error.message, { idempotencyKey: error.message });
    }
    console.error("Gagal memeriksa replay Buyback:", error);
    return failure(
      "Buyback belum bisa diproses karena terjadi kendala sistem. Coba ulang.",
    );
  }

  const itemArtifacts = new Map<string, BuybackItemArtifact>();
  const itemImages = new Map<string, File>();
  const storedImageKeys: string[] = [];

  for (const item of payload.items) {
    const imageValue = formData.get(`itemImage:${item.clientKey}`);
    const image =
      imageValue instanceof File && imageValue.size > 0 ? imageValue : null;

    if (!image) {
      return failure("Foto kondisi barang wajib diambil sebelum Buyback selesai.", {
        [`items.${item.clientKey}.image`]: "Foto kondisi barang wajib diisi.",
      });
    }

    const validation = validateImageFile(image);
    if (!validation.valid) {
      return failure("Foto kondisi barang tidak valid.", {
        [`items.${item.clientKey}.image`]: validation.message,
      });
    }
    itemImages.set(item.clientKey, image);
  }

  try {
    for (const item of payload.items) {
      const buybackItemId = randomUUID();
      const image = itemImages.get(item.clientKey);
      if (!image) {
        throw new Error("BUYBACK_ITEM_IMAGE_MISSING_AFTER_VALIDATION");
      }

      const imageKey = await storeImageFile({
        file: image,
        organizationId: auth.organization.id,
        entityType: "items",
        entityId: buybackItemId,
      });
      storedImageKeys.push(imageKey);
      itemArtifacts.set(item.clientKey, { buybackItemId, imageKey });
    }

    const requestMetadata = await getRequestMetadata();
    const result = await completeBuybackTransaction({
      auth,
      payload,
      requestMetadata,
      itemArtifacts,
    });

    if (result.replayed) {
      await Promise.all(storedImageKeys.map((key) => deleteImageFile(key)));
    }

    revalidatePath("/pos");
    revalidatePath("/pos/buyback");
    revalidatePath("/pos/pelanggan");
    revalidatePath("/admin/inventaris");

    return {
      status: "success",
      message: result.replayed
        ? `Buyback ${result.buybackNumber} sudah pernah berhasil diproses.`
        : `Buyback ${result.buybackNumber} berhasil diselesaikan.`,
      result,
    };
  } catch (error) {
    await Promise.all(storedImageKeys.map((key) => deleteImageFile(key)));

    if (error instanceof BuybackValidationError) {
      return failure(error.message);
    }

    console.error("Gagal menyelesaikan Buyback:", error);
    return failure(
      "Buyback gagal diselesaikan karena terjadi kendala sistem. Coba ulang.",
    );
  }
}

function redirectBuybackDetailWithFeedback({
  buybackId,
  type,
  message,
}: {
  buybackId: string;
  type: "success" | "error" | "info";
  message: string;
}): never {
  const params = new URLSearchParams({
    detail: buybackId,
    bb_type: type,
    bb_msg: message,
  });
  redirect(`/pos/buyback?${params.toString()}`);
}

export async function reprintBuybackReceiptAction(formData: FormData) {
  const buybackId = String(formData.get("buybackId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!UUID_PATTERN.test(buybackId)) {
    redirect("/pos/buyback?bb_type=error&bb_msg=Buyback%20tidak%20valid.");
  }
  if (!UUID_PATTERN.test(requestId)) {
    redirectBuybackDetailWithFeedback({
      buybackId,
      type: "error",
      message: "Request cetak ulang nota Buyback tidak valid.",
    });
  }

  const auth = await requirePermission("buybacks.create");
  if (!hasPermission(auth, "pos.access")) {
    redirect("/akses-ditolak");
  }

  const [buyback] = await db
    .select({
      id: buybacks.id,
      organizationId: buybacks.organizationId,
      outletId: buybacks.outletId,
      registerId: buybacks.registerId,
      buybackNumber: buybacks.buybackNumber,
      status: buybacks.status,
    })
    .from(buybacks)
    .where(
      and(
        eq(buybacks.id, buybackId),
        eq(buybacks.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  if (!buyback || buyback.status !== "completed") {
    redirectBuybackDetailWithFeedback({
      buybackId,
      type: "error",
      message: "Buyback tidak ditemukan atau belum selesai.",
    });
  }

  const canAccessAll = auth.permissionCodes.includes("admin.access");
  const accessibleOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));
  if (!canAccessAll && !accessibleOutletIds.has(buyback.outletId)) {
    redirect("/akses-ditolak");
  }

  const now = new Date();
  const requestMetadata = await getRequestMetadata();

  let feedbackType: "success" | "info";
  let feedbackMessage: string;

  try {
    const result = await createHardwareJobV2({
      organizationId: auth.organization.id,
      outletId: buyback.outletId,
      registerId: buyback.registerId,
      createdByUserId: auth.user.id,
      jobType: "print_receipt_certificate",
      mode: "manual",
      payload: buildBuybackReceiptDocumentPayloadV2({
        buybackId: buyback.id,
        buybackNumber: buyback.buybackNumber,
        requestSource: "pos.buyback.detail",
        reprint: true,
        requestedAt: now,
        renderMode: RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
      }),
      idempotencyKey: `buyback-receipt:${buyback.id}:reprint:${requestId}`,
      sourceType: "buyback",
      sourceId: buyback.id,
      now,
      audit: {
        source: "pos.buyback.detail",
        requestId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        reason: `Cetak ulang nota Buyback ${buyback.buybackNumber}.`,
      },
    });

    revalidatePath("/pos/buyback");
    revalidatePath("/admin/operasional/hardware");

    feedbackType = result.duplicate ? "info" : "success";
    feedbackMessage = result.duplicate
      ? `Permintaan cetak ulang nota ${buyback.buybackNumber} sudah ada di antrean.`
      : `Nota ${buyback.buybackNumber} sudah masuk antrean Document Printer.`;
  } catch (error) {
    console.error("Gagal membuat job cetak ulang nota Buyback:", error);
    redirectBuybackDetailWithFeedback({
      buybackId,
      type: "error",
      message:
        "Cetak ulang nota Buyback gagal dibuat. Coba ulang atau cek Hardware Hub.",
    });
  }

  redirectBuybackDetailWithFeedback({
    buybackId: buyback.id,
    type: feedbackType,
    message: feedbackMessage,
  });
}
