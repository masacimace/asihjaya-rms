const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  getOrCreateInstallerInstanceId,
  loadHardwareCredential,
} = require("../lib/credential-store");
const {
  enrollHardwareHubInstaller,
  resolveStatePaths,
  resumeHardwareHubEnrollment,
} = require("../lib/installer-enrollment");

const ENROLLMENT_ID = "11111111-1111-4111-8111-111111111111";
const AGENT_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "secure-agent-secret-" + "s".repeat(48);

const protector = {
  kind: "test-protector",
  protect(value) {
    return `test:v1:${Buffer.from(String(value), "utf8").toString("base64")}`;
  },
  unprotect(value) {
    const prefix = "test:v1:";
    assert.ok(String(value).startsWith(prefix));
    return Buffer.from(String(value).slice(prefix.length), "base64").toString("utf8");
  },
};

function makeFetch(calls) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/api/hardware/v2/enrollments/claim")) {
      const body = JSON.parse(init.body);
      assert.equal(body.installationCode, "AJ-7K4P-9Q2M-X6TR");
      assert.match(body.instanceId, /^[0-9a-f-]{36}$/);
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: false,
          enrollment: {
            id: ENROLLMENT_ID,
            status: "claimed",
            claimedAt: "2026-09-16T00:00:00.000Z",
          },
          agent: {
            id: AGENT_ID,
            code: "HUB-KASIR-TEST",
            name: "Hardware Hub Kasir Test",
          },
          credential: {
            secret: SECRET,
            authMode: "signed",
            protocolMode: "v2-preferred",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (String(url).endsWith("/api/hardware/v2/enrollments/complete")) {
      const body = JSON.parse(init.body);
      assert.equal(body.enrollmentId, ENROLLMENT_ID);
      assert.equal(init.headers["x-hardware-agent-id"], AGENT_ID);
      assert.equal(init.headers["x-hardware-auth-version"], "2");
      assert.ok(init.headers["x-hardware-signature"]);
      assert.ok(init.headers["x-hardware-content-sha256"]);
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: false,
          enrollment: {
            id: ENROLLMENT_ID,
            status: "completed",
            claimedAt: "2026-09-16T00:00:00.000Z",
            completedAt: "2026-09-16T00:01:00.000Z",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error(`Unexpected URL: ${url}`);
  };
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-secure-enrollment-"));
  try {
    const paths = resolveStatePaths(tempRoot);
    const firstInstance = getOrCreateInstallerInstanceId({
      instancePath: paths.instancePath,
    });
    const secondInstance = getOrCreateInstallerInstanceId({
      instancePath: paths.instancePath,
    });
    assert.equal(firstInstance, secondInstance, "instance ID harus persistent");

    const calls = [];
    const result = await enrollHardwareHubInstaller({
      apiUrl: "https://rms.example.test",
      installationCode: "AJ-7K4P-9Q2M-X6TR",
      stateDir: tempRoot,
      machineName: "OUTLET-PC-01",
      installerVersion: "1.0.0-stage4",
      fetchImpl: makeFetch(calls),
      protector,
    });

    assert.equal(result.credentialPersisted, true);
    assert.equal(result.completion.enrollment.status, "completed");
    assert.equal(calls.length, 2, "fresh enrollment harus claim lalu complete");

    const rawCredentialFile = fs.readFileSync(paths.credentialPath, "utf8");
    assert.ok(!rawCredentialFile.includes(SECRET), "secret plaintext tidak boleh tersimpan");
    assert.ok(
      !rawCredentialFile.includes("AJ-7K4P-9Q2M-X6TR"),
      "Installation Code tidak boleh dipersist",
    );
    assert.ok(rawCredentialFile.includes("test:v1:"));

    const loaded = loadHardwareCredential({
      credentialPath: paths.credentialPath,
      credentialKeyPath: paths.credentialKeyPath,
      protector,
    });
    assert.equal(loaded.agentId, AGENT_ID);
    assert.equal(loaded.secret, SECRET);
    assert.equal(loaded.instanceId, firstInstance);

    const resumeCalls = [];
    const resumed = await resumeHardwareHubEnrollment({
      stateDir: tempRoot,
      installerVersion: "1.0.1-stage4",
      fetchImpl: makeFetch(resumeCalls),
      protector,
    });
    assert.equal(resumed.resumed, true);
    assert.equal(resumeCalls.length, 1, "resume hanya boleh mengirim completion ACK");
    assert.ok(resumeCalls[0].url.endsWith("/api/hardware/v2/enrollments/complete"));

    console.log("Hardware Hub secure enrollment persistence contract passed.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
