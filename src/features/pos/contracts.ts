export const POS_INITIAL_ITEM_LIMIT = 120;

export type PosCategoryOption = {
  id: string;
  code: string;
  name: string;
  totalAvailableItems: number;
};

export type PosAvailableItem = {
  id: string;
  sku: string;
  barcode: string;
  qrValue: string | null;
  serialNumber: string | null;
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  weightGram: string | null;
  purityPercent: string | null;
  exchangePurityPercent: string | null;
  size: string | null;
  color: string | null;
  gemstone: string | null;
  sellingAmount: string | null;
  imageKey: string | null;
  productImageKey: string | null;
  outletId: string | null;
  outletCode: string | null;
  outletName: string | null;
};

export type PosRegisterContext = {
  id: string;
  code: string;
  name: string;
  isHardwareHub: boolean;
};

export type PosActiveShiftContext = {
  id: string;
  status: "open" | "closing" | "closed";
  openedAt: Date;
  openedByName: string | null;
  openingCash: string;
  expectedCash: string | null;
};

export type PosOperationalContext = {
  outlet: {
    id: string;
    code: string;
    name: string;
  } | null;
  register: PosRegisterContext | null;
  activeShift: PosActiveShiftContext | null;
};

export type PosCustomerOption = {
  id: string;
  customerCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
};

export type PosManualPaymentProfileType = "qris" | "edc" | "bank_account";

export type PosManualPaymentProfile = {
  id: string;
  profileType: PosManualPaymentProfileType;
  code: string;
  name: string;
  provider: string;
  verificationSource: PosManualPaymentVerificationSource;
  merchantId: string | null;
  terminalId: string | null;
  destinationAccount: string | null;
  registerId: string | null;
  registerName: string | null;
};

export type PosManualPaymentPolicy = {
  method: Exclude<PosManualPaymentMethod, "cash">;
  coVerificationThreshold: number;
  evidenceThreshold: number;
  duplicateLookbackDays: number;
  isEnabled: boolean;
};

export type PosInitialData = {
  context: PosOperationalContext;
  categories: PosCategoryOption[];
  items: PosAvailableItem[];
  customers: PosCustomerOption[];
  paymentProfiles: PosManualPaymentProfile[];
  paymentPolicies: PosManualPaymentPolicy[];
};

export type PosScanLookupResult =
  | {
      status: "found";
      item: PosAvailableItem;
      message: string;
    }
  | {
      status: "not_found" | "unavailable" | "invalid";
      message: string;
    };

export type PosManualPaymentMethod =
  "cash" | "qris_manual" | "debit_card" | "credit_card" | "bank_transfer";

export type PosManualPaymentVerificationSource =
  "merchant_app" | "edc_terminal" | "bank_app" | "bank_statement";

export type PosManualPaymentVerificationDetails = {
  terminalId?: string | null;
  merchantId?: string | null;
  batchNumber?: string | null;
  traceNumber?: string | null;
  cardNetwork?: string | null;
  cardLast4?: string | null;
  senderName?: string | null;
  destinationAccount?: string | null;
};

export type PosCheckoutPaymentInput = {
  method: PosManualPaymentMethod;
  amount: number;
  manualPaymentProfileId?: string | null;
  verificationConfirmed?: boolean | null;
  receivedAmount?: number | null;
  changeAmount?: number | null;
  provider?: string | null;
  reference?: string | null;
  note?: string | null;
  verificationSource?: PosManualPaymentVerificationSource | null;
  providerPaidAtIso?: string | null;
  evidenceKey?: string | null;
  verificationDetails?: PosManualPaymentVerificationDetails | null;
};

export type PosCheckoutPayload = {
  itemIds: string[];
  payments: PosCheckoutPaymentInput[];
  idempotencyKey: string;
  customerId?: string | null;
  note?: string | null;
  discountApprovalId?: string | null;
  discountAmount?: number | null;
  discountReason?: string | null;
  manualPaymentApprovalId?: string | null;
};

export type PosManualPaymentApproval = {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  responseNotes: string | null;
  createdAtIso: string;
  resolvedAtIso: string | null;
};

export type PosManualPaymentApprovalStatusResult =
  | {
      status: "found";
      message: string;
      approval: PosManualPaymentApproval;
    }
  | {
      status: "not_found" | "error";
      message: string;
    };

export type PosPaymentEvidenceUploadResult =
  | { status: "success"; message: string; evidenceKey: string }
  | { status: "error"; message: string };

export type PosDiscountApprovalPayload = {
  itemIds: string[];
  discountAmount: number;
  reason: string;
  customerId?: string | null;
};

export type PosDiscountApprovalStatus = "pending" | "approved" | "rejected";

export type PosDiscountApproval = {
  id: string;
  status: PosDiscountApprovalStatus;
  discountAmount: number;
  reason: string;
  responseNotes: string | null;
  createdAtIso: string;
  resolvedAtIso: string | null;
};

export type PosDiscountApprovalActionResult =
  | {
      status: "success";
      message: string;
      approval: PosDiscountApproval;
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type PosDiscountApprovalStatusResult =
  | {
      status: "found";
      message: string;
      approval: PosDiscountApproval;
    }
  | {
      status: "not_found" | "error";
      message: string;
    };

export type PosHoldCartPayload = {
  itemIds: string[];
  customerId?: string | null;
  title?: string | null;
  note?: string | null;
};

export type PosHeldCartStatus = "active" | "resumed" | "canceled";

export type PosHeldCartSummary = {
  id: string;
  holdNumber: string;
  status: PosHeldCartStatus;
  title: string | null;
  note: string | null;
  itemCount: number;
  subtotalAmount: string;
  discountAmount: string;
  totalAmount: string;
  createdAt: Date;
  updatedAt: Date;
  customer: PosCustomerOption | null;
  heldBy: {
    id: string;
    fullName: string;
  };
  shiftId: string;
  registerId: string;
};

export type PosHeldCartItem = PosAvailableItem & {
  lineNumber: number;
  listPriceAmount: string;
  discountAmount: string;
  finalPriceAmount: string;
};

export type PosHeldCartListItem = PosHeldCartSummary & {
  items: PosHeldCartItem[];
};

export type PosHeldCartListData = {
  outlet: {
    id: string;
    code: string;
    name: string;
    hardwareStatus: "online" | "offline";
  } | null;
  register: PosRegisterContext | null;
  query: string;
  heldCarts: PosHeldCartListItem[];
  summary: {
    totalHeldCarts: number;
    totalItems: number;
    totalAmount: number;
  };
};

export type PosHeldCartActionResult =
  | {
      status: "success";
      message: string;
      heldCart: PosHeldCartSummary;
      items?: PosHeldCartItem[];
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type PosCheckoutSaleResult = {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  receiptCertificateJobId?: string | null;
};

export type PosCheckoutActionResult =
  | {
      status: "success";
      message: string;
      sale: PosCheckoutSaleResult;
      recovery: "created" | "replayed";
    }
  | {
      status: "approval_required";
      message: string;
      approval: PosManualPaymentApproval;
    }
  | {
      status: "processing";
      message: string;
      idempotencyKey: string;
      retryAfterMs: number;
    }
  | {
      status: "error";
      message: string;
      code?:
        | "validation_error"
        | "idempotency_conflict"
        | "attempt_failed"
        | "system_error";
      fieldErrors?: Record<string, string>;
    };

export type PosCheckoutRecoveryStatusResult =
  | {
      status: "completed";
      message: string;
      sale: PosCheckoutSaleResult;
    }
  | {
      status: "approval_required";
      message: string;
      approval: PosManualPaymentApproval;
    }
  | {
      status: "processing";
      message: string;
      retryAfterMs: number;
    }
  | {
      status: "failed";
      message: string;
      errorCode: string | null;
      retryable: boolean;
    }
  | {
      status: "not_found";
      message: string;
    };

export type PosShiftActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

export const initialPosShiftActionState: PosShiftActionState = {
  status: "idle",
  message: "",
};

export type PosTransactionRange = "today" | "7d" | "30d" | "all";

export type PosTransactionPayment = {
  method: string;
  provider: string;
  amount: string;
  status: string;
  providerReference: string | null;
};

export type PosTransactionItem = {
  productItemId: string;
  sku: string;
  productName: string;
  categoryName: string;
  finalPriceAmount: string;
};

export type PosTransactionListItem = {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotalAmount: string;
  discountAmount: string;
  additionalFeeAmount: string;
  totalAmount: string;
  paidAmount: number;
  paymentStatus: "paid" | "partial" | "pending";
  completedAt: Date | null;
  createdAt: Date;
  customerCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  cashierName: string;
  registerName: string;
  shiftId: string;
  totalItems: number;
  items: PosTransactionItem[];
  payments: PosTransactionPayment[];
};

export type PosTransactionListData = {
  outlet: {
    id: string;
    code: string;
    name: string;
    hardwareStatus: "online" | "offline";
  } | null;
  query: string;
  range: PosTransactionRange;
  shiftId: string | null;
  transactions: PosTransactionListItem[];
  summary: {
    totalTransactions: number;
    totalAmount: number;
    paidAmount: number;
    totalItems: number;
  };
};

export type PosTransactionDetailPayment = PosTransactionPayment & {
  id: string;
  paidAt: Date | null;
  verifiedAt: Date | null;
  receivedAmount: number | null;
  changeAmount: number | null;
  note: string | null;
};

export type PosTransactionDetailItem = PosTransactionItem & {
  id: string;
  lineNumber: number;
  barcode: string;
  serialNumber: string | null;
  weightGram: string | null;
  purityPercent: string | null;
  exchangePurityPercent: string | null;
  size: string | null;
  color: string | null;
  gemstone: string | null;
  listPriceAmount: string;
  discountAmount: string;
};

export type PosTransactionHardwareJob = {
  id: string;
  jobType: string;
  deviceType: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
};

export type PosTransactionDetailData = {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotalAmount: string;
  discountAmount: string;
  discountReason: string | null;
  additionalFeeAmount: string;
  totalAmount: string;
  paidAmount: number;
  paymentStatus: "paid" | "partial" | "pending";
  completedAt: Date | null;
  createdAt: Date;
  notes: string | null;
  outletName: string;
  registerName: string;
  shiftId: string;
  shiftOpenedAt: Date | null;
  shiftClosedAt: Date | null;
  shiftStatus: string | null;
  cashierName: string;
  customer: {
    code: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  items: PosTransactionDetailItem[];
  payments: PosTransactionDetailPayment[];
  hardwareJobs: PosTransactionHardwareJob[];
};

export type PosCustomerLastTransaction = {
  id: string;
  invoiceNumber: string;
  completedAt: Date | null;
  totalAmount: string;
};

export type PosCustomerListItem = {
  id: string;
  customerCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  totalTransactions: number;
  totalAmount: number;
  lastTransaction: PosCustomerLastTransaction | null;
};

export type PosCustomerListData = {
  outlet: {
    id: string;
    code: string;
    name: string;
    hardwareStatus: "online" | "offline";
  } | null;
  query: string;
  customers: PosCustomerListItem[];
  summary: {
    totalCustomers: number;
    customersWithTransactions: number;
    totalTransactionAmount: number;
  };
};

export type PosShiftCashSummary = {
  openingBalance: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  cashRefunds: number;
  closingAdjustments: number;
  expectedCash: number;
  movementCount: number;
};

export type PosShiftTransactionSummary = {
  totalTransactions: number;
  totalAmount: number;
  paidAmount: number;
  cashPaymentAmount: number;
  nonCashPaymentAmount: number;
  totalItems: number;
  discountAmount: number;
  averageTransactionAmount: number;
};

export type PosShiftPaymentMethodSummary = {
  method: string;
  amount: number;
  paymentCount: number;
  transactionCount: number;
};

export type PosShiftPaymentStatusSummary = {
  status: "paid" | "partial" | "pending";
  transactionCount: number;
  totalAmount: number;
  paidAmount: number;
};

export type PosShiftOverviewRecentTransaction = {
  id: string;
  invoiceNumber: string;
  completedAt: Date | null;
  customerName: string | null;
  totalAmount: string;
  paidAmount: number;
  discountAmount: string;
  paymentStatus: "paid" | "partial" | "pending";
  totalItems: number;
  paymentMethods: string[];
};

export type PosShiftOverviewData = {
  outlet: {
    id: string;
    code: string;
    name: string;
    hardwareStatus: "online" | "offline";
  } | null;
  register: PosRegisterContext | null;
  activeShift: {
    id: string;
    status: "open" | "closing" | "closed";
    openedAt: Date;
    openedByName: string | null;
    openingCash: string;
    expectedCash: string;
    cashSummary: PosShiftCashSummary;
    transactionSummary: PosShiftTransactionSummary;
    paymentMethodSummary: PosShiftPaymentMethodSummary[];
    paymentStatusSummary: PosShiftPaymentStatusSummary[];
  } | null;
  recentTransactions: PosShiftOverviewRecentTransaction[];
};
