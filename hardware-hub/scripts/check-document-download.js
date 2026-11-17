/* eslint-disable */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { loadWindowsAdapterModule, createSyntheticA4LandscapePdf } = require("./check-real-document-adapter");
const { parseRetryAfterMs, resolveDocumentDownloadTimeoutMs } = require("../lib/document-download-policy");

async function main() {
  const serverDate = "Tue, 17 Nov 2026 04:00:00 GMT";
  assert.equal(parseRetryAfterMs("60"), 60_000);
  assert.equal(parseRetryAfterMs("999999999"), 900_000);
  assert.equal(parseRetryAfterMs("Tue, 17 Nov 2026 04:00:07 GMT", serverDate, 0), 7_000);
  for (const value of [undefined, "", "-1", "1.5", "tomorrow"]) assert.equal(parseRetryAfterMs(value), null);
  assert.equal(resolveDocumentDownloadTimeoutMs({ requestTimeoutMs: 15_000 }), 90_000);

  const pdf = createSyntheticA4LandscapePdf();
  const downloadPath = "/api/sales/11111111-1111-4111-8111-111111111111/receipt-certificate";
  let mode = {};
  const server = http.createServer((req, res) => {
    if (mode.status) {
      res.writeHead(mode.status, { date: serverDate, ...(mode.retryAfter ? { "retry-after": mode.retryAfter } : {}) });
      res.end();
    } else if (mode.truncated) {
      res.writeHead(200, { "content-type": "application/pdf", "content-length": pdf.length + 100 });
      res.write(pdf.subarray(0, 30));
      setTimeout(() => res.destroy(), 20);
    } else if (mode.streaming) {
      res.writeHead(200, { "content-type": "application/pdf" });
      res.write("%PDF-");
      const timer = setInterval(() => res.write(" data "), 10);
      res.on("close", () => clearInterval(timer));
    } else {
      const timer = setTimeout(() => {
        res.writeHead(200, { "content-type": mode.contentType || "application/pdf" });
        res.end(pdf);
      }, mode.delayMs || 0);
      res.on("close", () => clearTimeout(timer));
    }
  });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-pdf-busy-"));
  const commandCalls = [];
  const { createHardwareAdapterFactory } = loadWindowsAdapterModule(commandCalls);
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const config = {
      adapterModes: { document_printer: "real" },
      apiUrl: `http://127.0.0.1:${server.address().port}`,
      createRequestHeaders: () => ({}), documentPrinterName: "EPSON Test",
      pdfPrintExecutable: "SumatraPDF.exe", requestTimeoutMs: 20,
      documentDownloadTimeoutMs: 2_000, printCommandTimeoutMs: 2_000,
      tempDir, logger: { log() {}, warn() {}, error() {} },
    };
    const job = { id: "download-test", jobType: "print_receipt_certificate", payload: {
      documentProfileId: "receipt_a4_landscape_v1", printProfileId: "epson_l3251_a4_v1",
      download: { path: downloadPath, contentType: "application/pdf" },
    } };
    const factory = createHardwareAdapterFactory(config);
    async function fails(nextMode, code, retrySafe, retryAfterMs, overrides = {}) {
      mode = nextMode;
      const adapter = createHardwareAdapterFactory({ ...config, ...overrides });
      const before = commandCalls.length;
      await assert.rejects(() => adapter.prepareHardwareJob({ job, attemptId: "attempt-fail" }), (error) => {
        assert.equal(error.code, code);
        const classification = adapter.classifyPrepareError(error);
        assert.equal(classification.retrySafe, retrySafe);
        assert.equal(classification.retryAfterMs, retryAfterMs);
        return true;
      });
      assert.equal(commandCalls.length, before, "Download failure must never dispatch to the printer.");
      assert.deepEqual(fs.readdirSync(tempDir), [], "Failed downloads must leave no open/partial PDF.");
    }
    await fails({ status: 429, retryAfter: "60" }, "DOCUMENT_RATE_LIMITED", true, 60_000);
    await fails({ status: 503, retryAfter: "Tue, 17 Nov 2026 04:00:07 GMT" }, "DOCUMENT_SERVER_BUSY", true, 7_000);
    await fails({ status: 429 }, "DOCUMENT_RATE_LIMITED", true, 60_000);
    await fails({ status: 503, retryAfter: "invalid" }, "DOCUMENT_SERVER_BUSY", true, 5_000);
    await fails({ status: 401, retryAfter: "60" }, "DOCUMENT_DOWNLOAD_FAILED", false, undefined);
    await fails({ truncated: true }, "DOCUMENT_DOWNLOAD_INTERRUPTED", true, undefined);
    await fails({ streaming: true }, "DOCUMENT_DOWNLOAD_TIMEOUT", true, undefined, { documentDownloadTimeoutMs: 80 });
    await fails({ delayMs: 250 }, "DOCUMENT_DOWNLOAD_TIMEOUT", true, undefined, { documentDownloadTimeoutMs: 80 });
    await fails({ contentType: "text/html" }, "DOCUMENT_CONTENT_TYPE_MISMATCH", false, undefined);

    // A render slower than the API timeout is still valid within the PDF budget.
    mode = { delayMs: 150 };
    const prepared = await factory.prepareHardwareJob({ job, attemptId: "slow-valid" });
    assert.equal(commandCalls.length, 0);
    await prepared.dispatch();
    assert.equal(commandCalls.length, 1);
    await prepared.cleanup();
    assert.deepEqual(fs.readdirSync(tempDir), []);
    console.log("OK: PDF retry hints, separate deadline, interrupted streams and zero dispatch on download failure.");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
