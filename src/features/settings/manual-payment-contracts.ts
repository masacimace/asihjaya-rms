import type {
  PosManualPaymentProfileType,
  PosManualPaymentVerificationSource,
} from "@/features/pos/contracts";
import type { NonCashManualPaymentMethod } from "@/features/pos/manual-payment-verification";

export type ManualPaymentSettingsOutlet = {
  id: string;
  code: string;
  name: string;
  registers: Array<{
    id: string;
    code: string;
    name: string;
  }>;
};

export type ManualPaymentSettingsProfile = {
  id: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  registerId: string | null;
  registerCode: string | null;
  registerName: string | null;
  profileType: PosManualPaymentProfileType;
  code: string;
  name: string;
  provider: string;
  verificationSource: PosManualPaymentVerificationSource;
  merchantId: string | null;
  terminalId: string | null;
  destinationAccount: string | null;
  displayOrder: number;
  isActive: boolean;
};

export type ManualPaymentSettingsPolicy = {
  method: NonCashManualPaymentMethod;
  coVerificationThreshold: number;
  evidenceThreshold: number;
  duplicateLookbackDays: number;
  isEnabled: boolean;
};

export type ManualPaymentSettingsData = {
  outlets: ManualPaymentSettingsOutlet[];
  profiles: ManualPaymentSettingsProfile[];
  policies: ManualPaymentSettingsPolicy[];
};
