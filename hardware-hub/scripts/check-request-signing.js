/* eslint-disable */
const assert = require("assert/strict");
const {
  createHardwareRequestHeaders,
  createSignature,
  hashBody,
  normalizeAuthMode,
} = require("../lib/request-signing");

const agentId = "4cc0ba19-b44e-4ef1-b9d4-1f1871690081";
const agentSecret = "hardware-hub-signing-check-" + "x".repeat(48);
const payload = JSON.stringify({ supportedCapabilities: ["print"] });
const timestamp = 1785123456789;
const nonce = "abcdefghijklmnopqrstuvwx";
const pathAndQuery = "/api/hardware/v2/jobs/claim";
const additionalHeaders = {
  "x-hardware-protocol-version": "2",
  "x-hardware-lease-token": "lease-check-token",
  "idempotency-key": "request-signing-check-idempotency",
};

const headers = createHardwareRequestHeaders({
  agentId,
  agentSecret,
  agentVersion: "check",
  authMode: "signed",
  method: "POST",
  pathAndQuery,
  payload,
  additionalHeaders,
  now: timestamp,
  nonce,
});

assert.equal(headers["x-hardware-agent-secret"], undefined);
assert.equal(headers["x-hardware-auth-version"], "2");
assert.equal(headers["x-hardware-content-sha256"], hashBody(payload));
assert.equal(
  headers["x-hardware-signature"],
  createSignature({
    secret: agentSecret,
    agentId,
    agentVersion: "check",
    method: "POST",
    pathAndQuery,
    timestamp: String(timestamp),
    nonce,
    contentSha256: hashBody(payload),
    protocolVersion: "2",
    leaseToken: "lease-check-token",
    idempotencyKey: "request-signing-check-idempotency",
  }),
);

const dual = createHardwareRequestHeaders({
  agentId,
  agentSecret,
  agentVersion: "check",
  authMode: "dual",
  method: "GET",
  pathAndQuery: "/api/sales/receipt-certificate-preview",
  payload: null,
  now: timestamp,
  nonce,
});
assert.equal(dual["x-hardware-agent-secret"], agentSecret);
assert.equal(normalizeAuthMode("SIGNED"), "signed");
assert.throws(() => normalizeAuthMode("invalid"));

console.log("OK: Hardware Hub HMAC request signing siap digunakan.");
