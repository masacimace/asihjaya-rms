/* eslint-disable */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { hashCanonicalJson } = require("../lib/canonical-json");
const { ExecutionJournal } = require("../lib/execution-journal");
const { HardwareProtocolV2Runner } = require("../lib/protocol-v2-runner");
const { createSecretProtector } = require("../lib/secret-protector");

function createTempContext(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `asihjaya-${name}-`));
  const journal = new ExecutionJournal({ filePath: path.join(root, "journal.sqlite") });
  const secretProtector = createSecretProtector({
    keyPath: path.join(root, "journal.key"),
    platform: "linux",
  });
  return { root, journal, secretProtector };
}

function createClaim(idSuffix = "1") {
  const payload = {
    schemaVersion: 1,
    templateId: "jewelry_barbell_inter_v3",
    templateVersion: 3,
    printerProfileId: "sato_cg408_jewelry_barbell_inter_v3",
    fields: {
      barcode: `89900000000${idSuffix}`,
      name: "Cincin Emas",
      sku: `SKU-${idSuffix}`,
      weightGram: "2.35",
    },
  };
  return {
    job: {
      id: `00000000-0000-4000-8000-0000000000${idSuffix.padStart(2, "0")}`,
      jobType: "print_label_sato",
      deviceType: "label_printer",
      requiredCapability: "print_label_sato",
      payload,
      payloadHash: hashCanonicalJson(payload),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    attempt: {
      id: `10000000-0000-4000-8000-0000000000${idSuffix.padStart(2, "0")}`,
      number: 1,
      leaseToken: `lease-token-${idSuffix}`,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
}

class FakeProtocolClient {
  constructor({ loseSubmittedResponseOnce = false } = {}) {
    this.events = [];
    this.server = new Map();
    this.loseSubmittedResponseOnce = loseSubmittedResponseOnce;
  }

  async claim() {
    return { job: null, attempt: null };
  }

  async renewLease({ attemptId }) {
    return {
      attempt: {
        attemptId,
        leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    };
  }

  async sendEvent({ attemptId, event }) {
    const current = this.server.get(attemptId) || { sequence: 0, status: "claimed" };
    if (event.eventSequence < current.sequence) {
      return { success: true, duplicate: true };
    }
    if (event.eventSequence === current.sequence) {
      assert.equal(event.status, current.status, "duplicate sequence harus memakai status yang sama");
      return { success: true, duplicate: true };
    }
    assert.equal(event.eventSequence, current.sequence + 1, "event sequence harus berurutan");
    this.server.set(attemptId, {
      sequence: event.eventSequence,
      status: event.status,
    });
    this.events.push({ attemptId, status: event.status, sequence: event.eventSequence });

    if (event.status === "submitted" && this.loseSubmittedResponseOnce) {
      this.loseSubmittedResponseOnce = false;
      const error = new Error("Simulated lost HTTP response after server commit");
      error.code = "API_NETWORK_ERROR";
      throw error;
    }

    return { success: true, duplicate: false };
  }
}

function createRunner({ journal, secretProtector, client, dispatchCounter }) {
  return new HardwareProtocolV2Runner({
    journal,
    client,
    secretProtector,
    agentVersion: "test-agent",
    dryRun: true,
    leaseRenewIntervalMs: 45_000,
    prepareHardwareJob: async () => ({
      adapter: "fake_printer",
      target: "fake",
      async dispatch() {
        dispatchCounter.count += 1;
        return { accepted: true };
      },
      async cleanup() {},
    }),
    classifyPrepareError(error) {
      return {
        category: "test",
        code: error.code || "TEST_PREPARE_FAILED",
        retrySafe: false,
      };
    },
    logger: {
      log() {},
      warn() {},
      error() {},
    },
  });
}

async function testLostSubmittedAckDoesNotReprint() {
  const context = createTempContext("lost-ack");
  const client = new FakeProtocolClient({ loseSubmittedResponseOnce: true });
  const dispatchCounter = { count: 0 };
  const runner = createRunner({ ...context, client, dispatchCounter });
  const claim = createClaim("1");

  await assert.rejects(
    () => runner.processClaim(claim),
    /Simulated lost HTTP response/,
  );
  assert.equal(runner.activeLeaseToken, null, "Lost ACK must release the cached lease token.");
  assert.equal(dispatchCounter.count, 1, "physical dispatch harus terjadi tepat sekali");
  let record = context.journal.get(claim.attempt.id);
  assert.equal(record.state, "submitted");
  assert.equal(record.pendingEventStatus, "submitted");
  assert.equal(record.serverAcknowledgedAt, null);

  const restartedRunner = createRunner({ ...context, client, dispatchCounter });
  const recovery = await restartedRunner.recover();
  assert.equal(recovery.remaining, 0);
  assert.equal(dispatchCounter.count, 1, "recovery submitted tidak boleh dispatch ulang");
  record = context.journal.get(claim.attempt.id);
  assert.equal(record.state, "acknowledged");
  assert.equal(record.eventSequence, 4);
  context.journal.close();
  fs.rmSync(context.root, { recursive: true, force: true });
}

async function testCrashAfterDispatchBecomesUnknown() {
  const context = createTempContext("dispatch-crash");
  const client = new FakeProtocolClient();
  const dispatchCounter = { count: 0 };
  const runner = createRunner({ ...context, client, dispatchCounter });
  const claim = createClaim("2");
  const record = context.journal.createFromClaim({
    job: claim.job,
    attempt: claim.attempt,
    leaseTokenProtected: context.secretProtector.protect(claim.attempt.leaseToken),
  });
  let current = await runner.queueAndSendEvent(record, "processing", { result: {} });
  current = await runner.queueAndSendEvent(current, "dispatching", { result: {} });
  context.journal.markDispatchStarted(current.attemptId, { adapter: "fake_printer" });

  const restartedRunner = createRunner({ ...context, client, dispatchCounter });
  const recovery = await restartedRunner.recover();
  assert.equal(recovery.remaining, 0);
  assert.equal(dispatchCounter.count, 0, "crash setelah dispatch marker tidak boleh dispatch ulang");
  const recovered = context.journal.get(claim.attempt.id);
  assert.equal(recovered.state, "unknown_after_dispatch");
  assert.equal(client.server.get(claim.attempt.id).status, "unknown_after_dispatch");
  context.journal.close();
  fs.rmSync(context.root, { recursive: true, force: true });
}

async function testPayloadHashMismatchStopsDispatch() {
  const context = createTempContext("hash-mismatch");
  const client = new FakeProtocolClient();
  const dispatchCounter = { count: 0 };
  const runner = createRunner({ ...context, client, dispatchCounter });
  const claim = createClaim("3");
  claim.job.payloadHash = "0".repeat(64);
  await runner.processClaim(claim);
  assert.equal(dispatchCounter.count, 0);
  const record = context.journal.get(claim.attempt.id);
  assert.equal(record.state, "failed_before_dispatch");
  context.journal.close();
  fs.rmSync(context.root, { recursive: true, force: true });
}

async function testLeaseTokenReuseIsLimitedToActiveExecution() {
  const context = createTempContext("lease-token-reuse");
  try {
    let decryptCalls = 0;
    const unprotect = context.secretProtector.unprotect.bind(context.secretProtector);
    context.secretProtector.unprotect = (value) => { decryptCalls++; return unprotect(value); };
    const client = new FakeProtocolClient();
    const sendEvent = client.sendEvent.bind(client);
    const expectedTokens = new Map();
    client.sendEvent = async (event) => {
      assert.equal(event.leaseToken, expectedTokens.get(event.attemptId));
      return sendEvent(event);
    };
    const dispatchCounter = { count: 0 };
    const runner = createRunner({ ...context, client, dispatchCounter });
    for (const suffix of ["4", "5"]) {
      const claim = createClaim(suffix);
      expectedTokens.set(claim.attempt.id, claim.attempt.leaseToken);
      await runner.processClaim(claim);
      assert.equal(runner.activeLeaseToken, null, "Completed attempts must release the cached token.");
      const record = context.journal.get(claim.attempt.id);
      assert.equal(record.state, "acknowledged");
      assert.notEqual(record.leaseTokenProtected, claim.attempt.leaseToken);
      assert.ok(!JSON.stringify(record).includes(claim.attempt.leaseToken), "The journal must never contain plaintext lease tokens.");
      assert.equal(typeof record.result.prepareDurationMs, "number");
      assert.equal(typeof record.result.dispatchDurationMs, "number");
    }
    assert.equal(decryptCalls, 2, "Each four-event execution must decrypt once, without reuse across attempts.");
    assert.equal(dispatchCounter.count, 2);
  } finally {
    context.journal.close();
    fs.rmSync(context.root, { recursive: true, force: true });
  }
}

async function main() {
  await testLostSubmittedAckDoesNotReprint();
  await testCrashAfterDispatchBecomesUnknown();
  await testPayloadHashMismatchStopsDispatch();
  await testLeaseTokenReuseIsLimitedToActiveExecution();
  console.log("OK: Hardware Hub v2 crash-safe journal and recovery checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
