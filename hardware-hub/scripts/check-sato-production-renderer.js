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
assert.equal(loaded.config.id, "sato_cg408_jewelry_barbell_host_bold_v2");
assert.equal(loaded.config.version, 2);
assert.equal(loaded.config.font.family, "Arial Narrow");
assert.equal(loaded.config.font.style, "Bold");
assert.equal(loaded.config.front.productName.x, 105);
assert.equal(loaded.config.front.productName.fontPx, 14);
assert.equal(loaded.config.front.barcode.x, 115);
assert.equal(loaded.config.front.barcode.strategy, "CODE128_B");
assert.equal(loaded.config.front.barcode.heightDots, 38);
assert.equal(loaded.config.front.barcodeText.y, 69);
assert.equal(loaded.config.front.barcodeText.fontPx, 21);
assert.equal(loaded.config.back.x, 98);
assert.equal(loaded.config.back.rotation, 180);
assert.equal(loaded.config.back.weight.fontPx, 29);
assert.equal(loaded.config.back.purity.fontPx, 21);
assert(fs.existsSync(renderScript), "production SATO renderer PowerShell wajib tersedia");

const payload = {
  schemaVersion: 1,
  templateId: SATO_JEWELRY_LABEL_TEMPLATE_ID,
  templateVersion: 2,
  printerProfileId: SATO_JEWELRY_LABEL_PROFILE_ID,
  copies: 1,
  fields: {
    sku: "AJ00000006",
    barcode: "AJ00000006",
    productName: "Nama Produk Master",
    weightGram: "6.050",
    purityPercent: "66.7",
    exchangePurityPercent: "60.000",
    size: null,
    color: null,
    gemstone: null,
    sellingAmount: null,
  },
};
const prepared = prepareSatoJewelryLabel(payload, { configPath, copies: 1 });
assert.equal(prepared.template.id, SATO_JEWELRY_LABEL_TEMPLATE_ID);
assert.equal(prepared.profile.id, SATO_JEWELRY_LABEL_PROFILE_ID);
assert.equal(prepared.profile.renderer, "host_bold_bmp_v2");
assert.equal(prepared.profile.physicalValidation, "accepted");
assert.deepEqual(prepared.renderInput, {
  productName: "NAMA PRODUK MASTER",
  barcode: "AJ00000006",
  weight: "6.05Gr",
  purity: "16K-60%",
  copies: 1,
});
assert.equal(prepared.label.templateId, SATO_JEWELRY_LABEL_TEMPLATE_ID);
assert.equal(prepared.label.printerProfileId, SATO_JEWELRY_LABEL_PROFILE_ID);
assert.match(prepared.fakeCommandSha256, /^[0-9a-f]{64}$/);
assert.throws(
  () => prepareSatoJewelryLabel({ ...payload, templateId: "jewelry_compact_v1", templateVersion: 1 }, { configPath }),
  (error) => error?.code === "SATO_INGRESS_TEMPLATE_UNSUPPORTED",
);
assert.throws(
  () => prepareSatoJewelryLabel({ ...payload, printerProfileId: "sato_cg408tt_jewelry_v1" }, { configPath }),
  (error) => error?.code === "SATO_INGRESS_PROFILE_UNSUPPORTED",
);

async function checkFakeProductionMetadata() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-sato-b2b2-"));
  try {
    const outputDir = path.join(root, "output");
    const controller = createFailureInjectionController({
      enabled: true,
      outputDir,
      defaultScenario: "success",
      logger: QUIET_LOGGER,
    });
    const factory = createHardwareAdapterFactory({
      agentVersion: "b2b2-check",
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
    assert.equal(metadata.printerProfile.renderer, "host_bold_bmp_v2");
    assert.equal(metadata.printerProfile.physicalValidation, "accepted");
    assert.equal(metadata.label.barcode, "AJ00000006");
    assert.equal(metadata.label.weightPrinted, "6.05Gr");
    assert.equal(metadata.label.purityPrinted, "16K-60%");
    assert.equal(metadata.bytes, fs.statSync(result.outputFile).size);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

checkFakeProductionMetadata()
  .then(() => console.log("OK: B2B.2 strict single-profile SATO production renderer checks passed."))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
