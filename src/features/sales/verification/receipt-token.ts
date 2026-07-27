import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECEIPT_TOKEN_PREFIX = "receipt-certificate";
const LEGACY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{11}$/;
const V2_TOKEN_PATTERN = /^v2\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/;

function uuidToBase64Url(uuid: string) {
  if (!UUID_PATTERN.test(uuid)) {
    throw new Error("Sale id untuk token verifikasi nota tidak valid.");
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

export function createReceiptVerificationUrl(saleId: string) {
  const token = createReceiptVerificationToken(saleId);

  return {
    token,
    url: `${serverEnv.APP_URL}/v/${token}`,
  };
}
