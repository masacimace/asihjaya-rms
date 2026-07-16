import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { NextRequest } from "next/server";

import {
  createHardwareJobLease,
  getHardwareJobLeaseExpiresAt,
  hashHardwareJobLeaseToken,
  isHardwareJobLeaseExpired,
  verifyHardwareJobLeaseToken,
} from "@/lib/hardware/job-lease-v2";
import {
  doesHardwareJobAttemptRequireLiveLease,
  getClaimableHardwareCapabilities,
  getEnabledHardwareCapabilities,
  getHardwareJobRetryAvailableAt,
  getHardwareJobRetryBackoffMs,
} from "@/lib/hardware/job-protocol-v2";
import { HardwareJobProtocolV2Error } from "@/lib/hardware/job-protocol-v2-error";
import {
  assertHardwareProtocolV2Request,
  parseHardwareJobAttemptV2Event,
  parseHardwareJobClaimV2Body,
} from "@/lib/hardware/job-protocol-v2-http";

async function main() {
  const now = new Date("2026-07-16T10:00:00.000Z");
  const lease = createHardwareJobLease(now);

  assert.equal(lease.token.length > 40, true);
  assert.equal(lease.tokenHash, hashHardwareJobLeaseToken(lease.token));
  assert.equal(verifyHardwareJobLeaseToken(lease.token, lease.tokenHash), true);
  assert.equal(
    verifyHardwareJobLeaseToken(`${lease.token}-invalid`, lease.tokenHash),
    false,
  );
  assert.equal(
    lease.expiresAt.toISOString(),
    "2026-07-16T10:01:00.000Z",
  );
  assert.equal(
    getHardwareJobLeaseExpiresAt(now).toISOString(),
    "2026-07-16T10:01:00.000Z",
  );
  assert.equal(isHardwareJobLeaseExpired(lease.expiresAt, now), false);
  assert.equal(
    isHardwareJobLeaseExpired(
      lease.expiresAt,
      new Date("2026-07-16T10:01:00.000Z"),
    ),
    true,
  );

  assert.deepEqual(
    getEnabledHardwareCapabilities({
      print_label_sato: true,
      print_receipt_certificate: true,
      open_cash_drawer: false,
    }),
    ["print_label_sato", "print_document_pdf"],
  );
  assert.deepEqual(
    getClaimableHardwareCapabilities({
      storedCapabilities: {
        print_label_sato: true,
        print_document_pdf: true,
      },
      requestedCapabilities: ["print_document_pdf", "open_cash_drawer"],
    }),
    ["print_document_pdf"],
  );

  assert.equal(getHardwareJobRetryBackoffMs(1), 5_000);
  assert.equal(getHardwareJobRetryBackoffMs(2), 15_000);
  assert.equal(getHardwareJobRetryBackoffMs(5), 300_000);
  assert.equal(getHardwareJobRetryBackoffMs(99), 300_000);
  assert.equal(
    getHardwareJobRetryAvailableAt({ attemptNumber: 3, now }).toISOString(),
    "2026-07-16T10:00:45.000Z",
  );
  assert.equal(doesHardwareJobAttemptRequireLiveLease("dispatching"), true);
  assert.equal(doesHardwareJobAttemptRequireLiveLease("submitted"), false);

  const claimRequest = new NextRequest("http://localhost/api/hardware/v2/jobs/claim", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hardware-protocol-version": "2",
    },
    body: JSON.stringify({
      supportedCapabilities: [
        "print_label_sato",
        "print_label_sato",
        "print_document_pdf",
        "invalid_capability",
      ],
      agentVersion: "2.0.0",
    }),
  });

  assert.doesNotThrow(() => assertHardwareProtocolV2Request(claimRequest));
  assert.deepEqual(await parseHardwareJobClaimV2Body(claimRequest), {
    supportedCapabilities: ["print_label_sato", "print_document_pdf"],
    agentVersion: "2.0.0",
  });

  const submittedRequest = new NextRequest(
    "http://localhost/api/hardware/v2/jobs/job/attempts/attempt",
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-hardware-protocol-version": "2",
        "idempotency-key": "attempt:submitted:3",
      },
      body: JSON.stringify({
        status: "submitted",
        eventSequence: 3,
        occurredAt: "2026-07-16T10:00:10.000Z",
        result: {
          processExitCode: 0,
          spoolerJobId: null,
        },
      }),
    },
  );

  const submittedEvent = await parseHardwareJobAttemptV2Event(
    submittedRequest,
  );
  assert.equal(submittedEvent.status, "submitted");
  assert.equal(submittedEvent.eventSequence, 3);
  assert.equal(submittedEvent.error, null);

  const unsafeUnknownRequest = new NextRequest(
    "http://localhost/api/hardware/v2/jobs/job/attempts/attempt",
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-hardware-protocol-version": "2",
        "idempotency-key": "attempt:unknown:3",
      },
      body: JSON.stringify({
        status: "unknown_after_dispatch",
        eventSequence: 3,
        error: {
          code: "SPOOLER_RESULT_UNKNOWN",
          message: "Spooler result tidak diketahui.",
          retrySafe: true,
        },
      }),
    },
  );

  await assert.rejects(
    () => parseHardwareJobAttemptV2Event(unsafeUnknownRequest),
    (error: unknown) =>
      error instanceof HardwareJobProtocolV2Error &&
      error.code === "UNSAFE_RETRY_CLASSIFICATION",
  );

  const invalidVersionRequest = new NextRequest("http://localhost", {
    headers: { "x-hardware-protocol-version": "1" },
  });
  assert.throws(
    () => assertHardwareProtocolV2Request(invalidVersionRequest),
    (error: unknown) =>
      error instanceof HardwareJobProtocolV2Error &&
      error.code === "UNSUPPORTED_PROTOCOL_VERSION",
  );

  const claimSource = await readFile(
    "src/lib/hardware/job-claim-v2.ts",
    "utf8",
  );
  assert.match(claimSource, /\.for\("update", \{ skipLocked: true \}\)/);
  assert.match(claimSource, /eq\(hardwareJobs\.protocolVersion/);
  assert.match(claimSource, /hardwareJobs\.targetAgentId/);
  assert.match(claimSource, /hardwareJobs\.requiredCapability/);
  assert.match(claimSource, /createHardwareJobLease\(now\)/);
  assert.match(claimSource, /unknown_after_dispatch/);

  const attemptSource = await readFile(
    "src/lib/hardware/job-attempt-v2.ts",
    "utf8",
  );
  assert.match(attemptSource, /verifyHardwareJobLeaseToken/);
  assert.match(attemptSource, /EVENT_SEQUENCE_GAP/);
  assert.match(attemptSource, /STALE_ATTEMPT/);
  assert.match(attemptSource, /unknown_outcome/);
  assert.match(attemptSource, /doesHardwareJobAttemptRequireLiveLease/);

  const claimRoute = await readFile(
    "src/app/api/hardware/v2/jobs/claim/route.ts",
    "utf8",
  );
  const attemptRoute = await readFile(
    "src/app/api/hardware/v2/jobs/[jobId]/attempts/[attemptId]/route.ts",
    "utf8",
  );
  const leaseRoute = await readFile(
    "src/app/api/hardware/v2/jobs/[jobId]/attempts/[attemptId]/lease/route.ts",
    "utf8",
  );
  assert.match(claimRoute, /assertHardwareProtocolV2Request/);
  assert.match(attemptRoute, /parseHardwareJobAttemptV2Event/);
  assert.match(leaseRoute, /renewHardwareJobAttemptV2Lease/);

  console.log("Hardware Job Protocol v2 claim + lease checks berhasil.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
