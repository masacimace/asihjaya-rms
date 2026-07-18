/* eslint-disable */
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { OperationalLogger } = require("../lib/operational-logger");
const { OperationalHealth } = require("../lib/operational-health");
const { acquireProcessLock } = require("../lib/process-lock");
const { redactConfig } = require("./collect-diagnostics");

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on("error", reject);
  });
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-operations-check-"));
  try {
    const logDir = path.join(tempRoot, "logs");
    const secret = "test-secret-value-1234567890";
    const logger = new OperationalLogger({
      logDir,
      version: "test",
      agentId: "agent-test",
      maxFileBytes: 64 * 1024,
      retentionDays: 7,
      maxFiles: 20,
      mirrorToConsole: false,
      redactionValues: [secret],
    });
    for (let index = 0; index < 1400; index += 1) logger.info("rotation", index, secret, "x".repeat(80));
    const logs = fs.readdirSync(logDir).filter((name) => name.endsWith(".jsonl"));
    assert(logs.length >= 2, "structured logger harus rotate berdasarkan ukuran");
    const combined = logs.map((name) => fs.readFileSync(path.join(logDir, name), "utf8")).join("\n");
    assert(!combined.includes(secret), "secret tidak boleh masuk structured log");
    assert(combined.includes("[REDACTED]"), "structured log harus memiliki redaction marker");

    const lockPath = path.join(tempRoot, "data", "agent.lock");
    const lock = acquireProcessLock({ filePath: lockPath });
    assert.throws(() => acquireProcessLock({ filePath: lockPath }), /sudah berjalan/);
    lock.release();
    const secondLock = acquireProcessLock({ filePath: lockPath });
    secondLock.release();

    const healthPath = path.join(tempRoot, "data", "health.json");
    const health = new OperationalHealth({ filePath: healthPath, logger, agent: { id: "agent-test" } });
    health.markReady({ journal: { total: 0 } });
    const address = await health.startServer({ enabled: true, host: "127.0.0.1", port: 0 });
    const response = await getJson(`http://127.0.0.1:${address.port}/ready`);
    assert.equal(response.status, 200);
    assert.equal(response.body.ready, true);
    await health.close();

    const redacted = redactConfig({
      ASIHJAYA_API_URL: "https://example.test",
      HARDWARE_AGENT_SECRET: secret,
      SOME_PASSWORD: "password",
    });
    assert.equal(redacted.HARDWARE_AGENT_SECRET, "[REDACTED]");
    assert.equal(redacted.SOME_PASSWORD, "[REDACTED]");
    assert.equal(redacted.ASIHJAYA_API_URL, "https://example.test");

    const diagnosticsModule = require("./collect-diagnostics");
    const diagnostics = diagnosticsModule.collectDiagnostics();
    assert(
      diagnostics.documentPrinting.profiles.some(
        (profile) => profile.id === "epson_l3251_a4_v1" && profile.paper === "A4",
      ),
      "support diagnostics harus mencantumkan deterministic Epson A4 profile",
    );
    assert.equal(
      diagnostics.labelPrinting.configuredProfileId,
      "sato_cg408tt_jewelry_v1",
      "support diagnostics harus mencantumkan deterministic SATO profile",
    );
    assert.equal(
      diagnostics.labelPrinting.active?.physicalValidation,
      "pending",
      "SATO physical validation harus tetap eksplisit pending",
    );

    for (const file of ["start-agent.ps1", "install-startup-task.ps1", "export-support-bundle.ps1"]) {
      assert(fs.existsSync(path.join(__dirname, file)), `${file} wajib tersedia`);
    }
    const installTask = fs.readFileSync(path.join(__dirname, "install-startup-task.ps1"), "utf8");
    assert(installTask.includes("MultipleInstances IgnoreNew"));
    assert(installTask.includes("NodeExecutable"));
    const bundle = fs.readFileSync(path.join(__dirname, "export-support-bundle.ps1"), "utf8");
    assert(!bundle.includes("hardware-executions.sqlite\" | Copy-Item"));
    assert(bundle.includes("SECURITY-NOTICE"));

    logger.close();
    console.log("OK: production Windows operations checks passed.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
