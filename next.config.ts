import type { NextConfig } from "next";

type BodySizeLimitOf<T> = T extends { bodySizeLimit?: infer Limit }
  ? NonNullable<Limit>
  : never;

type ServerActionBodySizeLimit = BodySizeLimitOf<
  NonNullable<NonNullable<NextConfig["experimental"]>["serverActions"]>
>;

const DEFAULT_SERVER_ACTION_BODY_SIZE_LIMIT: ServerActionBodySizeLimit = "20mb";

function getServerActionBodySizeLimit(): ServerActionBodySizeLimit {
  const configuredValue = process.env.SERVER_ACTION_BODY_SIZE_LIMIT
    ?.trim()
    .toLowerCase();

  if (!configuredValue) {
    return DEFAULT_SERVER_ACTION_BODY_SIZE_LIMIT;
  }

  if (!/^\d+(?:\.\d+)?(?:kb|mb|gb)$/.test(configuredValue)) {
    throw new Error(
      "SERVER_ACTION_BODY_SIZE_LIMIT harus memakai format seperti 500kb, 3mb, atau 1gb.",
    );
  }

  return configuredValue as ServerActionBodySizeLimit;
}

const isDevelopment = process.env.NODE_ENV !== "production";
const shouldEnableHsts = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://fastly.jsdelivr.net${isDevelopment ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://www.google.com https://maps.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
  },
  ...(shouldEnableHsts
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: getServerActionBodySizeLimit(),
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
