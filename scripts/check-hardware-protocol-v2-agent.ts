import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { hashHardwareJobPayloadV2 } from "@/lib/hardware/job-payload-v2";

const require = createRequire(import.meta.url);
const { hashCanonicalJson } = require(
  path.resolve(process.cwd(), "hardware-hub/lib/canonical-json.js"),
) as {
  hashCanonicalJson(value: unknown): string;
};

const fixtures: unknown[] = [
  {
    schemaVersion: 1,
    templateId: "jewelry_compact_v1",
    templateVersion: 1,
    printerProfileId: "sato_cg408tt_jewelry_v1",
    copies: 1,
    fields: {
      sku: "SKU-001",
      barcode: "899000000001",
      name: "Cincin Emas",
      weightGram: "2.35",
      price: 3_500_000,
    },
  },
  {
    z: [3, 2, 1],
    a: {
      nested: true,
      nullable: null,
      negativeZero: -0,
    },
  },
];

for (const fixture of fixtures) {
  assert.equal(
    hashHardwareJobPayloadV2(fixture),
    hashCanonicalJson(fixture),
    "Server dan Windows agent harus menghasilkan canonical payload hash yang sama.",
  );
}

const result = spawnSync(
  process.execPath,
  [path.resolve(process.cwd(), "hardware-hub/scripts/check-crash-safe-agent.js")],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("OK: Protocol v2 server/agent canonical payload hash parity passed.");
