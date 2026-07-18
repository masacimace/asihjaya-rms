export const RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1 =
  "receipt_a5_landscape_v1" as const;
export const RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1 =
  "receipt_a4_landscape_v1" as const;

export type ReceiptDocumentProfileId =
  | typeof RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1
  | typeof RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1;

export type ReceiptDocumentProfile = {
  id: ReceiptDocumentProfileId;
  label: string;
  paper: "A5" | "A4";
  orientation: "landscape";
  cssPageSize: string;
  widthMm: number;
  heightMm: number;
  viewport: {
    width: number;
    height: number;
  };
  designScale: number;
  expectedPdfPoints: {
    width: number;
    height: number;
  };
};

const MM_TO_CSS_PIXEL = 96 / 25.4;
const MM_TO_PDF_POINT = 72 / 25.4;
const BASE_DESIGN_WIDTH_MM = 210;
const BASE_DESIGN_HEIGHT_MM = 148;

function createProfile(input: {
  id: ReceiptDocumentProfileId;
  label: string;
  paper: "A5" | "A4";
  widthMm: number;
  heightMm: number;
}): ReceiptDocumentProfile {
  return {
    ...input,
    orientation: "landscape",
    cssPageSize: `${input.paper} landscape`,
    viewport: {
      width: Math.round(input.widthMm * MM_TO_CSS_PIXEL),
      height: Math.round(input.heightMm * MM_TO_CSS_PIXEL),
    },
    designScale: Math.min(
      input.widthMm / BASE_DESIGN_WIDTH_MM,
      input.heightMm / BASE_DESIGN_HEIGHT_MM,
    ),
    expectedPdfPoints: {
      width: input.widthMm * MM_TO_PDF_POINT,
      height: input.heightMm * MM_TO_PDF_POINT,
    },
  };
}

export const receiptDocumentProfiles = {
  [RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1]: createProfile({
    id: RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
    label: "A5 Landscape (Legacy)",
    paper: "A5",
    widthMm: 210,
    heightMm: 148,
  }),
  [RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1]: createProfile({
    id: RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
    label: "A4 Landscape",
    paper: "A4",
    widthMm: 297,
    heightMm: 210,
  }),
} satisfies Record<ReceiptDocumentProfileId, ReceiptDocumentProfile>;

export const DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID =
  RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1;

export const LEGACY_RECEIPT_DOCUMENT_PROFILE_ID =
  RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1;

export function isReceiptDocumentProfileId(
  value: unknown,
): value is ReceiptDocumentProfileId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(receiptDocumentProfiles, value)
  );
}

export function resolveReceiptDocumentProfile(
  value: unknown,
  fallback: ReceiptDocumentProfileId = DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID,
): ReceiptDocumentProfile {
  return receiptDocumentProfiles[
    isReceiptDocumentProfileId(value) ? value : fallback
  ];
}
