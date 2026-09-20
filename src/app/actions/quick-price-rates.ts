"use server";

import { revalidatePath } from "next/cache";

import { saveBuybackPriceRatesAction } from "@/app/actions/buyback-price-rates";
import { saveMetalPriceRatesAction } from "@/app/actions/metal-price-rates";
import {
  initialMetalPriceRateActionState,
  type MetalPriceRateActionState,
} from "@/features/pricing/metal-price-rate-action-state";
import { normalizePurityKey } from "@/features/pricing/metal-price-rates";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export type QuickPriceRateKind = "sale" | "buyback";

export type QuickPriceRateResult = {
  status: "success" | "error";
  message: string;
  purityKey?: string;
  ratePerGram?: string;
};

type QuickPriceRateInput = {
  kind: QuickPriceRateKind;
  purityPercent: string;
  ratePerGram: string;
};

function normalizeMoney(value: string) {
  const normalized = value
    .replace(/^rp\s*/i, "")
    .replace(/[.\s]/g, "")
    .replace(/^0+(?=\d)/, "");

  if (!/^\d{1,18}$/.test(normalized) || normalized === "0") {
    return null;
  }

  return normalized;
}

function revalidateQuickRateConsumers() {
  for (const path of [
    "/admin/produk",
    "/admin/inventaris",
    "/pos/produk/tambah",
    "/pos/buyback",
    "/pos/buyback/pemrosesan",
  ]) {
    revalidatePath(path);
  }
}

export async function canManageQuickPriceRatesAction(): Promise<boolean> {
  const auth = await getCurrentAuth();
  return Boolean(auth && hasPermission(auth, "pricing.manage"));
}

export async function saveQuickPriceRateAction(
  input: QuickPriceRateInput,
): Promise<QuickPriceRateResult> {
  const auth = await getCurrentAuth();

  if (!auth) {
    return {
      status: "error",
      message: "Sesi login sudah tidak aktif. Login ulang lalu coba kembali.",
    };
  }

  if (!hasPermission(auth, "pricing.manage")) {
    return {
      status: "error",
      message:
        "Akun ini tidak memiliki permission untuk mengubah Harga / Gram Global.",
    };
  }

  if (input.kind !== "sale" && input.kind !== "buyback") {
    return { status: "error", message: "Jenis rate global tidak valid." };
  }

  const purityKey = normalizePurityKey(input.purityPercent);
  if (!purityKey) {
    return {
      status: "error",
      message: "Kadar harus berada di atas 0 dan maksimal 100%.",
    };
  }

  const ratePerGram = normalizeMoney(input.ratePerGram);
  if (!ratePerGram) {
    return {
      status: "error",
      message: "Harga / Gram wajib lebih besar dari Rp0 dan maksimal 18 digit.",
    };
  }

  const formData = new FormData();
  if (input.kind === "sale") {
    formData.set(`ratePerGram:${purityKey}`, ratePerGram);
  } else {
    formData.set(`buybackRatePerGram:${purityKey}`, ratePerGram);
  }

  let result: MetalPriceRateActionState;
  try {
    result =
      input.kind === "sale"
        ? await saveMetalPriceRatesAction(
            initialMetalPriceRateActionState,
            formData,
          )
        : await saveBuybackPriceRatesAction(
            initialMetalPriceRateActionState,
            formData,
          );
  } catch (error) {
    console.error("Gagal menyimpan quick Harga/Gram global", error);
    return {
      status: "error",
      message:
        "Harga / Gram Global belum bisa disimpan karena terjadi kendala sistem.",
    };
  }

  if (result.status !== "success") {
    return {
      status: "error",
      message: result.message ?? "Harga / Gram Global belum bisa disimpan.",
    };
  }

  revalidateQuickRateConsumers();

  return {
    status: "success",
    message:
      input.kind === "sale"
        ? `Rate Jual Global ${purityKey}% berhasil diperbarui.`
        : `Rate Buyback Global ${purityKey}% berhasil diperbarui.`,
    purityKey,
    ratePerGram,
  };
}
