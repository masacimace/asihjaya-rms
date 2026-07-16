/* eslint-disable */
const fs = require("fs");
const path = require("path");

const SUPPORTED_FAKE_SCENARIOS = new Set([
  "success",
  "fail_before_dispatch",
  "timeout_before_dispatch",
  "printer_not_found",
  "slow_execution",
  "unknown_after_dispatch",
  "crash_after_dispatch",
  "success_then_ack_lost",
]);

const DEVICE_SCENARIO_KEYS = {
  label_printer: "label",
  document_printer: "document",
  cash_drawer: "cashDrawer",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function sanitizeSegment(value, fallback = "unknown") {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  return normalized || fallback;
}

function normalizeScenario(value, fallback = "success") {
  const scenario = String(value || fallback).trim().toLowerCase();
  if (!SUPPORTED_FAKE_SCENARIOS.has(scenario)) {
    throw new Error(
      `Fake hardware scenario ${scenario} tidak dikenal. Pilihan: ${Array.from(SUPPORTED_FAKE_SCENARIOS).join(", ")}.`,
    );
  }
  return scenario;
}

function readJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("FAKE_HARDWARE_PLAN_PATH wajib berisi JSON object.");
  }
  return value;
}

class SimulatedAgentCrashError extends Error {
  constructor(message = "Simulated agent crash after dispatch.") {
    super(message);
    this.name = "SimulatedAgentCrashError";
    this.code = "SIMULATED_AGENT_CRASH";
    this.retrySafe = false;
    this.simulatedAgentCrash = true;
  }
}

class FakeHardwareError extends Error {
  constructor(message, { code, retrySafe = false, category = "simulation" } = {}) {
    super(message);
    this.name = "FakeHardwareError";
    this.code = code || "FAKE_HARDWARE_ERROR";
    this.retrySafe = retrySafe;
    this.category = category;
  }
}

class FailureInjectionController {
  constructor({
    enabled = false,
    outputDir,
    planPath = "",
    defaultScenario = "success",
    deviceScenarios = {},
    delayMs = 250,
    logger = console,
  }) {
    this.enabled = enabled === true;
    this.outputDir = path.resolve(outputDir || path.join(process.cwd(), "data", "fake-output"));
    this.planPath = planPath ? path.resolve(planPath) : "";
    this.defaultScenario = normalizeScenario(defaultScenario);
    this.deviceScenarios = Object.fromEntries(
      Object.entries(deviceScenarios || {}).map(([key, value]) => [key, normalizeScenario(value)]),
    );
    this.delayMs = Math.max(0, Math.min(Number(delayMs) || 250, 120_000));
    this.logger = logger;
    this.attemptContexts = new Map();
    this.lastPlanMtimeMs = -1;
    this.cachedPlan = null;
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  loadPlan() {
    if (!this.planPath) return null;
    try {
      const stat = fs.statSync(this.planPath);
      if (stat.mtimeMs !== this.lastPlanMtimeMs) {
        this.cachedPlan = readJsonFile(this.planPath);
        this.lastPlanMtimeMs = stat.mtimeMs;
      }
      return this.cachedPlan;
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  resolveScenario({ jobId, jobType, deviceType } = {}) {
    const plan = this.loadPlan();
    const deviceKey = DEVICE_SCENARIO_KEYS[deviceType] || deviceType;
    const value =
      plan?.jobs?.[jobId] ||
      plan?.jobTypes?.[jobType] ||
      plan?.devices?.[deviceType] ||
      plan?.devices?.[deviceKey] ||
      this.deviceScenarios[deviceType] ||
      this.deviceScenarios[deviceKey] ||
      plan?.defaultScenario ||
      this.defaultScenario;
    return normalizeScenario(value);
  }

  resolveDelayMs(context = {}) {
    const plan = this.loadPlan();
    const value =
      plan?.jobDelayMs?.[context.jobId] ||
      plan?.jobTypeDelayMs?.[context.jobType] ||
      plan?.deviceDelayMs?.[context.deviceType] ||
      plan?.delayMs ||
      this.delayMs;
    return Math.max(0, Math.min(Number(value) || 0, 120_000));
  }

  registerAttempt(job, attemptId) {
    const context = {
      jobId: job.id,
      attemptId,
      jobType: job.jobType,
      deviceType: job.deviceType,
      requiredCapability: job.requiredCapability,
    };
    context.scenario = this.resolveScenario(context);
    this.attemptContexts.set(attemptId, context);
    return context;
  }

  getAttemptContext(attemptId, fallback = {}) {
    return this.attemptContexts.get(attemptId) || {
      attemptId,
      ...fallback,
      scenario: this.resolveScenario(fallback),
    };
  }

  getAttemptDir(context) {
    const device = sanitizeSegment(context.deviceType, "hardware");
    const job = sanitizeSegment(context.jobId, "job");
    const attempt = sanitizeSegment(context.attemptId, "attempt");
    return path.join(this.outputDir, device, job, attempt);
  }

  getInjectionMarker(context, name) {
    return path.join(
      this.outputDir,
      ".injections",
      sanitizeSegment(context.attemptId, "attempt"),
      `${sanitizeSegment(name)}.marker`,
    );
  }

  writeExclusive(filePath, data, encoding = undefined) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    try {
      fs.writeFileSync(filePath, data, { flag: "wx", ...(encoding ? { encoding } : {}) });
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new FakeHardwareError(
          `Duplicate fake dispatch terdeteksi; artifact sudah ada: ${filePath}`,
          {
            code: "FAKE_DUPLICATE_DISPATCH_DETECTED",
            retrySafe: false,
            category: "deduplication",
          },
        );
      }
      throw error;
    }
  }

  async beforePrepare(context) {
    if (!this.enabled) return;
    const scenario = context.scenario || this.resolveScenario(context);
    const delayMs = this.resolveDelayMs(context);
    if (scenario === "timeout_before_dispatch") {
      await sleep(delayMs);
      throw new FakeHardwareError("Simulated timeout sebelum dispatch.", {
        code: "NETWORK_ERROR_BEFORE_DISPATCH",
        retrySafe: true,
        category: "network",
      });
    }
    if (scenario === "fail_before_dispatch") {
      throw new FakeHardwareError("Simulated hardware preparation failure.", {
        code: "FAKE_FAIL_BEFORE_DISPATCH",
        retrySafe: true,
        category: "simulation",
      });
    }
    if (scenario === "printer_not_found") {
      throw new FakeHardwareError("Simulated printer not found.", {
        code: "PRINTER_NOT_FOUND",
        retrySafe: true,
        category: "device",
      });
    }
  }

  async beforeArtifactWrite(context) {
    if (!this.enabled) return;
    if (context.scenario === "slow_execution") {
      await sleep(this.resolveDelayMs(context));
    }
  }

  async afterArtifactWrite(context) {
    if (!this.enabled) return;
    if (context.scenario === "unknown_after_dispatch") {
      throw new FakeHardwareError(
        "Simulated uncertain device outcome after artifact dispatch.",
        {
          code: "FAKE_UNKNOWN_AFTER_DISPATCH",
          retrySafe: false,
          category: "device",
        },
      );
    }
    if (context.scenario === "crash_after_dispatch") {
      throw new SimulatedAgentCrashError();
    }
  }

  shouldLoseSubmittedAck({ jobId, attemptId, event }) {
    if (!this.enabled || event?.status !== "submitted") return false;
    const context = this.getAttemptContext(attemptId, { jobId });
    if (context.scenario !== "success_then_ack_lost") return false;
    const marker = this.getInjectionMarker(context, "submitted-ack-lost-once");
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    if (fs.existsSync(marker)) return false;
    fs.writeFileSync(marker, new Date().toISOString(), { flag: "wx", encoding: "utf8" });
    return true;
  }

  createProtocolClient(client) {
    if (!this.enabled) return client;
    return {
      claim: (...args) => client.claim(...args),
      renewLease: (...args) => client.renewLease(...args),
      sendEvent: async (args) => {
        const response = await client.sendEvent(args);
        if (this.shouldLoseSubmittedAck(args)) {
          const error = new Error(
            "Simulated lost HTTP response after server committed submitted event.",
          );
          error.code = "API_NETWORK_ERROR";
          error.retryable = true;
          throw error;
        }
        return response;
      },
    };
  }

  describe() {
    return {
      enabled: this.enabled,
      outputDir: this.outputDir,
      planPath: this.planPath || null,
      defaultScenario: this.defaultScenario,
      deviceScenarios: this.deviceScenarios,
      delayMs: this.delayMs,
      supportedScenarios: Array.from(SUPPORTED_FAKE_SCENARIOS),
    };
  }
}

function createFailureInjectionController(options) {
  return new FailureInjectionController(options);
}

module.exports = {
  SUPPORTED_FAKE_SCENARIOS,
  FakeHardwareError,
  SimulatedAgentCrashError,
  FailureInjectionController,
  createFailureInjectionController,
  normalizeScenario,
  sanitizeSegment,
  sleep,
};
