import { isIP } from "node:net";

const DEFAULT_ALLOWED_HOSTS = ["asihjaya.com"] as const;

export function getLegacyImageAllowedHosts(): string[] {
  const configured = process.env.LEGACY_IMAGE_ALLOWED_HOSTS;
  const source: readonly string[] = configured
    ? configured.split(",")
    : DEFAULT_ALLOWED_HOSTS;
  const values = source
    .map((value) => value.trim().toLowerCase().replace(/^\.+/, ""))
    .filter(Boolean);

  return Array.from(new Set(values));
}

export function isLegacyImageUrlAllowed(
  value: string,
  allowedHosts = getLegacyImageAllowedHosts(),
): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    return false;
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || isIP(hostname) !== 0) {
    return false;
  }

  return allowedHosts.some(
    (allowedHost) =>
      hostname === allowedHost || hostname.endsWith(`.${allowedHost}`),
  );
}
