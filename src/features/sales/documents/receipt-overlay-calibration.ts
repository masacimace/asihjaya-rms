export type ReceiptOverlayCalibration = {
  offsetXmm: number;
  offsetYmm: number;
  scale: number;
};

export const RECEIPT_OVERLAY_OFFSET_X_MM_ENV_KEY =
  "RECEIPT_OVERLAY_OFFSET_X_MM" as const;
export const RECEIPT_OVERLAY_OFFSET_Y_MM_ENV_KEY =
  "RECEIPT_OVERLAY_OFFSET_Y_MM" as const;
export const RECEIPT_OVERLAY_SCALE_ENV_KEY = "RECEIPT_OVERLAY_SCALE" as const;

export const DEFAULT_RECEIPT_OVERLAY_CALIBRATION = {
  offsetXmm: 0,
  offsetYmm: 0,
  scale: 1,
} satisfies ReceiptOverlayCalibration;

const OVERLAY_OFFSET_MIN_MM = -30;
const OVERLAY_OFFSET_MAX_MM = 30;
const OVERLAY_SCALE_MIN = 0.9;
const OVERLAY_SCALE_MAX = 1.1;

function parseCalibrationNumber({
  key,
  value,
  fallback,
  min,
  max,
}: {
  key: string;
  value: string | undefined;
  fallback: number;
  min: number;
  max: number;
}) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return fallback;
  }

  const parsedValue = Number(normalizedValue.replace(",", "."));

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < min ||
    parsedValue > max
  ) {
    throw new Error(`${key} harus angka ${min} sampai ${max}.`);
  }

  return parsedValue;
}

export function getConfiguredReceiptOverlayCalibration(): ReceiptOverlayCalibration {
  return {
    offsetXmm: parseCalibrationNumber({
      key: RECEIPT_OVERLAY_OFFSET_X_MM_ENV_KEY,
      value: process.env[RECEIPT_OVERLAY_OFFSET_X_MM_ENV_KEY],
      fallback: DEFAULT_RECEIPT_OVERLAY_CALIBRATION.offsetXmm,
      min: OVERLAY_OFFSET_MIN_MM,
      max: OVERLAY_OFFSET_MAX_MM,
    }),
    offsetYmm: parseCalibrationNumber({
      key: RECEIPT_OVERLAY_OFFSET_Y_MM_ENV_KEY,
      value: process.env[RECEIPT_OVERLAY_OFFSET_Y_MM_ENV_KEY],
      fallback: DEFAULT_RECEIPT_OVERLAY_CALIBRATION.offsetYmm,
      min: OVERLAY_OFFSET_MIN_MM,
      max: OVERLAY_OFFSET_MAX_MM,
    }),
    scale: parseCalibrationNumber({
      key: RECEIPT_OVERLAY_SCALE_ENV_KEY,
      value: process.env[RECEIPT_OVERLAY_SCALE_ENV_KEY],
      fallback: DEFAULT_RECEIPT_OVERLAY_CALIBRATION.scale,
      min: OVERLAY_SCALE_MIN,
      max: OVERLAY_SCALE_MAX,
    }),
  };
}

export function formatReceiptOverlayCalibration(
  calibration: ReceiptOverlayCalibration,
) {
  return `X ${calibration.offsetXmm}mm · Y ${calibration.offsetYmm}mm · Scale ${calibration.scale}`;
}
