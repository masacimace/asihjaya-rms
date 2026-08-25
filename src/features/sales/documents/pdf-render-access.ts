import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import type { ReceiptDocumentProfileId } from "./receipt-document-profiles";
import type { ReceiptCertificateRenderMode } from "./receipt-certificate-render-modes";
import { serverEnv } from "@/lib/env";

export const PDF_RENDER_TOKEN_HEADER = "x-asihjaya-pdf-render-token";

const TOKEN_VERSION = "v1";
const DEFAULT_TOKEN_TTL_MS = 60_000;
const MIN_TOKEN_TTL_MS = 5_000;
const MAX_TOKEN_TTL_MS = 5 * 60_000;
const MAX_TOKEN_LENGTH = 4_096;
const MAX_MEDIA_KEYS = 1_000;
const GLOBAL_REGISTRY_KEY = "__asihjayaPdfRenderAccessRegistry";

type PdfRenderScope = "receipt-sale" | "receipt-buyback" | "receipt-preview";

type PdfRenderTokenPayload = {
  version: 1;
  nonce: string;
  scope: PdfRenderScope;
  organizationId: string;
  saleId: string | null;
  buybackId: string | null;
  documentProfileId: ReceiptDocumentProfileId;
  renderMode: ReceiptCertificateRenderMode;
  issuedAt: number;
  expiresAt: number;
};

type PdfRenderRegistryEntry = PdfRenderTokenPayload & {
  allowedMediaKeys: ReadonlySet<string>;
  signature: string;
};

type PdfRenderRegistryGlobal = typeof globalThis & {
  [GLOBAL_REGISTRY_KEY]?: Map<string, PdfRenderRegistryEntry>;
};

export type PdfRenderCapabilityInput = {
  scope: PdfRenderScope;
  organizationId: string;
  saleId?: string | null;
  buybackId?: string | null;
  documentProfileId: ReceiptDocumentProfileId;
  renderMode: ReceiptCertificateRenderMode;
  allowedMediaKeys?: readonly string[];
};

export type ActivePdfRenderAccess = {
  scope: PdfRenderScope;
  organizationId: string;
  saleId: string | null;
  buybackId: string | null;
  documentProfileId: ReceiptDocumentProfileId;
  renderMode: ReceiptCertificateRenderMode;
  expiresAt: number;
};

function getRegistry(): Map<string, PdfRenderRegistryEntry> {
  const globalRegistry = globalThis as PdfRenderRegistryGlobal;

  if (!globalRegistry[GLOBAL_REGISTRY_KEY]) {
    globalRegistry[GLOBAL_REGISTRY_KEY] = new Map();
  }

  return globalRegistry[GLOBAL_REGISTRY_KEY];
}

function getTokenTtlMs() {
  const configured = Number(process.env.PDF_RENDER_TOKEN_TTL_MS);

  if (!Number.isInteger(configured)) {
    return DEFAULT_TOKEN_TTL_MS;
  }

  return Math.min(
    MAX_TOKEN_TTL_MS,
    Math.max(MIN_TOKEN_TTL_MS, configured),
  );
}

function cleanupExpiredEntries(now = Date.now()) {
  const registry = getRegistry();

  for (const [nonce, entry] of registry) {
    if (entry.expiresAt <= now) {
      registry.delete(nonce);
    }
  }
}

function encodePayload(payload: PdfRenderTokenPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signEncodedPayload(encodedPayload: string) {
  return createHmac("sha256", serverEnv.PDF_RENDER_TOKEN_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function parseTokenPayload(encodedPayload: string): PdfRenderTokenPayload | null {
  try {
    const decoded = Buffer.from(encodedPayload, "base64url");

    if (decoded.toString("base64url") !== encodedPayload) {
      return null;
    }

    const value = JSON.parse(decoded.toString("utf8")) as Partial<PdfRenderTokenPayload>;

    if (
      value.version !== 1 ||
      typeof value.nonce !== "string" ||
      value.nonce.length < 16 ||
      !["receipt-sale", "receipt-buyback", "receipt-preview"].includes(value.scope ?? "") ||
      typeof value.organizationId !== "string" ||
      value.organizationId.length === 0 ||
      !(
        value.saleId === null ||
        typeof value.saleId === "string"
      ) ||
      !(
        value.buybackId === null ||
        typeof value.buybackId === "string"
      ) ||
      typeof value.documentProfileId !== "string" ||
      typeof value.renderMode !== "string" ||
      !Number.isInteger(value.issuedAt) ||
      !Number.isInteger(value.expiresAt) ||
      (value.expiresAt ?? 0) <= (value.issuedAt ?? 0)
    ) {
      return null;
    }

    return value as PdfRenderTokenPayload;
  } catch {
    return null;
  }
}

function resolveActiveEntry(token: string | null | undefined) {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
    return null;
  }

  const encodedPayload = parts[1] ?? "";
  const providedSignature = parts[2] ?? "";
  const payload = parseTokenPayload(encodedPayload);

  if (!payload) {
    return null;
  }

  const expectedSignature = signEncodedPayload(encodedPayload);
  if (
    providedSignature.length === 0 ||
    !safeEqualText(providedSignature, expectedSignature)
  ) {
    return null;
  }

  const now = Date.now();
  cleanupExpiredEntries(now);

  if (payload.expiresAt <= now || payload.issuedAt > now + 5_000) {
    return null;
  }

  const entry = getRegistry().get(payload.nonce);
  if (
    !entry ||
    entry.signature !== providedSignature ||
    entry.scope !== payload.scope ||
    entry.organizationId !== payload.organizationId ||
    entry.saleId !== payload.saleId ||
    entry.buybackId !== payload.buybackId ||
    entry.documentProfileId !== payload.documentProfileId ||
    entry.renderMode !== payload.renderMode ||
    entry.expiresAt !== payload.expiresAt
  ) {
    return null;
  }

  return entry;
}

export function issuePdfRenderCapability(input: PdfRenderCapabilityInput) {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const allowedMediaKeys = Array.from(
    new Set(
      (input.allowedMediaKeys ?? [])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  if (allowedMediaKeys.length > MAX_MEDIA_KEYS) {
    throw new Error(
      `Jumlah media pada satu render PDF melebihi batas ${MAX_MEDIA_KEYS}.`,
    );
  }

  const payload: PdfRenderTokenPayload = {
    version: 1,
    nonce: randomBytes(24).toString("base64url"),
    scope: input.scope,
    organizationId: input.organizationId,
    saleId: input.saleId ?? null,
    buybackId: input.buybackId ?? null,
    documentProfileId: input.documentProfileId,
    renderMode: input.renderMode,
    issuedAt: now,
    expiresAt: now + getTokenTtlMs(),
  };

  const encodedPayload = encodePayload(payload);
  const signature = signEncodedPayload(encodedPayload);
  const token = `${TOKEN_VERSION}.${encodedPayload}.${signature}`;

  getRegistry().set(payload.nonce, {
    ...payload,
    allowedMediaKeys: new Set(allowedMediaKeys),
    signature,
  });

  let released = false;

  return {
    token,
    renderId: payload.nonce.slice(0, 12),
    expiresAt: payload.expiresAt,
    release() {
      if (released) {
        return;
      }

      released = true;
      const entry = getRegistry().get(payload.nonce);
      if (entry?.signature === signature) {
        getRegistry().delete(payload.nonce);
      }
    },
  };
}

export function authorizePdfRenderDocument({
  token,
  scope,
  saleId,
  buybackId,
  documentProfileId,
  renderMode,
}: {
  token: string | null | undefined;
  scope: PdfRenderScope;
  saleId?: string | null;
  buybackId?: string | null;
  documentProfileId: ReceiptDocumentProfileId;
  renderMode: ReceiptCertificateRenderMode;
}): ActivePdfRenderAccess | null {
  const entry = resolveActiveEntry(token);

  if (
    !entry ||
    entry.scope !== scope ||
    entry.saleId !== (saleId ?? null) ||
    entry.buybackId !== (buybackId ?? null) ||
    entry.documentProfileId !== documentProfileId ||
    entry.renderMode !== renderMode
  ) {
    return null;
  }

  return {
    scope: entry.scope,
    organizationId: entry.organizationId,
    saleId: entry.saleId,
    buybackId: entry.buybackId,
    documentProfileId: entry.documentProfileId,
    renderMode: entry.renderMode,
    expiresAt: entry.expiresAt,
  };
}

export function authorizePdfRenderMedia({
  token,
  imageKey,
}: {
  token: string | null | undefined;
  imageKey: string;
}): ActivePdfRenderAccess | null {
  const entry = resolveActiveEntry(token);

  if (!entry || !entry.allowedMediaKeys.has(imageKey)) {
    return null;
  }

  return {
    scope: entry.scope,
    organizationId: entry.organizationId,
    saleId: entry.saleId,
    buybackId: entry.buybackId,
    documentProfileId: entry.documentProfileId,
    renderMode: entry.renderMode,
    expiresAt: entry.expiresAt,
  };
}
