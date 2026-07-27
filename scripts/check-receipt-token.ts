import { createHmac } from "node:crypto";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.SESSION_SECRET ??=
    "session-secret-for-static-check-minimum-32-characters";
  process.env.RECEIPT_VERIFICATION_SECRET ??=
    "receipt-secret-for-static-check-minimum-32-characters";
  process.env.CUSTOMER_HISTORY_SESSION_SECRET ??=
    "customer-history-secret-for-static-check-minimum-32-characters";
  process.env.CUSTOMER_HISTORY_PIN_PEPPER ??=
    "customer-history-pin-pepper-for-static-check-minimum-32-characters";

  const {
    createReceiptVerificationToken,
    verifyReceiptVerificationToken,
  } = await import("../src/features/sales/verification/receipt-token");

  const saleId = "8ad038f7-d346-4bd4-8f96-f3fd5c01af70";
  const token = createReceiptVerificationToken(saleId);
  const parsedToken = verifyReceiptVerificationToken(token);

  assert(token.startsWith("v2."), "Token nota baru harus memakai format v2.");
  assert(parsedToken?.saleId === saleId, "Token v2 harus mengembalikan sale id.");
  assert(parsedToken?.version === "v2", "Token baru harus terdeteksi sebagai v2.");

  const tamperedToken = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  assert(
    verifyReceiptVerificationToken(tamperedToken) === null,
    "Token yang diubah harus ditolak.",
  );

  const [, encodedSaleId, signature] = token.split(".");
  assert(encodedSaleId && signature, "Struktur token v2 harus lengkap.");
  const base64UrlAlphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const finalSaleCharacter = encodedSaleId.at(-1)!;
  const finalSaleCharacterIndex = base64UrlAlphabet.indexOf(finalSaleCharacter);
  const nonCanonicalSaleToken = `${encodedSaleId.slice(0, -1)}${
    base64UrlAlphabet[finalSaleCharacterIndex + 1]
  }`;
  assert(
    verifyReceiptVerificationToken(
      `v2.${nonCanonicalSaleToken}.${signature}`,
    ) === null,
    "Encoding Base64URL sale id yang tidak kanonik harus ditolak.",
  );

  const saleToken = Buffer.from(saleId.replaceAll("-", ""), "hex").toString(
    "base64url",
  );
  const legacySignature = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`receipt-certificate:${saleId}`)
    .digest()
    .subarray(0, 8)
    .toString("base64url");
  const legacyToken = `${saleToken}.${legacySignature}`;
  const parsedLegacyToken = verifyReceiptVerificationToken(legacyToken);

  assert(
    parsedLegacyToken?.saleId === saleId,
    "QR nota lama harus tetap dapat diverifikasi.",
  );
  assert(
    parsedLegacyToken?.version === "legacy",
    "QR nota lama harus ditandai sebagai legacy.",
  );

  console.log("Receipt verification token check passed.");
}

main().catch((error: unknown) => {
  console.error("Receipt verification token check failed:", error);
  process.exitCode = 1;
});
