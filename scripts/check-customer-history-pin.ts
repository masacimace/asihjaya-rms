import {
  hashCustomerHistoryPin,
  verifyCustomerHistoryPinHash,
} from "../src/features/customers/history-pin-crypto";
import {
  generateTemporaryCustomerHistoryPin,
  validateCustomerHistoryPin,
} from "../src/features/customers/history-pin-policy";

process.env.CUSTOMER_HISTORY_PIN_PEPPER ??=
  "customer-history-pin-pepper-for-static-check-minimum-32-characters";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  for (let index = 0; index < 200; index += 1) {
    const pin = generateTemporaryCustomerHistoryPin();
    assert(/^\d{6}$/.test(pin), `PIN generated tidak valid: ${pin}`);
  }

  for (const pin of [
    "000000",
    "111111",
    "012345",
    "123456",
    "234567",
    "654321",
    "987654",
    "121212",
    "123123",
  ]) {
    assert(
      validateCustomerHistoryPin({ pin, phone: null }).valid,
      `PIN 6 digit seharusnya diterima: ${pin}`,
    );
  }

  assert(
    validateCustomerHistoryPin({
      pin: "456789",
      phone: "+62 812-3456-789",
    }).valid,
    "PIN boleh sama dengan 6 angka terakhir nomor telepon.",
  );

  for (const pin of ["12345", "1234567", "12A456", "", " 123456"]) {
    assert(
      !validateCustomerHistoryPin({ pin, phone: null }).valid,
      `PIN non-6-digit seharusnya ditolak: ${JSON.stringify(pin)}`,
    );
  }

  const encodedHash = await hashCustomerHistoryPin("123456");
  assert(
    await verifyCustomerHistoryPinHash("123456", encodedHash),
    "PIN yang benar harus cocok dengan hash.",
  );
  assert(
    !(await verifyCustomerHistoryPinHash("123457", encodedHash)),
    "PIN yang salah harus ditolak.",
  );

  const originalPepper = process.env.CUSTOMER_HISTORY_PIN_PEPPER;
  process.env.CUSTOMER_HISTORY_PIN_PEPPER =
    "different-customer-history-pin-pepper-minimum-32-characters";
  assert(
    !(await verifyCustomerHistoryPinHash("123456", encodedHash)),
    "Hash PIN harus terikat pada pepper server.",
  );
  process.env.CUSTOMER_HISTORY_PIN_PEPPER = originalPepper;

  console.log(
    "Customer history PIN policy and hashing check passed — any exact 6-digit PIN is accepted while hashing remains protected.",
  );
}

main().catch((error: unknown) => {
  console.error("Customer history PIN check failed:", error);
  process.exitCode = 1;
});
