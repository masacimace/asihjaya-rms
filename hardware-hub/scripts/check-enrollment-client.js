const assert = require("node:assert/strict");

const {
  HardwareEnrollmentClaimError,
  claimHardwareEnrollment,
} = require("../lib/enrollment-client");

async function main() {
  const calls = [];
  const successPayload = {
    success: true,
    idempotent: false,
    enrollment: {
      id: "11111111-1111-4111-8111-111111111111",
      status: "claimed",
      claimedAt: "2026-09-16T00:00:00.000Z",
    },
    agent: {
      id: "22222222-2222-4222-8222-222222222222",
      code: "HUB-KASIR-ABC123",
      name: "Hardware Hub Kasir 01",
    },
    credential: {
      secret: "s".repeat(64),
      authMode: "signed",
      protocolMode: "v2-preferred",
    },
  };

  const result = await claimHardwareEnrollment({
    apiUrl: "https://rms.example.test/",
    installationCode: "aj-7k4p-9q2m-x6tr",
    instanceId: "33333333-3333-4333-8333-333333333333",
    machineName: "OUTLET-PC-01",
    installerVersion: "1.0.0",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(successPayload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(
    calls[0]?.url,
    "https://rms.example.test/api/hardware/v2/enrollments/claim",
  );
  assert.equal(calls[0]?.init?.method, "POST");
  const requestBody = JSON.parse(calls[0]?.init?.body ?? "{}");
  assert.equal(requestBody.installationCode, "AJ-7K4P-9Q2M-X6TR");
  assert.equal(
    requestBody.instanceId,
    "33333333-3333-4333-8333-333333333333",
  );
  assert.equal(requestBody.machineName, "OUTLET-PC-01");
  assert.equal(result.credential.secret, successPayload.credential.secret);

  await assert.rejects(
    () =>
      claimHardwareEnrollment({
        apiUrl: "https://rms.example.test",
        installationCode: "AJ-7K4P-9Q2M-X6TR",
        instanceId: "44444444-4444-4444-8444-444444444444",
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: "INSTALLATION_CODE_ALREADY_CLAIMED",
            }),
            {
              status: 409,
              headers: { "retry-after": "17" },
            },
          ),
      }),
    (error) => {
      assert.ok(error instanceof HardwareEnrollmentClaimError);
      assert.equal(error.status, 409);
      assert.equal(error.code, "INSTALLATION_CODE_ALREADY_CLAIMED");
      assert.equal(error.retryAfterSeconds, 17);
      return true;
    },
  );

  console.log("Hardware Hub enrollment client contract passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
