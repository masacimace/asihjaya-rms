import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const HARDWARE_JOB_LEASE_TOKEN_BYTES = 32;
export const HARDWARE_JOB_LEASE_DURATION_MS = 60_000;

export type HardwareJobLease = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

export function hashHardwareJobLeaseToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifyHardwareJobLeaseToken(
  token: string,
  expectedHash: string,
): boolean {
  if (!token || !/^[0-9a-f]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashHardwareJobLeaseToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getHardwareJobLeaseExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + HARDWARE_JOB_LEASE_DURATION_MS);
}

export function createHardwareJobLease(now = new Date()): HardwareJobLease {
  const token = randomBytes(HARDWARE_JOB_LEASE_TOKEN_BYTES).toString("base64url");

  return {
    token,
    tokenHash: hashHardwareJobLeaseToken(token),
    expiresAt: getHardwareJobLeaseExpiresAt(now),
  };
}

export function isHardwareJobLeaseExpired(
  leaseExpiresAt: Date,
  now = new Date(),
): boolean {
  return leaseExpiresAt.getTime() <= now.getTime();
}
