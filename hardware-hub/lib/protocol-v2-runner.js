/* eslint-disable */
const { hashCanonicalJson } = require("./canonical-json");

const PRE_DISPATCH_STATES = new Set(["claimed", "processing", "dispatching"]);
const SERVER_ATTEMPT_CONFLICT_CODES = new Set([
  "STALE_ATTEMPT",
  "ATTEMPT_NOT_FOUND",
  "LEASE_EXPIRED",
  "INVALID_LEASE_TOKEN",
  "INVALID_ATTEMPT_STATE_TRANSITION",
  "INVALID_JOB_STATE_TRANSITION",
  "EVENT_SEQUENCE_CONFLICT",
]);

function asError(value) {
  return value instanceof Error ? value : new Error(String(value));
}

function getErrorCode(error, fallback = "HARDWARE_JOB_FAILED") {
  const raw = String(error?.code || fallback).trim().toUpperCase();
  const safe = raw.replace(/[^A-Z0-9_]/g, "_").slice(0, 80);
  return safe || fallback;
}

function isExpired(iso, now = new Date()) {
  const time = new Date(iso).getTime();
  return !Number.isFinite(time) || time <= now.getTime();
}

class HardwareProtocolV2Runner {
  constructor({
    journal,
    client,
    secretProtector,
    prepareHardwareJob,
    classifyPrepareError,
    logger = console,
    agentVersion,
    dryRun = false,
    leaseRenewIntervalMs = 20_000,
    recoveryLimit = 50,
    now = () => new Date(),
  }) {
    this.journal = journal;
    this.client = client;
    this.secretProtector = secretProtector;
    this.prepareHardwareJob = prepareHardwareJob;
    this.classifyPrepareError = classifyPrepareError;
    this.logger = logger;
    this.agentVersion = agentVersion;
    this.dryRun = dryRun;
    this.leaseRenewIntervalMs = leaseRenewIntervalMs;
    this.recoveryLimit = recoveryLimit;
    this.now = now;
    this.activeAttemptId = null;
  }

  getBaseResult(record) {
    return {
      agentVersion: this.agentVersion,
      dryRun: this.dryRun,
      jobType: record.jobType,
      deviceType: record.deviceType,
      payloadHash: record.payloadHash,
    };
  }

  getLeaseToken(record) {
    return this.secretProtector.unprotect(record.leaseTokenProtected);
  }

  async claim(supportedCapabilities) {
    return this.client.claim(supportedCapabilities);
  }

  validateClaimResponse(response) {
    if (!response?.job) return null;
    if (!response.attempt) {
      throw new Error("Claim v2 mengembalikan job tanpa attempt.");
    }

    const { job, attempt } = response;
    const requiredStrings = [
      ["job.id", job.id],
      ["job.jobType", job.jobType],
      ["job.deviceType", job.deviceType],
      ["job.requiredCapability", job.requiredCapability],
      ["job.payloadHash", job.payloadHash],
      ["attempt.id", attempt.id],
      ["attempt.leaseToken", attempt.leaseToken],
      ["attempt.leaseExpiresAt", attempt.leaseExpiresAt],
    ];

    for (const [name, value] of requiredStrings) {
      if (typeof value !== "string" || !value.trim()) {
        throw new Error(`Claim v2 field ${name} tidak valid.`);
      }
    }
    if (!Number.isInteger(attempt.number) || attempt.number < 1) {
      throw new Error("Claim v2 attempt.number tidak valid.");
    }

    return { job, attempt };
  }

  async processClaim(response) {
    const claimed = this.validateClaimResponse(response);
    if (!claimed) return { processed: false, reason: "no_job" };

    const { job, attempt } = claimed;
    const leaseTokenProtected = this.secretProtector.protect(attempt.leaseToken);
    let record = this.journal.createFromClaim({
      job,
      attempt,
      leaseTokenProtected,
      now: this.now(),
    });

    const calculatedHash = hashCanonicalJson(job.payload || {});
    if (calculatedHash !== job.payloadHash) {
      this.logger.error(
        `[-] Payload hash mismatch untuk job ${job.id}; hardware tidak dijalankan.`,
      );
      await this.failBeforeDispatch(record, {
        code: "PAYLOAD_HASH_MISMATCH",
        message: "Payload hash claim tidak cocok dengan canonical payload lokal.",
        retrySafe: false,
      });
      return { processed: true, status: "failed_before_dispatch" };
    }

    record = await this.execute(record);
    return { processed: true, status: record?.state || "unknown" };
  }

  async recover() {
    const rows = this.journal.listRecoverable(this.recoveryLimit);
    let recovered = 0;

    for (const row of rows) {
      if (this.activeAttemptId && this.activeAttemptId !== row.attemptId) break;
      try {
        await this.execute(row, { recovery: true });
        recovered += 1;
      } catch (error) {
        this.logger.error(
          `[-] Recovery attempt ${row.attemptId} belum selesai: ${asError(error).message}`,
        );
      }
    }

    return {
      recovered,
      remaining: this.journal.countRecoverable(),
      stats: this.journal.getStats(),
    };
  }

  async flushPendingEvent(record) {
    const current = this.journal.get(record.attemptId);
    if (!current?.pendingEventStatus) return current;

    try {
      const response = await this.client.sendEvent({
        jobId: current.jobId,
        attemptId: current.attemptId,
        leaseToken: this.getLeaseToken(current),
        idempotencyKey: current.pendingEventIdempotencyKey,
        event: current.pendingEvent,
      });
      return this.journal.acknowledgePendingEvent(current.attemptId, response, this.now());
    } catch (error) {
      if (SERVER_ATTEMPT_CONFLICT_CODES.has(error?.code)) {
        if (current.dispatchStartedAt || current.state === "submitted") {
          return this.journal.setTerminalError(
            current.attemptId,
            {
              state: "unknown_after_dispatch",
              code: getErrorCode(error, "SERVER_ATTEMPT_CONFLICT_AFTER_DISPATCH"),
              message: `Server menolak event setelah dispatch: ${asError(error).message}`,
              result: current.result,
            },
            this.now(),
          );
        }

        return this.journal.markLeaseExpired(
          current.attemptId,
          `Server menolak attempt sebelum dispatch: ${asError(error).message}`,
          this.now(),
        );
      }
      throw error;
    }
  }

  async queueAndSendEvent(record, status, { result = {}, error = null } = {}) {
    const current = this.journal.get(record.attemptId);
    if (!current) throw new Error(`Attempt ${record.attemptId} tidak ditemukan.`);
    if (current.pendingEventStatus) {
      return this.flushPendingEvent(current);
    }

    const sequence = current.eventSequence + 1;
    const occurredAt = this.now().toISOString();
    const idempotencyKey = `${current.attemptId}:${status}:${sequence}`;
    const body = {
      status,
      eventSequence: sequence,
      occurredAt,
      result: {
        ...this.getBaseResult(current),
        ...result,
      },
      ...(error ? { error } : {}),
    };

    const queued = this.journal.queueEvent(current.attemptId, {
      status,
      eventSequence: sequence,
      idempotencyKey,
      body,
      now: this.now(),
    });
    return this.flushPendingEvent(queued);
  }

  async renewLease(record) {
    const current = this.journal.get(record.attemptId);
    if (!current || current.dispatchStartedAt || current.state === "submitted") {
      return current;
    }
    const response = await this.client.renewLease({
      jobId: current.jobId,
      attemptId: current.attemptId,
      leaseToken: this.getLeaseToken(current),
    });
    const leaseExpiresAt = response?.attempt?.leaseExpiresAt;
    if (typeof leaseExpiresAt !== "string") {
      throw new Error("Lease renewal response tidak memiliki leaseExpiresAt.");
    }
    return this.journal.updateLease(current.attemptId, leaseExpiresAt, this.now());
  }

  startLeaseRenewal(record) {
    let renewing = false;
    const timer = setInterval(async () => {
      if (renewing) return;
      renewing = true;
      try {
        await this.renewLease(record);
      } catch (error) {
        this.logger.warn(
          `[!] Lease renewal ${record.attemptId} gagal: ${asError(error).message}`,
        );
      } finally {
        renewing = false;
      }
    }, this.leaseRenewIntervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  ensureLeaseLive(record) {
    const current = this.journal.get(record.attemptId);
    if (!current) throw new Error(`Attempt ${record.attemptId} tidak ditemukan.`);
    if (isExpired(current.leaseExpiresAt, this.now())) {
      this.journal.markLeaseExpired(
        current.attemptId,
        "Local lease telah kedaluwarsa sebelum dispatch.",
        this.now(),
      );
      const error = new Error("Lease attempt kedaluwarsa sebelum dispatch.");
      error.code = "LEASE_EXPIRED_BEFORE_DISPATCH";
      throw error;
    }
    return current;
  }

  async failBeforeDispatch(record, classification) {
    try {
      return await this.queueAndSendEvent(record, "failed_before_dispatch", {
        error: {
          code: getErrorCode(classification, classification.code || "PREPARE_FAILED"),
          message: String(classification.message || "Hardware preparation gagal.").slice(0, 2000),
          retrySafe: classification.retrySafe === true,
        },
        result: {
          failedAt: this.now().toISOString(),
          errorCategory: classification.category || "pre_dispatch",
        },
      });
    } catch (error) {
      this.logger.error(
        `[-] Gagal melaporkan failed_before_dispatch ${record.attemptId}: ${asError(error).message}`,
      );
      throw error;
    }
  }

  async reportUnknownAfterDispatch(record, error, result = {}) {
    const current = this.journal.get(record.attemptId);
    if (!current) return null;
    if (current.state === "unknown_after_dispatch") return current;

    try {
      return await this.queueAndSendEvent(current, "unknown_after_dispatch", {
        error: {
          code: getErrorCode(error, "DEVICE_RESULT_UNKNOWN"),
          message: String(asError(error).message).slice(0, 2000),
          retrySafe: false,
        },
        result: {
          ...result,
          unknownAt: this.now().toISOString(),
          dispatchStartedAt: current.dispatchStartedAt,
        },
      });
    } catch (reportError) {
      if (SERVER_ATTEMPT_CONFLICT_CODES.has(reportError?.code)) {
        return this.journal.setTerminalError(
          current.attemptId,
          {
            state: "unknown_after_dispatch",
            code: getErrorCode(reportError, "SERVER_ATTEMPT_CONFLICT_AFTER_DISPATCH"),
            message: `Outcome tetap unknown; server menolak report: ${asError(reportError).message}`,
            result: current.result,
          },
          this.now(),
        );
      }
      throw reportError;
    }
  }

  async finishSubmitted(record) {
    let current = this.journal.get(record.attemptId);
    if (!current) return null;
    if (current.pendingEventStatus) {
      current = await this.flushPendingEvent(current);
    }
    if (current.state === "acknowledged" || current.state === "unknown_after_dispatch") {
      return current;
    }
    if (current.state !== "submitted") {
      return current;
    }
    return this.queueAndSendEvent(current, "acknowledged", {
      result: {
        acknowledgedAt: this.now().toISOString(),
        submittedAt: current.submittedAt,
      },
    });
  }

  async execute(record, { recovery = false } = {}) {
    if (this.activeAttemptId && this.activeAttemptId !== record.attemptId) {
      throw new Error(`Agent sedang memproses attempt ${this.activeAttemptId}.`);
    }
    this.activeAttemptId = record.attemptId;

    let prepared = null;
    let stopRenewal = null;

    try {
      let current = this.journal.get(record.attemptId);
      if (!current) throw new Error(`Attempt ${record.attemptId} tidak ditemukan.`);

      if (current.pendingEventStatus) {
        current = await this.flushPendingEvent(current);
      }

      if (["acknowledged", "failed_before_dispatch", "unknown_after_dispatch", "lease_expired", "cancelled"].includes(current.state)) {
        return current;
      }

      if (current.state === "submitted") {
        return await this.finishSubmitted(current);
      }

      if (current.dispatchStartedAt) {
        return await this.reportUnknownAfterDispatch(
          current,
          Object.assign(
            new Error(
              recovery
                ? "Agent restart setelah dispatch dimulai; hasil hardware tidak dapat dipastikan."
                : "Execution terhenti setelah dispatch dimulai.",
            ),
            { code: "AGENT_RECOVERY_AFTER_DISPATCH" },
          ),
        );
      }

      this.ensureLeaseLive(current);
      stopRenewal = this.startLeaseRenewal(current);

      if (current.state === "claimed") {
        current = await this.queueAndSendEvent(current, "processing", {
          result: {
            processingAt: this.now().toISOString(),
            recovery,
          },
        });
      }

      if (current.state !== "processing" && current.state !== "dispatching") {
        return current;
      }

      try {
        prepared = await this.prepareHardwareJob({
          job: {
            id: current.jobId,
            jobType: current.jobType,
            deviceType: current.deviceType,
            requiredCapability: current.requiredCapability,
            payload: current.payload,
            payloadHash: current.payloadHash,
          },
          attemptId: current.attemptId,
        });
      } catch (error) {
        const classification = this.classifyPrepareError(asError(error), current);
        return await this.failBeforeDispatch(current, {
          ...classification,
          message: asError(error).message,
        });
      }

      current = this.ensureLeaseLive(current);

      if (current.state === "processing") {
        current = await this.queueAndSendEvent(current, "dispatching", {
          result: {
            adapter: prepared.adapter,
            target: prepared.target || null,
            preparedAt: this.now().toISOString(),
          },
        });
      }

      if (current.state !== "dispatching") return current;

      current = this.journal.markDispatchStarted(
        current.attemptId,
        {
          adapter: prepared.adapter,
          target: prepared.target || null,
        },
        this.now(),
      );
      stopRenewal?.();
      stopRenewal = null;

      let deviceResult;
      try {
        deviceResult = await prepared.dispatch();
      } catch (error) {
        return await this.reportUnknownAfterDispatch(current, error, {
          adapter: prepared.adapter,
          target: prepared.target || null,
        });
      }

      current = await this.queueAndSendEvent(current, "submitted", {
        result: {
          submittedAt: this.now().toISOString(),
          adapter: prepared.adapter,
          target: prepared.target || null,
          deviceResult,
        },
      });

      return await this.finishSubmitted(current);
    } catch (error) {
      const current = this.journal.get(record.attemptId);
      if (current?.pendingEventStatus) {
        throw error;
      }
      if (current?.dispatchStartedAt && current.state !== "submitted") {
        return await this.reportUnknownAfterDispatch(current, error);
      }
      if (
        current &&
        PRE_DISPATCH_STATES.has(current.state) &&
        !isExpired(current.leaseExpiresAt, this.now())
      ) {
        const classification = this.classifyPrepareError(asError(error), current);
        return await this.failBeforeDispatch(current, {
          ...classification,
          message: asError(error).message,
        });
      }
      throw error;
    } finally {
      stopRenewal?.();
      if (prepared?.cleanup) {
        try {
          await prepared.cleanup();
        } catch (error) {
          this.logger.warn(`[!] Cleanup hardware temp file gagal: ${asError(error).message}`);
        }
      }
      this.activeAttemptId = null;
    }
  }
}

module.exports = {
  HardwareProtocolV2Runner,
  SERVER_ATTEMPT_CONFLICT_CODES,
};
