/* eslint-disable */
const fs = require("fs");
const path = require("path");
const util = require("util");

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function dateStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function safeValue(value, depth = 0) {
  if (depth > 5) return "[max-depth]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      code: value.code,
      stack: value.stack,
    };
  }
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (Array.isArray(value)) return value.map((item) => safeValue(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, safeValue(item, depth + 1)]),
    );
  }
  if (["string", "number", "boolean"].includes(typeof value) || value == null) {
    return value;
  }
  return String(value);
}

class OperationalLogger {
  constructor({
    logDir,
    service = "asihjaya-hardware-hub",
    version = "unknown",
    agentId = null,
    level = "info",
    retentionDays = 30,
    maxFileBytes = 20 * 1024 * 1024,
    maxFiles = 90,
    mirrorToConsole = true,
    redactionValues = [],
    now = () => new Date(),
  }) {
    this.logDir = path.resolve(logDir);
    this.service = service;
    this.version = version;
    this.agentId = agentId;
    this.level = LEVELS[level] ? level : "info";
    this.retentionDays = clampNumber(retentionDays, 30, 1, 365);
    this.maxFileBytes = clampNumber(maxFileBytes, 20 * 1024 * 1024, 64 * 1024, 1024 * 1024 * 1024);
    this.maxFiles = clampNumber(maxFiles, 90, 2, 1000);
    this.mirrorToConsole = mirrorToConsole;
    this.redactionValues = redactionValues.filter((value) => typeof value === "string" && value.length >= 8);
    this.now = now;
    this.originalConsole = {
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };
    this.currentDate = null;
    this.currentIndex = 0;
    this.currentPath = null;
    this.currentBytes = 0;
    this.consoleInstalled = false;
    fs.mkdirSync(this.logDir, { recursive: true });
    this.prune();
  }

  redactString(input) {
    let output = String(input);
    for (const secret of this.redactionValues) output = output.split(secret).join("[REDACTED]");
    output = output
      .replace(/(x-hardware-agent-secret["'\s:=]+)[^\s,"'}]+/gi, "$1[REDACTED]")
      .replace(/(hardware_agent_secret["'\s:=]+)[^\s,"'}]+/gi, "$1[REDACTED]")
      .replace(/(leaseToken["'\s:=]+)[^\s,"'}]+/gi, "$1[REDACTED]")
      .replace(/(lease_token["'\s:=]+)[^\s,"'}]+/gi, "$1[REDACTED]");
    return output;
  }

  redact(value, depth = 0) {
    if (depth > 5) return "[max-depth]";
    if (typeof value === "string") return this.redactString(value);
    if (Array.isArray(value)) return value.map((item) => this.redact(item, depth + 1));
    if (value && typeof value === "object") {
      const result = {};
      for (const [key, item] of Object.entries(value)) {
        if (/secret|token|password|credential/i.test(key)) result[key] = "[REDACTED]";
        else result[key] = this.redact(item, depth + 1);
      }
      return result;
    }
    return value;
  }

  resolveFile(now) {
    const stamp = dateStamp(now);
    if (this.currentDate !== stamp) {
      this.currentDate = stamp;
      this.currentIndex = 0;
      this.currentPath = null;
      this.currentBytes = 0;
    }
    if (!this.currentPath) {
      while (true) {
        const suffix = this.currentIndex === 0 ? "" : `-${String(this.currentIndex).padStart(3, "0")}`;
        const candidate = path.join(this.logDir, `agent-${stamp}${suffix}.jsonl`);
        const size = fs.existsSync(candidate) ? fs.statSync(candidate).size : 0;
        if (size < this.maxFileBytes) {
          this.currentPath = candidate;
          this.currentBytes = size;
          break;
        }
        this.currentIndex += 1;
      }
    }
    return this.currentPath;
  }

  rotateIfNeeded(nextBytes, now) {
    this.resolveFile(now);
    if (this.currentBytes > 0 && this.currentBytes + nextBytes > this.maxFileBytes) {
      this.currentIndex += 1;
      this.currentPath = null;
      this.currentBytes = 0;
      this.resolveFile(now);
    }
  }

  shouldWrite(level) {
    return LEVELS[level] >= LEVELS[this.level];
  }

  write(level, args, context = undefined) {
    const normalizedLevel = LEVELS[level] ? level : "info";
    const values = Array.from(args || []).map((value) => safeValue(value));
    const message = this.redactString(
      values
        .map((value) =>
          typeof value === "string"
            ? value
            : util.inspect(value, { depth: 5, breakLength: Infinity, compact: true }),
        )
        .join(" "),
    );
    const now = this.now();
    if (this.shouldWrite(normalizedLevel)) {
      const entry = this.redact({
        timestamp: now.toISOString(),
        level: normalizedLevel,
        service: this.service,
        version: this.version,
        agentId: this.agentId,
        pid: process.pid,
        message,
        ...(context ? { context: safeValue(context) } : {}),
      });
      const line = `${JSON.stringify(entry)}\n`;
      const bytes = Buffer.byteLength(line);
      this.rotateIfNeeded(bytes, now);
      fs.appendFileSync(this.currentPath, line, { encoding: "utf8" });
      this.currentBytes += bytes;
    }
    if (this.mirrorToConsole) {
      const method = normalizedLevel === "info" ? "log" : normalizedLevel;
      this.originalConsole[method](...Array.from(args || []));
    }
  }

  debug(...args) { this.write("debug", args); }
  info(...args) { this.write("info", args); }
  log(...args) { this.write("info", args); }
  warn(...args) { this.write("warn", args); }
  error(...args) { this.write("error", args); }
  event(level, message, context = {}) { this.write(level, [message], context); }

  installConsoleBridge() {
    if (this.consoleInstalled) return;
    this.consoleInstalled = true;
    console.debug = (...args) => this.debug(...args);
    console.info = (...args) => this.info(...args);
    console.log = (...args) => this.log(...args);
    console.warn = (...args) => this.warn(...args);
    console.error = (...args) => this.error(...args);
  }

  restoreConsole() {
    if (!this.consoleInstalled) return;
    Object.assign(console, this.originalConsole);
    this.consoleInstalled = false;
  }

  prune(now = this.now()) {
    fs.mkdirSync(this.logDir, { recursive: true });
    const cutoff = now.getTime() - this.retentionDays * 24 * 60 * 60 * 1000;
    const files = fs
      .readdirSync(this.logDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^agent-\d{4}-\d{2}-\d{2}(?:-\d{3})?\.jsonl$/.test(entry.name))
      .map((entry) => {
        const filePath = path.join(this.logDir, entry.name);
        return { filePath, name: entry.name, mtimeMs: fs.statSync(filePath).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const [index, file] of files.entries()) {
      if (file.mtimeMs < cutoff || index >= this.maxFiles) {
        try { fs.unlinkSync(file.filePath); } catch {}
      }
    }
  }

  getCurrentLogPath() {
    return this.resolveFile(this.now());
  }

  close() {
    this.restoreConsole();
  }
}

function createOperationalLogger(options) {
  return new OperationalLogger(options);
}

module.exports = { OperationalLogger, createOperationalLogger };
