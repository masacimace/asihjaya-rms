import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readBarcodes } from "zxing-wasm/reader";

import {
  buildInventoryLabelPayloadV2,
  INVENTORY_LABEL_TEMPLATE_V2,
  SATO_CG408_LABEL_PROFILE_V2,
  SHORT_LABEL_TEMPLATE,
  assertHardwareJobPayloadV2,
  buildHardwareTestPayloadV2,
} from "@/lib/hardware/job-payload-contracts-v2";

const payload = buildInventoryLabelPayloadV2({
  itemId: "00000000-0000-4000-8000-000000000001",
  copies: 2,
  sku: "AJ-0001",
  barcode: "AJ00000001",
  masterProductName: "CINCIN EMAS ASIHJAYA",
  itemDisplayName: "CINCIN EMAS ASIHJAYA ITEM 001",
  weightGram: "2.350",
  purityPercent: "75",
  exchangePurityPercent: "70",
  size: "12",
  color: "Kuning",
  gemstone: "Zircon",
  sellingAmount: "1850000",
});

assert.equal(payload.templateId, INVENTORY_LABEL_TEMPLATE_V2);
assert.equal(payload.templateVersion, 3);
assert.equal(payload.printerProfileId, SATO_CG408_LABEL_PROFILE_V2);
assert.equal(payload.copies, 2);
assert.equal(payload.fields.barcode, "AJ00000001");
assert.equal(payload.fields.masterProductName, "CINCIN EMAS ASIHJAYA");
assert.equal(payload.fields.itemDisplayName, "CINCIN EMAS ASIHJAYA ITEM 001");

assert.throws(
  () =>
    buildInventoryLabelPayloadV2({
      ...payload.fields,
      itemId: payload.itemId,
      copies: 1,
      barcode: "barcode-lowercase",
    }),
  /CODE128 uppercase/,
);

const short = buildInventoryLabelPayloadV2({ ...payload.fields, itemId: payload.itemId, copies: 1, labelBarcode: "000001" });
assert.equal(short.templateId, SHORT_LABEL_TEMPLATE);
assert.equal(short.templateVersion, 4);
assert.equal(short.fields.barcode, "AJ00000001");
for (const invalid of ["12345", "1234567", "12+345", "ABCDEF", " 123456"]) {
  assert.throws(() => buildInventoryLabelPayloadV2({ ...payload.fields, itemId: payload.itemId, copies: 1, labelBarcode: invalid }), TypeError);
}
assert.throws(() => assertHardwareJobPayloadV2("print_label_sato", { ...short, templateVersion: 3 }));
assert.throws(() => assertHardwareJobPayloadV2("print_label_sato", { ...payload, fields: { ...payload.fields, labelBarcode: "000001" } }));
const testInput = { jobType: "test_label_printer" as const, agentId: payload.itemId, requestedAt: new Date() };
const legacyTest = buildHardwareTestPayloadV2(testInput);
const aliasTest = buildHardwareTestPayloadV2({ ...testInput, shortLabelSupported: true });
assert.equal("templateVersion" in legacyTest && legacyTest.templateVersion, 3);
assert.equal("templateVersion" in aliasTest && aliasTest.templateVersion, 4);

// Decode ideal digital patterns at the exact proposed dot dimensions. Actual
// outlet print quality/camera focus still require physical acceptance.
const require = createRequire(import.meta.url);
const Code128C = require("jsbarcode").getModule("CODE128C") as new (value: string, options: object) => { encode(): { data: string } };
for (const value of ["000001", "013447", "999999"]) {
  const pattern = new Code128C(value, {}).encode().data;
  assert.equal(pattern.length, 68);
  const width = 2 * pattern.length + 40, height = 61;
  assert.equal(width, 176);
  assert.ok(width <= 182);
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let x = 0; x < pattern.length; x++) {
    if (pattern[x] !== "1") continue;
    for (let y = 10; y < 51; y++) for (let dx = 0; dx < 2; dx++) {
      const offset = (y * width + 20 + x * 2 + dx) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 0;
    }
  }
  const decoded = await readBarcodes({ data, width, height } as ImageData, { formats: ["Code128"] });
  assert.equal(decoded[0]?.text, value);
}
console.log("Inventory label payload + V4 six-digit aliases + exact-size digital Code128 C decoding checks passed.");
