/* eslint-disable */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createFailureInjectionController } = require("../lib/failure-injection");
const { createHardwareAdapterFactory } = require("../lib/hardware-adapters");
const {
  SATO_JEWELRY_LABEL_TEMPLATE_ID,
  SATO_JEWELRY_LABEL_PROFILE_ID,
  loadSatoJewelryLabelConfig,
  prepareSatoJewelryLabel,
} = require("../lib/sato-jewelry-label");

const QUIET_LOGGER = { log() {}, info() {}, warn() {}, error() {} };
const configPath = path.resolve(__dirname, "..", "config", "sato-jewelry-barbell-host-bold.json");
const renderScript = path.resolve(__dirname, "render-sato-jewelry-label.ps1");

const loaded = loadSatoJewelryLabelConfig(configPath);
assert.equal(loaded.config.id, "sato_cg408_jewelry_barbell_inter_v3");
assert.equal(loaded.config.version, 3);
assert.equal(loaded.config.font.family, "Inter");
assert.equal(loaded.config.font.filePathEnv, "SATO_LABEL_FONT_PATH");

// The exact client-approved coordinates/font sizes are frozen by SHA-256 lock,
// not duplicated here. This keeps the user's final fine-tuning as the authority.
assert.equal(loaded.config.physicalValidation, "accepted");
assert.equal(loaded.lock.schemaVersion, 1);
assert.equal(loaded.lock.templateId, SATO_JEWELRY_LABEL_TEMPLATE_ID);
assert.equal(loaded.lock.templateVersion, 3);
assert.equal(loaded.lock.printerProfileId, SATO_JEWELRY_LABEL_PROFILE_ID);
assert.equal(loaded.lock.renderer, "host_inter_bmp_v3");
assert.equal(loaded.lock.physicalValidation, "accepted");
assert.equal(loaded.lock.barcode.strategy, "CODE128_B");
assert.deepEqual(loaded.lock.frontContent, ["productMasterName", "barcode", "barcodeNumber"]);
assert.deepEqual(loaded.lock.backContent, ["weight", "itemDisplayName"]);
assert.equal(Object.hasOwn(loaded.config.back, "purity"), false);
assert(fs.existsSync(renderScript), "production SATO renderer PowerShell wajib tersedia");

const payload = {
  schemaVersion: 1,
  templateId: SATO_JEWELRY_LABEL_TEMPLATE_ID,
  templateVersion: 3,
  printerProfileId: SATO_JEWELRY_LABEL_PROFILE_ID,
  copies: 1,
  fields: {
    sku: "AJ0002416",
    barcode: "AJ0002416",
    masterProductName: "Giwang KB Keroncong 16K",
    itemDisplayName: "Giwang KB MP 1 Gigi 4 + Ulir Gr.099 - 16K/700",
    weightGram: "2.750",
    // Purity fields remain ingress-compatible but are intentionally not rendered.
    purityPercent: "75",
    exchangePurityPercent: "83",
    size: null,
    color: null,
    gemstone: null,
    sellingAmount: null,
  },
};

const prepared = prepareSatoJewelryLabel(payload, { configPath, copies: 1 });
assert.equal(prepared.template.id, SATO_JEWELRY_LABEL_TEMPLATE_ID);
assert.equal(prepared.template.version, 3);
assert.equal(prepared.profile.id, SATO_JEWELRY_LABEL_PROFILE_ID);
assert.equal(prepared.profile.renderer, "host_inter_bmp_v3");
assert.equal(prepared.profile.physicalValidation, "accepted");
assert.deepEqual(prepared.renderInput, {
  masterProductName: "GIWANG KB KERONCONG 16K",
  itemDisplayName: "GIWANG KB MP 1 GIGI 4 + ULIR GR.099 - 16K/700",
  barcode: "AJ0002416",
  weight: "2.75 Gr",
  copies: 1,
});
assert.equal(prepared.label.masterProductNamePrinted, "GIWANG KB KERONCONG 16K");
assert.equal(prepared.label.itemDisplayNamePrinted, "GIWANG KB MP 1 GIGI 4 + ULIR GR.099 - 16K/700");
assert.equal(prepared.label.weightPrinted, "2.75 Gr");
assert.equal(Object.hasOwn(prepared.label, "purityPrinted"), false);
assert.equal(prepared.label.templateId, SATO_JEWELRY_LABEL_TEMPLATE_ID);
assert.equal(prepared.label.printerProfileId, SATO_JEWELRY_LABEL_PROFILE_ID);
assert.match(prepared.fakeCommandSha256, /^[0-9a-f]{64}$/);

// Purity is no longer a print requirement for the revised client label.
const withoutPurity = prepareSatoJewelryLabel(
  {
    ...payload,
    fields: {
      ...payload.fields,
      purityPercent: null,
      exchangePurityPercent: null,
    },
  },
  { configPath, copies: 1 },
);
assert.equal(withoutPurity.renderInput.weight, "2.75 Gr");
assert.equal(Object.hasOwn(withoutPurity.renderInput, "purity"), false);

assert.throws(
  () => prepareSatoJewelryLabel({ ...payload, templateId: "jewelry_barbell_host_bold_v2", templateVersion: 2 }, { configPath }),
  (error) => error?.code === "SATO_INGRESS_TEMPLATE_UNSUPPORTED",
);
assert.throws(
  () => prepareSatoJewelryLabel({ ...payload, printerProfileId: "sato_cg408_jewelry_barbell_host_bold_v2" }, { configPath }),
  (error) => error?.code === "SATO_INGRESS_PROFILE_UNSUPPORTED",
);

async function checkFakeProductionMetadata() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-sato-v3-frozen-"));
  try {
    const outputDir = path.join(root, "output");
    const controller = createFailureInjectionController({
      enabled: true,
      outputDir,
      defaultScenario: "success",
      logger: QUIET_LOGGER,
    });
    const factory = createHardwareAdapterFactory({
      agentVersion: "label-v3-frozen-check",
      apiUrl: "http://127.0.0.1:3000",
      dryRun: false,
      dryRunOutputDir: outputDir,
      tempDir: path.join(root, "temp"),
      adapterModes: { label_printer: "fake", document_printer: "fake", cash_drawer: "fake" },
      failureController: controller,
      labelPrinterName: "",
      documentPrinterName: "",
      cashDrawerPrinterName: "",
      requestTimeoutMs: 3000,
      printCommandTimeoutMs: 5000,
      powershellExecutable: "powershell.exe",
      satoLabelConfigPath: configPath,
      satoCopies: 1,
      logger: QUIET_LOGGER,
    });
    const job = {
      id: "00000000-0000-4000-8000-000000000198",
      jobType: "print_label_sato",
      deviceType: "label_printer",
      payload,
    };
    const preparedJob = await factory.prepareHardwareJob({
      job,
      attemptId: "00000000-0000-4000-8000-000000000197",
    });
    const result = await preparedJob.dispatch();
    const metadata = JSON.parse(fs.readFileSync(result.metadataFile, "utf8"));
    assert.equal(metadata.template.id, SATO_JEWELRY_LABEL_TEMPLATE_ID);
    assert.equal(metadata.printerProfile.id, SATO_JEWELRY_LABEL_PROFILE_ID);
    assert.equal(metadata.printerProfile.renderer, "host_inter_bmp_v3");
    assert.equal(metadata.printerProfile.physicalValidation, "accepted");
    assert.equal(metadata.label.barcode, "AJ0002416");
    assert.equal(metadata.label.weightPrinted, "2.75 Gr");
    assert.equal(Object.hasOwn(metadata.label, "purityPrinted"), false);
    assert.equal(metadata.bytes, fs.statSync(result.outputFile).size);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

checkFakeProductionMetadata()
  .then(() => console.log("OK: SATO Label V3 client-approved frozen contract checks passed."))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
