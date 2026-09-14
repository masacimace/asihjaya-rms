"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { db } from "@/db";
import {
  auditLogs,
  metalBuybackPriceRates,
  metalPurities,
  metals,
} from "@/db/schema";
import type { MetalPriceRateActionState } from "@/features/pricing/metal-price-rate-action-state";
import { normalizePurityKey } from "@/features/pricing/metal-price-rates";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function normalizeMoney(value: string) {
  const normalized = value
    .replace(/^rp\s*/i, "")
    .replace(/[.\s]/g, "")
    .replace(/^0+(?=\d)/, "");

  if (!/^\d{1,18}$/.test(normalized) || normalized === "0") return null;
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
  const rows = await transaction
    .select({ id: metalPurities.id })
    .from(metalPurities)
    .where(
      and(
        eq(metalPurities.metalId, metalId),
        sql`${metalPurities.purityPercentage}::numeric = ${purityKey}::numeric`,
      ),
    )
    .limit(1);

  if (rows[0]) return rows[0];

  const created = await transaction
    .insert(metalPurities)
    .values({
      metalId,
      code: makePurityCode(purityKey),
      displayName: `${purityKey}%`,
      purityPercentage: purityKey,
      isActive: true,
    })
    .returning({ id: metalPurities.id });

  if (!created[0]) throw new Error("PURITY_CREATE_FAILED");
  return created[0];
}

function revalidateBuybackRateConsumers() {
  revalidatePath("/admin");
  revalidatePath("/admin/pengaturan/harga-gram");
  revalidatePath("/pos/buyback");
}

export async function retireBuybackPriceRateAction(
  purityValue: string,
): Promise<MetalPriceRateActionState> {
  const auth = await requirePermission("pricing.manage");
  const purityKey = normalizePurityKey(purityValue);

  if (!purityKey) {
    return { status: "error", message: "Kadar Buyback yang akan dihentikan tidak valid." };
  }

  const metalId = await getGoldMetalId(auth.organization.id);
  if (!metalId) {
    return { status: "error", message: "Master logam Emas belum tersedia." };
  }

  const headerStore = await headers();

  try {
    const result = await db.transaction(async (transaction) => {
      const purityRows = await transaction
        .select({ id: metalPurities.id })
        .from(metalPurities)
        .where(
          and(
            eq(metalPurities.metalId, metalId),
            sql`${metalPurities.purityPercentage}::numeric = ${purityKey}::numeric`,
          ),
        )
        .limit(1);
      const purity = purityRows[0] ?? null;
      if (!purity) return { kind: "missing" as const };

      const activeRows = await transaction
        .select({
          id: metalBuybackPriceRates.id,
          ratePerGram: metalBuybackPriceRates.ratePerGram,
          effectiveFrom: metalBuybackPriceRates.effectiveFrom,
        })
        .from(metalBuybackPriceRates)
        .where(
          and(
            eq(metalBuybackPriceRates.metalPurityId, purity.id),
            isNull(metalBuybackPriceRates.effectiveUntil),
          ),
        )
        .limit(1);
      const active = activeRows[0] ?? null;
      if (!active) return { kind: "missing" as const };

      const effectiveUntil = new Date(
        Math.max(Date.now(), active.effectiveFrom.getTime() + 1),
      );

      await transaction
        .update(metalBuybackPriceRates)
        .set({ effectiveUntil })
        .where(eq(metalBuybackPriceRates.id, active.id));

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: "pricing.buyback_rate.retire",
        entityType: "metal_purity",
        entityId: purity.id,
        beforeData: {
          purityPercent: purityKey,
          ratePerGram: active.ratePerGram,
          effectiveFrom: active.effectiveFrom.toISOString(),
          rateType: "buyback",
        },
        afterData: {
          purityPercent: purityKey,
          status: "retired",
          effectiveUntil: effectiveUntil.toISOString(),
          rateType: "buyback",
        },
        ipAddress: getClientIp(headerStore),
        userAgent: headerStore.get("user-agent"),
      });

      return { kind: "retired" as const };
    });

    if (result.kind === "missing") {
      return {
        status: "error",
        message: `Rate Buyback ${purityKey}% sudah tidak aktif atau tidak ditemukan.`,
      };
    }
  } catch (error) {
    console.error("Gagal menghentikan Rate Buyback aktif", error);
    return {
      status: "error",
      message: "Rate Buyback belum bisa dihentikan karena terjadi kendala sistem.",
    };
  }

  revalidateBuybackRateConsumers();
  return {
    status: "success",
    message: `Rate Buyback ${purityKey}% berhasil dihentikan. Histori rate tetap tersimpan.`,
  };
}

export async function saveBuybackPriceRatesAction(
  _previousState: MetalPriceRateActionState,
  formData: FormData,
): Promise<MetalPriceRateActionState> {
  const auth = await requirePermission("pricing.manage");
  const fieldErrors: Record<string, string> = {};
  const entries: Array<{ purityKey: string; ratePerGram: string }> = [];

  for (const [name, rawValue] of formData.entries()) {
    if (!name.startsWith("buybackRatePerGram:")) continue;

    const purityKey = normalizePurityKey(name.slice("buybackRatePerGram:".length));
    const rawRate = String(rawValue ?? "").trim();
    if (!purityKey || !rawRate) continue;

    const ratePerGram = normalizeMoney(rawRate);
    if (!ratePerGram) {
      fieldErrors[name] = `Rate Buyback kadar ${purityKey}% harus lebih besar dari Rp0.`;
      continue;
    }
    entries.push({ purityKey, ratePerGram });
  }

  const rawNewPurity = readText(formData, "newBuybackPurityPercent");
  const newPurityKey = normalizePurityKey(rawNewPurity);
  const rawNewRate = readText(formData, "newBuybackRatePerGram");

  if (rawNewPurity || rawNewRate) {
    if (!newPurityKey) {
      fieldErrors.newBuybackPurityPercent =
        "Kadar Buyback baru harus berada di atas 0 dan maksimal 100%.";
    }

    const newRate = normalizeMoney(rawNewRate);
    if (!newRate) {
      fieldErrors.newBuybackRatePerGram =
        "Rate Buyback / Gram baru wajib lebih besar dari Rp0.";
    }

    if (newPurityKey && newRate) {
      entries.push({ purityKey: newPurityKey, ratePerGram: newRate });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Periksa kembali Rate Buyback yang diisi.",
      fieldErrors,
    };
  }

  if (entries.length === 0) {
    return { status: "error", message: "Tidak ada perubahan Rate Buyback untuk disimpan." };
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
            id: metalBuybackPriceRates.id,
            ratePerGram: metalBuybackPriceRates.ratePerGram,
            effectiveFrom: metalBuybackPriceRates.effectiveFrom,
          })
          .from(metalBuybackPriceRates)
          .where(
            and(
              eq(metalBuybackPriceRates.metalPurityId, purity.id),
              isNull(metalBuybackPriceRates.effectiveUntil),
            ),
          )
          .limit(1);
        const active = activeRows[0] ?? null;

        if (active?.ratePerGram === entry.ratePerGram) continue;

        const effectiveFrom = active
          ? new Date(
              Math.max(now.getTime(), active.effectiveFrom.getTime() + 1),
            )
          : now;

        if (active) {
          await transaction
            .update(metalBuybackPriceRates)
            .set({ effectiveUntil: effectiveFrom })
            .where(eq(metalBuybackPriceRates.id, active.id));
        }

        await transaction.insert(metalBuybackPriceRates).values({
          metalPurityId: purity.id,
          ratePerGram: entry.ratePerGram,
          effectiveFrom,
          effectiveUntil: null,
          notes: "Rate Buyback aktif dari pengaturan RMS",
          createdByUserId: auth.user.id,
        });

        await transaction.insert(auditLogs).values({
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          action: "pricing.buyback_rate.update",
          entityType: "metal_purity",
          entityId: purity.id,
          beforeData: active
            ? {
                purityPercent: entry.purityKey,
                ratePerGram: active.ratePerGram,
                rateType: "buyback",
              }
            : null,
          afterData: {
            purityPercent: entry.purityKey,
            ratePerGram: entry.ratePerGram,
            rateType: "buyback",
          },
          ipAddress: getClientIp(headerStore),
          userAgent: headerStore.get("user-agent"),
        });
      }
    });
  } catch (error) {
    console.error("Gagal menyimpan Rate Buyback aktif", error);
    return {
      status: "error",
      message: "Rate Buyback belum bisa disimpan karena terjadi kendala sistem.",
    };
  }

  revalidateBuybackRateConsumers();
  return { status: "success", message: "Rate Buyback aktif berhasil diperbarui." };
}
