/* eslint-disable */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { prepareSatoJewelryLabel, loadSatoJewelryLabelConfig } = require("../lib/sato-jewelry-label");
const { createSatoProductionContractFixture } = require("./generate-outlet-fixtures");
const { loadWindowsAdapterModule } = require("./check-real-document-adapter");

async function main() {
  const payload = JSON.parse(createSatoProductionContractFixture(undefined, { shortAlias: true })).payload;
  payload.fields.barcode = "AJ00013447";
  payload.fields.labelBarcode = "000001";
  const baseline = loadSatoJewelryLabelConfig();
  const prepared = prepareSatoJewelryLabel(payload);
  assert.equal(prepared.template.version, 4);
  assert.equal(prepared.renderInput.barcode, "AJ00013447");
  assert.equal(prepared.renderInput.labelBarcode, "000001");
  assert.equal(prepared.profile.barcode.strategy, "CODE128_C");
  assert.equal(prepared.profile.barcode.narrowBarDots, 2);
  assert.equal(prepared.profile.physicalValidation, "pending_outlet_test");
  assert.equal(prepared.profile.baseLayoutSha256, baseline.lock.layoutSha256);
  assert.equal(baseline.config.front.barcode.narrowBarDots, 1, "The accepted V3 config/lock must remain intact for queued jobs.");
  for (const invalid of ["12345", "1234567", "AJ1234", "123.45", " 123456", "", 123456, null, undefined]) {
    assert.throws(() => prepareSatoJewelryLabel({ ...payload, fields: { ...payload.fields, labelBarcode: invalid } }), error => error.code === "SATO_LABEL_ALIAS_INVALID");
  }
  const legacy = JSON.parse(createSatoProductionContractFixture()).payload;
  assert.throws(() => prepareSatoJewelryLabel({ ...legacy, fields: { ...legacy.fields, labelBarcode: "000001" } }), error => error.code === "SATO_LABEL_ALIAS_INVALID");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-short-label-"));
  try {
    let dispatched = null;
    const calls = [];
    const native = Buffer.from("\x1bA\x1bH0116\x1bV0030\x1bBG02041>I000001\x1bQ1\x1bZ", "ascii");
    const { createHardwareAdapterFactory } = loadWindowsAdapterModule(calls, (executable, args) => {
      const get = key => args[args.indexOf(key) + 1];
      if (get("-File").endsWith("render-sato-jewelry-label.ps1")) {
        assert.equal(get("-Barcode"), "AJ00013447");
        assert.equal(get("-LabelBarcode"), "000001");
        fs.writeFileSync(get("-OutputFile"), native);
      } else {
        dispatched = fs.readFileSync(get("-FilePath"));
        return { stdout: JSON.stringify({ jobId: 101, bytesWritten: dispatched.length, dataType: "RAW" }) };
      }
    });
    const factory = createHardwareAdapterFactory({ labelPrinterName: "SATO CG408", tempDir: root, printCommandTimeoutMs: 2000, logger: { log() {}, warn() {}, error() {} },
      adapterModes: { label_printer: "real", document_printer: "real", cash_drawer: "real" }, satoPrintDarkness: 0, satoPrintSpeedIps: 0 });
    const job = await factory.prepareHardwareJob({ job: { id: "alias-check", jobType: "print_label_sato", payload }, attemptId: "alias-check" });
    try {
      const result = await job.dispatch();
      assert.equal(result.label.barcodeTextPrinted, "AJ00013447");
      assert.equal(result.label.labelBarcode, "000001");
      assert.deepEqual(dispatched, native);
    } finally { await job.cleanup(); }

    // Generate only an SBPL file, never send it to a printer. Exercise the real
    // Windows renderer as well as the JS adapter (Linux CI still checks JS).
    if (process.platform === "win32") {
      const output = path.join(root, "alias.sbpl");
      // Use a Windows standard font for this isolated barcode test so CI does
      // not require Inter installed before the installer bundles its pinned font.
      const configPath = path.join(root, "barcode-test-config.json");
      const testConfig = JSON.parse(JSON.stringify(baseline.config));
      testConfig.font.family = "Arial";
      fs.writeFileSync(configPath, JSON.stringify(testConfig));
      const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
        path.join(__dirname, "render-sato-jewelry-label.ps1"), "-ConfigPath", configPath, "-Barcode", "AJ00013447", "-LabelBarcode", "000001", "-OutputFile", output],
        { encoding: "utf8", timeout: 30000, windowsHide: true, env: { ...process.env, SATO_LABEL_FONT_PATH: "" } });
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert(fs.readFileSync(output).includes(Buffer.from("\x1bBG02041>I000001", "ascii")));
      const metadata = JSON.parse(fs.readFileSync(`${output}.json`, "utf8").replace(/^\uFEFF/, ""));
      assert.equal(metadata.front.barcode.data, "000001");
      assert.equal(metadata.front.barcode.barsWidthDots, 136);
      assert.equal(metadata.front.barcode.quietZoneDotsPerSide, 20);
      assert.equal(metadata.front.barcode.narrowBarDots, 2);
      assert.equal(metadata.front.barcodeText.text, "AJ00013447");
      assert.equal(metadata.physicalValidation, "pending_outlet_test");
      assert(metadata.front.barcode.barsWidthDots + 2 * metadata.front.barcode.quietZoneDotsPerSide <= 182);
    }
    console.log("OK: V4 alias/native Code128 C 2-dot dispatch, original printed code, validation and V3 compatibility.");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
