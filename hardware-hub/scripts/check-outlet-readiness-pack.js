/* eslint-disable */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  parseEnv,
  updateEnvContent,
  assertRealDeviceReady,
} = require("../lib/outlet-operations");
const { generateFixtures } = require("./generate-outlet-fixtures");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-outlet-readiness-"));
try {
  const envText = [
    "LABEL_PRINTER_ADAPTER=fake",
    "DOCUMENT_PRINTER_ADAPTER=fake",
    "CASH_DRAWER_ADAPTER=fake",
    "LABEL_PRINTER_NAME=SATO CG408TT",
    "",
  ].join("\n");
  const updated = updateEnvContent(envText, {
    LABEL_PRINTER_ADAPTER: "real",
    DOCUMENT_PRINTER_ADAPTER: "fake",
  });
  const parsed = parseEnv(updated);
  assert.equal(parsed.LABEL_PRINTER_ADAPTER, "real");
  assert.equal(parsed.DOCUMENT_PRINTER_ADAPTER, "fake");
  assert.equal(parsed.CASH_DRAWER_ADAPTER, "fake");

  assert.throws(
    () => assertRealDeviceReady("drawer", {}, tempRoot),
    /Cash drawer real diblokir/,
  );

  const fixtureOutput = path.join(tempRoot, "fixtures");
  const generated = generateFixtures({ outputRoot: fixtureOutput, now: new Date("2026-07-18T10:00:00Z") });
  const expectedFiles = [
    "sato-alignment.sbpl",
    "sato-barcode-code39.sbpl",
    "epson-a4-landscape-validation.pdf",
    "fixture-manifest.json",
    "README.txt",
  ];
  for (const file of expectedFiles) assert.ok(fs.existsSync(path.join(generated.destination, file)), file);
  const pdf = fs.readFileSync(path.join(generated.destination, "epson-a4-landscape-validation.pdf"));
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.match(pdf.toString("latin1"), /\/MediaBox \[0 0 841\.89 595\.28\]/);
  assert.equal(generated.manifest.epson.pages, 2);
  assert.equal(generated.manifest.sato.physicalValidation, "pending");

  console.log("[PASS] Adapter env updates preserve unrelated settings.");
  console.log("[PASS] Cash drawer real activation is blocked by default.");
  console.log("[PASS] Deterministic SATO and Epson outlet fixtures are generated.");
  console.log("[PASS] Epson fixture is a two-page A4 landscape PDF.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
