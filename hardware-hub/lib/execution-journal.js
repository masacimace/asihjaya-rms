/* eslint-disable */
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ACTIVE_STATES = ["claimed", "processing", "dispatching", "submitted"];
const TERMINAL_STATES = [
  "acknowledged",
  "failed_before_dispatch",
  "unknown_after_dispatch",
  "lease_expired",
  "cancelled",
];

function nowIso(now = new Date()) {
  return now.toISOString();
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapRow(row) {
  if (!row) return null;
  return {
    attemptId: row.attempt_id,
    jobId: row.job_id,
    attemptNumber: row.attempt_number,
    jobType: row.job_type,
    deviceType: row.device_type,
    requiredCapability: row.required_capability,
    payload: parseJson(row.payload_json, {}),
    payloadHash: row.payload_hash,
    leaseTokenProtected: row.lease_token_protected,
    leaseExpiresAt: row.lease_expires_at,
    eventSequence: row.event_sequence,
    state: row.state,
    receivedAt: row.received_at,
    processingAt: row.processing_at,
    dispatchStartedAt: row.dispatch_started_at,
    submittedAt: row.submitted_at,
    serverAcknowledgedAt: row.server_acknowledged_at,
    finishedAt: row.finished_at,
    result: parseJson(row.result_json, {}),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    pendingEventStatus: row.pending_event_status,
    pendingEventSequence: row.pending_event_sequence,
    pendingEventIdempotencyKey: row.pending_event_idempotency_key,
    pendingEvent: parseJson(row.pending_event_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class ExecutionJournal {
  constructor({ filePath, logger = console }) {
    if (!filePath) throw new Error("Hardware journal filePath wajib diisi.");
    this.filePath = path.resolve(filePath);
    this.logger = logger;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.db = new DatabaseSync(this.filePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = FULL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        attempt_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        attempt_number INTEGER NOT NULL,
        job_type TEXT NOT NULL,
        device_type TEXT NOT NULL,
        required_capability TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        lease_token_protected TEXT NOT NULL,
        lease_expires_at TEXT NOT NULL,
        event_sequence INTEGER NOT NULL DEFAULT 0,
        state TEXT NOT NULL,
        received_at TEXT NOT NULL,
        processing_at TEXT,
        dispatch_started_at TEXT,
        submitted_at TEXT,
        server_acknowledged_at TEXT,
        finished_at TEXT,
        result_json TEXT,
        error_code TEXT,
        error_message TEXT,
        pending_event_status TEXT,
        pending_event_sequence INTEGER,
        pending_event_idempotency_key TEXT,
        pending_event_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS executions_state_idx
      ON executions(state, updated_at);

      CREATE INDEX IF NOT EXISTS executions_job_idx
      ON executions(job_id, created_at);

      CREATE UNIQUE INDEX IF NOT EXISTS executions_job_active_uq
      ON executions(job_id)
      WHERE state IN ('claimed', 'processing', 'dispatching', 'submitted');
    `);
  }

  transaction(callback) {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      const result = callback();
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK;");
      } catch {}
      throw error;
    }
  }

  get(attemptId) {
    return mapRow(
      this.db.prepare("SELECT * FROM executions WHERE attempt_id = ?").get(attemptId),
    );
  }

  getActiveByJobId(jobId) {
    const placeholders = ACTIVE_STATES.map(() => "?").join(",");
    return mapRow(
      this.db
        .prepare(
          `SELECT * FROM executions WHERE job_id = ? AND state IN (${placeholders}) ORDER BY created_at DESC LIMIT 1`,
        )
        .get(jobId, ...ACTIVE_STATES),
    );
  }

  listRecoverable(limit = 50) {
    const placeholders = ACTIVE_STATES.map(() => "?").join(",");
    return this.db
      .prepare(
        `SELECT * FROM executions WHERE state IN (${placeholders}) OR pending_event_status IS NOT NULL ORDER BY created_at ASC LIMIT ?`,
      )
      .all(...ACTIVE_STATES, Math.max(1, Math.min(Number(limit) || 50, 500)))
      .map(mapRow);
  }

  countRecoverable() {
    const placeholders = ACTIVE_STATES.map(() => "?").join(",");
    const row = this.db
      .prepare(`SELECT COUNT(*) AS total FROM executions WHERE state IN (${placeholders}) OR pending_event_status IS NOT NULL`)
      .get(...ACTIVE_STATES);
    return Number(row?.total || 0);
  }

  createFromClaim({ job, attempt, leaseTokenProtected, now = new Date() }) {
    return this.transaction(() => {
      const existing = this.get(attempt.id);
      if (existing) {
        if (existing.jobId !== job.id || existing.payloadHash !== job.payloadHash) {
          throw new Error("Attempt claim bertabrakan dengan journal record yang berbeda.");
        }
        return existing;
      }

      const active = this.getActiveByJobId(job.id);
      if (active && active.attemptId !== attempt.id) {
        throw new Error(
          `Job ${job.id} masih memiliki local active attempt ${active.attemptId}.`,
        );
      }

      const timestamp = nowIso(now);
      this.db
        .prepare(
          `INSERT INTO executions (
            attempt_id, job_id, attempt_number, job_type, device_type,
            required_capability, payload_json, payload_hash,
            lease_token_protected, lease_expires_at, event_sequence, state,
            received_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'claimed', ?, ?, ?)`,
        )
        .run(
          attempt.id,
          job.id,
          attempt.number,
          job.jobType,
          job.deviceType,
          job.requiredCapability,
          JSON.stringify(job.payload || {}),
          job.payloadHash,
          leaseTokenProtected,
          attempt.leaseExpiresAt,
          timestamp,
          timestamp,
          timestamp,
        );

      return this.get(attempt.id);
    });
  }

  updateLease(attemptId, leaseExpiresAt, now = new Date()) {
    this.db
      .prepare(
        "UPDATE executions SET lease_expires_at = ?, updated_at = ? WHERE attempt_id = ?",
      )
      .run(leaseExpiresAt, nowIso(now), attemptId);
    return this.get(attemptId);
  }

  queueEvent(attemptId, { status, eventSequence, idempotencyKey, body, now = new Date() }) {
    return this.transaction(() => {
      const current = this.get(attemptId);
      if (!current) throw new Error(`Attempt ${attemptId} tidak ditemukan di journal.`);
      if (TERMINAL_STATES.includes(current.state)) {
        throw new Error(`Attempt ${attemptId} sudah terminal pada state ${current.state}.`);
      }
      if (current.pendingEventStatus) {
        if (
          current.pendingEventStatus === status &&
          current.pendingEventSequence === eventSequence &&
          current.pendingEventIdempotencyKey === idempotencyKey
        ) {
          return current;
        }
        throw new Error(`Attempt ${attemptId} masih memiliki pending event lain.`);
      }
      if (eventSequence !== current.eventSequence + 1) {
        throw new Error(
          `Event sequence journal harus ${current.eventSequence + 1}, menerima ${eventSequence}.`,
        );
      }

      const timestamp = nowIso(now);
      const timestampColumn =
        status === "processing"
          ? "processing_at"
          : status === "submitted"
            ? "submitted_at"
            : null;
      const timestampSql = timestampColumn ? `, ${timestampColumn} = ?` : "";
      const args = [
        status,
        status,
        eventSequence,
        idempotencyKey,
        JSON.stringify(body),
        timestamp,
      ];
      if (timestampColumn) args.push(timestamp);
      args.push(attemptId);

      this.db
        .prepare(
          `UPDATE executions
           SET state = ?, pending_event_status = ?, pending_event_sequence = ?,
               pending_event_idempotency_key = ?, pending_event_json = ?, updated_at = ?
               ${timestampSql}
           WHERE attempt_id = ?`,
        )
        .run(...args);

      return this.get(attemptId);
    });
  }

  acknowledgePendingEvent(attemptId, response, now = new Date()) {
    return this.transaction(() => {
      const current = this.get(attemptId);
      if (!current) throw new Error(`Attempt ${attemptId} tidak ditemukan di journal.`);
      if (!current.pendingEventStatus || !current.pendingEventSequence) {
        return current;
      }

      const timestamp = nowIso(now);
      const status = current.pendingEventStatus;
      const finished = TERMINAL_STATES.includes(status) ? timestamp : current.finishedAt;
      const serverAcknowledgedAt =
        status === "submitted" ? timestamp : current.serverAcknowledgedAt;
      const pendingResult =
        current.pendingEvent?.result && typeof current.pendingEvent.result === "object"
          ? current.pendingEvent.result
          : {};
      const pendingError =
        current.pendingEvent?.error && typeof current.pendingEvent.error === "object"
          ? current.pendingEvent.error
          : null;
      const result = {
        ...(current.result || {}),
        ...pendingResult,
        lastServerResponse: response || null,
      };

      this.db
        .prepare(
          `UPDATE executions SET
             event_sequence = ?, state = ?, pending_event_status = NULL,
             pending_event_sequence = NULL, pending_event_idempotency_key = NULL,
             pending_event_json = NULL, server_acknowledged_at = ?,
             finished_at = ?, result_json = ?, error_code = ?, error_message = ?,
             updated_at = ?
           WHERE attempt_id = ?`,
        )
        .run(
          current.pendingEventSequence,
          status,
          serverAcknowledgedAt,
          finished,
          JSON.stringify(result),
          pendingError?.code || current.errorCode,
          pendingError?.message || current.errorMessage,
          timestamp,
          attemptId,
        );

      return this.get(attemptId);
    });
  }

  markDispatchStarted(attemptId, metadata = {}, now = new Date()) {
    const timestamp = nowIso(now);
    this.db
      .prepare(
        `UPDATE executions
         SET dispatch_started_at = COALESCE(dispatch_started_at, ?),
             result_json = ?, updated_at = ?
         WHERE attempt_id = ?`,
      )
      .run(
        timestamp,
        JSON.stringify({ ...(this.get(attemptId)?.result || {}), dispatch: metadata }),
        timestamp,
        attemptId,
      );
    return this.get(attemptId);
  }

  markLeaseExpired(attemptId, message, now = new Date()) {
    const timestamp = nowIso(now);
    this.db
      .prepare(
        `UPDATE executions SET state = 'lease_expired', finished_at = ?,
          error_code = 'LEASE_EXPIRED_BEFORE_DISPATCH', error_message = ?,
          pending_event_status = NULL, pending_event_sequence = NULL,
          pending_event_idempotency_key = NULL, pending_event_json = NULL,
          updated_at = ? WHERE attempt_id = ?`,
      )
      .run(timestamp, message, timestamp, attemptId);
    return this.get(attemptId);
  }

  setTerminalError(attemptId, { state, code, message, result = {} }, now = new Date()) {
    if (!TERMINAL_STATES.includes(state)) {
      throw new Error(`State ${state} bukan terminal local journal state.`);
    }
    const timestamp = nowIso(now);
    this.db
      .prepare(
        `UPDATE executions SET state = ?, finished_at = ?, error_code = ?,
          error_message = ?, result_json = ?, pending_event_status = NULL,
          pending_event_sequence = NULL, pending_event_idempotency_key = NULL,
          pending_event_json = NULL, updated_at = ? WHERE attempt_id = ?`,
      )
      .run(state, timestamp, code, message, JSON.stringify(result), timestamp, attemptId);
    return this.get(attemptId);
  }

  getStats() {
    const rows = this.db
      .prepare("SELECT state, COUNT(*) AS total FROM executions GROUP BY state")
      .all();
    return Object.fromEntries(rows.map((row) => [row.state, Number(row.total)]));
  }

  close() {
    this.db.close();
  }
}

module.exports = {
  ACTIVE_STATES,
  TERMINAL_STATES,
  ExecutionJournal,
};
