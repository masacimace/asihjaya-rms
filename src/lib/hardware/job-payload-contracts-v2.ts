import {
  RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
  RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
  type ReceiptDocumentProfileId,
} from "@/features/sales/documents/receipt-document-profiles";
import type { HardwareJobType } from "@/lib/hardware/job-protocol-v2";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export const RECEIPT_PRINT_PROFILE_A5_V1 = "receipt_a5_v1" as const;
export const RECEIPT_PRINT_PROFILE_A4_V1 = "receipt_a4_v1" as const;
export const EPSON_L3251_PRINT_PROFILE_A4_V1 =
  "epson_l3251_a4_v1" as const;
export const INVENTORY_LABEL_TEMPLATE_V1 = "jewelry_compact" as const;
export const DEFAULT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export type HardwareLabelPayloadV2 = {
  schemaVersion: 1;
  templateId: typeof INVENTORY_LABEL_TEMPLATE_V1;
  templateVersion: 1;
  itemId: string;
  copies: number;
  fields: {
    sku: string;
    barcode: string;
    productName: string;
    weightGram: string | null;
    purityPercent: string | null;
    exchangePurityPercent: string | null;
    size: string | null;
    color: string | null;
    gemstone: string | null;
    sellingAmount: string | null;
  };
};

export type HardwareDocumentPayloadV2 = {
  schemaVersion: 1;
  documentType: "receipt_certificate" | "hardware_test_document";
  documentId: string;
  download: {
    path: string;
    contentType: "application/pdf";
    maxBytes: number;
    sha256?: string;
  };
  documentProfileId?: ReceiptDocumentProfileId;
  printProfileId:
    | typeof RECEIPT_PRINT_PROFILE_A5_V1
    | typeof RECEIPT_PRINT_PROFILE_A4_V1
    | typeof EPSON_L3251_PRINT_PROFILE_A4_V1;
  copies: number;
  metadata: {
    invoiceNumber?: string;
    requestSource: string;
    reprint: boolean;
    requestedAt: string;
  };
};

export type HardwareCashDrawerPayloadV2 = {
  schemaVersion: 1;
  drawerProfileId: "drawer_default_v1";
  paymentId: string | null;
  metadata: {
    requestSource: string;
    requestedAt: string;
    test: boolean;
  };
};

export type HardwareJobPayloadV2 =
  | HardwareLabelPayloadV2
  | HardwareDocumentPayloadV2
  | HardwareCashDrawerPayloadV2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertOnlyKeys(
  record: Record<string, unknown>,
  allowedKeys: readonly string[],
  context: string,
) {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(record).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    throw new TypeError(
      `${context} memiliki field yang tidak diizinkan: ${unknownKeys.join(", ")}.`,
    );
  }
}

function requireNullableString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
) {
  const value = record[key];
  if (value === null) return;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new TypeError(
      `Hardware payload field ${key} wajib string/null maksimal ${maxLength} karakter.`,
    );
  }
}

function requireIsoDate(record: Record<string, unknown>, key: string) {
  const value = requireString(record, key, 40);
  if (!Number.isFinite(new Date(value).getTime())) {
    throw new TypeError(`Hardware payload field ${key} bukan ISO date valid.`);
  }
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`Hardware payload field ${key} wajib berupa string.`);
  }
  if (value.length > maxLength) {
    throw new TypeError(
      `Hardware payload field ${key} melebihi ${maxLength} karakter.`,
    );
  }
  return value;
}

function requireInteger(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const value = record[key];
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new TypeError(
      `Hardware payload field ${key} wajib integer ${minimum}-${maximum}.`,
    );
  }
  return Number(value);
}

function validateLabelPayload(payload: Record<string, unknown>) {
  assertOnlyKeys(
    payload,
    ["schemaVersion", "templateId", "templateVersion", "itemId", "copies", "fields"],
    "Label payload",
  );
  if (payload.schemaVersion !== 1) {
    throw new TypeError("Label payload schemaVersion harus 1.");
  }
  if (payload.templateId !== INVENTORY_LABEL_TEMPLATE_V1) {
    throw new TypeError("Label payload templateId tidak didukung.");
  }
  if (payload.templateVersion !== 1) {
    throw new TypeError("Label payload templateVersion harus 1.");
  }

  const itemId = requireString(payload, "itemId", 64);
  if (!UUID_PATTERN.test(itemId)) {
    throw new TypeError("Label payload itemId bukan UUID valid.");
  }
  requireInteger(payload, "copies", 1, 20);

  if (!isRecord(payload.fields)) {
    throw new TypeError("Label payload fields wajib berupa object.");
  }
  assertOnlyKeys(
    payload.fields,
    [
      "sku",
      "barcode",
      "productName",
      "weightGram",
      "purityPercent",
      "exchangePurityPercent",
      "size",
      "color",
      "gemstone",
      "sellingAmount",
    ],
    "Label payload fields",
  );
  requireString(payload.fields, "sku", 80);
  requireString(payload.fields, "barcode", 120);
  requireString(payload.fields, "productName", 220);
  requireNullableString(payload.fields, "weightGram", 32);
  requireNullableString(payload.fields, "purityPercent", 32);
  requireNullableString(payload.fields, "exchangePurityPercent", 32);
  requireNullableString(payload.fields, "size", 64);
  requireNullableString(payload.fields, "color", 64);
  requireNullableString(payload.fields, "gemstone", 160);
  requireNullableString(payload.fields, "sellingAmount", 32);
}

function validateDocumentPayload(payload: Record<string, unknown>) {
  assertOnlyKeys(
    payload,
    [
      "schemaVersion",
      "documentType",
      "documentId",
      "download",
      "documentProfileId",
      "printProfileId",
      "copies",
      "metadata",
    ],
    "Document payload",
  );
  if (payload.schemaVersion !== 1) {
    throw new TypeError("Document payload schemaVersion harus 1.");
  }
  if (
    payload.documentType !== "receipt_certificate" &&
    payload.documentType !== "hardware_test_document"
  ) {
    throw new TypeError("Document payload documentType tidak didukung.");
  }
  const documentId = requireString(payload, "documentId", 160);
  if (!UUID_PATTERN.test(documentId)) {
    throw new TypeError("Document payload documentId bukan UUID valid.");
  }
  requireInteger(payload, "copies", 1, 10);

  if (
    payload.printProfileId !== RECEIPT_PRINT_PROFILE_A5_V1 &&
    payload.printProfileId !== RECEIPT_PRINT_PROFILE_A4_V1 &&
    payload.printProfileId !== EPSON_L3251_PRINT_PROFILE_A4_V1
  ) {
    throw new TypeError("Document payload printProfileId tidak didukung.");
  }
  if (!isRecord(payload.download)) {
    throw new TypeError("Document payload download wajib berupa object.");
  }
  assertOnlyKeys(
    payload.download,
    ["path", "contentType", "maxBytes", "sha256"],
    "Document download",
  );
  const path = requireString(payload.download, "path", 500);
  if (!path.startsWith("/api/")) {
    throw new TypeError("Document download path wajib relative /api/ path.");
  }
  let documentProfileId: ReceiptDocumentProfileId | undefined;
  if (payload.documentProfileId !== undefined) {
    if (
      payload.documentProfileId !==
        RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1 &&
      payload.documentProfileId !== RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1
    ) {
      throw new TypeError("Document payload documentProfileId tidak didukung.");
    }
    documentProfileId = payload.documentProfileId;
  }

  if (
    documentProfileId === RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1 &&
    payload.printProfileId !== RECEIPT_PRINT_PROFILE_A5_V1
  ) {
    throw new TypeError("A5 document wajib memakai legacy A5 print profile.");
  }
  if (
    documentProfileId === RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1 &&
    payload.printProfileId !== RECEIPT_PRINT_PROFILE_A4_V1 &&
    payload.printProfileId !== EPSON_L3251_PRINT_PROFILE_A4_V1
  ) {
    throw new TypeError("A4 document wajib memakai A4 print profile.");
  }
  if (
    documentProfileId === undefined &&
    payload.printProfileId === EPSON_L3251_PRINT_PROFILE_A4_V1
  ) {
    throw new TypeError("Epson A4 print profile wajib memiliki documentProfileId.");
  }

  const basePath =
    payload.documentType === "receipt_certificate"
      ? `/api/sales/${documentId}/receipt-certificate`
      : "/api/sales/receipt-certificate-preview";
  const expectedPath = documentProfileId
    ? `${basePath}?profile=${encodeURIComponent(documentProfileId)}`
    : basePath;
  if (path !== expectedPath) {
    throw new TypeError("Document download path tidak cocok dengan document intent/profile.");
  }
  if (payload.download.contentType !== "application/pdf") {
    throw new TypeError("Document contentType wajib application/pdf.");
  }
  requireInteger(payload.download, "maxBytes", 1, 50 * 1024 * 1024);
  if (
    payload.download.sha256 !== undefined &&
    (typeof payload.download.sha256 !== "string" ||
      !SHA256_PATTERN.test(payload.download.sha256))
  ) {
    throw new TypeError("Document download sha256 tidak valid.");
  }
  if (!isRecord(payload.metadata)) {
    throw new TypeError("Document metadata wajib berupa object.");
  }
  assertOnlyKeys(
    payload.metadata,
    ["invoiceNumber", "requestSource", "reprint", "requestedAt"],
    "Document metadata",
  );
  requireString(payload.metadata, "requestSource", 120);
  requireIsoDate(payload.metadata, "requestedAt");
  if (typeof payload.metadata.reprint !== "boolean") {
    throw new TypeError("Document metadata reprint wajib boolean.");
  }
  if (payload.metadata.invoiceNumber !== undefined) {
    requireString(payload.metadata, "invoiceNumber", 120);
  }
}

function validateCashDrawerPayload(payload: Record<string, unknown>) {
  assertOnlyKeys(
    payload,
    ["schemaVersion", "drawerProfileId", "paymentId", "metadata"],
    "Cash drawer payload",
  );
  if (payload.schemaVersion !== 1) {
    throw new TypeError("Cash drawer payload schemaVersion harus 1.");
  }
  if (payload.drawerProfileId !== "drawer_default_v1") {
    throw new TypeError("Cash drawer profile tidak didukung.");
  }
  if (
    payload.paymentId !== null &&
    (typeof payload.paymentId !== "string" || !UUID_PATTERN.test(payload.paymentId))
  ) {
    throw new TypeError("Cash drawer paymentId tidak valid.");
  }
  if (!isRecord(payload.metadata)) {
    throw new TypeError("Cash drawer metadata wajib berupa object.");
  }
  assertOnlyKeys(
    payload.metadata,
    ["requestSource", "requestedAt", "test"],
    "Cash drawer metadata",
  );
  requireString(payload.metadata, "requestSource", 120);
  requireIsoDate(payload.metadata, "requestedAt");
  if (typeof payload.metadata.test !== "boolean") {
    throw new TypeError("Cash drawer metadata test wajib boolean.");
  }
}

export function assertHardwareJobPayloadV2(
  jobType: HardwareJobType,
  payload: unknown,
): asserts payload is HardwareJobPayloadV2 {
  if (!isRecord(payload)) {
    throw new TypeError("Hardware Protocol v2 payload wajib berupa object.");
  }

  switch (jobType) {
    case "print_label_sato":
    case "test_label_printer":
      validateLabelPayload(payload);
      return;
    case "print_receipt_certificate":
    case "test_document_printer":
      validateDocumentPayload(payload);
      return;
    case "open_cash_drawer":
    case "test_cash_drawer":
      validateCashDrawerPayload(payload);
      return;
  }
}

export function buildInventoryLabelPayloadV2(input: {
  itemId: string;
  copies: number;
  sku: string;
  barcode: string;
  productName: string;
  weightGram: string | null;
  purityPercent: string | null;
  exchangePurityPercent: string | null;
  size: string | null;
  color: string | null;
  gemstone: string | null;
  sellingAmount: string | null;
}): HardwareLabelPayloadV2 {
  const payload: HardwareLabelPayloadV2 = {
    schemaVersion: 1,
    templateId: INVENTORY_LABEL_TEMPLATE_V1,
    templateVersion: 1,
    itemId: input.itemId,
    copies: input.copies,
    fields: {
      sku: input.sku,
      barcode: input.barcode,
      productName: input.productName,
      weightGram: input.weightGram,
      purityPercent: input.purityPercent,
      exchangePurityPercent: input.exchangePurityPercent,
      size: input.size,
      color: input.color,
      gemstone: input.gemstone,
      sellingAmount: input.sellingAmount,
    },
  };
  assertHardwareJobPayloadV2("print_label_sato", payload);
  return payload;
}

export function buildReceiptDocumentPayloadV2(input: {
  saleId: string;
  invoiceNumber: string;
  requestSource: string;
  reprint: boolean;
  requestedAt: Date;
  documentProfileId?: ReceiptDocumentProfileId;
  printProfileId?: HardwareDocumentPayloadV2["printProfileId"];
}): HardwareDocumentPayloadV2 {
  const documentProfileId =
    input.documentProfileId ?? RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1;
  const payload: HardwareDocumentPayloadV2 = {
    schemaVersion: 1,
    documentType: "receipt_certificate",
    documentId: input.saleId,
    download: {
      path: `/api/sales/${input.saleId}/receipt-certificate?profile=${encodeURIComponent(documentProfileId)}`,
      contentType: "application/pdf",
      maxBytes: DEFAULT_DOCUMENT_MAX_BYTES,
    },
    documentProfileId,
    printProfileId:
      input.printProfileId ??
      (documentProfileId === RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1
        ? EPSON_L3251_PRINT_PROFILE_A4_V1
        : RECEIPT_PRINT_PROFILE_A5_V1),
    copies: 1,
    metadata: {
      invoiceNumber: input.invoiceNumber,
      requestSource: input.requestSource,
      reprint: input.reprint,
      requestedAt: input.requestedAt.toISOString(),
    },
  };
  assertHardwareJobPayloadV2("print_receipt_certificate", payload);
  return payload;
}

export function buildHardwareTestPayloadV2(input: {
  jobType: "test_label_printer" | "test_document_printer" | "test_cash_drawer";
  agentId: string;
  requestedAt: Date;
}): HardwareJobPayloadV2 {
  if (input.jobType === "test_label_printer") {
    return buildInventoryLabelPayloadV2({
      itemId: input.agentId,
      copies: 1,
      sku: "AJ-TEST-LABEL",
      barcode: "AJTEST123456",
      productName: "CINCIN EMAS TEST ASIHJAYA",
      weightGram: "2.350",
      purityPercent: "75",
      exchangePurityPercent: "70",
      size: "12",
      color: "Kuning",
      gemstone: "Zircon",
      sellingAmount: "1850000",
    });
  }

  if (input.jobType === "test_document_printer") {
    const payload: HardwareDocumentPayloadV2 = {
      schemaVersion: 1,
      documentType: "hardware_test_document",
      documentId: input.agentId,
      download: {
        path: `/api/sales/receipt-certificate-preview?profile=${encodeURIComponent(RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1)}`,
        contentType: "application/pdf",
        maxBytes: DEFAULT_DOCUMENT_MAX_BYTES,
      },
      documentProfileId: RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
      printProfileId: EPSON_L3251_PRINT_PROFILE_A4_V1,
      copies: 1,
      metadata: {
        requestSource: "admin.hardware_test",
        reprint: false,
        requestedAt: input.requestedAt.toISOString(),
      },
    };
    assertHardwareJobPayloadV2(input.jobType, payload);
    return payload;
  }

  const payload: HardwareCashDrawerPayloadV2 = {
    schemaVersion: 1,
    drawerProfileId: "drawer_default_v1",
    paymentId: null,
    metadata: {
      requestSource: "admin.hardware_test",
      requestedAt: input.requestedAt.toISOString(),
      test: true,
    },
  };
  assertHardwareJobPayloadV2(input.jobType, payload);
  return payload;
}
