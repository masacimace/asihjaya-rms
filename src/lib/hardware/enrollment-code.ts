import { createHmac, randomBytes } from "node:crypto";

import { serverEnv } from "@/lib/env";

const ENROLLMENT_CODE_PREFIX = "AJ";
const ENROLLMENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ENROLLMENT_CODE_RANDOM_CHARACTERS = 12;
const ENROLLMENT_CODE_HMAC_DOMAIN = "asihjaya-hardware-enrollment-code-v1";

export const HARDWARE_ENROLLMENT_CODE_PATTERN =
  /^AJ-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

function randomAlphabetCharacter(): string {
  const rejectionLimit =
    256 - (256 % ENROLLMENT_CODE_ALPHABET.length);

  while (true) {
    const [value] = randomBytes(1);
    if (value !== undefined && value < rejectionLimit) {
      return ENROLLMENT_CODE_ALPHABET[value % ENROLLMENT_CODE_ALPHABET.length] ?? "";
    }
  }
}

export function generateHardwareEnrollmentCode(): string {
  const randomPart = Array.from(
    { length: ENROLLMENT_CODE_RANDOM_CHARACTERS },
    () => randomAlphabetCharacter(),
  ).join("");

  return [
    ENROLLMENT_CODE_PREFIX,
    randomPart.slice(0, 4),
    randomPart.slice(4, 8),
    randomPart.slice(8, 12),
  ].join("-");
}

export function normalizeHardwareEnrollmentCode(value: string): string | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  return HARDWARE_ENROLLMENT_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function hashHardwareEnrollmentCode(value: string): string | null {
  const normalized = normalizeHardwareEnrollmentCode(value);
  if (!normalized) return null;

  return createHmac(
    "sha256",
    serverEnv.HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY,
  )
    .update(`${ENROLLMENT_CODE_HMAC_DOMAIN}:${normalized}`, "utf8")
    .digest("hex");
}
