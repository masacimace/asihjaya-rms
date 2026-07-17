/* eslint-disable */
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  buildDpapiScript,
  createSecretProtector,
} = require("../lib/secret-protector");

function createFakePowerShell() {
  const scripts = [];
  return {
    scripts,
    spawnSyncImpl(_executable, args, options) {
      const script = args[args.length - 1];
      scripts.push(script);
      if (script.includes("::Protect(")) {
        return {
          status: 0,
          stdout: Buffer.from(`encrypted:${options.input}`, "utf8").toString("base64"),
          stderr: "",
        };
      }
      if (script.includes("::Unprotect(")) {
        const decoded = Buffer.from(String(options.input).trim(), "base64").toString("utf8");
        return {
          status: 0,
          stdout: decoded.replace(/^encrypted:/, ""),
          stderr: "",
        };
      }
      return { status: 1, stdout: "", stderr: "Unexpected test script" };
    },
  };
}

function testGeneratedPowerShellUsesExplicitAssemblyAndTypes() {
  for (const operation of ["protect", "unprotect"]) {
    const script = buildDpapiScript(operation);
    assert.match(script, /Add-Type -AssemblyName/);
    assert.match(script, /System\.Security\.Cryptography\.ProtectedData/);
    assert.match(script, /System\.Security\.Cryptography\.DataProtectionScope/);
    assert.match(script, /System\.Security/);
  }
}

function testWindowsProtectorRoundTripWithMockPowerShell() {
  const fake = createFakePowerShell();
  const protector = createSecretProtector({
    platform: "win32",
    powershellExecutable: "powershell-test.exe",
    spawnSyncImpl: fake.spawnSyncImpl,
  });
  const report = protector.selfTest();
  assert.equal(report.ok, true);
  assert.equal(report.kind, "windows-dpapi-current-user");
  assert.equal(fake.scripts.length, 2);
}

function runRealWindowsCheck() {
  if (process.platform !== "win32") {
    console.log("SKIP: real Windows DPAPI check hanya dijalankan pada Windows.");
    return;
  }

  const executable = process.env.HARDWARE_POWERSHELL_EXECUTABLE?.trim() || "powershell.exe";
  const scriptPath = path.join(__dirname, "check-windows-dpapi.ps1");
  const result = spawnSync(
    executable,
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
    { encoding: "utf8", windowsHide: true, timeout: 30_000 },
  );

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    throw new Error(
      `Real Windows DPAPI check gagal: ${result.error?.message || result.stderr || `exit ${result.status}`}`,
    );
  }
}

testGeneratedPowerShellUsesExplicitAssemblyAndTypes();
testWindowsProtectorRoundTripWithMockPowerShell();
runRealWindowsCheck();
console.log("OK: DPAPI hotfix and startup self-test checks passed.");
