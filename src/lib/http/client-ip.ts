import { isIP } from "node:net";

type HeaderSource = Headers | Request;

function getHeaders(source: HeaderSource): Headers {
  return source instanceof Headers ? source : source.headers;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return fallback;
}

function readTrustedProxyHops(): number {
  const value = Number(process.env.TRUST_PROXY_HOPS);
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function normalizeIpCandidate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  let candidate = value.trim();
  if (!candidate || candidate.toLowerCase() === "unknown") {
    return null;
  }

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }

  const zoneIndex = candidate.indexOf("%");
  if (zoneIndex > 0) {
    candidate = candidate.slice(0, zoneIndex);
  }

  return isIP(candidate) ? candidate.slice(0, 64) : null;
}

/**
 * Resolve IP hanya dari proxy headers ketika deployment secara eksplisit
 * menyatakan bahwa request selalu melewati reverse proxy terpercaya.
 *
 * TRUST_PROXY_HOPS=1 memilih entri paling kanan pada X-Forwarded-For,
 * yaitu client yang dilihat reverse proxy terakhir ketika proxy memakai
 * pola append seperti `$proxy_add_x_forwarded_for`.
 */
export function getClientIp(source: HeaderSource): string | null {
  if (!readBooleanEnv("TRUST_PROXY", false)) {
    return null;
  }

  const headers = getHeaders(source);
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    const chain = forwardedFor
      .split(",")
      .map((entry) => normalizeIpCandidate(entry))
      .filter((entry): entry is string => Boolean(entry));
    const index = chain.length - readTrustedProxyHops();

    if (index >= 0) {
      return chain[index] ?? null;
    }
  }

  return normalizeIpCandidate(headers.get("x-real-ip"));
}

export function getTrustedProxyConfiguration() {
  return {
    enabled: readBooleanEnv("TRUST_PROXY", false),
    hops: readTrustedProxyHops(),
  } as const;
}
