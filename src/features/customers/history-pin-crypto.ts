import { createHmac } from "node:crypto";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { serverEnv } from "@/lib/env";

const PIN_PATTERN = /^\d{6}$/;
const PIN_HASH_PREFIX = "customer-history-pin:";

function encodePin(pin: string) {
  return createHmac("sha256", serverEnv.CUSTOMER_HISTORY_PIN_PEPPER)
    .update(`${PIN_HASH_PREFIX}${pin}`)
    .digest("base64url");
}

export async function hashCustomerHistoryPin(pin: string) {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("PIN pelanggan harus terdiri dari tepat 6 angka.");
  }

  return hashPassword(encodePin(pin));
}

export async function verifyCustomerHistoryPinHash(
  pin: string,
  encodedHash: string,
) {
  if (!PIN_PATTERN.test(pin)) {
    return false;
  }

  return verifyPassword(encodePin(pin), encodedHash);
}
