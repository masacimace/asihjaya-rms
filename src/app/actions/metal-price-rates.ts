"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { db } from "@/db";
import {
  auditLogs,
  metalPriceRates,
  metalPurities,
  metals,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";
import { normalizePurityKey } from "@/features/pricing/metal-price-rates";

import type { MetalPriceRateActionState } from "@/features/pricing/metal-price-rate-action-state";

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

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

async function getGoldMetalId(organizationId: string) {
  const rows = await db
    .select({ id: metals.id })
    .from(metals)
    .where(
      and(
        eq(metals.organizationId, organizationId),
        eq(metals.code, "GOLD"),
      ),
    )
    .limit(1);

  return rows[0]?.id ?? null;
}

function makePurityCode(purityKey: string) {
  return `P${purityKey.replace(".", "_")}`.slice(0, 32);
}

async function getOrCreatePurity({
  transaction,
  metalId,
  purityKey,
}: {
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0];
  metalId: string;
  purityKey: string;
}) {
  const purityRows = await transaction
    .select({
      id: metalPurities.id,
      code: metalPurities.code,
      displayName: metalPurities.displayName,
    })
    .from(metalPurities)
    .where(
      and(
        eq(metalPurities.metalId, metalId),
        sql`${metalPurities.purityPercentage}::numeric = ${purityKey}::numeric`,
      ),
    )
    .limit(1);

  if (purityRows[0]) {
    return purityRows[0];
  }

  const created = await transaction
    .insert(metalPurities)
    .values({
      metalId,
      code: makePurityCode(purityKey),
      displayName: `${purityKey}%`,
      purityPercentage: purityKey,
      isActive: true,
    })
    .returning({
      id: metalPurities.id,
      code: metalPurities.code,
      displayName: metalPurities.displayName,
    });

  if (!created[0]) {
    throw new Error("PURITY_CREATE_FAILED");
  }

  return created[0];
}

export async function saveMetalPriceRatesAction(
  _previousState: MetalPriceRateActionState,
  formData: FormData,
): Promise<MetalPriceRateActionState> {
  const auth = await requirePermission("pricing.manage");
  const fieldErrors: Record<string, string> = {};
  const entries: Array<{ purityKey: string; ratePerGram: string }> = [];

  for (const [name, rawValue] of formData.entries()) {
    if (!name.startsWith("ratePerGram:")) {
      continue;
    }

    const purityKey = normalizePurityKey(name.slice("ratePerGram:".length));
    const rawRate = String(rawValue ?? "").trim();

    if (!purityKey || !rawRate) {
      continue;
    }

    const ratePerGram = normalizeMoney(rawRate);

    if (!ratePerGram) {
      fieldErrors[name] = `Harga/Gram kadar ${purityKey}% harus lebih besar dari Rp0.`;
      continue;
    }

    entries.push({ purityKey, ratePerGram });
  }

  const newPurityKey = normalizePurityKey(readText(formData, "newPurityPercent"));
  const rawNewRate = readText(formData, "newRatePerGram");

  if (readText(formData, "newPurityPercent") || rawNewRate) {
    if (!newPurityKey) {
      fieldErrors.newPurityPercent = "Kadar baru harus berada di atas 0 dan maksimal 100%.";
    }

    const newRate = normalizeMoney(rawNewRate);
    if (!newRate) {
      fieldErrors.newRatePerGram = "Harga/Gram baru wajib lebih besar dari Rp0.";
    }

    if (newPurityKey && newRate) {
      entries.push({ purityKey: newPurityKey, ratePerGram: newRate });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Periksa kembali Harga/Gram yang diisi.",
      fieldErrors,
    };
  }

  if (entries.length === 0) {
    return {
      status: "error",
      message: "Tidak ada perubahan Harga/Gram untuk disimpan.",
    };
  }

  const metalId = await getGoldMetalId(auth.organization.id);

  if (!metalId) {
    return {
      status: "error",
      message: "Master logam Emas belum tersedia. Jalankan seed database terlebih dahulu.",
    };
  }

  const headerStore = await headers();
  const now = new Date();

  try {
    const uniqueEntries = Array.from(
      new Map(entries.map((entry) => [entry.purityKey, entry])).values(),
    );

    await db.transaction(async (transaction) => {
      for (const entry of uniqueEntries) {
        const purity = await getOrCreatePurity({
          transaction,
          metalId,
          purityKey: entry.purityKey,
        });

        const activeRows = await transaction
          .select({
            id: metalPriceRates.id,
            ratePerGram: metalPriceRates.ratePerGram,
          })
          .from(metalPriceRates)
          .where(
            and(
              eq(metalPriceRates.metalPurityId, purity.id),
              isNull(metalPriceRates.effectiveUntil),
            ),
          )
          .limit(1);

        const active = activeRows[0] ?? null;

        if (active?.ratePerGram === entry.ratePerGram) {
          continue;
        }

        if (active) {
          await transaction
            .update(metalPriceRates)
            .set({ effectiveUntil: now })
            .where(eq(metalPriceRates.id, active.id));
        }

        await transaction.insert(metalPriceRates).values({
          metalPurityId: purity.id,
          ratePerGram: entry.ratePerGram,
          effectiveFrom: now,
          effectiveUntil: null,
          notes: "Harga/Gram aktif dari pengaturan RMS",
          createdByUserId: auth.user.id,
        });

        await transaction.insert(auditLogs).values({
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          action: "pricing.metal_rate.update",
          entityType: "metal_purity",
          entityId: purity.id,
          beforeData: active
            ? { purityPercent: entry.purityKey, ratePerGram: active.ratePerGram }
            : null,
          afterData: {
            purityPercent: entry.purityKey,
            ratePerGram: entry.ratePerGram,
          },
          ipAddress: getClientIp(headerStore),
          userAgent: headerStore.get("user-agent"),
        });
      }
    });
  } catch (error) {
    console.error("Gagal menyimpan Harga/Gram aktif", error);
    return {
      status: "error",
      message: "Harga/Gram belum bisa disimpan karena terjadi kendala sistem.",
    };
  }

  revalidatePath("/admin/pengaturan/harga-gram");
  revalidatePath("/admin/inventaris");
  revalidatePath("/pos");

  return {
    status: "success",
    message: "Harga/Gram aktif berhasil diperbarui.",
  };
}
