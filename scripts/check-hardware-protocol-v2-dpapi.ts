import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const secretProtector = read("hardware-hub/lib/secret-protector.js");
const agent = read("hardware-hub/agent.js");
const configCheck = read("hardware-hub/scripts/check-config.js");
const powershellCheck = read("hardware-hub/scripts/check-windows-dpapi.ps1");
const packageJson = JSON.parse(read("hardware-hub/package.json")) as {
  scripts?: Record<string, string>;
};

assert.match(secretProtector, /Add-Type -AssemblyName/);
assert.match(secretProtector, /System\.Security\.Cryptography\.ProtectedData/);
assert.match(secretProtector, /System\.Security\.Cryptography\.DataProtectionScope/);
assert.match(secretProtector, /selfTest\(\)/);
assert.match(agent, /Protocol v2 startup self-test gagal/);
assert.match(agent, /process\.exit\(78\)/);
assert.match(agent, /Secret protector self-test: OK/);
assert.match(configCheck, /Secret protector startup self-test gagal/);
assert.match(powershellCheck, /Round-trip test\s+: OK/);
assert.equal(packageJson.scripts?.["check:dpapi"], "node scripts/check-dpapi-hotfix.js");

execFileSync(process.execPath, [
  path.join(root, "hardware-hub", "scripts", "check-dpapi-hotfix.js"),
], {
  cwd: path.join(root, "hardware-hub"),
  stdio: "inherit",
});

console.log("OK: Hardware Protocol v2 Windows DPAPI startup hotfix checks passed.");
