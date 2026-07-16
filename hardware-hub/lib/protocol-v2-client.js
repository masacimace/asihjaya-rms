
const PROTOCOL_VERSION = 2;

class HardwareProtocolV2Client {
  constructor({ requestJson, agentVersion }) {
    if (typeof requestJson !== "function") {
      throw new Error("requestJson wajib diberikan ke HardwareProtocolV2Client.");
    }
    this.requestJson = requestJson;
    this.agentVersion = agentVersion;
  }

  claim(supportedCapabilities) {
    return this.requestJson("/api/hardware/v2/jobs/claim", {
      method: "POST",
      headers: {
        "x-hardware-protocol-version": String(PROTOCOL_VERSION),
      },
      body: {
        supportedCapabilities,
        agentVersion: this.agentVersion,
      },
    });
  }

  sendEvent({ jobId, attemptId, leaseToken, idempotencyKey, event }) {
    return this.requestJson(
      `/api/hardware/v2/jobs/${encodeURIComponent(jobId)}/attempts/${encodeURIComponent(attemptId)}`,
      {
        method: "PATCH",
        headers: {
          "x-hardware-protocol-version": String(PROTOCOL_VERSION),
          "x-hardware-lease-token": leaseToken,
          "idempotency-key": idempotencyKey,
        },
        body: event,
      },
    );
  }

  renewLease({ jobId, attemptId, leaseToken }) {
    return this.requestJson(
      `/api/hardware/v2/jobs/${encodeURIComponent(jobId)}/attempts/${encodeURIComponent(attemptId)}/lease`,
      {
        method: "POST",
        headers: {
          "x-hardware-protocol-version": String(PROTOCOL_VERSION),
          "x-hardware-lease-token": leaseToken,
        },
        body: {},
      },
    );
  }
}

module.exports = {
  PROTOCOL_VERSION,
  HardwareProtocolV2Client,
};
