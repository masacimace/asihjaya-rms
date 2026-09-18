/* eslint-disable */
const fs = require("fs");
const path = require("path");

const {
  createHardwareAdapterFactory,
  spawnCommand,
} = require("../lib/hardware-adapters");
const {
  buildSumatraPdfCommand,
  EPSON_L3251_PRINT_PROFILE_A4_V1,
  RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
} = require("../lib/document-print-profiles");
const { windowsPrinterExists } = require("../lib/outlet-operations");
const {
  createEpsonFixturePdf,
  createSatoProductionContractFixture,
} = require("./generate-outlet-fixtures");
const { DEFAULT_SATO_LABEL_CONFIG_PATH } = require("../lib/sato-jewelry-label");

try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
} catch {}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${arg} membutuhkan nilai.`);
    result[key] = value;
    index += 1;
  }
  return result;
}

function required(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} wajib diisi.`);
  return normalized;
}

function createLogger() {
  return {
    log(message) {
      if (process.env.HARDWARE_INSTALLER_VERBOSE === "1") {
        process.stderr.write(`${message}\n`);
      }
    },
  };
}

function assertPrinter(printerName) {
  const result = windowsPrinterExists(printerName, process.env);
  if (result.checked && !result.exists) {
    throw new Error(`Printer Windows tidak ditemukan: ${printerName}`);
  }
}

async function testLabel({ printerName, stateDir }) {
  assertPrinter(printerName);
  const contract = JSON.parse(createSatoProductionContractFixture().toString("utf8"));
  const factory = createHardwareAdapterFactory({
    adapterModes: {
      label_printer: "real",
      document_printer: "fake",
      cash_drawer: "fake",
    },
    dryRun: false,
    labelPrinterName: printerName,
    documentPrinterName: "",
    cashDrawerPrinterName: "",
    powershellExecutable:
      process.env.HARDWARE_POWERSHELL_EXECUTABLE?.trim() || "powershell.exe",
    tempDir: path.join(stateDir, "temp"),
    printCommandTimeoutMs: Number(process.env.PRINT_COMMAND_TIMEOUT_MS || 60000),
    logger: createLogger(),
    satoCopies: 1,
    satoLabelConfigPath: path.resolve(
      process.env.SATO_LABEL_CONFIG_PATH || DEFAULT_SATO_LABEL_CONFIG_PATH,
    ),
  });
  const prepared = await factory.prepareHardwareJob({
    job: {
      id: "installer-test-label",
      jobType: "test_label_printer",
      payload: contract.payload,
    },
    attemptId: "installer-test-label",
  });
  try {
    const result = await prepared.dispatch();
    return { device: "label", printerName, result };
  } finally {
    await prepared.cleanup();
  }
}

async function testDocument({ printerName, stateDir, pdfExecutable }) {
  assertPrinter(printerName);
  if (!fs.existsSync(pdfExecutable)) {
    throw new Error(`SumatraPDF tidak ditemukan: ${pdfExecutable}`);
  }
  const tempDir = path.join(stateDir, "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const pdfPath = path.join(tempDir, `installer-epson-test-${Date.now()}.pdf`);
  fs.writeFileSync(pdfPath, createEpsonFixturePdf());
  try {
    const command = buildSumatraPdfCommand({
      executable: pdfExecutable,
      printerName,
      filePath: pdfPath,
      payload: {
        documentProfileId: RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
        printProfileId: EPSON_L3251_PRINT_PROFILE_A4_V1,
        copies: 1,
      },
    });
    const result = await spawnCommand(command.executable, command.args, {
      timeoutMs: Number(process.env.PRINT_COMMAND_TIMEOUT_MS || 60000),
      logger: createLogger(),
    });
    return {
      device: "document",
      printerName,
      printProfileId: command.profile.id,
      printSettings: command.profile.printSettings,
      exitCode: result.exitCode,
    };
  } finally {
    try {
      fs.unlinkSync(pdfPath);
    } catch {}
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const device = required(args.device, "Device");
  const printerName = required(args.printer, "Printer");
  const stateDir = path.resolve(
    args["state-dir"] || process.env.HARDWARE_INSTALLER_STATE_DIR || "data",
  );
  if (device === "label") {
    return testLabel({ printerName, stateDir });
  }
  if (device === "document") {
    const pdfExecutable = path.resolve(
      required(
        args["pdf-executable"] || process.env.PDF_PRINT_EXECUTABLE,
        "PDF executable",
      ),
    );
    return testDocument({ printerName, stateDir, pdfExecutable });
  }
  throw new Error("Device test print harus label atau document.");
}

if (require.main === module) {
  main()
    .then((result) => {
      process.stdout.write(`${JSON.stringify({ success: true, ...result })}\n`);
    })
    .catch((error) => {
      process.stderr.write(
        `${JSON.stringify({ success: false, message: error?.message || String(error) })}\n`,
      );
      process.exitCode = 1;
    });
}

module.exports = {
  parseArgs,
  testDocument,
  testLabel,
};
