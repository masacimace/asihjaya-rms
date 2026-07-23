export const customerDepositLedgerEntryTypes = [
  "deposit_in",
  "deposit_used",
  "deposit_withdrawal",
  "adjustment",
] as const;

export type CustomerDepositLedgerEntryType =
  (typeof customerDepositLedgerEntryTypes)[number];

export const customerDepositLedgerDirections = ["credit", "debit"] as const;

export type CustomerDepositLedgerDirection =
  (typeof customerDepositLedgerDirections)[number];

export type CustomerDepositLedgerErrorCode =
  | "INVALID_AMOUNT"
  | "INVALID_DIRECTION"
  | "INSUFFICIENT_BALANCE";

export type CustomerDepositScope = {
  organizationId: string;
  outletId: string;
  customerId: string;
};

export type CustomerDepositBalance = CustomerDepositScope & {
  balanceAmount: string;
  balance: number;
  lastLedgerEntryAt: Date | null;
};

export type CustomerDepositOutletBalance = {
  organizationId: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  customerId: string;
  balanceAmount: string;
  balance: number;
  lastLedgerEntryAt: Date | null;
};

export type CustomerDepositLedgerRow = CustomerDepositScope & {
  id: string;
  saleId: string | null;
  paymentId: string | null;
  cashMovementId: string | null;
  approvalId: string | null;
  entryType: CustomerDepositLedgerEntryType;
  direction: CustomerDepositLedgerDirection;
  amount: string;
  balanceAfter: string;
  idempotencyKey: string | null;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdByUserId: string;
  occurredAt: Date;
  createdAt: Date;
};

export type CustomerDepositLedgerListRow = CustomerDepositLedgerRow & {
  outletName: string;
  customerName: string;
  customerCode: string | null;
  createdByName: string;
  invoiceNumber: string | null;
};

export type CreateCustomerDepositLedgerEntryInput = CustomerDepositScope & {
  entryType: CustomerDepositLedgerEntryType;
  direction: CustomerDepositLedgerDirection;
  amount: number | string;
  createdByUserId: string;
  saleId?: string | null;
  paymentId?: string | null;
  cashMovementId?: string | null;
  approvalId?: string | null;
  idempotencyKey?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

export type CustomerDepositLedgerListFilters = {
  organizationId: string;
  outletId?: string | null;
  customerId?: string | null;
  limit?: number;
};
