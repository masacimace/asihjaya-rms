import { randomInt } from "node:crypto";

const PIN_PATTERN = /^\d{6}$/;

export type CustomerHistoryPinValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export function generateTemporaryCustomerHistoryPin() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function validateCustomerHistoryPin({
  pin,
}: {
  pin: string;
  phone: string | null;
}): CustomerHistoryPinValidationResult {
  if (!PIN_PATTERN.test(pin)) {
    return {
      valid: false,
      message: "PIN harus terdiri dari tepat 6 angka.",
    };
  }

  return { valid: true };
}
