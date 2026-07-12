"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  manualPaymentPolicies,
  manualPaymentProfiles,
  outlets,
  registers,
} from "@/db/schema";
import type {
  PosManualPaymentProfileType,
  PosManualPaymentVerificationSource,
} from "@/features/pos/contracts";
import {
  isNonCashManualPaymentMethod,
} from "@/features/pos/manual-payment-verification";
import { requirePermission } from "@/lib/auth/session";

const SETTINGS_PATH = "/admin/pengaturan";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function parseMoneyInput(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").replace(/\D/g, "");
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) ? amount : Number.NaN;
}

function parseIntegerInput(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function redirectWithMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ type, message });
  redirect(`${SETTINGS_PATH}?${params.toString()}`);
}

function isProfileType(value: string): value is PosManualPaymentProfileType {
  return value === "qris" || value === "edc" || value === "bank_account";
}

function resolveVerificationSource({
  profileType,
  value,
}: {
  profileType: PosManualPaymentProfileType;
  value: string;
}): PosManualPaymentVerificationSource | null {
  if (profileType === "edc") return "edc_terminal";

  if (
    profileType === "qris" &&
    (value === "merchant_app" || value === "bank_app")
  ) {
    return value;
  }

  if (
    profileType === "bank_account" &&
    (value === "bank_app" || value === "bank_statement")
  ) {
    return value;
  }

  return null;
}

function isUniqueViolation(error: unknown, constraintName: string) {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };

  return (
    (candidate.code === "23505" && candidate.constraint === constraintName) ||
    (candidate.cause?.code === "23505" &&
      candidate.cause.constraint === constraintName)
  );
}

async function getRequestMetadata() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");

  return {
    ipAddress:
      forwardedFor?.split(",")[0]?.trim().slice(0, 64) ??
      headerStore.get("x-real-ip")?.slice(0, 64) ??
      null,
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function revalidatePaymentSettings() {
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/pos");
}

export async function saveManualPaymentPolicyAction(formData: FormData) {
  const auth = await requirePermission("settings.manage");
  const method = readText(formData, "method", 40);

  if (!isNonCashManualPaymentMethod(method)) {
    redirectWithMessage("error", "Metode kebijakan pembayaran tidak valid.");
  }

  const evidenceThreshold = parseMoneyInput(formData.get("evidenceThreshold"));
  const coVerificationThreshold = parseMoneyInput(
    formData.get("coVerificationThreshold"),
  );
  const duplicateLookbackDays = parseIntegerInput(
    formData.get("duplicateLookbackDays"),
  );
  const isEnabled = formData.get("isEnabled") === "on";

  if (
    !Number.isSafeInteger(evidenceThreshold) ||
    evidenceThreshold < 0 ||
    !Number.isSafeInteger(coVerificationThreshold) ||
    coVerificationThreshold < 0
  ) {
    redirectWithMessage("error", "Threshold harus berupa nominal rupiah yang valid.");
  }

  if (
    !Number.isSafeInteger(duplicateLookbackDays) ||
    duplicateLookbackDays < 1 ||
    duplicateLookbackDays > 3650
  ) {
    redirectWithMessage(
      "error",
      "Periode pencarian reference duplikat harus 1–3650 hari.",
    );
  }

  const requestMetadata = await getRequestMetadata();
  const now = new Date();

  await db.transaction(async (transaction) => {
    const [before] = await transaction
      .select({
        id: manualPaymentPolicies.id,
        evidenceThreshold: manualPaymentPolicies.evidenceThreshold,
        coVerificationThreshold:
          manualPaymentPolicies.coVerificationThreshold,
        duplicateLookbackDays: manualPaymentPolicies.duplicateLookbackDays,
        isEnabled: manualPaymentPolicies.isEnabled,
      })
      .from(manualPaymentPolicies)
      .where(
        and(
          eq(manualPaymentPolicies.organizationId, auth.organization.id),
          eq(manualPaymentPolicies.method, method),
        ),
      )
      .limit(1);

    const [saved] = await transaction
      .insert(manualPaymentPolicies)
      .values({
        organizationId: auth.organization.id,
        method,
        evidenceThreshold: String(evidenceThreshold),
        coVerificationThreshold: String(coVerificationThreshold),
        duplicateLookbackDays,
        isEnabled,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          manualPaymentPolicies.organizationId,
          manualPaymentPolicies.method,
        ],
        set: {
          evidenceThreshold: String(evidenceThreshold),
          coVerificationThreshold: String(coVerificationThreshold),
          duplicateLookbackDays,
          isEnabled,
          updatedAt: now,
        },
      })
      .returning({ id: manualPaymentPolicies.id });

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: null,
      actorUserId: auth.user.id,
      action: "settings.manual_payment_policy.update",
      entityType: "manual_payment_policy",
      entityId: saved?.id ?? method,
      beforeData: before
        ? {
            evidenceThreshold: Number(before.evidenceThreshold),
            coVerificationThreshold: Number(before.coVerificationThreshold),
            duplicateLookbackDays: before.duplicateLookbackDays,
            isEnabled: before.isEnabled,
          }
        : null,
      afterData: {
        method,
        evidenceThreshold,
        coVerificationThreshold,
        duplicateLookbackDays,
        isEnabled,
      },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: { source: "admin.settings.manual_payments" },
      createdAt: now,
    });
  });

  revalidatePaymentSettings();
  redirectWithMessage("success", "Kebijakan pembayaran manual berhasil disimpan.");
}

export async function saveManualPaymentProfileAction(formData: FormData) {
  const auth = await requirePermission("settings.manage");
  const profileId = readText(formData, "profileId", 36);
  const outletId = readText(formData, "outletId", 36);
  const requestedRegisterId = readText(formData, "registerId", 36);
  const profileTypeValue = readText(formData, "profileType", 24);
  const code = readText(formData, "code", 40).toUpperCase();
  const name = readText(formData, "name", 120);
  const provider = readText(formData, "provider", 80);
  const verificationSourceValue = readText(
    formData,
    "verificationSource",
    40,
  );
  const merchantId = readText(formData, "merchantId", 80) || null;
  const terminalId = readText(formData, "terminalId", 80) || null;
  const destinationAccount =
    readText(formData, "destinationAccount", 120) || null;
  const displayOrder = parseIntegerInput(formData.get("displayOrder"));
  const isActive = formData.get("isActive") === "on";

  if (profileId && !UUID_PATTERN.test(profileId)) {
    redirectWithMessage("error", "ID profil pembayaran tidak valid.");
  }

  if (!UUID_PATTERN.test(outletId)) {
    redirectWithMessage("error", "Pilih outlet yang valid.");
  }

  if (!isProfileType(profileTypeValue)) {
    redirectWithMessage("error", "Tipe profil pembayaran tidak valid.");
  }

  const verificationSource = resolveVerificationSource({
    profileType: profileTypeValue,
    value: verificationSourceValue,
  });

  if (!verificationSource) {
    redirectWithMessage("error", "Sumber verifikasi profil tidak valid.");
  }

  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)) {
    redirectWithMessage(
      "error",
      "Kode profil minimal 2 karakter dan hanya boleh huruf, angka, _ atau -.",
    );
  }

  if (name.length < 3 || provider.length < 2) {
    redirectWithMessage(
      "error",
      "Nama profil minimal 3 karakter dan provider minimal 2 karakter.",
    );
  }

  if (
    !Number.isSafeInteger(displayOrder) ||
    displayOrder < 0 ||
    displayOrder > 9999
  ) {
    redirectWithMessage("error", "Urutan profil harus antara 0–9999.");
  }

  if (profileTypeValue === "qris" && !merchantId) {
    redirectWithMessage("error", "Merchant ID/akun QRIS wajib diisi.");
  }

  if (profileTypeValue === "edc" && !terminalId) {
    redirectWithMessage("error", "Terminal ID EDC wajib diisi.");
  }

  if (profileTypeValue === "bank_account" && !destinationAccount) {
    redirectWithMessage("error", "Rekening tujuan toko wajib diisi.");
  }

  const registerId =
    profileTypeValue === "edc" && requestedRegisterId
      ? requestedRegisterId
      : null;

  if (registerId && !UUID_PATTERN.test(registerId)) {
    redirectWithMessage("error", "Register EDC tidak valid.");
  }

  const [outlet] = await db
    .select({ id: outlets.id })
    .from(outlets)
    .where(
      and(
        eq(outlets.id, outletId),
        eq(outlets.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  if (!outlet) {
    redirectWithMessage("error", "Outlet tidak ditemukan dalam organisasi ini.");
  }

  if (registerId) {
    const [register] = await db
      .select({ id: registers.id })
      .from(registers)
      .where(
        and(
          eq(registers.id, registerId),
          eq(registers.outletId, outletId),
          eq(registers.isActive, true),
        ),
      )
      .limit(1);

    if (!register) {
      redirectWithMessage(
        "error",
        "Register EDC tidak aktif atau bukan bagian dari outlet yang dipilih.",
      );
    }
  }

  const requestMetadata = await getRequestMetadata();
  const now = new Date();

  try {
    await db.transaction(async (transaction) => {
      const [before] = profileId
        ? await transaction
            .select()
            .from(manualPaymentProfiles)
            .where(
              and(
                eq(manualPaymentProfiles.id, profileId),
                eq(
                  manualPaymentProfiles.organizationId,
                  auth.organization.id,
                ),
              ),
            )
            .limit(1)
        : [];

      if (profileId && !before) {
        throw new Error("MANUAL_PAYMENT_PROFILE_NOT_FOUND");
      }

      const values = {
        organizationId: auth.organization.id,
        outletId,
        registerId,
        profileType: profileTypeValue,
        code,
        name,
        provider,
        verificationSource,
        merchantId: profileTypeValue === "qris" ? merchantId : null,
        terminalId: profileTypeValue === "edc" ? terminalId : null,
        destinationAccount:
          profileTypeValue === "bank_account" ? destinationAccount : null,
        displayOrder,
        isActive,
        updatedAt: now,
      };

      const [saved] = profileId
        ? await transaction
            .update(manualPaymentProfiles)
            .set(values)
            .where(
              and(
                eq(manualPaymentProfiles.id, profileId),
                eq(
                  manualPaymentProfiles.organizationId,
                  auth.organization.id,
                ),
              ),
            )
            .returning({ id: manualPaymentProfiles.id })
        : await transaction
            .insert(manualPaymentProfiles)
            .values({ ...values, createdAt: now })
            .returning({ id: manualPaymentProfiles.id });

      if (!saved) {
        throw new Error("MANUAL_PAYMENT_PROFILE_SAVE_FAILED");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId,
        actorUserId: auth.user.id,
        action: profileId
          ? "settings.manual_payment_profile.update"
          : "settings.manual_payment_profile.create",
        entityType: "manual_payment_profile",
        entityId: saved.id,
        beforeData: before
          ? {
              outletId: before.outletId,
              registerId: before.registerId,
              profileType: before.profileType,
              code: before.code,
              name: before.name,
              provider: before.provider,
              verificationSource: before.verificationSource,
              merchantId: before.merchantId,
              terminalId: before.terminalId,
              destinationAccount: before.destinationAccount,
              displayOrder: before.displayOrder,
              isActive: before.isActive,
            }
          : null,
        afterData: values,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: { source: "admin.settings.manual_payments" },
        createdAt: now,
      });
    });
  } catch (error) {
    if (
      isUniqueViolation(
        error,
        "manual_payment_profiles_org_outlet_code_uq",
      )
    ) {
      redirectWithMessage(
        "error",
        "Kode profil sudah digunakan pada outlet yang sama.",
      );
    }

    if (error instanceof Error && error.message === "MANUAL_PAYMENT_PROFILE_NOT_FOUND") {
      redirectWithMessage("error", "Profil pembayaran tidak ditemukan.");
    }

    console.error("Failed to save manual payment profile", error);
    redirectWithMessage(
      "error",
      "Profil pembayaran belum bisa disimpan karena terjadi kendala sistem.",
    );
  }

  revalidatePaymentSettings();
  redirectWithMessage("success", "Profil pembayaran berhasil disimpan.");
}
