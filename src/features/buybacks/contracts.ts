export const BUYBACK_MAX_ITEMS = 20;

export type BuybackItemSource = "asihjaya" | "external";
export type BuybackPayoutMethod = "cash" | "bank_transfer" | "customer_deposit";

export type BuybackExistingItemOption = {
  id: string;
  sku: string;
  barcode: string;
  qrValue: string | null;
  serialNumber: string | null;
  productMasterId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  weightGram: string | null;
  purityPercent: string | null;
  exchangePurityPercent: string | null;
  color: string | null;
  deductionPerGram: string | null;
  imageKey: string | null;
  soldAt: Date | null;
  lastInvoiceNumber: string | null;
};

export type BuybackCustomerOption = {
  id: string;
  customerCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  customerDepositBalanceAmount: string;
  customerDepositBalance: number;
  customerDepositLastLedgerEntryAt: Date | null;
};

export type BuybackContext = {
  outlet: { id: string; code: string; name: string } | null;
  register: { id: string; code: string; name: string } | null;
  activeShift: {
    id: string;
    openedAt: Date;
    expectedCash: string | null;
  } | null;
};

export type BuybackInitialData = {
  context: BuybackContext;
  customers: BuybackCustomerOption[];
};

export type BuybackItemPayload = {
  clientKey: string;
  source: BuybackItemSource;
  productItemId?: string | null;
  productMasterId?: string | null;
  displayName?: string | null;
  weightGram: string;
  purityPercent: string;
  exchangePurityPercent: string;
  color: string;
  deductionPerGram: string;
  buybackPricePerGram: string;
};

export type BuybackPayoutPayload = {
  method: BuybackPayoutMethod;
  amount: string;
  reference?: string | null;
};

export type BuybackSubmitPayload = {
  idempotencyKey: string;
  customerId: string;
  notes?: string | null;
  items: BuybackItemPayload[];
  payouts: BuybackPayoutPayload[];
};

export type NormalizedBuybackItem = BuybackItemPayload & {
  productItemId: string | null;
  productMasterId: string | null;
  displayName: string | null;
  weightGram: string;
  purityPercent: string;
  exchangePurityPercent: string;
  deductionPerGram: string;
  buybackPricePerGram: string;
  baseAmount: number;
  deductionAmount: number;
  finalAmount: number;
};

export type NormalizedBuybackPayout = {
  method: BuybackPayoutMethod;
  amount: number;
  reference: string | null;
};

export type NormalizedBuybackPayload = {
  idempotencyKey: string;
  customerId: string;
  notes: string | null;
  items: NormalizedBuybackItem[];
  payouts: NormalizedBuybackPayout[];
  totalAmount: number;
};

export type BuybackActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  result?: {
    buybackId: string;
    buybackNumber: string;
    totalAmount: number;
    itemCount: number;
    replayed: boolean;
    receiptJobId?: string | null;
  };
};

export const initialBuybackActionState: BuybackActionState = { status: "idle" };

export type BuybackExistingSearchResult =
  | { status: "success"; items: BuybackExistingItemOption[] }
  | { status: "error"; message: string; items: [] };


export type BuybackHistoryPayoutSummary = {
  method: BuybackPayoutMethod;
  amount: string;
  reference: string | null;
};

export type BuybackHistoryRow = {
  id: string;
  buybackNumber: string;
  status: "completed" | "cancelled";
  totalAmount: string;
  completedAt: Date | null;
  createdAt: Date;
  customerId: string;
  customerCode: string | null;
  customerName: string;
  customerPhone: string | null;
  processedByName: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  itemCount: number;
  payouts: BuybackHistoryPayoutSummary[];
};

export type BuybackDetailItem = {
  id: string;
  productItemId: string;
  source: BuybackItemSource;
  lineNumber: number;
  weightGram: string;
  purityPercent: string;
  exchangePurityPercent: string;
  buybackPricePerGram: string;
  deductionPerGram: string;
  baseAmount: string;
  deductionAmount: string;
  finalAmount: string;
  snapshot: Record<string, unknown>;
  currentSku: string;
  currentBarcode: string;
  currentDisplayName: string;
};

export type BuybackReceiptJobSummary = {
  id: string;
  status: string;
  attempts: number;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
} | null;

export type BuybackDetail = BuybackHistoryRow & {
  registerCode: string;
  registerName: string;
  notes: string | null;
  items: BuybackDetailItem[];
  receiptJob: BuybackReceiptJobSummary;
};

export type BuybackHistoryData = {
  rows: BuybackHistoryRow[];
  detail: BuybackDetail | null;
};
