/* eslint-disable */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createFailureInjectionController } = require("../lib/failure-injection");
const { createHardwareAdapterFactory } = require("../lib/hardware-adapters");
const {
  SATO_LABEL_TEMPLATES,
  SATO_PRINTER_PROFILES,
  resolveSatoProfileConfiguration,
} = require("../lib/sato-label-profiles");
const { generateSatoSbpl } = require("../lib/sato-sbpl-generator");
const { SATO_GOLDEN_FIXTURES, basePayload } = require("../test/fixtures/sato-label-fixtures");

const UPDATE_GOLDEN = process.argv.includes("--update-golden");
const GOLDEN_DIR = path.resolve(__dirname, "..", "test", "golden", "sato");
const QUIET_LOGGER = { log() {}, warn() {}, error() {} };

fs.mkdirSync(GOLDEN_DIR, { recursive: true });
assert(SATO_LABEL_TEMPLATES.jewelry_compact_v1);
assert(SATO_PRINTER_PROFILES.sato_cg408tt_jewelry_v1);

for (const fixture of SATO_GOLDEN_FIXTURES) {
  const first = generateSatoSbpl(fixture.payload, {
    printerProfileId: "sato_cg408tt_jewelry_v1",
    ...fixture.options,
  });
  const second = generateSatoSbpl(fixture.payload, {
    printerProfileId: "sato_cg408tt_jewelry_v1",
    ...fixture.options,
  });
  assert(first.commandBuffer.equals(second.commandBuffer), `${fixture.name} tidak deterministik.`);
  assert.equal(first.commandSha256, second.commandSha256);
  assert(first.command.startsWith("\x1BA"));
  assert(first.command.endsWith("\x1BZ"));
  assert(first.command.includes(`\x1BQ${first.copies}`));
  assert.equal(first.printerProfile.id, "sato_cg408tt_jewelry_v1");
  assert.equal(first.printerProfile.physicalValidation, "pending");

  const goldenPath = path.join(GOLDEN_DIR, `${fixture.name}.sbpl`);
  if (UPDATE_GOLDEN || !fs.existsSync(goldenPath)) {
    fs.writeFileSync(goldenPath, first.commandBuffer);
  }
  const golden = fs.readFileSync(goldenPath);
  assert(
    golden.equals(first.commandBuffer),
    `${fixture.name} berbeda dari golden file. Jalankan npm run update:golden:sato hanya jika perubahan disengaja.`,
  );
}

assert.throws(
  () => generateSatoSbpl(basePayload({ fields: { barcode: "lowercase" } })),
  (error) => error?.code === "SATO_BARCODE_INVALID",
);
assert.throws(
  () => generateSatoSbpl({ ...basePayload(), templateId: "unknown-template" }),
  (error) => error?.code === "UNKNOWN_LABEL_TEMPLATE",
);
assert.throws(
  () =>
    generateSatoSbpl(
      { ...basePayload(), printerProfileId: "unknown-profile" },
      { printerProfileId: "sato_cg408tt_jewelry_v1" },
    ),
  (error) => error?.code === "SATO_PRINTER_PROFILE_MISMATCH",
);
assert.throws(
  () =>
    resolveSatoProfileConfiguration({
      printerProfileId: "sato_cg408tt_jewelry_v1",
      horizontalOffsetDots: -100,
    }) &&
    generateSatoSbpl(basePayload(), {
      printerProfileId: "sato_cg408tt_jewelry_v1",
      horizontalOffsetDots: -100,
    }),
  (error) => error?.code === "SATO_LAYOUT_OUT_OF_BOUNDS",
);

async function checkFakeArtifactMetadata() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-sato-pr9-"));
  const outputDir = path.join(root, "output");
  const controller = createFailureInjectionController({
    enabled: true,
    outputDir,
    defaultScenario: "success",
    logger: QUIET_LOGGER,
  });
  const factory = createHardwareAdapterFactory({
    agentVersion: "sato-pr9-check",
    agentId: "00000000-0000-4000-8000-000000000099",
    agentSecret: `test-${"x".repeat(40)}`,
    apiUrl: "http://127.0.0.1:3000",
    dryRun: false,
    dryRunOutputDir: outputDir,
    tempDir: path.join(root, "temp"),
    adapterModes: {
      label_printer: "fake",
      document_printer: "fake",
      cash_drawer: "fake",
    },
    failureController: controller,
    labelPrinterName: "",
    documentPrinterName: "",
    cashDrawerPrinterName: "",
    requestTimeoutMs: 3000,
    printCommandTimeoutMs: 5000,
    satoTemplateId: "jewelry_compact_v1",
    satoPrinterProfileId: "sato_cg408tt_jewelry_v1",
    satoCopies: 1,
    satoHorizontalOffsetDots: 0,
    satoVerticalOffsetDots: 0,
    satoIncludePrice: false,
    satoPrintSpeed: null,
    satoDarkness: null,
    satoMediaWidthDots: null,
    satoMediaHeightDots: null,
    logger: QUIET_LOGGER,
  });
  const job = {
    id: "00000000-0000-4000-8000-000000000098",
    jobType: "print_label_sato",
    deviceType: "label_printer",
    payload: basePayload(),
  };
  const attemptId = "00000000-0000-4000-8000-000000000097";
  const prepared = await factory.prepareHardwareJob({ job, attemptId });
  const result = await prepared.dispatch();
  const metadata = JSON.parse(fs.readFileSync(result.metadataFile, "utf8"));
  assert.equal(metadata.template.id, "jewelry_compact_v1");
  assert.equal(metadata.printerProfile.id, "sato_cg408tt_jewelry_v1");
  assert.equal(metadata.printerProfile.dpi, 203);
  assert.equal(metadata.printerProfile.physicalValidation, "pending");
  assert.match(metadata.commandSha256, /^[0-9a-f]{64}$/);
  assert.equal(metadata.bytes, fs.statSync(result.outputFile).size);
  fs.rmSync(root, { recursive: true, force: true });
}

checkFakeArtifactMetadata()
  .then(() => {
    console.log(
      `OK: SATO CG408TT profile, ${SATO_GOLDEN_FIXTURES.length} golden files, validation, dan fake artifact metadata lulus.`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
