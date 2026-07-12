import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  manualPaymentPolicies,
  manualPaymentProfiles,
  outlets,
  registers,
} from "@/db/schema";
import type {
  ManualPaymentSettingsData,
  ManualPaymentSettingsProfile,
} from "@/features/settings/manual-payment-contracts";
import {
  DEFAULT_MANUAL_PAYMENT_POLICIES,
  isNonCashManualPaymentMethod,
} from "@/features/pos/manual-payment-verification";
import type {
  PosManualPaymentProfileType,
  PosManualPaymentVerificationSource,
} from "@/features/pos/contracts";

function isProfileType(value: string): value is PosManualPaymentProfileType {
  return value === "qris" || value === "edc" || value === "bank_account";
}

function isVerificationSource(
  value: string,
): value is PosManualPaymentVerificationSource {
  return (
    value === "merchant_app" ||
    value === "edc_terminal" ||
    value === "bank_app" ||
    value === "bank_statement"
  );
}

export async function getManualPaymentSettingsData(
  organizationId: string,
): Promise<ManualPaymentSettingsData> {
  const [outletRows, registerRows, profileRows, policyRows] = await Promise.all([
    db
      .select({
        id: outlets.id,
        code: outlets.code,
        name: outlets.name,
      })
      .from(outlets)
      .where(
        and(
          eq(outlets.organizationId, organizationId),
          eq(outlets.isActive, true),
        ),
      )
      .orderBy(asc(outlets.name)),
    db
      .select({
        id: registers.id,
        code: registers.code,
        name: registers.name,
        outletId: registers.outletId,
      })
      .from(registers)
      .innerJoin(outlets, eq(registers.outletId, outlets.id))
      .where(
        and(
          eq(outlets.organizationId, organizationId),
          eq(registers.isActive, true),
        ),
      )
      .orderBy(asc(registers.name)),
    db
      .select({
        id: manualPaymentProfiles.id,
        outletId: manualPaymentProfiles.outletId,
        outletCode: outlets.code,
        outletName: outlets.name,
        registerId: manualPaymentProfiles.registerId,
        registerCode: registers.code,
        registerName: registers.name,
        profileType: manualPaymentProfiles.profileType,
        code: manualPaymentProfiles.code,
        name: manualPaymentProfiles.name,
        provider: manualPaymentProfiles.provider,
        verificationSource: manualPaymentProfiles.verificationSource,
        merchantId: manualPaymentProfiles.merchantId,
        terminalId: manualPaymentProfiles.terminalId,
        destinationAccount: manualPaymentProfiles.destinationAccount,
        displayOrder: manualPaymentProfiles.displayOrder,
        isActive: manualPaymentProfiles.isActive,
      })
      .from(manualPaymentProfiles)
      .innerJoin(outlets, eq(manualPaymentProfiles.outletId, outlets.id))
      .leftJoin(registers, eq(manualPaymentProfiles.registerId, registers.id))
      .where(eq(manualPaymentProfiles.organizationId, organizationId))
      .orderBy(
        asc(outlets.name),
        asc(manualPaymentProfiles.displayOrder),
        asc(manualPaymentProfiles.name),
      ),
    db
      .select({
        method: manualPaymentPolicies.method,
        coVerificationThreshold:
          manualPaymentPolicies.coVerificationThreshold,
        evidenceThreshold: manualPaymentPolicies.evidenceThreshold,
        duplicateLookbackDays: manualPaymentPolicies.duplicateLookbackDays,
        isEnabled: manualPaymentPolicies.isEnabled,
      })
      .from(manualPaymentPolicies)
      .where(eq(manualPaymentPolicies.organizationId, organizationId)),
  ]);

  const profiles = profileRows
    .filter(
      (row) =>
        isProfileType(row.profileType) &&
        isVerificationSource(row.verificationSource),
    )
    .map(
      (row) =>
        ({
          ...row,
          profileType: row.profileType as PosManualPaymentProfileType,
          verificationSource:
            row.verificationSource as PosManualPaymentVerificationSource,
        }) satisfies ManualPaymentSettingsProfile,
    );

  const policyMap = structuredClone(DEFAULT_MANUAL_PAYMENT_POLICIES);

  for (const row of policyRows) {
    if (!isNonCashManualPaymentMethod(row.method)) continue;

    policyMap[row.method] = {
      method: row.method,
      coVerificationThreshold: Number(row.coVerificationThreshold),
      evidenceThreshold: Number(row.evidenceThreshold),
      duplicateLookbackDays: row.duplicateLookbackDays,
      isEnabled: row.isEnabled,
    };
  }

  return {
    outlets: outletRows.map((outlet) => ({
      ...outlet,
      registers: registerRows
        .filter((register) => register.outletId === outlet.id)
        .map(({ id, code, name }) => ({ id, code, name })),
    })),
    profiles,
    policies: Object.values(policyMap),
  };
}
