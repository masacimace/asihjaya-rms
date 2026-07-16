/* eslint-disable */
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");

try {
  require("dotenv").config({ path: path.resolve(__dirname, ".env") });
} catch {
  // dotenv optional agar agent tetap bisa dijalankan lewat environment variable OS.
}

const { ExecutionJournal } = require("./lib/execution-journal");
const { createHardwareAdapterFactory } = require("./lib/hardware-adapters");
const { HardwareProtocolV2Client } = require("./lib/protocol-v2-client");
const { HardwareProtocolV2Runner } = require("./lib/protocol-v2-runner");
const { createSecretProtector } = require("./lib/secret-protector");

const AGENT_VERSION = "2.0.0-pr3-crash-safe";
const PROTOCOL_MODES = new Set(["v2-preferred", "v2-only", "v1-only"]);
process.title = "asihjaya-hardware-hub";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[-] Environment variable ${name} belum diatur.`);
    process.exit(1);
  }
  return value;
}

function optionalNumber(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalBoolean(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function resolveLocalPath(envName, fallback) {
  return path.resolve(__dirname, process.env[envName]?.trim() || fallback);
}

const ASIHJAYA_API_URL = requiredEnv("ASIHJAYA_API_URL").replace(/\/$/, "");
const HARDWARE_AGENT_ID = requiredEnv("HARDWARE_AGENT_ID");
const HARDWARE_AGENT_SECRET = requiredEnv("HARDWARE_AGENT_SECRET");
const HARDWARE_PROTOCOL_MODE = process.env.HARDWARE_PROTOCOL_MODE?.trim() || "v2-preferred";
const HARDWARE_DRY_RUN = optionalBoolean("HARDWARE_DRY_RUN", false);
const DRY_RUN_OUTPUT_DIR = resolveLocalPath("DRY_RUN_OUTPUT_DIR", "dry-run-output");
const HARDWARE_JOURNAL_PATH = resolveLocalPath(
  "HARDWARE_JOURNAL_PATH",
  "data/hardware-executions.sqlite",
);
const HARDWARE_JOURNAL_KEY_PATH = resolveLocalPath(
  "HARDWARE_JOURNAL_KEY_PATH",
  "data/hardware-journal.key",
);
const HARDWARE_TEMP_DIR = resolveLocalPath("HARDWARE_TEMP_DIR", "data/temp");
const LABEL_PRINTER_NAME = process.env.LABEL_PRINTER_NAME?.trim() || "";
const DOCUMENT_PRINTER_NAME = process.env.DOCUMENT_PRINTER_NAME?.trim() || "";
const CASH_DRAWER_PRINTER_NAME = process.env.CASH_DRAWER_PRINTER_NAME?.trim() || "";
const PDF_PRINT_EXECUTABLE = process.env.PDF_PRINT_EXECUTABLE?.trim() || "";
const PDF_PRINT_ARGS_JSON = process.env.PDF_PRINT_ARGS_JSON?.trim() || "";
const PDF_PRINT_COMMAND = process.env.PDF_PRINT_COMMAND?.trim() || "";
const POLL_INTERVAL_MS = optionalNumber("POLL_INTERVAL_MS", 2000);
const HEARTBEAT_INTERVAL_MS = optionalNumber("HEARTBEAT_INTERVAL_MS", 30000);
const REQUEST_TIMEOUT_MS = optionalNumber("REQUEST_TIMEOUT_MS", 15000);
const PRINT_COMMAND_TIMEOUT_MS = optionalNumber("PRINT_COMMAND_TIMEOUT_MS", 60000);
const LEASE_RENEW_INTERVAL_MS = optionalNumber("LEASE_RENEW_INTERVAL_MS", 20000);
const LOCAL_RECOVERY_LIMIT = optionalNumber("LOCAL_RECOVERY_LIMIT", 50);
const LABEL_PROFILE = process.env.LABEL_PROFILE?.trim() || "jewelry_compact";
const LABEL_COPIES = Math.max(
  1,
  Math.min(Math.round(optionalNumber("LABEL_COPIES", 1)), 20),
);
const LABEL_LEFT_OFFSET_DOTS = optionalNumber("LABEL_LEFT_OFFSET_DOTS", 0);
const LABEL_TOP_OFFSET_DOTS = optionalNumber("LABEL_TOP_OFFSET_DOTS", 0);
const LABEL_INCLUDE_PRICE = optionalBoolean("LABEL_INCLUDE_PRICE", false);

if (!PROTOCOL_MODES.has(HARDWARE_PROTOCOL_MODE)) {
  console.error(
    "[-] HARDWARE_PROTOCOL_MODE harus v2-preferred, v2-only, atau v1-only.",
  );
  process.exit(1);
}
if (HARDWARE_AGENT_SECRET.length < 32) {
  console.error("[-] HARDWARE_AGENT_SECRET minimal harus 32 karakter.");
  process.exit(1);
}
if (POLL_INTERVAL_MS < 1000) {
  console.error("[-] POLL_INTERVAL_MS minimal 1000 ms.");
  process.exit(1);
}
if (REQUEST_TIMEOUT_MS < 3000) {
  console.error("[-] REQUEST_TIMEOUT_MS minimal 3000 ms.");
  process.exit(1);
}
if (PRINT_COMMAND_TIMEOUT_MS < 5000) {
  console.error("[-] PRINT_COMMAND_TIMEOUT_MS minimal 5000 ms.");
  process.exit(1);
}
if (LEASE_RENEW_INTERVAL_MS < 5000 || LEASE_RENEW_INTERVAL_MS > 45000) {
  console.error("[-] LEASE_RENEW_INTERVAL_MS harus antara 5000 dan 45000 ms.");
  process.exit(1);
}

class HardwareHttpError extends Error {
  constructor(message, { status = 0, code = "HTTP_REQUEST_FAILED", retryable = true } = {}) {
    super(message);
    this.name = "HardwareHttpError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function getClientForUrl(url) {
  return url.startsWith("https") ? https : http;
}

function getBaseHeaders(payload, headers = {}) {
  return {
    "Content-Type": "application/json",
    "x-hardware-agent-id": HARDWARE_AGENT_ID,
    "x-hardware-agent-secret": HARDWARE_AGENT_SECRET,
    "x-hardware-agent-version": AGENT_VERSION,
    ...headers,
    ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
  };
}

function requestJson(
  pathname,
  { method = "POST", body = undefined, headers = {} } = {},
) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, ASIHJAYA_API_URL);
    if (url.origin !== new URL(ASIHJAYA_API_URL).origin) {
      reject(
        new HardwareHttpError("Request API lintas origin ditolak.", {
          code: "API_ORIGIN_NOT_ALLOWED",
          retryable: false,
        }),
      );
      return;
    }
    const payload = body === undefined ? null : JSON.stringify(body);
    const client = getClientForUrl(url.toString());
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers: getBaseHeaders(payload, headers),
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
          if (responseBody.length > 2 * 1024 * 1024) {
            req.destroy(new Error("API response terlalu besar."));
          }
        });
        res.on("end", () => {
          let parsed;
          try {
            parsed = responseBody ? JSON.parse(responseBody) : {};
          } catch {
            parsed = { raw: responseBody };
          }
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            const apiError = parsed?.error;
            reject(
              new HardwareHttpError(
                typeof apiError?.message === "string"
                  ? apiError.message
                  : typeof apiError === "string"
                    ? apiError
                    : `HTTP ${res.statusCode}: ${responseBody || "request failed"}`,
                {
                  status: res.statusCode || 0,
                  code:
                    typeof apiError?.code === "string"
                      ? apiError.code
                      : `HTTP_${res.statusCode || 0}`,
                  retryable: apiError?.retryable !== false,
                },
              ),
            );
            return;
          }
          resolve(parsed);
        });
      },
    );
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(
        new HardwareHttpError(`Request timeout setelah ${REQUEST_TIMEOUT_MS} ms.`, {
          code: "API_REQUEST_TIMEOUT",
          retryable: true,
        }),
      );
    });
    req.on("error", (error) => {
      reject(
        error instanceof HardwareHttpError
          ? error
          : new HardwareHttpError(error.message, {
              code: error.code || "API_NETWORK_ERROR",
              retryable: true,
            }),
      );
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function getSupportedCapabilities() {
  const capabilities = [];
  if (HARDWARE_DRY_RUN || LABEL_PRINTER_NAME) capabilities.push("print_label_sato");
  if (
    HARDWARE_DRY_RUN ||
    (DOCUMENT_PRINTER_NAME &&
      (PDF_PRINT_EXECUTABLE || PDF_PRINT_COMMAND))
  ) {
    capabilities.push("print_document_pdf");
  }
  if (HARDWARE_DRY_RUN || CASH_DRAWER_PRINTER_NAME) {
    capabilities.push("open_cash_drawer");
  }
  return capabilities;
}

function getConfigWarnings() {
  const warnings = [];
  if (HARDWARE_DRY_RUN) return warnings;
  if (!LABEL_PRINTER_NAME) warnings.push("LABEL_PRINTER_NAME belum dikonfigurasi.");
  if (!DOCUMENT_PRINTER_NAME) {
    warnings.push("DOCUMENT_PRINTER_NAME belum dikonfigurasi.");
  }
  if (
    DOCUMENT_PRINTER_NAME &&
    !PDF_PRINT_EXECUTABLE &&
    !PDF_PRINT_COMMAND
  ) {
    warnings.push("PDF_PRINT_EXECUTABLE/PDF_PRINT_COMMAND belum dikonfigurasi.");
  }
  if (PDF_PRINT_COMMAND) {
    warnings.push(
      "PDF_PRINT_COMMAND legacy masih aktif; migrasikan ke PDF_PRINT_EXECUTABLE + PDF_PRINT_ARGS_JSON.",
    );
  }
  if (!CASH_DRAWER_PRINTER_NAME) {
    warnings.push("CASH_DRAWER_PRINTER_NAME belum dikonfigurasi.");
  }
  if (ASIHJAYA_API_URL.startsWith("http://") && !ASIHJAYA_API_URL.includes("localhost")) {
    warnings.push("Production Hardware Hub seharusnya memakai HTTPS.");
  }
  return warnings;
}

const adapterFactory = createHardwareAdapterFactory({
  agentVersion: AGENT_VERSION,
  agentId: HARDWARE_AGENT_ID,
  agentSecret: HARDWARE_AGENT_SECRET,
  apiUrl: ASIHJAYA_API_URL,
  dryRun: HARDWARE_DRY_RUN,
  dryRunOutputDir: DRY_RUN_OUTPUT_DIR,
  tempDir: HARDWARE_TEMP_DIR,
  labelPrinterName: LABEL_PRINTER_NAME,
  documentPrinterName: DOCUMENT_PRINTER_NAME,
  cashDrawerPrinterName: CASH_DRAWER_PRINTER_NAME,
  pdfPrintExecutable: PDF_PRINT_EXECUTABLE,
  pdfPrintArgsJson: PDF_PRINT_ARGS_JSON,
  pdfPrintCommand: PDF_PRINT_COMMAND,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  printCommandTimeoutMs: PRINT_COMMAND_TIMEOUT_MS,
  labelProfile: LABEL_PROFILE,
  labelCopies: LABEL_COPIES,
  labelLeftOffsetDots: LABEL_LEFT_OFFSET_DOTS,
  labelTopOffsetDots: LABEL_TOP_OFFSET_DOTS,
  labelIncludePrice: LABEL_INCLUDE_PRICE,
  logger: console,
});

let journal = null;
let protocolV2Runner = null;
if (HARDWARE_PROTOCOL_MODE !== "v1-only") {
  journal = new ExecutionJournal({ filePath: HARDWARE_JOURNAL_PATH });
  const secretProtector = createSecretProtector({
    keyPath: HARDWARE_JOURNAL_KEY_PATH,
  });
  const protocolV2Client = new HardwareProtocolV2Client({
    requestJson,
    agentVersion: AGENT_VERSION,
  });
  protocolV2Runner = new HardwareProtocolV2Runner({
    journal,
    client: protocolV2Client,
    secretProtector,
    prepareHardwareJob: adapterFactory.prepareHardwareJob,
    classifyPrepareError: adapterFactory.classifyPrepareError,
    logger: console,
    agentVersion: AGENT_VERSION,
    dryRun: HARDWARE_DRY_RUN,
    leaseRenewIntervalMs: LEASE_RENEW_INTERVAL_MS,
    recoveryLimit: LOCAL_RECOVERY_LIMIT,
  });
}

console.log("[+] Starting Asihjaya Hardware Hub Agent...");
console.log(`[+] Agent version: ${AGENT_VERSION}`);
console.log(`[+] API URL: ${ASIHJAYA_API_URL}`);
console.log(`[+] Agent ID: ${HARDWARE_AGENT_ID}`);
console.log(`[+] Protocol mode: ${HARDWARE_PROTOCOL_MODE}`);
console.log(`[+] Dry run mode: ${HARDWARE_DRY_RUN ? "enabled" : "disabled"}`);
console.log(`[+] Journal: ${journal ? HARDWARE_JOURNAL_PATH : "disabled"}`);
console.log(`[+] Label printer: ${LABEL_PRINTER_NAME || "not configured"}`);
console.log(`[+] Document printer: ${DOCUMENT_PRINTER_NAME || "not configured"}`);
console.log(`[+] Cash drawer printer: ${CASH_DRAWER_PRINTER_NAME || "not configured"}`);
for (const warning of getConfigWarnings()) console.warn(`[!] Config warning: ${warning}`);

let isPolling = false;
let isHeartbeatRunning = false;
let isShuttingDown = false;
let heartbeatTimer;
let pollTimer;
let currentPollPromise = null;

function getCapabilitiesPayload() {
  const supported = getSupportedCapabilities();
  return {
    print_label_sato: supported.includes("print_label_sato"),
    print_document_pdf: supported.includes("print_document_pdf"),
    print_receipt_certificate: supported.includes("print_document_pdf"),
    open_cash_drawer: supported.includes("open_cash_drawer"),
    protocol_version: HARDWARE_PROTOCOL_MODE === "v1-only" ? 1 : 2,
    protocol_mode: HARDWARE_PROTOCOL_MODE,
    local_journal: journal
      ? {
          enabled: true,
          path: HARDWARE_JOURNAL_PATH,
          stats: journal.getStats(),
        }
      : { enabled: false },
    dry_run: HARDWARE_DRY_RUN,
    dry_run_output_dir: HARDWARE_DRY_RUN ? DRY_RUN_OUTPUT_DIR : null,
    agent_version: AGENT_VERSION,
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    poll_interval_ms: POLL_INTERVAL_MS,
    heartbeat_interval_ms: HEARTBEAT_INTERVAL_MS,
    request_timeout_ms: REQUEST_TIMEOUT_MS,
    print_command_timeout_ms: PRINT_COMMAND_TIMEOUT_MS,
    lease_renew_interval_ms: LEASE_RENEW_INTERVAL_MS,
    configured_devices: {
      label_printer: Boolean(LABEL_PRINTER_NAME),
      document_printer: Boolean(DOCUMENT_PRINTER_NAME),
      cash_drawer_printer: Boolean(CASH_DRAWER_PRINTER_NAME),
      pdf_print_executable: Boolean(PDF_PRINT_EXECUTABLE),
      pdf_print_command_legacy: Boolean(PDF_PRINT_COMMAND),
    },
    label_config: {
      profile: LABEL_PROFILE,
      copies: LABEL_COPIES,
      left_offset_dots: LABEL_LEFT_OFFSET_DOTS,
      top_offset_dots: LABEL_TOP_OFFSET_DOTS,
      include_price: LABEL_INCLUDE_PRICE,
    },
    config_warnings: getConfigWarnings(),
  };
}

async function heartbeat(status = "online") {
  if (isHeartbeatRunning && status === "online") return;
  isHeartbeatRunning = true;
  try {
    await requestJson("/api/hardware-agents/heartbeat", {
      body: { status, capabilities: getCapabilitiesPayload() },
    });
  } catch (error) {
    console.error("[-] Heartbeat failed:", error.message);
  } finally {
    isHeartbeatRunning = false;
  }
}

async function patchV1Job(jobId, status, { error = null, result = {} } = {}) {
  return requestJson(`/api/hardware-jobs/${jobId}`, {
    method: "PATCH",
    body: {
      status,
      error,
      result: {
        ...result,
        agentVersion: AGENT_VERSION,
        dryRun: HARDWARE_DRY_RUN,
      },
    },
  });
}

async function processV1Job(job) {
  const startedMs = Date.now();
  let prepared = null;
  console.log(`[+] Claimed legacy v1 job ${job.id}: ${job.jobType}`);
  await patchV1Job(job.id, "printing", {
    result: {
      startedAt: new Date().toISOString(),
      jobType: job.jobType,
      deviceType: job.deviceType,
    },
  });

  try {
    prepared = await adapterFactory.prepareHardwareJob({ job, attemptId: null });
    const deviceResult = await prepared.dispatch();
    await patchV1Job(job.id, "completed", {
      result: {
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        jobType: job.jobType,
        deviceType: job.deviceType,
        deviceResult,
      },
    });
    console.log(`[+] Completed legacy v1 job ${job.id}`);
  } catch (error) {
    const classification = adapterFactory.classifyPrepareError(error, job);
    console.error(`[-] Legacy v1 job ${job.id} failed:`, error.message);
    await patchV1Job(job.id, "failed", {
      error: error.message,
      result: {
        failedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        errorCategory: classification.category,
        errorCode: classification.code,
        retryable: classification.retrySafe,
      },
    });
  } finally {
    if (prepared?.cleanup) {
      try {
        await prepared.cleanup();
      } catch (error) {
        console.warn(`[!] Legacy cleanup gagal: ${error.message}`);
      }
    }
  }
}

async function pollOnce() {
  if (isShuttingDown || isPolling) return;
  isPolling = true;

  try {
    if (protocolV2Runner) {
      const recovery = await protocolV2Runner.recover();
      if (recovery.remaining > 0) {
        console.warn(
          `[!] ${recovery.remaining} local v2 execution masih menunggu recovery/ACK; claim baru ditunda.`,
        );
        return;
      }

      const capabilities = getSupportedCapabilities();
      if (capabilities.length > 0) {
        try {
          const response = await protocolV2Runner.claim(capabilities);
          if (response.job) {
            console.log(`[+] Claimed v2 job ${response.job.id}: ${response.job.jobType}`);
            await protocolV2Runner.processClaim(response);
            return;
          }
        } catch (error) {
          const v2Unavailable =
            HARDWARE_PROTOCOL_MODE === "v2-preferred" &&
            ["HTTP_404", "UNSUPPORTED_PROTOCOL_VERSION"].includes(error.code);
          if (!v2Unavailable) throw error;
          console.warn(
            `[!] Endpoint Protocol v2 belum tersedia (${error.code}); sementara fallback ke queue v1.`,
          );
        }
      }
    }

    if (HARDWARE_PROTOCOL_MODE !== "v2-only") {
      const response = await requestJson("/api/hardware-jobs/claim", { body: {} });
      if (response.job) await processV1Job(response.job);
    }
  } catch (error) {
    console.error(
      `[-] Poll/claim failed${error.code ? ` (${error.code})` : ""}:`,
      error.message,
    );
  } finally {
    isPolling = false;
  }
}

function claimAndProcessJob() {
  if (currentPollPromise) return currentPollPromise;
  currentPollPromise = pollOnce().finally(() => {
    currentPollPromise = null;
  });
  return currentPollPromise;
}

async function shutdown(signal, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[!] Received ${signal}. Stopping Asihjaya Hardware Hub Agent...`);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (pollTimer) clearInterval(pollTimer);

  try {
    await currentPollPromise;
  } catch {}

  try {
    await heartbeat("offline");
    console.log("[+] Agent marked offline.");
  } catch (error) {
    console.error("[-] Failed to mark agent offline:", error.message);
  }

  try {
    journal?.close();
  } catch (error) {
    console.error("[-] Failed to close local journal:", error.message);
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
  console.error("[-] Uncaught exception:", error);
  shutdown("uncaughtException", 1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[-] Unhandled rejection:", reason);
  shutdown("unhandledRejection", 1);
});

fs.mkdirSync(HARDWARE_TEMP_DIR, { recursive: true });
heartbeat("online");
claimAndProcessJob();
heartbeatTimer = setInterval(() => heartbeat("online"), HEARTBEAT_INTERVAL_MS);
pollTimer = setInterval(claimAndProcessJob, POLL_INTERVAL_MS);
