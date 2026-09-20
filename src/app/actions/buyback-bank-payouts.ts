"use server";

import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { completeBuybackAction } from "@/app/actions/buybacks";
import { db } from "@/db";
import {
  buybackPayouts,
  buybacks,
  manualPaymentProfiles,
  registers,
} from "@/db/schema";
import type { BuybackActionState } from "@/features/buybacks/contracts";
import { getDefaultPosRegisterCondition } from "@/features/pos/context";
import { hasPermission, requirePermission } from "@/lib/auth/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BuybackBankAccountOption = {
  id: string;
  code: string;
  name: string;
  provider: string;
  destinationAccount: string;
};

export type BuybackBankPayoutSnapshot = {
  profileId: string;
  code: string;
  name: string;
  provider: string;
  accountNumber: string;
  amount: string;
  reference: string | null;
};

type BankProfileRow = BuybackBankAccountOption & {
  verificationSource: string;
  registerId: string | null;
};

function readMetadataText(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function getPrimaryOutlet(auth: Awaited<ReturnType<typeof requirePermission>>) {
  return auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0] ?? null;
}

async function getDefaultRegisterId(outletId: string) {
  const [register] = await db
    .select({ id: registers.id })
    .from(registers)
    .where(getDefaultPosRegisterCondition(outletId))
    .orderBy(asc(registers.name))
    .limit(1);
  return register?.id ?? null;
}

async function getActiveBankProfiles({
  organizationId,
  outletId,
  registerId,
  profileId,
}: {
  organizationId: string;
  outletId: string;
  registerId: string | null;
  profileId?: string | null;
}): Promise<BankProfileRow[]> {
  const rows = await db
    .select({
      id: manualPaymentProfiles.id,
      code: manualPaymentProfiles.code,
      name: manualPaymentProfiles.name,
      provider: manualPaymentProfiles.provider,
      destinationAccount: manualPaymentProfiles.destinationAccount,
      verificationSource: manualPaymentProfiles.verificationSource,
      registerId: manualPaymentProfiles.registerId,
    })
    .from(manualPaymentProfiles)
    .where(
      and(
        eq(manualPaymentProfiles.organizationId, organizationId),
        eq(manualPaymentProfiles.outletId, outletId),
        eq(manualPaymentProfiles.profileType, "bank_account"),
        eq(manualPaymentProfiles.isActive, true),
        or(
          eq(manualPaymentProfiles.verificationSource, "bank_app"),
          eq(manualPaymentProfiles.verificationSource, "bank_statement"),
        ),
        profileId ? eq(manualPaymentProfiles.id, profileId) : undefined,
        registerId
          ? or(
              isNull(manualPaymentProfiles.registerId),
              eq(manualPaymentProfiles.registerId, registerId),
            )
          : isNull(manualPaymentProfiles.registerId),
      ),
    )
    .orderBy(
      asc(manualPaymentProfiles.displayOrder),
      asc(manualPaymentProfiles.name),
    );

  return rows.flatMap((row) => {
    const destinationAccount = row.destinationAccount?.trim();
    if (!destinationAccount) return [];
    return [{ ...row, destinationAccount }];
  });
}

function formHasBankTransfer(formData: FormData) {
  const raw = String(formData.get("payload") ?? "");
  if (!raw || raw.length > 100_000) return false;

  try {
    const payload = JSON.parse(raw) as {
      payouts?: Array<{ method?: unknown; amount?: unknown }>;
    };
    return Boolean(
      payload.payouts?.some(
        (payout) =>
          payout?.method === "bank_transfer" && Number(payout.amount ?? 0) > 0,
      ),
    );
  } catch {
    return false;
  }
}

async function resolveSelectedProfile({
  organizationId,
  outletId,
  registerId,
  profileId,
}: {
  organizationId: string;
  outletId: string;
  registerId: string | null;
  profileId: string;
}) {
  const [profile] = await getActiveBankProfiles({
    organizationId,
    outletId,
    registerId,
    profileId,
  });
  return profile ?? null;
}

export async function getBuybackBankAccountsAction(): Promise<{
  status: "success" | "error";
  message?: string;
  accounts: BuybackBankAccountOption[];
}> {
  const auth = await requirePermission("buybacks.create");
  if (!hasPermission(auth, "pos.access")) {
    return {
      status: "error",
      message: "User ini belum memiliki akses POS.",
      accounts: [],
    };
  }

  const outlet = getPrimaryOutlet(auth);
  if (!outlet) {
    return {
      status: "error",
      message: "Outlet aktif tidak ditemukan.",
      accounts: [],
    };
  }

  try {
    const registerId = await getDefaultRegisterId(outlet.id);
    const profiles = await getActiveBankProfiles({
      organizationId: auth.organization.id,
      outletId: outlet.id,
      registerId,
    });

    return {
      status: "success",
      accounts: profiles.map(({ id, code, name, provider, destinationAccount }) => ({
        id,
        code,
        name,
        provider,
        destinationAccount,
      })),
    };
  } catch (error) {
    console.error("Gagal memuat rekening payout Buyback:", error);
    return {
      status: "error",
      message: "Rekening Transfer belum bisa dimuat. Coba ulang.",
      accounts: [],
    };
  }
}

export async function completeBuybackWithBankAccountAction(
  previousState: BuybackActionState,
  formData: FormData,
): Promise<BuybackActionState> {
  const hasBankTransfer = formHasBankTransfer(formData);
  let selectedProfile: BankProfileRow | null = null;

  if (hasBankTransfer) {
    const profileId = String(formData.get("bankAccountProfileId") ?? "").trim();
    if (!UUID_PATTERN.test(profileId)) {
      return {
        status: "error",
        message: "Pilih rekening sumber payout untuk Transfer Bank.",
        fieldErrors: {
          bankAccountProfileId: "Rekening sumber payout wajib dipilih.",
        },
      };
    }

    const auth = await requirePermission("buybacks.create");
    if (!hasPermission(auth, "pos.access")) {
      return { status: "error", message: "User ini belum memiliki akses POS." };
    }

    const outlet = getPrimaryOutlet(auth);
    if (!outlet) {
      return { status: "error", message: "Outlet aktif tidak ditemukan." };
    }

    try {
      const registerId = await getDefaultRegisterId(outlet.id);
      selectedProfile = await resolveSelectedProfile({
        organizationId: auth.organization.id,
        outletId: outlet.id,
        registerId,
        profileId,
      });
    } catch (error) {
      console.error("Gagal memvalidasi rekening payout Buyback:", error);
      return {
        status: "error",
        message: "Rekening sumber payout belum bisa divalidasi. Coba ulang.",
      };
    }

    if (!selectedProfile) {
      return {
        status: "error",
        message:
          "Rekening sumber payout tidak aktif, bukan Rekening Transfer, atau tidak tersedia untuk outlet/register ini.",
        fieldErrors: {
          bankAccountProfileId: "Pilih kembali rekening sumber payout yang aktif.",
        },
      };
    }
  }

  const result = await completeBuybackAction(previousState, formData);
  if (result.status !== "success" || !result.result || !selectedProfile) {
    return result;
  }

  try {
    const [buyback] = await db
      .select({ organizationId: buybacks.organizationId })
      .from(buybacks)
      .where(eq(buybacks.id, result.result.buybackId))
      .limit(1);

    if (!buyback) {
      throw new Error("BUYBACK_NOT_FOUND_AFTER_SUCCESS");
    }

    const auth = await requirePermission("buybacks.create");
    if (buyback.organizationId !== auth.organization.id) {
      throw new Error("BUYBACK_ORGANIZATION_MISMATCH");
    }

    const [storedPayout] = await db
      .select({
        id: buybackPayouts.id,
        metadata: buybackPayouts.metadata,
      })
      .from(buybackPayouts)
      .where(
        and(
          eq(buybackPayouts.buybackId, result.result.buybackId),
          eq(buybackPayouts.method, "bank_transfer"),
        ),
      )
      .limit(1);

    if (!storedPayout) {
      throw new Error("BANK_TRANSFER_PAYOUT_NOT_FOUND_AFTER_SUCCESS");
    }

    const existingMetadata = storedPayout.metadata ?? {};
    const storedProfileId = readMetadataText(
      existingMetadata,
      "bankAccountProfileId",
    );

    if (storedProfileId && storedProfileId !== selectedProfile.id) {
      return {
        status: "error",
        message:
          "Transaksi Buyback ini sudah tersimpan dengan rekening payout yang berbeda. Refresh halaman dan buka detail transaksi.",
        fieldErrors: {
          bankAccountProfileId: "Rekening payout tidak cocok dengan transaksi tersimpan.",
        },
      };
    }

    await db
      .update(buybackPayouts)
      .set({
        metadata: {
          ...existingMetadata,
          source: "pos.buyback.b2",
          bankAccountProfileId: selectedProfile.id,
          bankAccountCode: selectedProfile.code,
          bankAccountName: selectedProfile.name,
          bankProvider: selectedProfile.provider,
          bankAccountNumber: selectedProfile.destinationAccount,
          bankVerificationSource: selectedProfile.verificationSource,
        },
      })
      .where(eq(buybackPayouts.id, storedPayout.id));

    revalidatePath("/pos/buyback");
    revalidatePath("/pos/buyback/riwayat");
    revalidatePath("/admin/buyback");
  } catch (error) {
    console.error("Gagal menyimpan snapshot rekening payout Buyback:", error);
    return {
      status: "error",
      message:
        "Buyback sudah tercatat, tetapi snapshot rekening payout belum tersimpan. Klik Selesaikan Buyback lagi untuk retry yang aman.",
    };
  }

  return result;
}

export async function getBuybackBankPayoutSnapshotAction(
  buybackId: string,
): Promise<{
  status: "success" | "error";
  payout: BuybackBankPayoutSnapshot | null;
}> {
  if (!UUID_PATTERN.test(buybackId)) {
    return { status: "error", payout: null };
  }

  const auth = await requirePermission("buybacks.view");
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  if (outletIds.length === 0) {
    return { status: "error", payout: null };
  }

  const [row] = await db
    .select({
      organizationId: buybacks.organizationId,
      amount: buybackPayouts.amount,
      reference: buybackPayouts.reference,
      metadata: buybackPayouts.metadata,
    })
    .from(buybackPayouts)
    .innerJoin(buybacks, eq(buybackPayouts.buybackId, buybacks.id))
    .where(
      and(
        eq(buybackPayouts.buybackId, buybackId),
        eq(buybackPayouts.method, "bank_transfer"),
        eq(buybacks.organizationId, auth.organization.id),
        inArray(buybacks.outletId, outletIds),
      ),
    )
    .limit(1);

  if (!row) return { status: "success", payout: null };

  const profileId = readMetadataText(row.metadata, "bankAccountProfileId");
  const code = readMetadataText(row.metadata, "bankAccountCode");
  const name = readMetadataText(row.metadata, "bankAccountName");
  const provider = readMetadataText(row.metadata, "bankProvider");
  const accountNumber = readMetadataText(row.metadata, "bankAccountNumber");

  if (!profileId || !code || !name || !provider || !accountNumber) {
    return { status: "success", payout: null };
  }

  return {
    status: "success",
    payout: {
      profileId,
      code,
      name,
      provider,
      accountNumber,
      amount: row.amount,
      reference: row.reference,
    },
  };
}
