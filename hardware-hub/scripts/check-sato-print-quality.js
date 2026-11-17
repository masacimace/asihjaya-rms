/* eslint-disable */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveSatoPrintQuality, buildSatoPrintQualityCommands } = require("../lib/sato-print-quality");
const { loadSatoJewelryLabelConfig } = require("../lib/sato-jewelry-label");
const { loadWindowsAdapterModule } = require("./check-real-document-adapter");

async function main() {
  const quality = resolveSatoPrintQuality();
  assert.equal(quality.darkness, 4);
  assert.equal(quality.speedIps, 2);
  assert.equal(quality.physicalValidation, "pending_outlet_test");
  const commands = buildSatoPrintQualityCommands(quality);
  assert.equal(commands.toString("ascii"), "\x1bA\x1bCS2\x1bZ\x1bA\x1b#E4\x1bZ");
  assert(!commands.includes(Buffer.from("\x1bQ")), "Quality configuration must never print or feed a label itself.");
  assert.equal(buildSatoPrintQualityCommands({ darkness: 0, speedIps: 0 }).length, 0);
  assert.equal(buildSatoPrintQualityCommands({ darkness: 0, speedIps: 3 }).toString(), "\x1bA\x1bCS3\x1bZ");
  for (const invalid of [{ darkness: 6 }, { darkness: -1 }, { darkness: "4\x1bQ99" }, { speedIps: 1 }, { speedIps: 2.5 }, { speedIps: 6 }]) {
    assert.throws(() => resolveSatoPrintQuality(invalid), (error) => error.code === "SATO_PRINT_QUALITY_INVALID");
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-sato-quality-"));
  const captured = [];
  const calls = [];
  let failDispatch = false;
  const nativeLabel = Buffer.from("\x1bA\x1bH0111\x1bV0030\x1bBG01041>HAJ00011160\x1bQ1\x1bZ", "ascii");
  const { createHardwareAdapterFactory } = loadWindowsAdapterModule(calls, (executable, args) => {
    const get = (name) => args[args.indexOf(name) + 1];
    if (get("-File").endsWith("render-sato-jewelry-label.ps1")) {
      assert.equal(get("-Barcode"), "AJ00011160");
      fs.writeFileSync(get("-OutputFile"), nativeLabel);
      return {};
    }
    assert(get("-File").endsWith("send-raw-to-printer.ps1"));
    captured.push(fs.readFileSync(get("-FilePath")));
    return { exitCode: failDispatch ? 1 : 0, stdout: JSON.stringify({ jobId: 101, bytesWritten: captured.at(-1).length, dataType: "RAW" }) };
  });
  const config = {
    labelPrinterName: "SATO CG408", tempDir: root,
    adapterModes: { label_printer: "real", document_printer: "real", cash_drawer: "real" },
    printCommandTimeoutMs: 2_000, logger: { log() {}, warn() {}, error() {} },
  };
  const job = { id: "quality-test", jobType: "print_label_sato", payload: {
    schemaVersion: 1, templateId: "jewelry_barbell_inter_v3", templateVersion: 3,
    printerProfileId: "sato_cg408_jewelry_barbell_inter_v3",
    fields: { barcode: "AJ00011160", masterProductName: "Gelang", itemDisplayName: "Gelang Test", weightGram: "2.5" },
  } };
  try {
    const factory = createHardwareAdapterFactory(config);
    const unused = await factory.prepareHardwareJob({ job, attemptId: "prepared-only" });
    await unused.cleanup();
    assert.equal(captured.length, 0, "Preparation must not configure or print hardware.");
    for (let index = 0; index < 2; index++) {
      const prepared = await factory.prepareHardwareJob({ job, attemptId: `success-${index}` });
      try {
        const result = await prepared.dispatch();
        assert.equal(result.printQualityConfigured, index === 0);
        assert.equal(result.label.barcode, "AJ00011160");
        assert.equal(result.printerProfile.printQuality.darkness, 4);
        assert.equal(result.printerProfile.printQuality.physicalValidation, "pending_outlet_test");
        assert.equal(result.commandSha256, crypto.createHash("sha256").update(captured.at(-1)).digest("hex"));
      } finally { await prepared.cleanup(); }
    }
    assert.deepEqual(captured[0], Buffer.concat([commands, nativeLabel]));
    assert.deepEqual(captured[1], nativeLabel, "Subsequent labels keep every rendered byte unchanged and skip NVRAM settings.");

    const restarted = createHardwareAdapterFactory(config);
    failDispatch = true;
    const failed = await restarted.prepareHardwareJob({ job, attemptId: "failed" });
    try { await assert.rejects(() => failed.dispatch()); } finally { await failed.cleanup(); }
    failDispatch = false;
    const afterFailure = await restarted.prepareHardwareJob({ job, attemptId: "different-job" });
    try {
      assert.equal((await afterFailure.dispatch()).printQualityConfigured, true, "Only a successful RAW dispatch may update the session cache.");
    } finally { await afterFailure.cleanup(); }

    const printerDefault = createHardwareAdapterFactory({ ...config, satoPrintDarkness: 0, satoPrintSpeedIps: 0 });
    const defaults = await printerDefault.prepareHardwareJob({ job, attemptId: "printer-default" });
    try {
      assert.equal((await defaults.dispatch()).printQualityConfigured, false);
      assert.deepEqual(captured.at(-1), nativeLabel);
    } finally { await defaults.cleanup(); }
    assert.deepEqual(fs.readdirSync(root), []);
    // Loading the accepted geometry still validates its original semantic hash.
    assert.equal(loadSatoJewelryLabelConfig().config.front.barcode.narrowBarDots, 1);
    console.log("OK: SATO quality control frames, unchanged barcode/layout bytes, once-per-session application and safe defaults.");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
