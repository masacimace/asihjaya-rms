/* eslint-disable */
const fs = require("fs");
const http = require("http");
const path = require("path");

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

function normalizeError(error) {
  if (!error) return null;
  return {
    code: error.code || null,
    message: error.message || String(error),
    at: new Date().toISOString(),
  };
}

class OperationalHealth {
  constructor({ filePath, logger = console, agent = {} }) {
    this.filePath = path.resolve(filePath);
    this.logger = logger;
    this.startedAtMs = Date.now();
    this.server = null;
    this.state = {
      schemaVersion: 1,
      status: "starting",
      ready: false,
      startedAt: new Date(this.startedAtMs).toISOString(),
      updatedAt: new Date().toISOString(),
      agent,
      heartbeat: { lastAttemptAt: null, lastSuccessAt: null, lastError: null },
      polling: { lastAttemptAt: null, lastSuccessAt: null, lastError: null },
      currentJob: null,
      lastJob: null,
      journal: null,
      lastError: null,
    };
    this.flush();
  }

  snapshot() {
    return {
      ...this.state,
      updatedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAtMs) / 1000),
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryRssBytes: process.memoryUsage().rss,
      },
    };
  }

  flush() { atomicWriteJson(this.filePath, this.snapshot()); }

  patch(patch) {
    this.state = { ...this.state, ...patch, updatedAt: new Date().toISOString() };
    this.flush();
  }

  markReady({ journal = null } = {}) {
    this.patch({ status: "healthy", ready: true, journal, lastError: null });
  }

  markUnhealthy(error, status = "unhealthy") {
    this.patch({ status, ready: false, lastError: normalizeError(error) });
  }

  heartbeatAttempt() {
    this.state.heartbeat = { ...this.state.heartbeat, lastAttemptAt: new Date().toISOString() };
    this.flush();
  }

  heartbeatSuccess() {
    this.state.heartbeat = { lastAttemptAt: this.state.heartbeat.lastAttemptAt, lastSuccessAt: new Date().toISOString(), lastError: null };
    if (this.state.ready && !this.state.polling.lastError) this.state.status = "healthy";
    this.flush();
  }

  heartbeatFailure(error) {
    this.state.heartbeat = { ...this.state.heartbeat, lastError: normalizeError(error) };
    this.state.lastError = normalizeError(error);
    if (this.state.ready) this.state.status = "degraded";
    this.flush();
  }

  pollAttempt() {
    this.state.polling = { ...this.state.polling, lastAttemptAt: new Date().toISOString() };
    this.flush();
  }

  pollSuccess() {
    this.state.polling = { lastAttemptAt: this.state.polling.lastAttemptAt, lastSuccessAt: new Date().toISOString(), lastError: null };
    if (this.state.ready && !this.state.heartbeat.lastError) this.state.status = "healthy";
    this.flush();
  }

  pollFailure(error) {
    this.state.polling = { ...this.state.polling, lastError: normalizeError(error) };
    this.state.lastError = normalizeError(error);
    if (this.state.ready) this.state.status = "degraded";
    this.flush();
  }

  startJob(job, protocol) {
    this.patch({ currentJob: { id: job.id, jobType: job.jobType, deviceType: job.deviceType, protocol, startedAt: new Date().toISOString() } });
  }

  finishJob({ status, error = null }) {
    const currentJob = this.state.currentJob;
    this.patch({
      currentJob: null,
      lastJob: currentJob ? { ...currentJob, status, finishedAt: new Date().toISOString(), error: normalizeError(error) } : this.state.lastJob,
      ...(error ? { lastError: normalizeError(error) } : {}),
    });
  }

  updateJournal(stats) {
    this.state.journal = stats;
    this.flush();
  }

  startServer({ enabled, host = "127.0.0.1", port = 3210 }) {
    if (!enabled) return Promise.resolve(null);
    if (!["127.0.0.1", "::1", "localhost"].includes(host)) {
      throw new Error("Health server hanya boleh bind ke loopback host.");
    }
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (!["/", "/health", "/ready"].includes(req.url || "")) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "not_found" }));
          return;
        }
        const snapshot = this.snapshot();
        const ready = snapshot.ready === true && snapshot.status === "healthy";
        res.writeHead(req.url === "/ready" && !ready ? 503 : 200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(snapshot));
      });
      this.server.once("error", reject);
      this.server.listen(port, host, () => {
        const address = this.server.address();
        resolve({ host, port: typeof address === "object" && address ? address.port : port });
      });
    });
  }

  async close() {
    this.patch({ status: "stopped", ready: false, stoppedAt: new Date().toISOString() });
    if (!this.server) return;
    await new Promise((resolve) => this.server.close(() => resolve()));
    this.server = null;
  }
}

module.exports = { OperationalHealth, atomicWriteJson };
