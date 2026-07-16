import assert from "node:assert/strict";

import { hardwareJobTypeEnum } from "@/db/schema";
import {
  getHardwareJobExpiresAt,
  getHardwareJobExpirySeconds,
  getRequiredHardwareCapability,
  isHardwareJobAttemptTerminalStatus,
  isHardwareJobAttemptTransitionAllowed,
  isHardwareJobV2TerminalStatus,
  isHardwareJobV2TransitionAllowed,
} from "@/lib/hardware/job-protocol-v2";

const capabilityByJobType = {
  print_label_sato: "print_label_sato",
  print_receipt_certificate: "print_document_pdf",
  open_cash_drawer: "open_cash_drawer",
  test_label_printer: "print_label_sato",
  test_document_printer: "print_document_pdf",
  test_cash_drawer: "open_cash_drawer",
} as const;

for (const jobType of hardwareJobTypeEnum.enumValues) {
  assert.equal(
    getRequiredHardwareCapability(jobType),
    capabilityByJobType[jobType],
    `Capability ${jobType} harus stabil dan eksplisit.`,
  );
}

assert.equal(getHardwareJobExpirySeconds("open_cash_drawer", "automatic"), 30);
assert.equal(getHardwareJobExpirySeconds("test_label_printer", "test"), 120);
assert.equal(
  getHardwareJobExpirySeconds("print_receipt_certificate", "automatic"),
  600,
);
assert.equal(
  getHardwareJobExpirySeconds("print_receipt_certificate", "manual"),
  900,
);
assert.equal(
  getHardwareJobExpirySeconds("print_label_sato", "manual"),
  14_400,
);

const baseTime = new Date("2026-07-16T10:00:00.000Z");
assert.equal(
  getHardwareJobExpiresAt({
    jobType: "print_receipt_certificate",
    mode: "manual",
    now: baseTime,
  }).toISOString(),
  "2026-07-16T10:15:00.000Z",
);

assert.equal(isHardwareJobV2TransitionAllowed("pending", "claimed"), true);
assert.equal(isHardwareJobV2TransitionAllowed("pending", "completed"), false);
assert.equal(
  isHardwareJobV2TransitionAllowed("processing", "failed", {
    dispatchStarted: false,
  }),
  true,
);
assert.equal(
  isHardwareJobV2TransitionAllowed("processing", "failed", {
    dispatchStarted: true,
  }),
  false,
);
assert.equal(
  isHardwareJobV2TransitionAllowed("processing", "unknown_outcome", {
    dispatchStarted: true,
  }),
  true,
);
assert.equal(
  isHardwareJobV2TransitionAllowed("processing", "unknown_outcome", {
    dispatchStarted: false,
  }),
  false,
);
assert.equal(
  isHardwareJobV2TransitionAllowed("failed", "pending", {
    retrySafe: true,
  }),
  true,
);
assert.equal(isHardwareJobV2TransitionAllowed("failed", "pending"), false);
assert.equal(
  isHardwareJobV2TransitionAllowed("unknown_outcome", "pending", {
    manualRetry: true,
  }),
  true,
);
assert.equal(
  isHardwareJobV2TransitionAllowed("unknown_outcome", "completed", {
    manualResolution: true,
  }),
  true,
);
assert.equal(
  isHardwareJobV2TransitionAllowed("unknown_outcome", "completed"),
  false,
);
assert.equal(isHardwareJobV2TransitionAllowed("submitted", "pending"), false);

assert.equal(
  isHardwareJobAttemptTransitionAllowed("claimed", "processing"),
  true,
);
assert.equal(
  isHardwareJobAttemptTransitionAllowed("processing", "dispatching"),
  true,
);
assert.equal(
  isHardwareJobAttemptTransitionAllowed("dispatching", "submitted"),
  true,
);
assert.equal(
  isHardwareJobAttemptTransitionAllowed("submitted", "acknowledged"),
  true,
);
assert.equal(
  isHardwareJobAttemptTransitionAllowed("submitted", "processing"),
  false,
);
assert.equal(
  isHardwareJobAttemptTransitionAllowed(
    "unknown_after_dispatch",
    "submitted",
  ),
  false,
);

assert.equal(isHardwareJobV2TerminalStatus("completed"), true);
assert.equal(isHardwareJobV2TerminalStatus("failed"), false);
assert.equal(isHardwareJobAttemptTerminalStatus("acknowledged"), true);
assert.equal(isHardwareJobAttemptTerminalStatus("submitted"), false);

console.log("Hardware Job Protocol v2 database foundation checks berhasil.");
