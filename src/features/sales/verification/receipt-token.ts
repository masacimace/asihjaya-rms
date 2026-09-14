import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECEIPT_TOKEN_PREFIX = "receipt-certificate";
const PUBLIC_HISTORY_TOKEN_PREFIX = "customer-history";
const LEGACY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{11}$/;
const V2_TOKEN_PATTERN = /^v2\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/;
const V3_TOKEN_PATTERN =
  /^v3\.(sale|buyback)\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/;

export type PublicHistoryTransactionKind = "sale" | "buyback";
export type PublicHistoryTokenVersion = "legacy" | "v2" | "v3";

export type VerifiedPublicHistoryToken = {
  transactionKind: PublicHistoryTransactionKind;
  transactionId: string;
  version: PublicHistoryTokenVersion;
};

function uuidToBase64Url(uuid: string) {
  if (!UUID_PATTERN.test(uuid)) {
    throw new Error("ID transaksi untuk token verifikasi tidak valid.");
  }

  return Buffer.from(uuid.replaceAll("-", ""), "hex").toString("base64url");
}

function base64UrlToUuid(value: string) {
  const bytes = Buffer.from(value, "base64url");

  if (bytes.length !== 16 || bytes.toString("base64url") !== value) {
    return null;
  }

  const hex = bytes.toString("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function createReceiptSignature({
  saleId,
  secret,
  bytes,
  version,
}: {
  saleId: string;
  secret: string;
  bytes: number;
  version: "legacy" | "v2";
}) {
  return createHmac("sha256", secret)
    .update(`${RECEIPT_TOKEN_PREFIX}:${version}:${saleId}`)
    .digest()
    .subarray(0, bytes)
    .toString("base64url");
}

function createPublicHistorySignature({
  transactionKind,
  transactionId,
  secret,
}: {
  transactionKind: PublicHistoryTransactionKind;
  transactionId: string;
  secret: string;
}) {
  return createHmac("sha256", secret)
    .update(
      `${PUBLIC_HISTORY_TOKEN_PREFIX}:v3:${transactionKind}:${transactionId}`,
    )
    .digest()
    .subarray(0, 16)
    .toString("base64url");
}

function signaturesMatch(signature: string, expectedSignature: string) {
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");

  return (
    signatureBuffer.length === expectedSignatureBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  );
}

export function createReceiptVerificationToken(saleId: string) {
  const saleToken = uuidToBase64Url(saleId);
  const signature = createReceiptSignature({
    saleId,
    secret: serverEnv.RECEIPT_VERIFICATION_SECRET,
    bytes: 16,
    version: "v2",
  });

  return `v2.${saleToken}.${signature}`;
}

export function verifyReceiptVerificationToken(token: string) {
  const normalizedToken = token.trim();
  const isV2 = V2_TOKEN_PATTERN.test(normalizedToken);
  const isLegacy = LEGACY_TOKEN_PATTERN.test(normalizedToken);

  if (!isV2 && !isLegacy) {
    return null;
  }

  const tokenParts = normalizedToken.split(".");
  const saleToken = isV2 ? tokenParts[1] : tokenParts[0];
  const signature = isV2 ? tokenParts[2] : tokenParts[1];

  if (!saleToken || !signature) {
    return null;
  }

  const saleId = base64UrlToUuid(saleToken);

  if (!saleId || !UUID_PATTERN.test(saleId)) {
    return null;
  }

  const expectedSignature = isV2
    ? createReceiptSignature({
        saleId,
        secret: serverEnv.RECEIPT_VERIFICATION_SECRET,
        bytes: 16,
        version: "v2",
      })
    : createHmac("sha256", serverEnv.SESSION_SECRET)
        .update(`${RECEIPT_TOKEN_PREFIX}:${saleId}`)
        .digest()
        .subarray(0, 8)
        .toString("base64url");

  if (!signaturesMatch(signature, expectedSignature)) {
    return null;
  }

  return {
    saleId,
    version: isV2 ? ("v2" as const) : ("legacy" as const),
  };
}

export function createPublicHistoryVerificationToken({
  transactionKind,
  transactionId,
}: {
  transactionKind: PublicHistoryTransactionKind;
  transactionId: string;
}) {
  const transactionToken = uuidToBase64Url(transactionId);
  const signature = createPublicHistorySignature({
    transactionKind,
    transactionId,
    secret: serverEnv.RECEIPT_VERIFICATION_SECRET,
  });

  return `v3.${transactionKind}.${transactionToken}.${signature}`;
}

export function verifyPublicHistoryVerificationToken(
  token: string,
): VerifiedPublicHistoryToken | null {
  const normalizedToken = token.trim();

  if (V3_TOKEN_PATTERN.test(normalizedToken)) {
    const [, transactionKindRaw, transactionToken, signature] =
      normalizedToken.split(".");

    if (
      (transactionKindRaw !== "sale" && transactionKindRaw !== "buyback") ||
      !transactionToken ||
      !signature
    ) {
      return null;
    }

    const transactionId = base64UrlToUuid(transactionToken);

    if (!transactionId || !UUID_PATTERN.test(transactionId)) {
      return null;
    }

    const expectedSignature = createPublicHistorySignature({
      transactionKind: transactionKindRaw,
      transactionId,
      secret: serverEnv.RECEIPT_VERIFICATION_SECRET,
    });

    if (!signaturesMatch(signature, expectedSignature)) {
      return null;
    }

    return {
      transactionKind: transactionKindRaw,
      transactionId,
      version: "v3",
    };
  }

  const legacyReceiptToken = verifyReceiptVerificationToken(normalizedToken);

  if (!legacyReceiptToken) {
    return null;
  }

  return {
    transactionKind: "sale",
    transactionId: legacyReceiptToken.saleId,
    version: legacyReceiptToken.version,
  };
}

export function createReceiptVerificationUrl(saleId: string) {
  const token = createReceiptVerificationToken(saleId);

  return {
    token,
    url: `${serverEnv.APP_URL}/v/${token}`,
  };
}

export function createPublicHistoryVerificationUrl({
  transactionKind,
  transactionId,
}: {
  transactionKind: PublicHistoryTransactionKind;
  transactionId: string;
}) {
  const token = createPublicHistoryVerificationToken({
    transactionKind,
    transactionId,
  });

  return {
    token,
    url: `${serverEnv.APP_URL}/v/${token}`,
  };
}
