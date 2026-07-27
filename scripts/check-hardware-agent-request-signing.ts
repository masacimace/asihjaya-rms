import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  process.env.HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY =
    "hardware-agent-check-encryption-key-" + "x".repeat(48);
  process.env.HARDWARE_AGENT_SIGNATURE_TOLERANCE_MS = "300000";
  process.env.HARDWARE_AGENT_NONCE_TTL_MS = "600000";

  const credential = await import(
    "../src/lib/hardware/agent-credential"
  );
  const signing = await import(
    "../src/lib/hardware/request-signing"
  );
  const require = createRequire(import.meta.url);
  const hubSigning = require("../hardware-hub/lib/request-signing.js") as {
    createHardwareRequestHeaders(input: {
      agentId: string;
      agentSecret: string;
      agentVersion: string;
      authMode: string;
      method: string;
      pathAndQuery: string;
      payload: string | null;
      additionalHeaders?: Record<string, string>;
      now?: number;
      nonce?: string;
    }): Record<string, string>;
  };

  const agentId = "4cc0ba19-b44e-4ef1-b9d4-1f1871690081";
  const agentSecret = "request-signing-check-secret-" + "s".repeat(48);
  const encrypted = credential.encryptHardwareAgentSecret(agentId, agentSecret);

  assert.equal(credential.isEncryptedHardwareAgentCredential(encrypted), true);
  assert.equal(
    credential.decryptHardwareAgentSecret(agentId, encrypted),
    agentSecret,
  );
  assert.equal(
    credential.decryptHardwareAgentSecret(
      "193b9c78-3847-4315-8149-5976ea36ff80",
      encrypted,
    ),
    null,
  );
  assert.equal(encrypted.includes(agentSecret), false);
  assert.equal(
    credential.decryptHardwareAgentSecret(agentId, `${encrypted}.`),
    null,
  );
  const malformedParts = encrypted.split(".");
  malformedParts[1] = `${malformedParts[1]}=`;
  assert.equal(
    credential.decryptHardwareAgentSecret(agentId, malformedParts.join(".")),
    null,
  );

  const payload = JSON.stringify({ status: "online", capabilities: ["print"] });
  const now = Date.now();
  const pathAndQuery = "/api/hardware-agents/heartbeat?source=check";
  const signedHeaders = {
    "x-hardware-protocol-version": "2",
    "x-hardware-lease-token": "lease-check-token",
    "idempotency-key": "request-signing-check-idempotency",
  };
  const headers = hubSigning.createHardwareRequestHeaders({
    agentId,
    agentSecret,
    agentVersion: "check",
    authMode: "signed",
    method: "POST",
    pathAndQuery,
    payload,
    additionalHeaders: signedHeaders,
    now,
    nonce: "abcdefghijklmnopqrstuvwx",
  });

  assert.equal(headers["x-hardware-agent-secret"], undefined);
  assert.equal(headers["x-hardware-auth-version"], "2");

  const request = new Request(`https://rms.example${pathAndQuery}`, {
    method: "POST",
    headers: {
      ...signedHeaders,
      ...headers,
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(payload)),
    },
    body: payload,
  });

  signing.resetHardwareRequestReplayStateForTests();
  assert.deepEqual(
    await signing.verifySignedHardwareRequest({
      request,
      agentId,
      secret: agentSecret,
      now,
    }),
    { valid: true },
  );

  const replay = await signing.verifySignedHardwareRequest({
    request,
    agentId,
    secret: agentSecret,
    now,
  });
  assert.equal(replay.valid, false);
  if (!replay.valid) assert.equal(replay.reason, "replayed_nonce");

  signing.resetHardwareRequestReplayStateForTests();
  const tamperedBody = new Request(`https://rms.example${pathAndQuery}`, {
    method: "POST",
    headers: { ...signedHeaders, ...headers },
    body: JSON.stringify({ status: "offline" }),
  });
  const bodyResult = await signing.verifySignedHardwareRequest({
    request: tamperedBody,
    agentId,
    secret: agentSecret,
    now,
  });
  assert.equal(bodyResult.valid, false);
  if (!bodyResult.valid) assert.equal(bodyResult.reason, "body_hash_mismatch");

  signing.resetHardwareRequestReplayStateForTests();
  const tamperedPath = new Request(
    "https://rms.example/api/hardware-jobs/claim",
    {
      method: "POST",
      headers: { ...signedHeaders, ...headers },
      body: payload,
    },
  );
  const pathResult = await signing.verifySignedHardwareRequest({
    request: tamperedPath,
    agentId,
    secret: agentSecret,
    now,
  });
  assert.equal(pathResult.valid, false);
  if (!pathResult.valid) assert.equal(pathResult.reason, "invalid_signature");

  signing.resetHardwareRequestReplayStateForTests();
  const tamperedLease = new Request(`https://rms.example${pathAndQuery}`, {
    method: "POST",
    headers: {
      ...signedHeaders,
      ...headers,
      "x-hardware-lease-token": "tampered-lease-token",
    },
    body: payload,
  });
  const leaseResult = await signing.verifySignedHardwareRequest({
    request: tamperedLease,
    agentId,
    secret: agentSecret,
    now,
  });
  assert.equal(leaseResult.valid, false);
  if (!leaseResult.valid) assert.equal(leaseResult.reason, "invalid_signature");

  const dualHeaders = hubSigning.createHardwareRequestHeaders({
    agentId,
    agentSecret,
    agentVersion: "check",
    authMode: "dual",
    method: "GET",
    pathAndQuery: "/api/hardware-jobs/claim",
    payload: null,
  });
  assert.equal(dualHeaders["x-hardware-agent-secret"], agentSecret);

  const agentSource = await readFile(resolve("hardware-hub/agent.js"), "utf8");
  const adapterSource = await readFile(
    resolve("hardware-hub/lib/hardware-adapters.js"),
    "utf8",
  );
  const authSource = await readFile(
    resolve("src/lib/hardware/agent-auth.ts"),
    "utf8",
  );
  const saleHtmlSource = await readFile(
    resolve(
      "src/app/documents/sales/[saleId]/receipt-certificate-html/page.tsx",
    ),
    "utf8",
  );

  assert.match(agentSource, /HARDWARE_AGENT_REQUEST_AUTH_MODE \|\| "signed"/);
  assert.doesNotMatch(agentSource, /"x-hardware-agent-secret": HARDWARE_AGENT_SECRET/);
  assert.doesNotMatch(adapterSource, /x-hardware-agent-secret/);
  assert.match(adapterSource, /createRequestHeaders/);
  assert.match(authSource, /verifySignedHardwareRequest/);
  assert.match(authSource, /Mode dual boleh turun ke legacy hanya/);
  assert.doesNotMatch(saleHtmlSource, /authenticateHardwareAgent/);

  console.log("Hardware Agent request signing check passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
