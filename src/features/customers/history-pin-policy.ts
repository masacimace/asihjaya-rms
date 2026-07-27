import { randomInt } from "node:crypto";

const PIN_PATTERN = /^\d{6}$/;
const COMMON_PINS = new Set([
  "000000",
  "111111",
  "123456",
  "654321",
  "121212",
  "112233",
  "123123",
  "321321",
  "999999",
]);

export type CustomerHistoryPinValidationResult =
  | { valid: true }
  | { valid: false; message: string };

function normalizePhoneDigits(phone: string | null | undefined) {
  return phone?.replace(/\D/g, "") ?? "";
}

function isSequentialPin(pin: string) {
  const digits = [...pin].map(Number);
  const ascending = digits.every(
    (digit, index) => index === 0 || digit === digits[index - 1]! + 1,
  );
  const descending = digits.every(
    (digit, index) => index === 0 || digit === digits[index - 1]! - 1,
  );

  return ascending || descending;
}

function isRepeatingPattern(pin: string) {
  return (
    pin.slice(0, 1).repeat(6) === pin ||
    pin.slice(0, 2).repeat(3) === pin ||
    pin.slice(0, 3).repeat(2) === pin
  );
}

export function generateTemporaryCustomerHistoryPin() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function validateCustomerHistoryPin({
  pin,
  phone,
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

  if (COMMON_PINS.has(pin) || isSequentialPin(pin) || isRepeatingPattern(pin)) {
    return {
      valid: false,
      message: "Gunakan PIN yang tidak mudah ditebak.",
    };
  }

  const phoneDigits = normalizePhoneDigits(phone);

  if (phoneDigits.length >= 6 && phoneDigits.slice(-6) === pin) {
    return {
      valid: false,
      message: "PIN tidak boleh sama dengan 6 angka terakhir nomor telepon.",
    };
  }

  return { valid: true };
}
