import type {
  BuybackItemSource,
  BuybackProcessingStatus,
  BuybackProcessingType,
} from "@/features/buybacks/contracts";

export type BuybackProcessingRateOption = {
  purityKey: string;
  purityPercent: string;
  ratePerGram: string;
};

export type BuybackProcessingQueueRow = {
  id: string;
  buybackItemId: string;
  buybackId: string;
  buybackNumber: string;
  buybackCompletedAt: Date | null;
  customerName: string;
  customerCode: string | null;
  source: BuybackItemSource;
  lineNumber: number;
  processingType: BuybackProcessingType;
  status: BuybackProcessingStatus;
  sourceProductItemId: string | null;
  sourceProductMasterId: string | null;
  sourceSku: string | null;
  sourceBarcode: string | null;
  sourceDisplayName: string;
  sourceCategoryId: string;
  sourceCategoryName: string;
  sourceWeightGram: string;
  sourcePurityPercent: string;
  sourceExchangePurityPercent: string | null;
  sourceColor: string;
  sourceDeductionPerGram: string | null;
  beforeImageKey: string | null;
  beforeImageUrl: string | null;
  resultProductItemId: string | null;
  resultSku: string | null;
  resultBarcode: string | null;
  resultDisplayName: string | null;
  resultWeightGram: string | null;
  resultPurityPercent: string | null;
  resultExchangePurityPercent: string | null;
  resultColor: string | null;
  resultPricePerGram: string | null;
  resultDeductionPerGram: string | null;
  resultImageKey: string | null;
  resultImageUrl: string | null;
  processedAt: Date | null;
  createdAt: Date;
};

export type BuybackProcessingData = {
  rows: BuybackProcessingQueueRow[];
  pendingCount: number;
  completedCount: number;
  cleaningPendingCount: number;
  reconditionPendingCount: number;
};

export type BuybackProcessingSubmitPayload = {
  processingId: string;
  categoryId: string;
  productMasterId: string;
  displayName: string;
  weightGram: string;
  purityPercent: string;
  exchangePurityPercent: string;
  color: string;
  pricePerGram: string;
  deductionPerGram: string;
};

export type NormalizedBuybackProcessingPayload = {
  processingId: string;
  categoryId: string;
  productMasterId: string;
  displayName: string;
  weightGram: string;
  purityPercent: string;
  exchangePurityPercent: string;
  color: string;
  pricePerGram: string;
  deductionPerGram: string;
};

export type BuybackProcessingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  result?: {
    processingId: string;
    buybackId: string;
    buybackNumber: string;
    processingType: BuybackProcessingType;
    productItemId: string;
    sku: string;
    barcode: string;
    replayed: boolean;
  };
};

export const initialBuybackProcessingActionState: BuybackProcessingActionState = {
  status: "idle",
};
