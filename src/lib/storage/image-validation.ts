export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const DEFAULT_IMAGE_MAX_UPLOAD_MB = 5;

export type ImageValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export function getImageMaxUploadBytes(): number {
  const configured = Number(process.env.IMAGE_MAX_UPLOAD_MB ?? "");
  const megabytes =
    Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_IMAGE_MAX_UPLOAD_MB;

  return Math.floor(megabytes * 1024 * 1024);
}

export function validateImageFile(file: File): ImageValidationResult {
  if (file.size === 0) {
    return { valid: false, message: "Pilih file foto terlebih dahulu." };
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return {
      valid: false,
      message: "Format foto harus JPG, PNG, atau WebP.",
    };
  }

  const maxBytes = getImageMaxUploadBytes();

  if (file.size > maxBytes) {
    return {
      valid: false,
      message: `Ukuran foto maksimal ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    };
  }

  return { valid: true };
}
