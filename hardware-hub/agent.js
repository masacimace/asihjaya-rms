/* eslint-disable */
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const { exec } = require("child_process");

try {
  require("dotenv").config({ path: path.resolve(__dirname, ".env") });
} catch {
  // dotenv optional agar agent tetap bisa dijalankan lewat environment variable OS.
}

const AGENT_VERSION = "5J-sato-label-refinement";
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
  if (value === undefined || value === null || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

const ASIHJAYA_API_URL = requiredEnv("ASIHJAYA_API_URL").replace(/\/$/, "");
const HARDWARE_AGENT_ID = requiredEnv("HARDWARE_AGENT_ID");
const HARDWARE_AGENT_SECRET = requiredEnv("HARDWARE_AGENT_SECRET");
const HARDWARE_DRY_RUN = optionalBoolean("HARDWARE_DRY_RUN", false);
const DRY_RUN_OUTPUT_DIR = path.resolve(
  __dirname,
  process.env.DRY_RUN_OUTPUT_DIR?.trim() || "dry-run-output",
);
const LABEL_PRINTER_NAME = process.env.LABEL_PRINTER_NAME?.trim() || "";
const DOCUMENT_PRINTER_NAME = process.env.DOCUMENT_PRINTER_NAME?.trim() || "";
const CASH_DRAWER_PRINTER_NAME = process.env.CASH_DRAWER_PRINTER_NAME?.trim() || "";
const PDF_PRINT_COMMAND = process.env.PDF_PRINT_COMMAND?.trim() || "";
const POLL_INTERVAL_MS = optionalNumber("POLL_INTERVAL_MS", 2000);
const HEARTBEAT_INTERVAL_MS = optionalNumber("HEARTBEAT_INTERVAL_MS", 30000);
const REQUEST_TIMEOUT_MS = optionalNumber("REQUEST_TIMEOUT_MS", 15000);
const PRINT_COMMAND_TIMEOUT_MS = optionalNumber("PRINT_COMMAND_TIMEOUT_MS", 60000);

const LABEL_PROFILE = process.env.LABEL_PROFILE?.trim() || "jewelry_compact";
const LABEL_COPIES = Math.max(1, Math.min(optionalNumber("LABEL_COPIES", 1), 20));
const LABEL_LEFT_OFFSET_DOTS = optionalNumber("LABEL_LEFT_OFFSET_DOTS", 0);
const LABEL_TOP_OFFSET_DOTS = optionalNumber("LABEL_TOP_OFFSET_DOTS", 0);
const LABEL_INCLUDE_PRICE = optionalBoolean("LABEL_INCLUDE_PRICE", false);

if (HARDWARE_AGENT_SECRET.length < 32) {
  console.error("[-] HARDWARE_AGENT_SECRET minimal harus 32 karakter.");
  process.exit(1);
}

if (!Number.isFinite(POLL_INTERVAL_MS) || POLL_INTERVAL_MS < 1000) {
  console.error("[-] POLL_INTERVAL_MS minimal 1000 ms.");
  process.exit(1);
}

if (!Number.isFinite(REQUEST_TIMEOUT_MS) || REQUEST_TIMEOUT_MS < 3000) {
  console.error("[-] REQUEST_TIMEOUT_MS minimal 3000 ms.");
  process.exit(1);
}

if (!Number.isFinite(PRINT_COMMAND_TIMEOUT_MS) || PRINT_COMMAND_TIMEOUT_MS < 5000) {
  console.error("[-] PRINT_COMMAND_TIMEOUT_MS minimal 5000 ms.");
  process.exit(1);
}

function getConfigWarnings() {
  const warnings = [];

  if (HARDWARE_DRY_RUN) {
    return warnings;
  }

  if (!LABEL_PRINTER_NAME) {
    warnings.push("LABEL_PRINTER_NAME belum dikonfigurasi.");
  }

  if (!DOCUMENT_PRINTER_NAME) {
    warnings.push("DOCUMENT_PRINTER_NAME belum dikonfigurasi.");
  }

  if (DOCUMENT_PRINTER_NAME && !PDF_PRINT_COMMAND) {
    warnings.push("PDF_PRINT_COMMAND belum dikonfigurasi untuk silent print PDF.");
  }

  if (!CASH_DRAWER_PRINTER_NAME) {
    warnings.push("CASH_DRAWER_PRINTER_NAME belum dikonfigurasi.");
  }

  return warnings;
}

console.log("[+] Starting Asihjaya Hardware Hub Agent...");
console.log(`[+] Agent version: ${AGENT_VERSION}`);
console.log(`[+] API URL: ${ASIHJAYA_API_URL}`);
console.log(`[+] Agent ID: ${HARDWARE_AGENT_ID}`);
console.log(`[+] Dry run mode: ${HARDWARE_DRY_RUN ? "enabled" : "disabled"}`);
if (HARDWARE_DRY_RUN) {
  console.log(`[+] Dry run output dir: ${DRY_RUN_OUTPUT_DIR}`);
}
console.log(`[+] Label printer: ${LABEL_PRINTER_NAME || "not configured"}`);
console.log(`[+] Label profile: ${LABEL_PROFILE} · copies: ${LABEL_COPIES}`);
console.log(`[+] Document printer: ${DOCUMENT_PRINTER_NAME || "not configured"}`);
console.log(`[+] Cash drawer printer: ${CASH_DRAWER_PRINTER_NAME || "not configured"}`);
for (const warning of getConfigWarnings()) {
  console.warn(`[!] Config warning: ${warning}`);
}

let isPolling = false;
let isHeartbeatRunning = false;
let isShuttingDown = false;
let heartbeatTimer;
let pollTimer;

function getClientForUrl(url) {
  return url.startsWith("https") ? https : http;
}

function getBaseHeaders(payload) {
  return {
    "Content-Type": "application/json",
    "x-hardware-agent-id": HARDWARE_AGENT_ID,
    "x-hardware-agent-secret": HARDWARE_AGENT_SECRET,
    "x-hardware-agent-version": AGENT_VERSION,
    ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
  };
}

function requestJson(pathname, { method = "POST", body = undefined } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, ASIHJAYA_API_URL);
    const payload = body === undefined ? null : JSON.stringify(body);
    const client = getClientForUrl(url.toString());

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers: getBaseHeaders(payload),
      },
      (res) => {
        let responseBody = "";

        res.on("data", (chunk) => {
          responseBody += chunk;
        });

        res.on("end", () => {
          let parsed;
          try {
            parsed = responseBody ? JSON.parse(responseBody) : {};
          } catch {
            parsed = { raw: responseBody };
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(
              new Error(
                `HTTP ${res.statusCode}: ${typeof parsed.error === "string" ? parsed.error : responseBody}`,
              ),
            );
            return;
          }

          resolve(parsed);
        });
      },
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timeout setelah ${REQUEST_TIMEOUT_MS} ms`));
    });

    req.on("error", reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

function getCapabilitiesPayload() {
  const configWarnings = getConfigWarnings();

  return {
    print_label_sato: HARDWARE_DRY_RUN || Boolean(LABEL_PRINTER_NAME),
    print_receipt_certificate:
      HARDWARE_DRY_RUN || Boolean(DOCUMENT_PRINTER_NAME && PDF_PRINT_COMMAND),
    open_cash_drawer: HARDWARE_DRY_RUN || Boolean(CASH_DRAWER_PRINTER_NAME),
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
    configured_devices: {
      label_printer: Boolean(LABEL_PRINTER_NAME),
      document_printer: Boolean(DOCUMENT_PRINTER_NAME),
      cash_drawer_printer: Boolean(CASH_DRAWER_PRINTER_NAME),
      pdf_print_command: Boolean(PDF_PRINT_COMMAND),
    },
    label_config: {
      profile: LABEL_PROFILE,
      copies: LABEL_COPIES,
      left_offset_dots: LABEL_LEFT_OFFSET_DOTS,
      top_offset_dots: LABEL_TOP_OFFSET_DOTS,
      include_price: LABEL_INCLUDE_PRICE,
    },
    config_warnings: configWarnings,
  };
}

async function heartbeat(status = "online") {
  if (isHeartbeatRunning && status === "online") return;
  isHeartbeatRunning = true;

  try {
    await requestJson("/api/hardware-agents/heartbeat", {
      body: {
        status,
        capabilities: getCapabilitiesPayload(),
      },
    });
  } catch (error) {
    console.error("[-] Heartbeat failed:", error.message);
  } finally {
    isHeartbeatRunning = false;
  }
}

async function claimAndProcessJob() {
  if (isShuttingDown || isPolling) return;
  isPolling = true;

  try {
    const response = await requestJson("/api/hardware-jobs/claim", {
      body: {},
    });

    if (!response.job) {
      return;
    }

    await processJob(response.job);
  } catch (error) {
    console.error("[-] Poll/claim failed:", error.message);
  } finally {
    isPolling = false;
  }
}

async function patchJob(jobId, status, { error = null, result = {} } = {}) {
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

function normalizeForPrinter(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeText(value, fallback = "-", maxLength = 64) {
  const text = normalizeForPrinter(value)
    .replace(/[\x1B]/g, "")
    .replace(/[<>]/g, "");

  return (text || fallback).slice(0, maxLength);
}

function sanitizeCode(value, fallback = "-") {
  const text = normalizeForPrinter(value)
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .trim();

  return (text || fallback).slice(0, 80);
}

function sanitizeNumericText(value, fallback = "-") {
  const text = normalizeForPrinter(value)
    .replace(/[^0-9.,-]/g, "")
    .replace(/,/g, ".")
    .trim();

  if (!text) return fallback;

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return text.slice(0, 16);

  return parsed
    .toFixed(3)
    .replace(/\.?0+$/, "")
    .slice(0, 16);
}

function formatMoneyForLabel(value) {
  const number = Number(String(value ?? "").replace(/[^0-9-]/g, ""));
  if (!Number.isFinite(number) || number <= 0) return null;

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(number)
    .replace(/\s+/g, " ");
}

function wrapLabelText(value, maxChars, maxLines) {
  const words = sanitizeText(value, "Produk", 96).split(" ").filter(Boolean);
  const lines = [];

  for (const word of words) {
    const current = lines[lines.length - 1];
    if (!current) {
      lines.push(word.slice(0, maxChars));
      continue;
    }

    if (`${current} ${word}`.length <= maxChars) {
      lines[lines.length - 1] = `${current} ${word}`;
    } else if (lines.length < maxLines) {
      lines.push(word.slice(0, maxChars));
    }
  }

  return lines.slice(0, maxLines);
}

function formatDots(value) {
  const number = Math.max(0, Math.min(Number(value) || 0, 9999));
  return String(Math.round(number)).padStart(4, "0");
}

function addDots(base, offset) {
  return formatDots(base + (Number(offset) || 0));
}

function satoText({ x, y, size = "XS", text }) {
  const ESC = "\x1B";
  return `${ESC}H${addDots(x, LABEL_LEFT_OFFSET_DOTS)}${ESC}V${addDots(
    y,
    LABEL_TOP_OFFSET_DOTS,
  )}${ESC}L0101${ESC}${size}${sanitizeText(text, "-")}`;
}

function satoBarcode({ x, y, barcode }) {
  const ESC = "\x1B";
  return `${ESC}H${addDots(x, LABEL_LEFT_OFFSET_DOTS)}${ESC}V${addDots(
    y,
    LABEL_TOP_OFFSET_DOTS,
  )}${ESC}B102060*${sanitizeCode(barcode, "000000")}*`;
}

function getLabelSummary(payload) {
  const barcode = sanitizeCode(payload.barcode, "000000");
  const sku = sanitizeCode(payload.sku, barcode);
  const weightGram = sanitizeNumericText(payload.weightGram, "-");
  const exchangePurity = sanitizeNumericText(payload.exchangePurityPercent, "-");
  const purity = sanitizeNumericText(payload.purityPercent, exchangePurity);
  const productName = sanitizeText(payload.productName, "Produk", 96);
  const size = sanitizeText(payload.size, "", 24);
  const gemstone = sanitizeText(payload.gemstone, "", 32);
  const color = sanitizeText(payload.color, "", 24);
  const price = formatMoneyForLabel(payload.sellingAmount);

  return {
    barcode,
    sku,
    weightGram,
    exchangePurity,
    purity,
    productName,
    size,
    gemstone,
    color,
    price,
  };
}

function buildJewelryCompactSatoLabel(payload) {
  const ESC = "\x1B";
  const label = getLabelSummary(payload);
  const productLines = wrapLabelText(label.productName, 26, 2);
  const specs = [
    label.weightGram !== "-" ? `BRT ${label.weightGram}g` : null,
    label.exchangePurity !== "-" ? `TUKAR ${label.exchangePurity}%` : null,
  ].filter(Boolean);
  const attrs = [label.size ? `UK ${label.size}` : null, label.color || null, label.gemstone || null]
    .filter(Boolean)
    .join(" · ");

  const lines = [
    `${ESC}A`,
    satoText({ x: 30, y: 18, size: "XM", text: productLines[0] || label.productName }),
  ];

  if (productLines[1]) {
    lines.push(satoText({ x: 30, y: 50, size: "XS", text: productLines[1] }));
  }

  lines.push(satoText({ x: 30, y: 82, size: "XS", text: specs.join("  ") || label.sku }));

  if (attrs) {
    lines.push(satoText({ x: 30, y: 112, size: "XS", text: attrs }));
  }

  if (LABEL_INCLUDE_PRICE && label.price) {
    lines.push(satoText({ x: 30, y: 142, size: "XS", text: label.price }));
  }

  lines.push(
    satoBarcode({ x: 30, y: LABEL_INCLUDE_PRICE && label.price ? 174 : 150, barcode: label.barcode }),
    satoText({ x: 30, y: LABEL_INCLUDE_PRICE && label.price ? 252 : 228, size: "XS", text: label.sku }),
    `${ESC}Q${LABEL_COPIES}`,
    `${ESC}Z`,
  );

  return { command: lines.join(""), label };
}

function buildSatoLabelCommand(payload) {
  // Untuk saat ini profile yang didukung hanya jewelry_compact, tapi env LABEL_PROFILE
  // disimpan agar layout lain bisa ditambah tanpa mengubah payload dari server.
  return buildJewelryCompactSatoLabel(payload);
}

function ensureDryRunOutputDir() {
  fs.mkdirSync(DRY_RUN_OUTPUT_DIR, { recursive: true });
}

function createDryRunPath(prefix, extension) {
  ensureDryRunOutputDir();
  const safePrefix = sanitizeCode(prefix, "hardware-job");
  const safeExtension = sanitizeCode(extension, "txt");

  return path.join(
    DRY_RUN_OUTPUT_DIR,
    `${safePrefix}_${Date.now()}_${Math.random().toString(16).slice(2)}.${safeExtension}`,
  );
}

function writeDryRunMetadata(filePath, metadata) {
  fs.writeFileSync(
    `${filePath}.json`,
    JSON.stringify(
      {
        ...metadata,
        dryRun: true,
        agentVersion: AGENT_VERSION,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
}

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        timeout: PRINT_COMMAND_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
            reject(
              new Error(
                `Command timeout setelah ${PRINT_COMMAND_TIMEOUT_MS} ms: ${stderr || error.message}`,
              ),
            );
            return;
          }

          reject(new Error(stderr || error.message));
          return;
        }

        resolve(stdout);
      },
    );
  });
}

async function printRawToWindowsShare({ printerName, content, extension = "txt", metadata = {} }) {
  if (HARDWARE_DRY_RUN) {
    const dryRunFile = createDryRunPath("raw-printer", extension);
    fs.writeFileSync(dryRunFile, content, "binary");
    writeDryRunMetadata(dryRunFile, {
      kind: "raw_printer_job",
      printerName: printerName || null,
      extension,
      bytes: Buffer.byteLength(content, "binary"),
      ...metadata,
    });
    console.log(`[~] Dry-run: raw printer job saved to ${dryRunFile}`);
    return {
      mode: "dry_run",
      outputFile: dryRunFile,
      printerName: printerName || null,
    };
  }

  if (!printerName) {
    throw new Error("Nama printer belum dikonfigurasi.");
  }

  const tmpFile = path.resolve(
    process.cwd(),
    `hardware_job_${Date.now()}_${Math.random().toString(16).slice(2)}.${extension}`,
  );

  fs.writeFileSync(tmpFile, content, "binary");

  try {
    const command = `copy /B "${tmpFile}" "\\\\localhost\\${printerName}"`;
    console.log(`[>] ${command}`);
    await execCommand(command);
    return {
      mode: "windows_share",
      printerName,
      command: "copy /B <tmp-file> \\\\localhost\\<printer>",
    };
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

function downloadFile(urlString, destination) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString, ASIHJAYA_API_URL);
    const client = getClientForUrl(url.toString());
    const file = fs.createWriteStream(destination);
    let settled = false;

    function fail(error) {
      if (settled) return;
      settled = true;
      file.destroy();
      try {
        fs.unlinkSync(destination);
      } catch {}
      reject(error);
    }

    const req = client.get(
      url,
      {
        headers: {
          "x-hardware-agent-id": HARDWARE_AGENT_ID,
          "x-hardware-agent-secret": HARDWARE_AGENT_SECRET,
          "x-hardware-agent-version": AGENT_VERSION,
        },
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          fail(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            settled = true;
            resolve();
          });
        });
      },
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Download timeout setelah ${REQUEST_TIMEOUT_MS} ms`));
    });

    req.on("error", fail);
    file.on("error", fail);
  });
}

async function printPdfDocument(payload) {
  const pdfUrl = typeof payload.pdfUrl === "string" ? payload.pdfUrl : "";
  if (!pdfUrl) {
    throw new Error("Payload PDF tidak memiliki pdfUrl.");
  }

  if (HARDWARE_DRY_RUN) {
    const dryRunFile = createDryRunPath("receipt-certificate", "pdf");
    await downloadFile(pdfUrl, dryRunFile);
    writeDryRunMetadata(dryRunFile, {
      kind: "pdf_document_job",
      pdfUrl,
      printerName: DOCUMENT_PRINTER_NAME || null,
      title: typeof payload.title === "string" ? payload.title : null,
    });
    console.log(`[~] Dry-run: PDF downloaded and saved to ${dryRunFile}`);
    return {
      mode: "dry_run",
      outputFile: dryRunFile,
      pdfUrl,
      printerName: DOCUMENT_PRINTER_NAME || null,
    };
  }

  if (!DOCUMENT_PRINTER_NAME) {
    throw new Error("DOCUMENT_PRINTER_NAME belum dikonfigurasi.");
  }

  if (!PDF_PRINT_COMMAND) {
    throw new Error(
      "PDF_PRINT_COMMAND belum dikonfigurasi. Contoh: SumatraPDF.exe -print-to \"{printer}\" -silent \"{file}\"",
    );
  }

  const tmpFile = path.resolve(
    process.cwd(),
    `hardware_job_${Date.now()}_${Math.random().toString(16).slice(2)}.pdf`,
  );

  try {
    await downloadFile(pdfUrl, tmpFile);
    const command = PDF_PRINT_COMMAND.replaceAll("{file}", tmpFile).replaceAll(
      "{printer}",
      DOCUMENT_PRINTER_NAME,
    );
    console.log(`[>] ${command}`);
    await execCommand(command);
    return {
      mode: "pdf_print_command",
      printerName: DOCUMENT_PRINTER_NAME,
      commandTemplate: PDF_PRINT_COMMAND.replaceAll(tmpFile, "{file}"),
    };
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

async function openCashDrawer() {
  if (!HARDWARE_DRY_RUN && !CASH_DRAWER_PRINTER_NAME) {
    throw new Error("CASH_DRAWER_PRINTER_NAME belum dikonfigurasi.");
  }

  const drawerKick = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]).toString(
    "binary",
  );
  return printRawToWindowsShare({
    printerName: CASH_DRAWER_PRINTER_NAME,
    content: drawerKick,
    extension: "bin",
  });
}

function classifyHardwareError(error, job) {
  const message = String(error?.message || error || "Unknown error");
  const lower = message.toLowerCase();

  if (lower.includes("unauthorized") || lower.includes("http 401")) {
    return { category: "auth", code: "AUTH_FAILED", retryable: false };
  }

  if (
    lower.includes("belum dikonfigurasi") ||
    lower.includes("not configured") ||
    lower.includes("pdf_print_command")
  ) {
    return { category: "configuration", code: "CONFIG_MISSING", retryable: false };
  }

  if (
    lower.includes("network name cannot be found") ||
    lower.includes("printer") ||
    lower.includes("print")
  ) {
    return { category: "printer", code: "PRINTER_UNAVAILABLE", retryable: true };
  }

  if (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("etimedout") ||
    lower.includes("timeout") ||
    lower.includes("download failed")
  ) {
    return { category: "network", code: "NETWORK_OR_DOWNLOAD_FAILED", retryable: true };
  }

  if (lower.includes("unsupported job type")) {
    return { category: "unsupported_job", code: "UNSUPPORTED_JOB_TYPE", retryable: false };
  }

  return {
    category: job?.deviceType || "unknown",
    code: "HARDWARE_JOB_FAILED",
    retryable: true,
  };
}

async function processJob(job) {
  const startedMs = Date.now();
  console.log(`[+] Claimed hardware job ${job.id}: ${job.jobType}`);
  await patchJob(job.id, "printing", {
    result: {
      startedAt: new Date().toISOString(),
      jobType: job.jobType,
      deviceType: job.deviceType,
    },
  });

  try {
    let deviceResult;

    if (job.jobType === "print_label_sato" || job.jobType === "test_label_printer") {
      const { command, label } = buildSatoLabelCommand(job.payload || {});
      deviceResult = await printRawToWindowsShare({
        printerName: LABEL_PRINTER_NAME,
        content: command,
        metadata: {
          kind: "sato_label_job",
          labelProfile: LABEL_PROFILE,
          copies: LABEL_COPIES,
          label,
        },
      });
      deviceResult = {
        ...deviceResult,
        labelProfile: LABEL_PROFILE,
        copies: LABEL_COPIES,
        label,
      };
    } else if (
      job.jobType === "print_receipt_certificate" ||
      job.jobType === "test_document_printer"
    ) {
      deviceResult = await printPdfDocument(job.payload || {});
    } else if (job.jobType === "open_cash_drawer" || job.jobType === "test_cash_drawer") {
      deviceResult = await openCashDrawer();
    } else {
      throw new Error(`Unsupported job type: ${job.jobType}`);
    }

    await patchJob(job.id, "completed", {
      result: {
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        jobType: job.jobType,
        deviceType: job.deviceType,
        dryRun: HARDWARE_DRY_RUN,
        dryRunOutputDir: HARDWARE_DRY_RUN ? DRY_RUN_OUTPUT_DIR : null,
        deviceResult,
        ...(deviceResult?.label ? { label: deviceResult.label } : {}),
      },
    });
    console.log(`[+] Completed hardware job ${job.id}`);
  } catch (error) {
    const classification = classifyHardwareError(error, job);
    console.error(`[-] Hardware job ${job.id} failed:`, error.message);
    await patchJob(job.id, "failed", {
      error: error.message,
      result: {
        failedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        jobType: job.jobType,
        deviceType: job.deviceType,
        errorCategory: classification.category,
        errorCode: classification.code,
        retryable: classification.retryable,
        message: error.message,
      },
    });
  }
}

async function shutdown(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log(`[!] Received ${signal}. Stopping Asihjaya Hardware Hub Agent...`);

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  try {
    await heartbeat("offline");
    console.log("[+] Agent marked offline.");
  } catch (error) {
    console.error("[-] Failed to mark agent offline:", error.message);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", (error) => {
  console.error("[-] Uncaught exception:", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("[-] Unhandled rejection:", reason);
  shutdown("unhandledRejection");
});

heartbeat("online");
claimAndProcessJob();
heartbeatTimer = setInterval(() => heartbeat("online"), HEARTBEAT_INTERVAL_MS);
pollTimer = setInterval(claimAndProcessJob, POLL_INTERVAL_MS);
