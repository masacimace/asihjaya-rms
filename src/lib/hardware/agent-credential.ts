import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { serverEnv } from "@/lib/env";

const CREDENTIAL_PREFIX = "hws2";
const CIPHER_ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const AAD_PREFIX = "asihjaya-hardware-agent-credential-v2";

function decodeCanonicalBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

function getEncryptionKey(): Buffer {
  return createHash("sha256")
    .update(serverEnv.HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY, "utf8")
    .digest();
}

function getAdditionalAuthenticatedData(agentId: string): Buffer {
  return Buffer.from(`${AAD_PREFIX}:${agentId}`, "utf8");
}

export function isEncryptedHardwareAgentCredential(value: string): boolean {
  return value.startsWith(`${CREDENTIAL_PREFIX}.`);
}

export function encryptHardwareAgentSecret(
  agentId: string,
  secret: string,
): string {
  if (!agentId.trim()) {
    throw new Error("Hardware agent ID wajib diisi untuk enkripsi credential.");
  }
  if (secret.length < 32) {
    throw new Error("Hardware agent secret minimal harus 32 karakter.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER_ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: TAG_BYTES,
  });
  cipher.setAAD(getAdditionalAuthenticatedData(agentId));

  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    CREDENTIAL_PREFIX,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function decryptHardwareAgentSecret(
  agentId: string,
  encodedCredential: string,
): string | null {
  const parts = encodedCredential.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const [prefix, encodedIv, encodedCiphertext, encodedTag] = parts;
  if (
    prefix !== CREDENTIAL_PREFIX ||
    !encodedIv ||
    !encodedCiphertext ||
    !encodedTag
  ) {
    return null;
  }

  try {
    const iv = decodeCanonicalBase64Url(encodedIv);
    const ciphertext = decodeCanonicalBase64Url(encodedCiphertext);
    const tag = decodeCanonicalBase64Url(encodedTag);

    if (
      !iv ||
      !ciphertext ||
      !tag ||
      iv.length !== IV_BYTES ||
      ciphertext.length === 0 ||
      tag.length !== TAG_BYTES
    ) {
      return null;
    }

    const decipher = createDecipheriv(
      CIPHER_ALGORITHM,
      getEncryptionKey(),
      iv,
      { authTagLength: TAG_BYTES },
    );
    decipher.setAAD(getAdditionalAuthenticatedData(agentId));
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
