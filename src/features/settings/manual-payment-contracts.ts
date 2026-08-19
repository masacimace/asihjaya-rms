import type {
  PosManualPaymentProfileType,
  PosManualPaymentVerificationSource,
} from "@/features/pos/contracts";

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

export type ManualPaymentSettingsData = {
  outlets: ManualPaymentSettingsOutlet[];
  profiles: ManualPaymentSettingsProfile[];
};
