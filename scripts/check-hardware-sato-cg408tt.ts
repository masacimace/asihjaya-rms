import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildInventoryLabelPayloadV2,
  INVENTORY_LABEL_TEMPLATE_V1,
  SATO_CG408TT_LABEL_PROFILE_V1,
} from "@/lib/hardware/job-payload-contracts-v2";

const payload = buildInventoryLabelPayloadV2({
  itemId: "00000000-0000-4000-8000-000000000001",
  copies: 2,
  sku: "AJ-0001",
  barcode: "AJ00000001",
  productName: "CINCIN EMAS ASIHJAYA",
  weightGram: "2.350",
  purityPercent: "75",
  exchangePurityPercent: "70",
  size: "12",
  color: "Kuning",
  gemstone: "Zircon",
  sellingAmount: "1850000",
});

assert.equal(payload.templateId, INVENTORY_LABEL_TEMPLATE_V1);
assert.equal(payload.templateVersion, 1);
assert.equal(payload.printerProfileId, SATO_CG408TT_LABEL_PROFILE_V1);
assert.equal(payload.copies, 2);
assert.equal(payload.fields.barcode, "AJ00000001");

assert.throws(
  () =>
    buildInventoryLabelPayloadV2({
      ...payload.fields,
      itemId: payload.itemId,
      copies: 1,
      barcode: "barcode-lowercase",
    }),
  /CODE39 uppercase/,
);

const root = process.cwd();
const adapterSource = fs.readFileSync(
  path.join(root, "hardware-hub/lib/hardware-adapters.js"),
  "utf8",
);
const generatorSource = fs.readFileSync(
  path.join(root, "hardware-hub/lib/sato-sbpl-generator.js"),
  "utf8",
);
const fakeSource = fs.readFileSync(
  path.join(root, "hardware-hub/lib/fake-hardware-adapters.js"),
  "utf8",
);

assert.match(adapterSource, /generateSatoSbpl/);
assert.doesNotMatch(adapterSource, /createSatoBuilder/);
assert.match(generatorSource, /SATO_BARCODE_INVALID/);
assert.match(generatorSource, /commandSha256/);
assert.match(fakeSource, /printerProfile/);
assert.match(fakeSource, /commandSha256/);

console.log("OK: Protocol v2 secure SATO label payload and agent integration checks passed.");
