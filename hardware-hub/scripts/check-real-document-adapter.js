/* eslint-disable */
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { EventEmitter } = require("events");

const adapterPath = path.join(__dirname, "..", "lib", "hardware-adapters.js");
const adapterDir = path.dirname(adapterPath);
const adapterSource = fs.readFileSync(adapterPath, "utf8");

function createSyntheticA4LandscapePdf() {
  return Buffer.from(
    "%PDF-1.4\n" +
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 841.89 595.28]>>endobj\n" +
      "trailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8",
  );
}

function loadWindowsAdapterModule(commandCalls) {
  function fakeSpawn(executable, args, options) {
    commandCalls.push({ executable, args: [...args], options: { ...options } });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    setImmediate(() => child.emit("close", 0, null));
    return child;
  }

  const moduleRecord = { exports: {} };
  const sandbox = {
    Buffer,
    URL,
    clearTimeout,
    console,
    module: moduleRecord,
    exports: moduleRecord.exports,
    __dirname: adapterDir,
    __filename: adapterPath,
    process: { platform: "win32" },
    require(request) {
      if (request === "child_process") return { spawn: fakeSpawn };
      if (request.startsWith(".")) return require(path.resolve(adapterDir, request));
      return require(request);
    },
    setImmediate,
    setTimeout,
  };

  vm.runInNewContext(adapterSource, sandbox, {
    filename: adapterPath,
    displayErrors: true,
  });
  return moduleRecord.exports;
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address();
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function main() {
  assert.doesNotMatch(
    adapterSource,
    /validatePrinterShareName\s*\(/,
    "Real document adapter tidak boleh memanggil validator printer yang tidak didefinisikan.",
  );
  assert.match(
    adapterSource,
    /validatePrinterName\(config\.documentPrinterName\)/,
    "Real document adapter wajib memvalidasi DOCUMENT_PRINTER_NAME sebelum download/dispatch.",
  );

  const pdf = createSyntheticA4LandscapePdf();
  const pdfSha256 = crypto.createHash("sha256").update(pdf).digest("hex");
  const saleId = "11111111-1111-4111-8111-111111111111";
  const downloadPath = `/api/sales/${saleId}/receipt-certificate`;
  const server = http.createServer((request, response) => {
    if (request.url !== downloadPath) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "content-type": "application/pdf",
      "content-length": String(pdf.length),
    });
    response.end(pdf);
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-document-adapter-"));
  const commandCalls = [];
  let prepared = null;

  try {
    const address = await listen(server);
    const apiUrl = `http://127.0.0.1:${address.port}`;
    const { createHardwareAdapterFactory, HardwareAdapterError } =
      loadWindowsAdapterModule(commandCalls);

    const logger = { log() {}, warn() {}, error() {} };
    const factory = createHardwareAdapterFactory({
      adapterModes: {
        label_printer: "real",
        document_printer: "real",
        cash_drawer: "real",
      },
      agentVersion: "checker",
      apiUrl,
      createRequestHeaders: () => ({}),
      documentPrinterName: "EPSON L3250 Series",
      pdfPrintExecutable: "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
      pdfPrintCommand: "",
      printCommandTimeoutMs: 5_000,
      requestTimeoutMs: 5_000,
      tempDir,
      logger,
    });

    prepared = await factory.prepareHardwareJob({
      attemptId: "attempt-document-real-check",
      job: {
        id: "job-document-real-check",
        jobType: "print_receipt_certificate",
        payload: {
          documentProfileId: "receipt_a4_landscape_v1",
          printProfileId: "epson_l3251_a4_v1",
          copies: 1,
          download: {
            path: downloadPath,
            contentType: "application/pdf",
            maxBytes: 1024 * 1024,
            sha256: pdfSha256,
          },
        },
      },
    });

    assert.equal(prepared.adapter, "sumatrapdf_profile");
    assert.equal(prepared.target, "EPSON L3250 Series");

    const result = await prepared.dispatch();
    assert.equal(result.mode, "sumatrapdf_profile");
    assert.equal(result.printerName, "EPSON L3250 Series");
    assert.equal(result.printProfileId, "epson_l3251_a4_v1");
    assert.equal(result.documentProfileId, "receipt_a4_landscape_v1");
    assert.equal(result.pdfContract.pageSize, "A4 landscape");
    assert.equal(commandCalls.length, 1);
    assert.equal(commandCalls[0].executable, "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe");
    assert.deepEqual(Array.from(commandCalls[0].args).slice(0, 6), [
      "-print-to",
      "EPSON L3250 Series",
      "-print-settings",
      "paper=A4,fit,color,simplex,ignore-pdf-print-settings",
      "-silent",
      commandCalls[0].args[5],
    ]);
    assert.match(commandCalls[0].args[5], /\.pdf$/i);
    assert.equal(commandCalls[0].options.shell, false);
    assert.equal(commandCalls[0].options.windowsHide, true);

    await prepared.cleanup();
    prepared = null;

    const invalidFactory = createHardwareAdapterFactory({
      adapterModes: {
        label_printer: "real",
        document_printer: "real",
        cash_drawer: "real",
      },
      agentVersion: "checker",
      apiUrl,
      createRequestHeaders: () => ({}),
      documentPrinterName: "EPSON L3250 Series\nunsafe",
      pdfPrintExecutable: "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
      pdfPrintCommand: "",
      printCommandTimeoutMs: 5_000,
      requestTimeoutMs: 5_000,
      tempDir,
      logger,
    });

    await assert.rejects(
      () =>
        invalidFactory.prepareHardwareJob({
          attemptId: "attempt-invalid-printer",
          job: {
            id: "job-invalid-printer",
            jobType: "test_document_printer",
            payload: {
              documentProfileId: "receipt_a4_landscape_v1",
              printProfileId: "epson_l3251_a4_v1",
              download: { path: downloadPath, contentType: "application/pdf" },
            },
          },
        }),
      (error) =>
        error instanceof HardwareAdapterError &&
        error.code === "INVALID_PRINTER_NAME" &&
        error.category === "configuration",
    );

    console.log(
      "OK: real document adapter memakai named printer, validator aktif, A4 Epson profile, dan silent Sumatra dispatch.",
    );
  } finally {
    if (prepared?.cleanup) await prepared.cleanup();
    await close(server);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
