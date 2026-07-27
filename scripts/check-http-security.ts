import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

process.env.TRUST_PROXY = "false";
process.env.TRUST_PROXY_HOPS = "1";

const { getClientIp } = await import("../src/lib/http/client-ip");
const {
  InvalidJsonBodyError,
  readJsonBodyLimited,
  RequestBodyTooLargeError,
} = await import("../src/lib/http/request-body");

const proxyHeaders = new Headers({
  "x-forwarded-for": "198.51.100.10, 10.0.0.8",
  "x-real-ip": "10.0.0.8",
});

assert.equal(
  getClientIp(proxyHeaders),
  null,
  "Proxy headers tidak boleh dipercaya saat TRUST_PROXY=false.",
);

process.env.TRUST_PROXY = "true";
assert.equal(getClientIp(proxyHeaders), "10.0.0.8");

process.env.TRUST_PROXY_HOPS = "2";
assert.equal(getClientIp(proxyHeaders), "198.51.100.10");

process.env.TRUST_PROXY_HOPS = "1";
assert.equal(
  getClientIp(
    new Headers({
      "x-forwarded-for": "spoofed-value, 203.0.113.20:443",
    }),
  ),
  "203.0.113.20",
);
assert.equal(
  getClientIp(new Headers({ "x-real-ip": "[2001:db8::8]:443" })),
  "2001:db8::8",
);

const parsed = await readJsonBodyLimited<{ ok: boolean }>(
  new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true }),
  }),
  1024,
);
assert.deepEqual(parsed, { ok: true });

await assert.rejects(
  () =>
    readJsonBodyLimited(
      new Request("http://localhost/test", {
        method: "POST",
        body: JSON.stringify({ value: "x".repeat(100) }),
      }),
      16,
    ),
  RequestBodyTooLargeError,
);

await assert.rejects(
  () =>
    readJsonBodyLimited(
      new Request("http://localhost/test", {
        method: "POST",
        body: "{invalid",
      }),
      1024,
    ),
  InvalidJsonBodyError,
);

const files = {
  nextConfig: await readFile("next.config.ts", "utf8"),
  auth: await readFile("src/app/actions/auth.ts", "utf8"),
  rateLimit: await readFile("src/lib/security/rate-limit.ts", "utf8"),
  pdfRateLimit: await readFile(
    "src/features/sales/documents/pdf-render-rate-limit.ts",
    "utf8",
  ),
  customerHistory: await readFile(
    "src/app/actions/customer-history.ts",
    "utf8",
  ),
  hardwareAuth: await readFile("src/lib/hardware/agent-auth.ts", "utf8"),
  schema: await readFile("src/db/schema/index.ts", "utf8"),
  migration: await readFile("drizzle/0003_security_rate_limits.sql", "utf8"),
};

for (const header of [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
]) {
  assert.ok(
    files.nextConfig.includes(header),
    `Security header ${header} belum dikonfigurasi.`,
  );
}

for (const directive of [
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "connect-src 'self' https://fastly.jsdelivr.net",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
]) {
  assert.ok(
    files.nextConfig.includes(directive),
    `CSP directive ${directive} belum tersedia.`,
  );
}

assert.ok(files.auth.includes("inspectSecurityRateLimit"));
assert.ok(files.auth.includes("recordSecurityRateLimitFailure"));
assert.ok(files.auth.includes("LOGIN_RATE_LIMIT_IDENTIFIER_FAILURES"));
assert.ok(files.auth.includes("LOGIN_RATE_LIMIT_IP_FAILURES"));
assert.ok(files.rateLimit.includes("pg_advisory_xact_lock"));
assert.ok(files.rateLimit.includes("SECURITY_RATE_LIMIT_SECRET"));
assert.ok(files.pdfRateLimit.includes("PDF_RATE_LIMIT_ACTOR_REQUESTS"));
assert.ok(files.pdfRateLimit.includes("status: 429"));
assert.ok(files.schema.includes("export const securityRateLimits"));
assert.ok(files.migration.includes('CREATE TABLE "security_rate_limits"'));

assert.ok(files.customerHistory.includes('from "@/lib/http/client-ip"'));
assert.ok(files.hardwareAuth.includes('from "@/lib/http/client-ip"'));
assert.ok(!files.customerHistory.includes('get("x-forwarded-for")'));
assert.ok(!files.auth.includes('get("x-forwarded-for")'));

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory()
        ? collectTypeScriptFiles(path)
        : /\.(?:ts|tsx)$/.test(entry.name)
          ? [path]
          : [];
    }),
  );

  return nested.flat();
}

const applicationFiles = await collectTypeScriptFiles("src");

for (const path of applicationFiles) {
  if (path === "src/lib/http/client-ip.ts") {
    continue;
  }

  const source = await readFile(path, "utf8");
  assert.ok(
    !source.includes("x-forwarded-for") && !source.includes("x-real-ip"),
    `Direct proxy-header parsing masih ditemukan di ${path}.`,
  );
}

console.log("HTTP security and rate-limit checks passed.");
