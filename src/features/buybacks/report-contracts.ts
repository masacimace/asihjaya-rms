import type {
  BuybackHistoryDateRange,
  BuybackHistoryPayoutFilter,
  BuybackHistoryProcessingFilter,
  BuybackItemSource,
  BuybackPayoutMethod,
  BuybackProcessingStatus,
  BuybackProcessingType,
} from "@/features/buybacks/contracts";

export type BuybackReportFilters = {
  search: string;
  dateRange: BuybackHistoryDateRange;
  processingFilter: BuybackHistoryProcessingFilter;
  payoutFilter: BuybackHistoryPayoutFilter;
};

export type BuybackReportPayout = {
  method: BuybackPayoutMethod;
  amount: string;
  reference: string | null;
};

export type BuybackReportItem = {
  id: string;
  lineNumber: number;
  source: BuybackItemSource;
  weightGram: string;
  purityPercent: string;
  finalAmount: string;
  snapshot: Record<string, unknown>;
  processingType: BuybackProcessingType | null;
  processingStatus: BuybackProcessingStatus | null;
};

export type BuybackReportRow = {
  id: string;
  buybackNumber: string;
  status: "completed" | "cancelled";
  totalAmount: string;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  outletCode: string;
  outletName: string;
  registerCode: string;
  registerName: string;
  processedByName: string;
  customerCode: string | null;
  customerName: string;
  customerPhone: string | null;
  payouts: BuybackReportPayout[];
  items: BuybackReportItem[];
};
