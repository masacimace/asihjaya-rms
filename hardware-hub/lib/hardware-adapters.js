/* eslint-disable */
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { spawn } = require("child_process");
const { createFakeHardwareBackend } = require("./fake-hardware-adapters");


const DOCUMENT_DOWNLOAD_PATH_PATTERNS = [
  /^\/api\/sales\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/receipt-certificate$/i,
  /^\/api\/sales\/receipt-certificate-preview$/,
];

function isAllowedDocumentDownloadPath(pathname) {
  return DOCUMENT_DOWNLOAD_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

class HardwareAdapterError extends Error {
  constructor(message, { code = "HARDWARE_ADAPTER_ERROR", retrySafe = false, category = "adapter" } = {}) {
    super(message);
    this.name = "HardwareAdapterError";
    this.code = code;
    this.retrySafe = retrySafe;
    this.category = category;
  }
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
  const text = normalizeForPrinter(value).replace(/[\x1B]/g, "").replace(/[<>]/g, "");
  return (text || fallback).slice(0, maxLength);
}

function sanitizeCode(value, fallback = "-") {
  const text = normalizeForPrinter(value).replace(/[^a-zA-Z0-9._-]/g, "").trim();
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
  return parsed.toFixed(3).replace(/\.?0+$/, "").slice(0, 16);
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
    } else if (`${current} ${word}`.length <= maxChars) {
      lines[lines.length - 1] = `${current} ${word}`;
    } else if (lines.length < maxLines) {
      lines.push(word.slice(0, maxChars));
    }
  }
  return lines.slice(0, maxLines);
}

function createSatoBuilder(config) {
  const formatDots = (value) => String(Math.round(Math.max(0, Math.min(Number(value) || 0, 9999)))).padStart(4, "0");
  const addDots = (base, offset) => formatDots(base + (Number(offset) || 0));
  const satoText = ({ x, y, size = "XS", text }) => {
    const ESC = "\x1B";
    return `${ESC}H${addDots(x, config.labelLeftOffsetDots)}${ESC}V${addDots(y, config.labelTopOffsetDots)}${ESC}L0101${ESC}${size}${sanitizeText(text, "-")}`;
  };
  const satoBarcode = ({ x, y, barcode }) => {
    const ESC = "\x1B";
    return `${ESC}H${addDots(x, config.labelLeftOffsetDots)}${ESC}V${addDots(y, config.labelTopOffsetDots)}${ESC}B102060*${sanitizeCode(barcode, "000000")}*`;
  };

  return function buildSatoLabel(payload) {
    const fields = payload?.fields && typeof payload.fields === "object" ? payload.fields : {};
    const merged = { ...payload, ...fields };
    const copies = Math.max(
      1,
      Math.min(Math.round(Number(payload?.copies) || config.labelCopies), 20),
    );
    const label = {
      barcode: sanitizeCode(merged.barcode, "000000"),
      sku: sanitizeCode(merged.sku, merged.barcode || "000000"),
      weightGram: sanitizeNumericText(merged.weightGram, "-"),
      exchangePurity: sanitizeNumericText(merged.exchangePurityPercent, "-"),
      purity: sanitizeNumericText(merged.purityPercent ?? merged.purity, "-"),
      productName: sanitizeText(merged.productName ?? merged.name, "Produk", 96),
      size: sanitizeText(merged.size, "", 24),
      gemstone: sanitizeText(merged.gemstone, "", 32),
      color: sanitizeText(merged.color, "", 24),
      price: formatMoneyForLabel(merged.sellingAmount ?? merged.price),
    };
    const ESC = "\x1B";
    const productLines = wrapLabelText(label.productName, 26, 2);
    const specs = [
      label.weightGram !== "-" ? `BRT ${label.weightGram}g` : null,
      label.exchangePurity !== "-" ? `TUKAR ${label.exchangePurity}%` : null,
    ].filter(Boolean);
    const attrs = [
      label.size ? `UK ${label.size}` : null,
      label.color || null,
      label.gemstone || null,
    ]
      .filter(Boolean)
      .join(" · ");
    const lines = [
      `${ESC}A`,
      satoText({ x: 30, y: 18, size: "XM", text: productLines[0] || label.productName }),
    ];
    if (productLines[1]) lines.push(satoText({ x: 30, y: 50, size: "XS", text: productLines[1] }));
    lines.push(satoText({ x: 30, y: 82, size: "XS", text: specs.join("  ") || label.sku }));
    if (attrs) lines.push(satoText({ x: 30, y: 112, size: "XS", text: attrs }));
    if (config.labelIncludePrice && label.price) {
      lines.push(satoText({ x: 30, y: 142, size: "XS", text: label.price }));
    }
    lines.push(
      satoBarcode({
        x: 30,
        y: config.labelIncludePrice && label.price ? 174 : 150,
        barcode: label.barcode,
      }),
      satoText({
        x: 30,
        y: config.labelIncludePrice && label.price ? 252 : 228,
        size: "XS",
        text: label.sku,
      }),
      `${ESC}Q${copies}`,
      `${ESC}Z`,
    );
    return { command: lines.join(""), label, copies };
  };
}

function spawnCommand(executable, args, { timeoutMs, logger }) {
  return new Promise((resolve, reject) => {
    logger.log(`[>] ${executable} ${args.map((value) => JSON.stringify(value)).join(" ")}`);
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-1024 * 1024);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-1024 * 1024);
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(
          new HardwareAdapterError(`Command timeout setelah ${timeoutMs} ms.`, {
            code: "PROCESS_TIMEOUT_AFTER_DISPATCH",
            retrySafe: false,
            category: "process",
          }),
        );
        return;
      }
      if (code !== 0) {
        reject(
          new HardwareAdapterError(
            stderr.trim() || `Command exit code ${code}; signal ${signal || "-"}.`,
            {
              code: "PROCESS_FAILED_AFTER_DISPATCH",
              retrySafe: false,
              category: "process",
            },
          ),
        );
        return;
      }
      resolve({ exitCode: code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function validatePrinterShareName(name) {
  if (!name) {
    throw new HardwareAdapterError("Nama printer belum dikonfigurasi.", {
      code: "PRINTER_NOT_CONFIGURED",
      retrySafe: false,
      category: "configuration",
    });
  }
  if (/["\r\n&|<>^]/.test(name)) {
    throw new HardwareAdapterError("Printer share name memiliki karakter yang tidak aman.", {
      code: "INVALID_PRINTER_NAME",
      retrySafe: false,
      category: "configuration",
    });
  }
}

function createTempPath(config, prefix, extension) {
  fs.mkdirSync(config.tempDir, { recursive: true });
  return path.join(
    config.tempDir,
    `${sanitizeCode(prefix, "hardware-job")}_${Date.now()}_${crypto.randomBytes(5).toString("hex")}.${sanitizeCode(extension, "tmp")}`,
  );
}

function createDryRunPath(config, prefix, extension) {
  fs.mkdirSync(config.dryRunOutputDir, { recursive: true });
  return path.join(
    config.dryRunOutputDir,
    `${sanitizeCode(prefix, "hardware-job")}_${Date.now()}_${crypto.randomBytes(5).toString("hex")}.${sanitizeCode(extension, "txt")}`,
  );
}

function writeDryRunMetadata(config, filePath, metadata) {
  fs.writeFileSync(
    `${filePath}.json`,
    JSON.stringify(
      {
        ...metadata,
        dryRun: true,
        agentVersion: config.agentVersion,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
}

function prepareRawWindowsJob(config, { printerName, content, extension = "bin", metadata = {} }) {
  if (config.dryRun) {
    return {
      adapter: "dry_run_raw_file",
      target: printerName || null,
      async dispatch() {
        const outputFile = createDryRunPath(config, "raw-printer", extension);
        fs.writeFileSync(outputFile, content, "binary");
        writeDryRunMetadata(config, outputFile, {
          kind: "raw_printer_job",
          printerName: printerName || null,
          bytes: Buffer.byteLength(content, "binary"),
          ...metadata,
        });
        return { mode: "dry_run", outputFile, printerName: printerName || null, ...metadata };
      },
      async cleanup() {},
    };
  }

  if (process.platform !== "win32") {
    throw new HardwareAdapterError("Raw Windows printer adapter hanya dapat berjalan di Windows.", {
      code: "WINDOWS_PRINTER_REQUIRED",
      retrySafe: false,
      category: "configuration",
    });
  }
  validatePrinterShareName(printerName);
  const tmpFile = createTempPath(config, "raw-printer", extension);
  fs.writeFileSync(tmpFile, content, "binary");
  const target = `\\\\localhost\\${printerName}`;
  return {
    adapter: "windows_raw_share",
    target: printerName,
    async dispatch() {
      const result = await spawnCommand(
        "cmd.exe",
        ["/d", "/s", "/c", `copy /B "${tmpFile}" "${target}"`],
        { timeoutMs: config.printCommandTimeoutMs, logger: config.logger },
      );
      return {
        mode: "windows_raw_share",
        printerName,
        exitCode: result.exitCode,
        ...metadata,
      };
    },
    async cleanup() {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    },
  };
}

function downloadFile(config, urlString, destination, options = {}) {
  return new Promise((resolve, reject) => {
    const base = new URL(config.apiUrl);
    const url = new URL(urlString, base);
    if (url.origin !== base.origin) {
      reject(
        new HardwareAdapterError("Download document lintas origin ditolak.", {
          code: "DOCUMENT_ORIGIN_NOT_ALLOWED",
          retrySafe: false,
          category: "security",
        }),
      );
      return;
    }
    if (!isAllowedDocumentDownloadPath(url.pathname)) {
      reject(
        new HardwareAdapterError("Path download document tidak termasuk allowlist.", {
          code: "DOCUMENT_PATH_NOT_ALLOWED",
          retrySafe: false,
          category: "security",
        }),
      );
      return;
    }
    const client = url.protocol === "https:" ? https : http;
    const file = fs.createWriteStream(destination, { flags: "wx" });
    const hash = crypto.createHash("sha256");
    let bytes = 0;
    let settled = false;
    const maxBytes = Math.max(1, Number(options.maxBytes) || 10 * 1024 * 1024);

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
          "x-hardware-agent-id": config.agentId,
          "x-hardware-agent-secret": config.agentSecret,
          "x-hardware-agent-version": config.agentVersion,
        },
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          fail(
            new HardwareAdapterError(`Download failed: HTTP ${res.statusCode}.`, {
              code: "DOCUMENT_DOWNLOAD_FAILED",
              retrySafe: true,
              category: "network",
            }),
          );
          return;
        }
        const contentType = String(res.headers["content-type"] || "").split(";", 1)[0].trim();
        if (options.contentType && contentType !== options.contentType) {
          res.resume();
          fail(
            new HardwareAdapterError(`Content-Type document tidak sesuai: ${contentType || "-"}.`, {
              code: "DOCUMENT_CONTENT_TYPE_MISMATCH",
              retrySafe: false,
              category: "validation",
            }),
          );
          return;
        }
        res.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            req.destroy(
              new HardwareAdapterError("Ukuran document melebihi batas payload.", {
                code: "DOCUMENT_TOO_LARGE",
                retrySafe: false,
                category: "validation",
              }),
            );
            return;
          }
          hash.update(chunk);
        });
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            if (settled) return;
            const sha256 = hash.digest("hex");
            if (options.sha256 && options.sha256 !== sha256) {
              fail(
                new HardwareAdapterError("SHA-256 document tidak cocok.", {
                  code: "DOCUMENT_HASH_MISMATCH",
                  retrySafe: false,
                  category: "validation",
                }),
              );
              return;
            }
            settled = true;
            resolve({ bytes, sha256, contentType });
          });
        });
      },
    );
    req.setTimeout(config.requestTimeoutMs, () => {
      req.destroy(
        new HardwareAdapterError(`Download timeout setelah ${config.requestTimeoutMs} ms.`, {
          code: "DOCUMENT_DOWNLOAD_TIMEOUT",
          retrySafe: true,
          category: "network",
        }),
      );
    });
    req.on("error", fail);
    file.on("error", fail);
  });
}

function parsePdfArgs(config, filePath) {
  const replace = (value) =>
    String(value)
      .replaceAll("{file}", filePath)
      .replaceAll("{printer}", config.documentPrinterName);

  if (config.pdfPrintExecutable) {
    let args;
    try {
      args = JSON.parse(config.pdfPrintArgsJson || "[]");
    } catch {
      throw new HardwareAdapterError("PDF_PRINT_ARGS_JSON bukan JSON array yang valid.", {
        code: "INVALID_PDF_PRINT_ARGS",
        retrySafe: false,
        category: "configuration",
      });
    }
    if (!Array.isArray(args) || !args.every((entry) => typeof entry === "string")) {
      throw new HardwareAdapterError("PDF_PRINT_ARGS_JSON wajib berupa array string.", {
        code: "INVALID_PDF_PRINT_ARGS",
        retrySafe: false,
        category: "configuration",
      });
    }
    return {
      executable: config.pdfPrintExecutable,
      args: args.map(replace),
      legacy: false,
    };
  }

  if (config.pdfPrintCommand) {
    return {
      executable: "cmd.exe",
      args: ["/d", "/s", "/c", replace(config.pdfPrintCommand)],
      legacy: true,
    };
  }

  throw new HardwareAdapterError("PDF print executable belum dikonfigurasi.", {
    code: "PDF_PRINTER_NOT_CONFIGURED",
    retrySafe: false,
    category: "configuration",
  });
}

function createHardwareAdapterFactory(config) {
  const buildSatoLabel = createSatoBuilder(config);
  const adapterModes = {
    label_printer: config.adapterModes?.label_printer || (config.dryRun ? "fake" : "real"),
    document_printer: config.adapterModes?.document_printer || (config.dryRun ? "fake" : "real"),
    cash_drawer: config.adapterModes?.cash_drawer || (config.dryRun ? "fake" : "real"),
  };
  const fakeBackend = config.failureController
    ? createFakeHardwareBackend({
        controller: config.failureController,
        agentVersion: config.agentVersion,
        logger: config.logger,
      })
    : null;

  function isFake(deviceType) {
    return adapterModes[deviceType] === "fake";
  }

  function requireFakeBackend(deviceType) {
    if (!fakeBackend) {
      throw new HardwareAdapterError(
        `Fake adapter ${deviceType} aktif tetapi failure controller belum tersedia.`,
        {
          code: "FAKE_ADAPTER_NOT_CONFIGURED",
          retrySafe: false,
          category: "configuration",
        },
      );
    }
    return fakeBackend;
  }

  async function prepareLabel(job, attemptId) {
    const { command, label, copies } = buildSatoLabel(job.payload || {});
    if (isFake("label_printer")) {
      return requireFakeBackend("label_printer").prepareLabel({
        job,
        attemptId,
        command,
        label,
        copies,
        labelProfile: config.labelProfile,
      });
    }
    return prepareRawWindowsJob(config, {
      printerName: config.labelPrinterName,
      content: command,
      extension: "sbpl",
      metadata: {
        labelProfile: config.labelProfile,
        copies,
        label,
      },
    });
  }

  async function prepareDocument(job, attemptId) {
    const payload = job.payload || {};
    const download = payload.download && typeof payload.download === "object" ? payload.download : {};
    const pdfUrl =
      typeof download.path === "string"
        ? download.path
        : typeof payload.pdfUrl === "string"
          ? payload.pdfUrl
          : "";
    if (!pdfUrl) {
      throw new HardwareAdapterError("Payload PDF tidak memiliki download.path atau pdfUrl.", {
        code: "DOCUMENT_PATH_MISSING",
        retrySafe: false,
        category: "validation",
      });
    }

    const tmpFile = createTempPath(config, "document", "pdf");
    let downloaded;
    try {
      if (isFake("document_printer")) {
        const controller = requireFakeBackend("document_printer");
        const context = config.failureController.registerAttempt(job, attemptId);
        await config.failureController.beforePrepare(context);
        downloaded = await downloadFile(config, pdfUrl, tmpFile, {
          contentType: download.contentType || "application/pdf",
          maxBytes: download.maxBytes,
          sha256: download.sha256,
        });
        return controller.prepareDocument({
          job,
          attemptId,
          sourcePath: tmpFile,
          download: {
            pdfUrl,
            ...downloaded,
          },
          printProfileId: payload.printProfileId || null,
          skipBeforePrepare: true,
        });
      }

      if (process.platform !== "win32") {
        throw new HardwareAdapterError("Document printer adapter hanya dapat berjalan di Windows.", {
          code: "WINDOWS_PRINTER_REQUIRED",
          retrySafe: false,
          category: "configuration",
        });
      }
      validatePrinterShareName(config.documentPrinterName);
      downloaded = await downloadFile(config, pdfUrl, tmpFile, {
        contentType: download.contentType || "application/pdf",
        maxBytes: download.maxBytes,
        sha256: download.sha256,
      });
      const command = parsePdfArgs(config, tmpFile);
      return {
        adapter: command.legacy ? "legacy_pdf_command" : "pdf_executable",
        target: config.documentPrinterName,
        async dispatch() {
          const result = await spawnCommand(command.executable, command.args, {
            timeoutMs: config.printCommandTimeoutMs,
            logger: config.logger,
          });
          return {
            mode: command.legacy ? "legacy_pdf_command" : "pdf_executable",
            printerName: config.documentPrinterName,
            exitCode: result.exitCode,
            printProfileId: payload.printProfileId || null,
            ...downloaded,
          };
        },
        async cleanup() {
          try {
            fs.unlinkSync(tmpFile);
          } catch {}
        },
      };
    } catch (error) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
      throw error;
    }
  }

  async function prepareCashDrawer(job, attemptId) {
    const drawerProfileId = job.payload?.drawerProfileId || "drawer_default_v1";
    if (isFake("cash_drawer")) {
      return requireFakeBackend("cash_drawer").prepareCashDrawer({
        job,
        attemptId,
        drawerProfileId,
      });
    }
    const kick = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]).toString("binary");
    return prepareRawWindowsJob(config, {
      printerName: config.cashDrawerPrinterName,
      content: kick,
      extension: "bin",
      metadata: { drawerProfileId },
    });
  }

  async function prepareHardwareJob({ job, attemptId }) {
    if (job.jobType === "print_label_sato" || job.jobType === "test_label_printer") {
      return prepareLabel(job, attemptId);
    }
    if (
      job.jobType === "print_receipt_certificate" ||
      job.jobType === "test_document_printer"
    ) {
      return prepareDocument(job, attemptId);
    }
    if (job.jobType === "open_cash_drawer" || job.jobType === "test_cash_drawer") {
      return prepareCashDrawer(job, attemptId);
    }
    throw new HardwareAdapterError(`Unsupported job type: ${job.jobType}`, {
      code: "UNSUPPORTED_JOB_TYPE",
      retrySafe: false,
      category: "unsupported_job",
    });
  }

  function classifyPrepareError(error) {
    if (error instanceof HardwareAdapterError || error?.code || error?.category) {
      return {
        category: error.category || "adapter",
        code: error.code || "HARDWARE_ADAPTER_ERROR",
        retrySafe: error.retrySafe === true,
      };
    }
    const message = String(error?.message || error || "Unknown error").toLowerCase();
    if (message.includes("timeout") || message.includes("econn") || message.includes("enotfound")) {
      return { category: "network", code: "NETWORK_ERROR_BEFORE_DISPATCH", retrySafe: true };
    }
    return { category: "pre_dispatch", code: "PREPARE_FAILED", retrySafe: false };
  }

  return { prepareHardwareJob, classifyPrepareError, adapterModes };
}

module.exports = {
  HardwareAdapterError,
  createHardwareAdapterFactory,
  spawnCommand,
};
