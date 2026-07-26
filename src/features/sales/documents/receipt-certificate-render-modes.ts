export const RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN = "full_design";
export const RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK =
  "vendor_static_artwork";
export const RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY =
  "preprinted_overlay";

export const RECEIPT_CERTIFICATE_RENDER_MODES = [
  RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN,
  RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
  RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
] as const;

export type ReceiptCertificateRenderMode =
  (typeof RECEIPT_CERTIFICATE_RENDER_MODES)[number];

export function isReceiptCertificateRenderMode(
  value: string,
): value is ReceiptCertificateRenderMode {
  return RECEIPT_CERTIFICATE_RENDER_MODES.includes(
    value as ReceiptCertificateRenderMode,
  );
}

export function resolveReceiptCertificateRenderMode(
  value: string | null | undefined,
): ReceiptCertificateRenderMode {
  if (value && isReceiptCertificateRenderMode(value)) {
    return value;
  }

  return RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN;
}

export function getReceiptCertificateRenderModeLabel(
  mode: ReceiptCertificateRenderMode,
) {
  if (mode === RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK) {
    return "Vendor static artwork";
  }

  if (mode === RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY) {
    return "Pre-printed overlay";
  }

  return "Full design";
}
