export type SaleReturnCaseStatus =
  | "awaiting_receipt"
  | "pending_inspection"
  | "partially_inspected"
  | "completed"
  | "rejected"
  | "cancelled";

export type SaleReturnItemStatus =
  | "awaiting_receipt"
  | "pending_inspection"
  | "restocked"
  | "repair"
  | "damaged"
  | "rejected";

export type ReturnInspectionDecision =
  | "restock"
  | "repair"
  | "damaged"
  | "reject";

export type SaleReturnWorkflowItem = {
  id: string;
  saleItemId: string;
  productItemId: string;
  lineNumber: number;
  productName: string;
  sku: string;
  barcode: string;
  serialNumber: string | null;
  expectedWeightGram: string | null;
  finalPriceAmount: string;
  status: SaleReturnItemStatus;
  receivedCode: string | null;
  actualWeightGram: string | null;
  identityConfirmed: boolean | null;
  certificateComplete: boolean | null;
  packagingComplete: boolean | null;
  conditionGood: boolean | null;
  decision: ReturnInspectionDecision | null;
  inspectionNotes: string | null;
  photoKey: string | null;
  receivedByName: string | null;
  receivedAt: Date | null;
  inspectedByName: string | null;
  inspectedAt: Date | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  currentAvailability: string;
  currentCondition: string;
  currentLocationState: string;
};

export type SaleReturnWorkflowData = {
  id: string;
  saleId: string;
  invoiceNumber: string;
  saleStatus: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  customerName: string | null;
  status: SaleReturnCaseStatus;
  expectedItemCount: number;
  receivedItemCount: number;
  inspectedItemCount: number;
  notes: string | null;
  createdAt: Date;
  completedAt: Date | null;
  createdByName: string;
  items: SaleReturnWorkflowItem[];
};
