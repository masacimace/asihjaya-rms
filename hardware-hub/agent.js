/* eslint-disable */
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");

try {
  require("dotenv").config({ path: path.resolve(__dirname, ".env"), quiet: true });
} catch {
  // dotenv optional agar agent tetap bisa dijalankan lewat environment variable OS.
}

const AGENT_VERSION = "2.3.0-pr9-sato-profile";
const { createOperationalLogger } = require("./lib/operational-logger");
const operationalLogger = createOperationalLogger({
  logDir: path.resolve(__dirname, process.env.HARDWARE_LOG_DIR?.trim() || "logs"),
  service: "asihjaya-hardware-hub",
  version: AGENT_VERSION,
  agentId: process.env.HARDWARE_AGENT_ID?.trim() || null,
  level: process.env.HARDWARE_LOG_LEVEL?.trim().toLowerCase() || "info",
  retentionDays: Number(process.env.HARDWARE_LOG_RETENTION_DAYS || 30),
  maxFileBytes: Number(process.env.HARDWARE_LOG_MAX_FILE_MB || 20) * 1024 * 1024,
  maxFiles: Number(process.env.HARDWARE_LOG_MAX_FILES || 90),
  redactionValues: [process.env.HARDWARE_AGENT_SECRET || ""],
});
operationalLogger.installConsoleBridge();

const { ExecutionJournal } = require("./lib/execution-journal");
const { createHardwareAdapterFactory } = require("./lib/hardware-adapters");
const { HardwareProtocolV2Client } = require("./lib/protocol-v2-client");
const { HardwareProtocolV2Runner } = require("./lib/protocol-v2-runner");
const { createSecretProtector } = require("./lib/secret-protector");
const { createFailureInjectionController } = require("./lib/failure-injection");
const { OperationalHealth } = require("./lib/operational-health");
const { acquireProcessLock } = require("./lib/process-lock");
const {
  SATO_LABEL_TEMPLATE_JEWELRY_COMPACT_V1,
  SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1,
  resolveSatoLabelTemplate,
  resolveSatoProfileConfiguration,
} = require("./lib/sato-label-profiles");

const PROTOCOL_MODES = new Set(["v2-preferred", "v2-only", "v1-only"]);
const ADAPTER_MODES = new Set(["real", "fake"]);
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
let ASIHJAYA_API_ORIGIN;
try {
  const parsedApiUrl = new URL(ASIHJAYA_API_URL);
  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(parsedApiUrl.hostname);
  if (parsedApiUrl.protocol !== "https:" && !isLoopback) {
    console.error("[-] ASIHJAYA_API_URL production wajib menggunakan HTTPS.");
    process.exit(1);
  }
  ASIHJAYA_API_ORIGIN = parsedApiUrl.origin;
} catch {
  console.error("[-] ASIHJAYA_API_URL bukan URL yang valid.");
  process.exit(1);
}
const HARDWARE_AGENT_ID = requiredEnv("HARDWARE_AGENT_ID");
const HARDWARE_AGENT_SECRET = requiredEnv("HARDWARE_AGENT_SECRET");
const HARDWARE_PROTOCOL_MODE = process.env.HARDWARE_PROTOCOL_MODE?.trim() || "v2-preferred";
const HARDWARE_DRY_RUN = optionalBoolean("HARDWARE_DRY_RUN", false);
const HARDWARE_ADAPTER_MODE =
  process.env.HARDWARE_ADAPTER_MODE?.trim().toLowerCase() ||
  (HARDWARE_DRY_RUN ? "fake" : "real");
const LABEL_PRINTER_ADAPTER =
  process.env.LABEL_PRINTER_ADAPTER?.trim().toLowerCase() || HARDWARE_ADAPTER_MODE;
const DOCUMENT_PRINTER_ADAPTER =
  process.env.DOCUMENT_PRINTER_ADAPTER?.trim().toLowerCase() || HARDWARE_ADAPTER_MODE;
const CASH_DRAWER_ADAPTER =
  process.env.CASH_DRAWER_ADAPTER?.trim().toLowerCase() || HARDWARE_ADAPTER_MODE;
const DRY_RUN_OUTPUT_DIR = resolveLocalPath("DRY_RUN_OUTPUT_DIR", "dry-run-output");
const FAKE_HARDWARE_OUTPUT_DIR = resolveLocalPath(
  "FAKE_HARDWARE_OUTPUT_DIR",
  process.env.DRY_RUN_OUTPUT_DIR?.trim() || "data/fake-output",
);
const FAKE_HARDWARE_PLAN_PATH = process.env.FAKE_HARDWARE_PLAN_PATH?.trim()
  ? resolveLocalPath("FAKE_HARDWARE_PLAN_PATH", "data/fake-plan.json")
  : "";
const FAKE_HARDWARE_SCENARIO = process.env.FAKE_HARDWARE_SCENARIO?.trim() || "success";
const FAKE_LABEL_SCENARIO = process.env.FAKE_LABEL_SCENARIO?.trim() || "";
const FAKE_DOCUMENT_SCENARIO = process.env.FAKE_DOCUMENT_SCENARIO?.trim() || "";
const FAKE_CASH_DRAWER_SCENARIO = process.env.FAKE_CASH_DRAWER_SCENARIO?.trim() || "";
const FAKE_HARDWARE_DELAY_MS = optionalNumber("FAKE_HARDWARE_DELAY_MS", 250);
const FAKE_EXIT_ON_CRASH = optionalBoolean("FAKE_EXIT_ON_CRASH", false);
const HARDWARE_JOURNAL_PATH = resolveLocalPath(
  "HARDWARE_JOURNAL_PATH",
  "data/hardware-executions.sqlite",
);
const HARDWARE_JOURNAL_KEY_PATH = resolveLocalPath(
  "HARDWARE_JOURNAL_KEY_PATH",
  "data/hardware-journal.key",
);
const HARDWARE_POWERSHELL_EXECUTABLE =
  process.env.HARDWARE_POWERSHELL_EXECUTABLE?.trim() || "powershell.exe";
const HARDWARE_TEMP_DIR = resolveLocalPath("HARDWARE_TEMP_DIR", "data/temp");
const HARDWARE_LOCK_PATH = resolveLocalPath("HARDWARE_LOCK_PATH", "data/agent.lock");
const HARDWARE_HEALTH_STATE_PATH = resolveLocalPath(
  "HARDWARE_HEALTH_STATE_PATH",
  "data/health-state.json",
);
const HARDWARE_HEALTH_SERVER_ENABLED = optionalBoolean("HARDWARE_HEALTH_SERVER_ENABLED", true);
const HARDWARE_HEALTH_SERVER_HOST =
  process.env.HARDWARE_HEALTH_SERVER_HOST?.trim() || "127.0.0.1";
const HARDWARE_HEALTH_SERVER_PORT = optionalNumber("HARDWARE_HEALTH_SERVER_PORT", 3210);
const HARDWARE_LOG_RETENTION_DAYS = optionalNumber("HARDWARE_LOG_RETENTION_DAYS", 30);
const HARDWARE_LOG_PRUNE_INTERVAL_MS = optionalNumber(
  "HARDWARE_LOG_PRUNE_INTERVAL_MS",
  60 * 60 * 1000,
);
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
const LABEL_TEMPLATE_ID =
  process.env.LABEL_TEMPLATE_ID?.trim() ||
  process.env.LABEL_PROFILE?.trim() ||
  SATO_LABEL_TEMPLATE_JEWELRY_COMPACT_V1;
const SATO_PRINTER_PROFILE =
  process.env.SATO_PRINTER_PROFILE?.trim() ||
  SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1;
const SATO_COPIES = Math.max(
  1,
  Math.min(
    Math.round(optionalNumber("SATO_COPIES", optionalNumber("LABEL_COPIES", 1))),
    20,
  ),
);
const SATO_HORIZONTAL_OFFSET_DOTS = optionalNumber(
  "SATO_HORIZONTAL_OFFSET_DOTS",
  optionalNumber("LABEL_LEFT_OFFSET_DOTS", 0),
);
const SATO_VERTICAL_OFFSET_DOTS = optionalNumber(
  "SATO_VERTICAL_OFFSET_DOTS",
  optionalNumber("LABEL_TOP_OFFSET_DOTS", 0),
);
const SATO_INCLUDE_PRICE =
  process.env.SATO_INCLUDE_PRICE !== undefined
    ? optionalBoolean("SATO_INCLUDE_PRICE", false)
    : optionalBoolean("LABEL_INCLUDE_PRICE", false);
const SATO_PRINT_SPEED = process.env.SATO_PRINT_SPEED?.trim() || null;
const SATO_DARKNESS = process.env.SATO_DARKNESS?.trim() || null;
const SATO_MEDIA_WIDTH_DOTS = process.env.SATO_MEDIA_WIDTH_DOTS?.trim() || null;
const SATO_MEDIA_HEIGHT_DOTS = process.env.SATO_MEDIA_HEIGHT_DOTS?.trim() || null;

if (!PROTOCOL_MODES.has(HARDWARE_PROTOCOL_MODE)) {
  console.error(
    "[-] HARDWARE_PROTOCOL_MODE harus v2-preferred, v2-only, atau v1-only.",
  );
  process.exit(1);
}
for (const [name, value] of [
  ["HARDWARE_ADAPTER_MODE", HARDWARE_ADAPTER_MODE],
  ["LABEL_PRINTER_ADAPTER", LABEL_PRINTER_ADAPTER],
  ["DOCUMENT_PRINTER_ADAPTER", DOCUMENT_PRINTER_ADAPTER],
  ["CASH_DRAWER_ADAPTER", CASH_DRAWER_ADAPTER],
]) {
  if (!ADAPTER_MODES.has(value)) {
    console.error(`[-] ${name} harus real atau fake.`);
    process.exit(1);
  }
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
if (HARDWARE_HEALTH_SERVER_PORT < 1 || HARDWARE_HEALTH_SERVER_PORT > 65535) {
  console.error("[-] HARDWARE_HEALTH_SERVER_PORT harus antara 1 dan 65535.");
  process.exit(1);
}
if (HARDWARE_LOG_RETENTION_DAYS < 1 || HARDWARE_LOG_RETENTION_DAYS > 365) {
  console.error("[-] HARDWARE_LOG_RETENTION_DAYS harus antara 1 dan 365 hari.");
  process.exit(1);
}
try {
  resolveSatoLabelTemplate(LABEL_TEMPLATE_ID);
  resolveSatoProfileConfiguration({
    printerProfileId: SATO_PRINTER_PROFILE,
    horizontalOffsetDots: SATO_HORIZONTAL_OFFSET_DOTS,
    verticalOffsetDots: SATO_VERTICAL_OFFSET_DOTS,
    includePrice: SATO_INCLUDE_PRICE,
    copies: SATO_COPIES,
    printSpeed: SATO_PRINT_SPEED,
    darkness: SATO_DARKNESS,
    mediaWidthDots: SATO_MEDIA_WIDTH_DOTS,
    mediaHeightDots: SATO_MEDIA_HEIGHT_DOTS,
  });
} catch (error) {
  console.error(`[-] Konfigurasi SATO tidak valid: ${error.message}`);
  process.exit(1);
}

let processLock;
try {
  processLock = acquireProcessLock({
    filePath: HARDWARE_LOCK_PATH,
    metadata: { agentId: HARDWARE_AGENT_ID, version: AGENT_VERSION },
  });
} catch (error) {
  console.error(`[-] ${error.message}`);
  operationalLogger.close();
  process.exit(error.exitCode || 73);
}

const operationalHealth = new OperationalHealth({
  filePath: HARDWARE_HEALTH_STATE_PATH,
  logger: console,
  agent: {
    id: HARDWARE_AGENT_ID,
    version: AGENT_VERSION,
    hostname: os.hostname(),
    protocolMode: HARDWARE_PROTOCOL_MODE,
  },
});

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
    if (url.origin !== ASIHJAYA_API_ORIGIN) {
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

function isFakeAdapter(deviceType) {
  return {
    label_printer: LABEL_PRINTER_ADAPTER,
    document_printer: DOCUMENT_PRINTER_ADAPTER,
    cash_drawer: CASH_DRAWER_ADAPTER,
  }[deviceType] === "fake";
}

function getSupportedCapabilities() {
  const capabilities = [];
  if (isFakeAdapter("label_printer") || LABEL_PRINTER_NAME) {
    capabilities.push("print_label_sato");
  }
  if (
    isFakeAdapter("document_printer") ||
    (DOCUMENT_PRINTER_NAME && (PDF_PRINT_EXECUTABLE || PDF_PRINT_COMMAND))
  ) {
    capabilities.push("print_document_pdf");
  }
  if (isFakeAdapter("cash_drawer") || CASH_DRAWER_PRINTER_NAME) {
    capabilities.push("open_cash_drawer");
  }
  return capabilities;
}

function getConfigWarnings() {
  const warnings = [];
  if (HARDWARE_DRY_RUN) {
    warnings.push("HARDWARE_DRY_RUN compatibility mode aktif; gunakan HARDWARE_ADAPTER_MODE=fake.");
  }
  if (!isFakeAdapter("label_printer") && !LABEL_PRINTER_NAME) {
    warnings.push("LABEL_PRINTER_NAME belum dikonfigurasi.");
  }
  if (!isFakeAdapter("document_printer") && !DOCUMENT_PRINTER_NAME) {
    warnings.push("DOCUMENT_PRINTER_NAME belum dikonfigurasi.");
  }
  if (
    !isFakeAdapter("document_printer") &&
    DOCUMENT_PRINTER_NAME &&
    !PDF_PRINT_EXECUTABLE &&
    !PDF_PRINT_COMMAND
  ) {
    warnings.push("PDF_PRINT_EXECUTABLE/PDF_PRINT_COMMAND belum dikonfigurasi.");
  }
  if (!isFakeAdapter("document_printer") && PDF_PRINT_COMMAND) {
    warnings.push(
      "PDF_PRINT_COMMAND legacy masih aktif; migrasikan ke PDF_PRINT_EXECUTABLE dan deterministic print profile.",
    );
  }
  if (!isFakeAdapter("cash_drawer") && !CASH_DRAWER_PRINTER_NAME) {
    warnings.push("CASH_DRAWER_PRINTER_NAME belum dikonfigurasi.");
  }
  if (ASIHJAYA_API_URL.startsWith("http://") && !ASIHJAYA_API_URL.includes("localhost")) {
    warnings.push("Production Hardware Hub seharusnya memakai HTTPS.");
  }
  return warnings;
}

const fakeAdaptersEnabled = [
  LABEL_PRINTER_ADAPTER,
  DOCUMENT_PRINTER_ADAPTER,
  CASH_DRAWER_ADAPTER,
].includes("fake");
const failureController = createFailureInjectionController({
  enabled: fakeAdaptersEnabled,
  outputDir: FAKE_HARDWARE_OUTPUT_DIR,
  planPath: FAKE_HARDWARE_PLAN_PATH,
  defaultScenario: FAKE_HARDWARE_SCENARIO,
  deviceScenarios: {
    ...(FAKE_LABEL_SCENARIO ? { label_printer: FAKE_LABEL_SCENARIO } : {}),
    ...(FAKE_DOCUMENT_SCENARIO ? { document_printer: FAKE_DOCUMENT_SCENARIO } : {}),
    ...(FAKE_CASH_DRAWER_SCENARIO ? { cash_drawer: FAKE_CASH_DRAWER_SCENARIO } : {}),
  },
  delayMs: FAKE_HARDWARE_DELAY_MS,
  logger: console,
});

const adapterFactory = createHardwareAdapterFactory({
  agentVersion: AGENT_VERSION,
  agentId: HARDWARE_AGENT_ID,
  agentSecret: HARDWARE_AGENT_SECRET,
  apiUrl: ASIHJAYA_API_URL,
  dryRun: HARDWARE_DRY_RUN,
  dryRunOutputDir: DRY_RUN_OUTPUT_DIR,
  tempDir: HARDWARE_TEMP_DIR,
  adapterModes: {
    label_printer: LABEL_PRINTER_ADAPTER,
    document_printer: DOCUMENT_PRINTER_ADAPTER,
    cash_drawer: CASH_DRAWER_ADAPTER,
  },
  failureController,
  labelPrinterName: LABEL_PRINTER_NAME,
  documentPrinterName: DOCUMENT_PRINTER_NAME,
  cashDrawerPrinterName: CASH_DRAWER_PRINTER_NAME,
  pdfPrintExecutable: PDF_PRINT_EXECUTABLE,
  pdfPrintArgsJson: PDF_PRINT_ARGS_JSON,
  pdfPrintCommand: PDF_PRINT_COMMAND,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  printCommandTimeoutMs: PRINT_COMMAND_TIMEOUT_MS,
  satoTemplateId: LABEL_TEMPLATE_ID,
  satoPrinterProfileId: SATO_PRINTER_PROFILE,
  satoCopies: SATO_COPIES,
  satoHorizontalOffsetDots: SATO_HORIZONTAL_OFFSET_DOTS,
  satoVerticalOffsetDots: SATO_VERTICAL_OFFSET_DOTS,
  satoIncludePrice: SATO_INCLUDE_PRICE,
  satoPrintSpeed: SATO_PRINT_SPEED,
  satoDarkness: SATO_DARKNESS,
  satoMediaWidthDots: SATO_MEDIA_WIDTH_DOTS,
  satoMediaHeightDots: SATO_MEDIA_HEIGHT_DOTS,
  logger: console,
});

let journal = null;
let protocolV2Runner = null;
let secretProtector = null;
let secretProtectorSelfTest = null;
let protocolV2StartupError = null;
if (HARDWARE_PROTOCOL_MODE !== "v1-only") {
  try {
    journal = new ExecutionJournal({ filePath: HARDWARE_JOURNAL_PATH });
    secretProtector = createSecretProtector({
      keyPath: HARDWARE_JOURNAL_KEY_PATH,
      powershellExecutable: HARDWARE_POWERSHELL_EXECUTABLE,
    });
    secretProtectorSelfTest = secretProtector.selfTest();

    const protocolV2Client = failureController.createProtocolClient(
      new HardwareProtocolV2Client({
        requestJson,
        agentVersion: AGENT_VERSION,
      }),
    );
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
  } catch (error) {
    protocolV2StartupError = error;
  }
}

console.log("[+] Starting Asihjaya Hardware Hub Agent...");
console.log(`[+] Agent version: ${AGENT_VERSION}`);
console.log(`[+] API URL: ${ASIHJAYA_API_URL}`);
console.log(`[+] Agent ID: ${HARDWARE_AGENT_ID}`);
console.log(`[+] Protocol mode: ${HARDWARE_PROTOCOL_MODE}`);
console.log(`[+] Dry run compatibility: ${HARDWARE_DRY_RUN ? "enabled" : "disabled"}`);
console.log(`[+] Adapter modes: label=${LABEL_PRINTER_ADAPTER}, document=${DOCUMENT_PRINTER_ADAPTER}, drawer=${CASH_DRAWER_ADAPTER}`);
console.log(`[+] Fake output: ${fakeAdaptersEnabled ? FAKE_HARDWARE_OUTPUT_DIR : "disabled"}`);
console.log(`[+] Fake scenario: ${fakeAdaptersEnabled ? FAKE_HARDWARE_SCENARIO : "disabled"}`);
console.log(`[+] Journal: ${journal ? HARDWARE_JOURNAL_PATH : "disabled"}`);
console.log(`[+] Process lock: ${HARDWARE_LOCK_PATH}`);
console.log(`[+] Structured logs: ${operationalLogger.getCurrentLogPath()}`);
console.log(`[+] Health state: ${HARDWARE_HEALTH_STATE_PATH}`);
console.log(
  `[+] Secret protector: ${secretProtectorSelfTest?.kind || (HARDWARE_PROTOCOL_MODE === "v1-only" ? "disabled" : "unhealthy")}`,
);
if (process.platform === "win32" && HARDWARE_PROTOCOL_MODE !== "v1-only") {
  console.log(`[+] PowerShell executable: ${HARDWARE_POWERSHELL_EXECUTABLE}`);
}
console.log(`[+] Label printer: ${LABEL_PRINTER_NAME || "not configured"}`);
console.log(`[+] SATO template/profile: ${LABEL_TEMPLATE_ID} / ${SATO_PRINTER_PROFILE}`);
console.log(`[+] Document printer: ${DOCUMENT_PRINTER_NAME || "not configured"}`);
console.log(`[+] Cash drawer printer: ${CASH_DRAWER_PRINTER_NAME || "not configured"}`);
for (const warning of getConfigWarnings()) console.warn(`[!] Config warning: ${warning}`);

if (protocolV2StartupError) {
  console.error("[-] Protocol v2 startup self-test gagal. Agent tidak akan heartbeat atau claim job.");
  console.error(`[-] ${protocolV2StartupError.message}`);
  if (process.platform === "win32") {
    console.error("[-] Jalankan `npm run check:dpapi` dari folder hardware-hub untuk diagnosis.");
    console.error(
      "[-] Pastikan agent selalu dijalankan oleh Windows user yang sama karena DPAPI memakai scope CurrentUser.",
    );
  }
  operationalHealth.markUnhealthy(protocolV2StartupError, "startup_failed");
  try {
    journal?.close();
  } catch {}
  processLock?.release();
  operationalLogger.close();
  process.exit(78);
}

console.log(`[+] Secret protector self-test: OK (${secretProtectorSelfTest?.kind || "disabled"})`);

let isPolling = false;
let isHeartbeatRunning = false;
let isShuttingDown = false;
let heartbeatTimer;
let pollTimer;
let logPruneTimer;
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
          secretProtector: secretProtectorSelfTest
            ? {
                healthy: true,
                kind: secretProtectorSelfTest.kind,
                testedAt: secretProtectorSelfTest.testedAt,
              }
            : { healthy: false },
        }
      : { enabled: false },
    dry_run: HARDWARE_DRY_RUN,
    adapter_modes: {
      label_printer: LABEL_PRINTER_ADAPTER,
      document_printer: DOCUMENT_PRINTER_ADAPTER,
      cash_drawer: CASH_DRAWER_ADAPTER,
    },
    fake_hardware: fakeAdaptersEnabled ? failureController.describe() : { enabled: false },
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
      label_printer: isFakeAdapter("label_printer") || Boolean(LABEL_PRINTER_NAME),
      document_printer: isFakeAdapter("document_printer") || Boolean(DOCUMENT_PRINTER_NAME),
      cash_drawer_printer: isFakeAdapter("cash_drawer") || Boolean(CASH_DRAWER_PRINTER_NAME),
      pdf_print_executable: Boolean(PDF_PRINT_EXECUTABLE),
      pdf_print_command_legacy: Boolean(PDF_PRINT_COMMAND),
    },
    label_config: {
      template_id: LABEL_TEMPLATE_ID,
      printer_profile_id: SATO_PRINTER_PROFILE,
      copies: SATO_COPIES,
      horizontal_offset_dots: SATO_HORIZONTAL_OFFSET_DOTS,
      vertical_offset_dots: SATO_VERTICAL_OFFSET_DOTS,
      include_price: SATO_INCLUDE_PRICE,
      print_speed: SATO_PRINT_SPEED,
      darkness: SATO_DARKNESS,
      media_width_dots: SATO_MEDIA_WIDTH_DOTS,
      media_height_dots: SATO_MEDIA_HEIGHT_DOTS,
      physical_validation: "pending",
    },
    operations: {
      structured_logs: true,
      log_retention_days: HARDWARE_LOG_RETENTION_DAYS,
      health_server_enabled: HARDWARE_HEALTH_SERVER_ENABLED,
      health_server_host: HARDWARE_HEALTH_SERVER_HOST,
      health_server_port: HARDWARE_HEALTH_SERVER_PORT,
      process_lock: true,
    },
    config_warnings: getConfigWarnings(),
  };
}

async function heartbeat(status = "online") {
  if (isHeartbeatRunning && status === "online") return;
  isHeartbeatRunning = true;
  operationalHealth.heartbeatAttempt();
  try {
    await requestJson("/api/hardware-agents/heartbeat", {
      body: { status, capabilities: getCapabilitiesPayload() },
    });
    operationalHealth.heartbeatSuccess();
  } catch (error) {
    operationalHealth.heartbeatFailure(error);
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
  operationalHealth.startJob(job, 1);
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
    operationalHealth.finishJob({ status: "completed" });
    console.log(`[+] Completed legacy v1 job ${job.id}`);
  } catch (error) {
    const classification = adapterFactory.classifyPrepareError(error, job);
    operationalHealth.finishJob({ status: "failed", error });
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
  operationalHealth.pollAttempt();

  try {
    if (protocolV2Runner) {
      const recovery = await protocolV2Runner.recover();
      if (recovery.remaining > 0) {
        console.warn(
          `[!] ${recovery.remaining} local v2 execution masih menunggu recovery/ACK; claim baru ditunda.`,
        );
        operationalHealth.pollSuccess();
        operationalHealth.updateJournal(journal?.getStats() || null);
        return;
      }

      const capabilities = getSupportedCapabilities();
      if (capabilities.length > 0) {
        try {
          const response = await protocolV2Runner.claim(capabilities);
          if (response.job) {
            console.log(`[+] Claimed v2 job ${response.job.id}: ${response.job.jobType}`);
            operationalHealth.startJob(response.job, 2);
            try {
              await protocolV2Runner.processClaim(response);
              operationalHealth.finishJob({ status: "processed" });
            } catch (error) {
              operationalHealth.finishJob({ status: "error", error });
              throw error;
            }
            operationalHealth.pollSuccess();
            operationalHealth.updateJournal(journal?.getStats() || null);
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
    operationalHealth.pollSuccess();
    operationalHealth.updateJournal(journal?.getStats() || null);
  } catch (error) {
    operationalHealth.pollFailure(error);
    console.error(
      `[-] Poll/claim failed${error.code ? ` (${error.code})` : ""}:`,
      error.message,
    );
    if (error?.simulatedAgentCrash === true && FAKE_EXIT_ON_CRASH) {
      console.error("[-] FAKE_EXIT_ON_CRASH aktif; process dihentikan dengan exit code 86.");
      process.exit(86);
    }
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
  if (logPruneTimer) clearInterval(logPruneTimer);

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
  try {
    await operationalHealth.close();
  } catch (error) {
    console.error("[-] Failed to close local health server:", error.message);
  }
  processLock?.release();
  operationalLogger.close();
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

async function startAgent() {
  fs.mkdirSync(HARDWARE_TEMP_DIR, { recursive: true });
  operationalHealth.markReady({ journal: journal?.getStats() || null });
  try {
    const healthAddress = await operationalHealth.startServer({
      enabled: HARDWARE_HEALTH_SERVER_ENABLED,
      host: HARDWARE_HEALTH_SERVER_HOST,
      port: HARDWARE_HEALTH_SERVER_PORT,
    });
    if (healthAddress) {
      console.log(`[+] Local health endpoint: http://${healthAddress.host}:${healthAddress.port}/health`);
    }
  } catch (error) {
    operationalHealth.markUnhealthy(error, "health_server_failed");
    console.error(`[-] Local health server gagal: ${error.message}`);
    processLock?.release();
    operationalLogger.close();
    process.exit(79);
  }

  await heartbeat("online");
  await claimAndProcessJob();
  heartbeatTimer = setInterval(() => heartbeat("online"), HEARTBEAT_INTERVAL_MS);
  pollTimer = setInterval(claimAndProcessJob, POLL_INTERVAL_MS);
  logPruneTimer = setInterval(() => operationalLogger.prune(), HARDWARE_LOG_PRUNE_INTERVAL_MS);
}

startAgent().catch((error) => {
  console.error("[-] Agent startup failed:", error);
  operationalHealth.markUnhealthy(error, "startup_failed");
  processLock?.release();
  operationalLogger.close();
  process.exit(1);
});
