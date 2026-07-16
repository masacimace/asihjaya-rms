/* eslint-disable */
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { hashCanonicalJson } = require("../lib/canonical-json");
const { ExecutionJournal } = require("../lib/execution-journal");
const { createFailureInjectionController } = require("../lib/failure-injection");
const { createHardwareAdapterFactory } = require("../lib/hardware-adapters");
const { HardwareProtocolV2Runner } = require("../lib/protocol-v2-runner");
const { createSecretProtector } = require("../lib/secret-protector");

const KEEP_OUTPUT = process.argv.includes("--keep-output");
const QUIET_LOGGER = { log() {}, warn() {}, error() {} };
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

function uuid(seed) {
  const hex = crypto.createHash("sha256").update(String(seed)).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function countFiles(root, name) {
  if (!fs.existsSync(root)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) total += countFiles(target, name);
    else if (!name || entry.name === name) total += 1;
  }
  return total;
}

function findFile(root, name) {
  if (!fs.existsSync(root)) return null;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(target, name);
      if (found) return found;
    } else if (entry.name === name) return target;
  }
  return null;
}

class FakeCloud {
  constructor() {
    this.jobs = [];
    this.attempts = new Map();
    this.events = [];
    this.claimCounter = 0;
  }

  addJob(job, { targetAgentId = null } = {}) {
    this.jobs.push({ ...job, targetAgentId, status: "pending" });
  }

  createClient(agentId) {
    return {
      claim: async (capabilities) => {
        const job = this.jobs.find(
          (candidate) =>
            candidate.status === "pending" &&
            capabilities.includes(candidate.requiredCapability) &&
            (!candidate.targetAgentId || candidate.targetAgentId === agentId),
        );
        if (!job) return { success: true, job: null, attempt: null };
        job.status = "claimed";
        const number = 1;
        const attemptId = uuid(`${job.id}:${agentId}:${++this.claimCounter}`);
        const attempt = {
          id: attemptId,
          number,
          leaseToken: `lease-${attemptId}-${"x".repeat(32)}`,
          leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        };
        this.attempts.set(attemptId, {
          jobId: job.id,
          agentId,
          sequence: 0,
          status: "claimed",
          leaseExpiresAt: attempt.leaseExpiresAt,
        });
        return { success: true, job, attempt };
      },
      renewLease: async ({ attemptId }) => {
        const attempt = this.attempts.get(attemptId);
        assert(attempt, "renewLease attempt harus tersedia");
        attempt.leaseExpiresAt = new Date(Date.now() + 60_000).toISOString();
        return { success: true, attempt: { leaseExpiresAt: attempt.leaseExpiresAt } };
      },
      sendEvent: async ({ jobId, attemptId, event }) => {
        const attempt = this.attempts.get(attemptId);
        assert(attempt, "sendEvent attempt harus tersedia");
        assert.equal(attempt.jobId, jobId);
        if (event.eventSequence < attempt.sequence) {
          return { success: true, duplicate: true, currentStatus: attempt.status };
        }
        if (event.eventSequence === attempt.sequence) {
          assert.equal(event.status, attempt.status);
          return { success: true, duplicate: true, currentStatus: attempt.status };
        }
        assert.equal(event.eventSequence, attempt.sequence + 1);
        attempt.sequence = event.eventSequence;
        attempt.status = event.status;
        this.events.push({ jobId, attemptId, status: event.status, sequence: event.eventSequence });
        const job = this.jobs.find((candidate) => candidate.id === jobId);
        if (event.status === "acknowledged") job.status = "completed";
        else if (event.status === "failed_before_dispatch") job.status = "failed";
        else if (event.status === "unknown_after_dispatch") job.status = "unknown_outcome";
        else job.status = event.status;
        return { success: true, duplicate: false, currentStatus: event.status };
      },
    };
  }
}

function createJob(seed, kind, apiUrl) {
  const id = uuid(`job:${seed}:${kind}`);
  let jobType;
  let deviceType;
  let requiredCapability;
  let payload;

  if (kind === "label") {
    jobType = "print_label_sato";
    deviceType = "label_printer";
    requiredCapability = "print_label_sato";
    payload = {
      schemaVersion: 1,
      templateId: "jewelry_compact",
      templateVersion: 1,
      itemId: uuid(`item:${seed}`),
      copies: 1,
      fields: {
        sku: `SKU-${seed}`,
        barcode: `899000${String(seed).padStart(6, "0")}`,
        name: "Cincin Emas Simulasi",
        weightGram: "2.35",
        purity: "75%",
        price: 3500000,
      },
    };
  } else if (kind === "document") {
    const saleId = uuid(`sale:${seed}`);
    jobType = "print_receipt_certificate";
    deviceType = "document_printer";
    requiredCapability = "print_document_pdf";
    payload = {
      schemaVersion: 1,
      documentType: "receipt_certificate",
      documentId: saleId,
      download: {
        path: `/api/sales/${saleId}/receipt-certificate`,
        contentType: "application/pdf",
        sha256: crypto.createHash("sha256").update(PDF_BYTES).digest("hex"),
        maxBytes: 1024 * 1024,
      },
      printProfileId: "receipt_a5_v1",
      copies: 1,
    };
  } else {
    jobType = "open_cash_drawer";
    deviceType = "cash_drawer";
    requiredCapability = "open_cash_drawer";
    payload = {
      schemaVersion: 1,
      drawerProfileId: "drawer_default_v1",
      paymentId: uuid(`payment:${seed}`),
    };
  }

  return {
    id,
    jobType,
    deviceType,
    requiredCapability,
    payload,
    payloadHash: hashCanonicalJson(payload),
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    apiUrl,
  };
}

function createRuntime({ root, cloud, agentId, scenario, apiUrl, outputDir, delayMs = 20 }) {
  const journalPath = path.join(root, `${agentId}-journal.sqlite`);
  const keyPath = path.join(root, `${agentId}-journal.key`);
  const journal = new ExecutionJournal({ filePath: journalPath });
  const secretProtector = createSecretProtector({ keyPath, platform: "linux" });
  const controller = createFailureInjectionController({
    enabled: true,
    outputDir,
    defaultScenario: scenario,
    delayMs,
    logger: QUIET_LOGGER,
  });
  const adapterFactory = createHardwareAdapterFactory({
    agentVersion: "simulation-agent",
    agentId,
    agentSecret: `simulation-secret-${"x".repeat(40)}`,
    apiUrl,
    dryRun: false,
    dryRunOutputDir: outputDir,
    tempDir: path.join(root, `${agentId}-temp`),
    adapterModes: {
      label_printer: "fake",
      document_printer: "fake",
      cash_drawer: "fake",
    },
    failureController: controller,
    labelPrinterName: "",
    documentPrinterName: "",
    cashDrawerPrinterName: "",
    pdfPrintExecutable: "",
    pdfPrintArgsJson: "",
    pdfPrintCommand: "",
    requestTimeoutMs: 3000,
    printCommandTimeoutMs: 5000,
    labelProfile: "jewelry_compact",
    labelCopies: 1,
    labelLeftOffsetDots: 0,
    labelTopOffsetDots: 0,
    labelIncludePrice: false,
    logger: QUIET_LOGGER,
  });
  const client = controller.createProtocolClient(cloud.createClient(agentId));
  const runner = new HardwareProtocolV2Runner({
    journal,
    client,
    secretProtector,
    prepareHardwareJob: adapterFactory.prepareHardwareJob,
    classifyPrepareError: adapterFactory.classifyPrepareError,
    logger: QUIET_LOGGER,
    agentVersion: "simulation-agent",
    dryRun: false,
    leaseRenewIntervalMs: 45_000,
    recoveryLimit: 50,
  });
  return { journal, controller, runner, journalPath, keyPath };
}

async function claimAndProcess(runtime, capabilities) {
  const response = await runtime.runner.claim(capabilities);
  if (!response.job) return { response, result: null };
  return { response, result: await runtime.runner.processClaim(response) };
}

async function withPdfServer(callback) {
  const server = http.createServer((req, res) => {
    if (/^\/api\/sales\/[0-9a-f-]+\/receipt-certificate$/.test(req.url || "")) {
      res.writeHead(200, {
        "content-type": "application/pdf",
        "content-length": PDF_BYTES.length,
      });
      res.end(PDF_BYTES);
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const apiUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await callback(apiUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runScenarioCase({ suiteRoot, apiUrl, name, scenario, kind = "label", expectedState, artifactName, delayMs }) {
  const root = path.join(suiteRoot, name);
  const outputDir = path.join(root, "artifacts");
  fs.mkdirSync(root, { recursive: true });
  const cloud = new FakeCloud();
  const job = createJob(name, kind, apiUrl);
  cloud.addJob(job);
  const runtime = createRuntime({
    root,
    cloud,
    agentId: `agent-${name}`,
    scenario,
    apiUrl,
    outputDir,
    delayMs,
  });
  const started = Date.now();
  let thrown = null;
  const response = await runtime.runner.claim([job.requiredCapability]);
  try {
    if (response.job) await runtime.runner.processClaim(response);
  } catch (error) {
    thrown = error;
  }
  const durationMs = Date.now() - started;
  const record = response?.attempt ? runtime.journal.get(response.attempt.id) : null;
  return { root, outputDir, cloud, job, runtime, response, record, thrown, durationMs, expectedState, artifactName };
}

async function main() {
  const suiteRoot = KEEP_OUTPUT
    ? path.resolve(process.cwd(), "data", `simulation-${new Date().toISOString().replace(/[:.]/g, "-")}`)
    : fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-hardware-simulation-"));
  fs.mkdirSync(suiteRoot, { recursive: true });
  const results = [];

  await withPdfServer(async (apiUrl) => {
    const success = await runScenarioCase({
      suiteRoot,
      apiUrl,
      name: "success-label",
      scenario: "success",
      expectedState: "acknowledged",
      artifactName: "label.sbpl",
    });
    assert.equal(success.record.state, "acknowledged");
    assert.equal(countFiles(success.outputDir, "label.sbpl"), 1);
    assert.equal(success.cloud.jobs[0].status, "completed");
    results.push({ name: "success-label", passed: true });
    success.runtime.journal.close();

    const duplicateRoot = path.join(suiteRoot, "duplicate-dispatch-guard");
    const duplicateOutput = path.join(duplicateRoot, "artifacts");
    fs.mkdirSync(duplicateRoot, { recursive: true });
    const duplicateController = createFailureInjectionController({
      enabled: true,
      outputDir: duplicateOutput,
      defaultScenario: "success",
      logger: QUIET_LOGGER,
    });
    const duplicateFactory = createHardwareAdapterFactory({
      agentVersion: "simulation-agent",
      agentId: "duplicate-agent",
      agentSecret: `simulation-secret-${"x".repeat(40)}`,
      apiUrl,
      dryRun: false,
      dryRunOutputDir: duplicateOutput,
      tempDir: path.join(duplicateRoot, "temp"),
      adapterModes: { label_printer: "fake", document_printer: "fake", cash_drawer: "fake" },
      failureController: duplicateController,
      labelProfile: "jewelry_compact",
      labelCopies: 1,
      labelLeftOffsetDots: 0,
      labelTopOffsetDots: 0,
      labelIncludePrice: false,
      logger: QUIET_LOGGER,
    });
    const duplicateJob = createJob("duplicate-dispatch", "label", apiUrl);
    const duplicatePrepared = await duplicateFactory.prepareHardwareJob({
      job: duplicateJob,
      attemptId: uuid("duplicate-attempt"),
    });
    await duplicatePrepared.dispatch();
    await assert.rejects(
      () => duplicatePrepared.dispatch(),
      (error) => error?.code === "FAKE_DUPLICATE_DISPATCH_DETECTED",
    );
    assert.equal(countFiles(duplicateOutput, "label.sbpl"), 1);
    results.push({ name: "duplicate-dispatch-guard", passed: true });

    for (const scenario of ["fail_before_dispatch", "timeout_before_dispatch", "printer_not_found"]) {
      const item = await runScenarioCase({
        suiteRoot,
        apiUrl,
        name: scenario,
        scenario,
        expectedState: "failed_before_dispatch",
      });
      assert.equal(item.record.state, "failed_before_dispatch");
      assert.equal(countFiles(item.outputDir, "label.sbpl"), 0);
      assert.equal(item.cloud.jobs[0].status, "failed");
      results.push({ name: scenario, passed: true });
      item.runtime.journal.close();
    }

    const slow = await runScenarioCase({
      suiteRoot,
      apiUrl,
      name: "slow-execution",
      scenario: "slow_execution",
      expectedState: "acknowledged",
      artifactName: "label.sbpl",
      delayMs: 80,
    });
    assert.equal(slow.record.state, "acknowledged");
    assert(slow.durationMs >= 65, `slow execution terlalu cepat: ${slow.durationMs} ms`);
    assert.equal(countFiles(slow.outputDir, "label.sbpl"), 1);
    results.push({ name: "slow-execution", passed: true, durationMs: slow.durationMs });
    slow.runtime.journal.close();

    const unknown = await runScenarioCase({
      suiteRoot,
      apiUrl,
      name: "unknown-after-dispatch",
      scenario: "unknown_after_dispatch",
      expectedState: "unknown_after_dispatch",
      artifactName: "label.sbpl",
    });
    assert.equal(unknown.record.state, "unknown_after_dispatch");
    assert.equal(countFiles(unknown.outputDir, "label.sbpl"), 1);
    assert.equal(unknown.cloud.jobs[0].status, "unknown_outcome");
    results.push({ name: "unknown-after-dispatch", passed: true });
    unknown.runtime.journal.close();

    const crash = await runScenarioCase({
      suiteRoot,
      apiUrl,
      name: "crash-after-dispatch",
      scenario: "crash_after_dispatch",
      expectedState: "dispatching",
      artifactName: "label.sbpl",
    });
    assert(crash.thrown?.simulatedAgentCrash, "crash scenario harus melempar simulated crash");
    let crashRecord = crash.runtime.journal.get(crash.response.attempt.id);
    assert.equal(crashRecord.state, "dispatching");
    assert(crashRecord.dispatchStartedAt);
    assert.equal(countFiles(crash.outputDir, "label.sbpl"), 1);
    const restartedCrash = createRuntime({
      root: crash.root,
      cloud: crash.cloud,
      agentId: "agent-crash-after-dispatch",
      scenario: "crash_after_dispatch",
      apiUrl,
      outputDir: crash.outputDir,
    });
    crash.runtime.journal.close();
    const crashRecovery = await restartedCrash.runner.recover();
    assert.equal(crashRecovery.remaining, 0);
    crashRecord = restartedCrash.journal.get(crash.response.attempt.id);
    assert.equal(crashRecord.state, "unknown_after_dispatch");
    assert.equal(countFiles(crash.outputDir, "label.sbpl"), 1, "recovery crash tidak boleh menulis artifact kedua");
    results.push({ name: "crash-after-dispatch-recovery", passed: true });
    restartedCrash.journal.close();

    const ack = await runScenarioCase({
      suiteRoot,
      apiUrl,
      name: "submitted-ack-lost",
      scenario: "success_then_ack_lost",
      expectedState: "submitted",
      artifactName: "label.sbpl",
    });
    assert.equal(ack.thrown?.code, "API_NETWORK_ERROR");
    let ackRecord = ack.runtime.journal.get(ack.response.attempt.id);
    assert.equal(ackRecord.state, "submitted");
    assert.equal(ackRecord.pendingEventStatus, "submitted");
    assert.equal(countFiles(ack.outputDir, "label.sbpl"), 1);
    const restartedAck = createRuntime({
      root: ack.root,
      cloud: ack.cloud,
      agentId: "agent-submitted-ack-lost",
      scenario: "success_then_ack_lost",
      apiUrl,
      outputDir: ack.outputDir,
    });
    ack.runtime.journal.close();
    const ackRecovery = await restartedAck.runner.recover();
    assert.equal(ackRecovery.remaining, 0);
    ackRecord = restartedAck.journal.get(ack.response.attempt.id);
    assert.equal(ackRecord.state, "acknowledged");
    assert.equal(countFiles(ack.outputDir, "label.sbpl"), 1, "ACK recovery tidak boleh dispatch ulang");
    results.push({ name: "submitted-ack-lost-recovery", passed: true });
    restartedAck.journal.close();

    const document = await runScenarioCase({
      suiteRoot,
      apiUrl,
      name: "success-document",
      scenario: "success",
      kind: "document",
      expectedState: "acknowledged",
      artifactName: "document.pdf",
    });
    assert.equal(document.record.state, "acknowledged");
    const documentPath = findFile(document.outputDir, "document.pdf");
    assert(documentPath);
    assert.deepEqual(fs.readFileSync(documentPath), PDF_BYTES);
    results.push({ name: "success-document", passed: true });
    document.runtime.journal.close();

    const drawer = await runScenarioCase({
      suiteRoot,
      apiUrl,
      name: "success-drawer",
      scenario: "success",
      kind: "drawer",
      expectedState: "acknowledged",
      artifactName: "drawer.json",
    });
    assert.equal(drawer.record.state, "acknowledged");
    const drawerPath = findFile(drawer.outputDir, "drawer.json");
    assert(drawerPath);
    const drawerPayload = JSON.parse(fs.readFileSync(drawerPath, "utf8"));
    assert.equal(drawerPayload.kind, "fake_cash_drawer_dispatch");
    results.push({ name: "success-drawer", passed: true });
    drawer.runtime.journal.close();

    const multiRoot = path.join(suiteRoot, "multi-agent");
    const multiOutput = path.join(multiRoot, "artifacts");
    fs.mkdirSync(multiRoot, { recursive: true });
    const cloud = new FakeCloud();
    const raceJob = createJob("multi-agent-race", "label", apiUrl);
    cloud.addJob(raceJob);
    const agentA = createRuntime({ root: multiRoot, cloud, agentId: "agent-a", scenario: "success", apiUrl, outputDir: multiOutput });
    const agentB = createRuntime({ root: multiRoot, cloud, agentId: "agent-b", scenario: "success", apiUrl, outputDir: multiOutput });
    const claims = await Promise.all([
      agentA.runner.claim(["print_label_sato"]),
      agentB.runner.claim(["print_label_sato"]),
    ]);
    assert.equal(claims.filter((claim) => claim.job).length, 1);
    const winnerIndex = claims[0].job ? 0 : 1;
    await [agentA, agentB][winnerIndex].runner.processClaim(claims[winnerIndex]);
    assert.equal(countFiles(multiOutput, "label.sbpl"), 1);

    const targetedJob = createJob("target-agent", "label", apiUrl);
    cloud.addJob(targetedJob, { targetAgentId: "agent-b" });
    const wrongTarget = await agentA.runner.claim(["print_label_sato"]);
    assert.equal(wrongTarget.job, null);
    const correctTarget = await agentB.runner.claim(["print_label_sato"]);
    assert.equal(correctTarget.job.id, targetedJob.id);
    await agentB.runner.processClaim(correctTarget);
    assert.equal(countFiles(multiOutput, "label.sbpl"), 2);
    results.push({ name: "multi-agent-and-target-routing", passed: true });
    agentA.journal.close();
    agentB.journal.close();
  });

  const report = {
    passed: true,
    generatedAt: new Date().toISOString(),
    keepOutput: KEEP_OUTPUT,
    suiteRoot,
    results,
  };
  fs.writeFileSync(path.join(suiteRoot, "simulation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`OK: ${results.length} fake hardware and failure-injection scenarios passed.`);
  console.log(`Simulation report: ${path.join(suiteRoot, "simulation-report.json")}`);

  if (!KEEP_OUTPUT) fs.rmSync(suiteRoot, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
