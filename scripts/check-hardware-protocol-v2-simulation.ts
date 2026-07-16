import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const failureInjection = read("hardware-hub/lib/failure-injection.js");
const fakeAdapters = read("hardware-hub/lib/fake-hardware-adapters.js");
const runner = read("hardware-hub/lib/protocol-v2-runner.js");
const agent = read("hardware-hub/agent.js");
const envExample = read("hardware-hub/.env.example");
const packageJson = JSON.parse(read("hardware-hub/package.json")) as {
  scripts?: Record<string, string>;
};

for (const scenario of [
  "success",
  "fail_before_dispatch",
  "timeout_before_dispatch",
  "printer_not_found",
  "slow_execution",
  "unknown_after_dispatch",
  "crash_after_dispatch",
  "success_then_ack_lost",
]) {
  assert.match(failureInjection, new RegExp(`\\"${scenario}\\"`));
}

assert.match(fakeAdapters, /FAKE_DUPLICATE_DISPATCH_DETECTED|writeExclusive/);
assert.match(fakeAdapters, /label\.sbpl/);
assert.match(fakeAdapters, /document\.pdf/);
assert.match(fakeAdapters, /drawer\.json/);
assert.match(runner, /simulatedAgentCrash/);
assert.match(agent, /HARDWARE_ADAPTER_MODE/);
assert.match(agent, /failureController\.createProtocolClient/);
assert.match(envExample, /FAKE_HARDWARE_SCENARIO=success/);
assert.equal(
  packageJson.scripts?.["check:simulation"],
  "node scripts/run-failure-injection-harness.js",
);

execFileSync(process.execPath, [
  path.join(root, "hardware-hub", "scripts", "run-failure-injection-harness.js"),
], {
  cwd: path.join(root, "hardware-hub"),
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_NO_WARNINGS: "1",
  },
});

console.log("OK: Hardware Protocol v2 fake adapters and failure-injection harness checks passed.");
