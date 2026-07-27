/* eslint-disable */
const crypto = require("crypto");

const HARDWARE_AUTH_VERSION = "2";
const AUTH_MODES = new Set(["signed", "dual", "legacy"]);
const SIGNATURE_CONTEXT = "ASIHJAYA-HARDWARE-REQUEST-V2";

function normalizeAuthMode(value) {
  const mode = String(value || "signed").trim().toLowerCase();
  if (!AUTH_MODES.has(mode)) {
    throw new Error(
      "HARDWARE_AGENT_REQUEST_AUTH_MODE harus signed, dual, atau legacy.",
    );
  }
  return mode;
}

function hashBody(payload) {
  const body = payload === null || payload === undefined
    ? Buffer.alloc(0)
    : Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(String(payload), "utf8");
  return crypto.createHash("sha256").update(body).digest("hex");
}


function getHeaderValue(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value === undefined || value === null ? "" : String(value).trim();
    }
  }
  return "";
}

function createCanonicalValue({
  agentId,
  agentVersion = "",
  method,
  pathAndQuery,
  timestamp,
  nonce,
  contentSha256,
  protocolVersion = "",
  leaseToken = "",
  idempotencyKey = "",
}) {
  return [
    SIGNATURE_CONTEXT,
    agentId,
    String(agentVersion).trim(),
    String(method || "GET").toUpperCase(),
    pathAndQuery,
    timestamp,
    nonce,
    contentSha256,
    String(protocolVersion).trim(),
    String(leaseToken).trim(),
    String(idempotencyKey).trim(),
  ].join("\n");
}

function createSignature({
  secret,
  agentId,
  agentVersion = "",
  method,
  pathAndQuery,
  timestamp,
  nonce,
  contentSha256,
  protocolVersion = "",
  leaseToken = "",
  idempotencyKey = "",
}) {
  return crypto
    .createHmac("sha256", secret)
    .update(
      createCanonicalValue({
        agentId,
        agentVersion,
        method,
        pathAndQuery,
        timestamp,
        nonce,
        contentSha256,
        protocolVersion,
        leaseToken,
        idempotencyKey,
      }),
      "utf8",
    )
    .digest("base64url");
}

function createHardwareRequestHeaders({
  agentId,
  agentSecret,
  agentVersion,
  authMode = "signed",
  method,
  pathAndQuery,
  payload = null,
  additionalHeaders = {},
  now = Date.now(),
  nonce = crypto.randomBytes(18).toString("base64url"),
}) {
  const mode = normalizeAuthMode(authMode);
  const headers = {
    "x-hardware-agent-id": agentId,
    "x-hardware-agent-version": agentVersion,
  };

  if (mode === "legacy" || mode === "dual") {
    headers["x-hardware-agent-secret"] = agentSecret;
  }

  if (mode === "signed" || mode === "dual") {
    const timestamp = String(now);
    const contentSha256 = hashBody(payload);
    headers["x-hardware-auth-version"] = HARDWARE_AUTH_VERSION;
    headers["x-hardware-timestamp"] = timestamp;
    headers["x-hardware-nonce"] = nonce;
    headers["x-hardware-content-sha256"] = contentSha256;
    headers["x-hardware-signature"] = createSignature({
      secret: agentSecret,
      agentId,
      agentVersion,
      method,
      pathAndQuery,
      timestamp,
      nonce,
      contentSha256,
      protocolVersion: getHeaderValue(
        additionalHeaders,
        "x-hardware-protocol-version",
      ),
      leaseToken: getHeaderValue(additionalHeaders, "x-hardware-lease-token"),
      idempotencyKey: getHeaderValue(additionalHeaders, "idempotency-key"),
    });
  }

  return headers;
}

module.exports = {
  HARDWARE_AUTH_VERSION,
  AUTH_MODES,
  normalizeAuthMode,
  getHeaderValue,
  hashBody,
  createCanonicalValue,
  createSignature,
  createHardwareRequestHeaders,
};
