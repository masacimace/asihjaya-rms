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
    createPublicHistoryVerificationToken,
    createPublicHistoryVerificationUrl,
    createReceiptVerificationToken,
    verifyPublicHistoryVerificationToken,
    verifyReceiptVerificationToken,
  } = await import("../src/features/sales/verification/receipt-token");

  const saleId = "8ad038f7-d346-4bd4-8f96-f3fd5c01af70";
  const buybackId = "0a2f2f98-6f7f-4c87-9975-74d7024b1e1a";

  // Legacy Sale receipt helper stays v2 so existing QR compatibility can be regression-tested.
  const token = createReceiptVerificationToken(saleId);
  const parsedToken = verifyReceiptVerificationToken(token);

  assert(token.startsWith("v2."), "Token nota Sale existing harus tetap memakai v2.");
  assert(parsedToken?.saleId === saleId, "Token v2 harus mengembalikan sale id.");
  assert(parsedToken?.version === "v2", "Token Sale existing harus terdeteksi sebagai v2.");

  const tamperedToken = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  assert(
    verifyReceiptVerificationToken(tamperedToken) === null,
    "Token Sale yang diubah harus ditolak.",
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

  // V3 is transaction-aware and supports both Sale and Buyback.
  const saleHistoryToken = createPublicHistoryVerificationToken({
    transactionKind: "sale",
    transactionId: saleId,
  });
  const parsedSaleHistoryToken =
    verifyPublicHistoryVerificationToken(saleHistoryToken);

  const saleHistoryUrl = createPublicHistoryVerificationUrl({
    transactionKind: "sale",
    transactionId: saleId,
  });
  assert(
    saleHistoryUrl.token.startsWith("v3.sale.") &&
      saleHistoryUrl.url === `${process.env.APP_URL}/v/${saleHistoryUrl.token}`,
    "QR Sale baru harus menggunakan Public History v3 pada route /v/[token].",
  );

  assert(
    saleHistoryToken.startsWith("v3.sale."),
    "Public History Sale token harus memakai format v3.sale.",
  );
  assert(
    parsedSaleHistoryToken?.transactionKind === "sale" &&
      parsedSaleHistoryToken.transactionId === saleId &&
      parsedSaleHistoryToken.version === "v3",
    "Public History Sale v3 harus resolve ke Sale yang sama.",
  );

  const buybackHistoryToken = createPublicHistoryVerificationToken({
    transactionKind: "buyback",
    transactionId: buybackId,
  });
  const parsedBuybackHistoryToken =
    verifyPublicHistoryVerificationToken(buybackHistoryToken);

  assert(
    buybackHistoryToken.startsWith("v3.buyback."),
    "Public History Buyback token harus memakai format v3.buyback.",
  );
  assert(
    parsedBuybackHistoryToken?.transactionKind === "buyback" &&
      parsedBuybackHistoryToken.transactionId === buybackId &&
      parsedBuybackHistoryToken.version === "v3",
    "Public History Buyback v3 harus resolve ke Buyback yang sama.",
  );

  const buybackHistoryUrl = createPublicHistoryVerificationUrl({
    transactionKind: "buyback",
    transactionId: buybackId,
  });
  assert(
    buybackHistoryUrl.url ===
      `${process.env.APP_URL}/v/${buybackHistoryUrl.token}`,
    "Public History URL harus memakai route /v/[token].",
  );

  const tamperedBuybackHistoryToken = `${buybackHistoryToken.slice(0, -1)}${
    buybackHistoryToken.endsWith("A") ? "B" : "A"
  }`;
  assert(
    verifyPublicHistoryVerificationToken(tamperedBuybackHistoryToken) === null,
    "Public History v3 yang diubah harus ditolak.",
  );

  // Backward compatibility: old Sale v2/legacy tokens resolve as Sale history.
  const parsedV2AsHistory = verifyPublicHistoryVerificationToken(token);
  assert(
    parsedV2AsHistory?.transactionKind === "sale" &&
      parsedV2AsHistory.transactionId === saleId &&
      parsedV2AsHistory.version === "v2",
    "QR Sale v2 harus tetap dapat membuka Public History.",
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
  const parsedLegacyAsHistory = verifyPublicHistoryVerificationToken(legacyToken);

  assert(
    parsedLegacyToken?.saleId === saleId,
    "QR nota lama harus tetap dapat diverifikasi.",
  );
  assert(
    parsedLegacyToken?.version === "legacy",
    "QR nota lama harus ditandai sebagai legacy.",
  );
  assert(
    parsedLegacyAsHistory?.transactionKind === "sale" &&
      parsedLegacyAsHistory.transactionId === saleId &&
      parsedLegacyAsHistory.version === "legacy",
    "QR Sale legacy harus tetap dapat membuka Public History.",
  );

  console.log(
    "Receipt/Public History token check passed — legacy/v2 Sale compatible, v3 Sale + Buyback verified.",
  );
}

main().catch((error: unknown) => {
  console.error("Receipt verification token check failed:", error);
  process.exitCode = 1;
});
