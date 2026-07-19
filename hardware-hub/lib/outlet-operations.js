/* eslint-disable */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { DatabaseSync } = require("node:sqlite");

const DEVICE_ENV_KEYS = {
  label: "LABEL_PRINTER_ADAPTER",
  document: "DOCUMENT_PRINTER_ADAPTER",
  drawer: "CASH_DRAWER_ADAPTER",
};

const ACTIVE_EXECUTION_STATES = ["claimed", "processing", "dispatching", "submitted"];

function parseEnv(content) {
  const values = {};
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function serializeEnvValue(value) {
  const text = String(value ?? "");
  if (!text) return "";
  if (/^[A-Za-z0-9_./:\\-]+$/.test(text)) return text;
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function updateEnvContent(content, updates) {
  const pending = new Map(Object.entries(updates));
  const lines = String(content || "").split(/\r?\n/);
  const updatedLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !pending.has(match[1])) return line;
    const value = pending.get(match[1]);
    pending.delete(match[1]);
    return `${match[1]}=${serializeEnvValue(value)}`;
  });

  if (pending.size > 0) {
    if (updatedLines.length && updatedLines[updatedLines.length - 1] !== "") {
      updatedLines.push("");
    }
    updatedLines.push("# Outlet readiness updates");
    for (const [key, value] of pending) {
      updatedLines.push(`${key}=${serializeEnvValue(value)}`);
    }
  }

  return `${updatedLines.join("\n").replace(/\n+$/, "")}\n`;
}

function timestampForFile(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function createEnvBackup(envPath, now = new Date()) {
  const backupDir = path.join(path.dirname(envPath), "data", "env-backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `.env.${timestampForFile(now)}.bak`);
  fs.copyFileSync(envPath, backupPath, fs.constants.COPYFILE_EXCL);
  return backupPath;
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function readProcessLock(lockPath) {
  if (!fs.existsSync(lockPath)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    return {
      ...payload,
      alive: isProcessAlive(Number(payload.pid)),
    };
  } catch {
    return { invalid: true, alive: false };
  }
}

function countActiveExecutions(journalPath) {
  if (!fs.existsSync(journalPath)) return 0;
  const db = new DatabaseSync(journalPath, { readOnly: true });
  try {
    const placeholders = ACTIVE_EXECUTION_STATES.map(() => "?").join(",");
    const row = db
      .prepare(
        `SELECT COUNT(*) AS total FROM executions WHERE state IN (${placeholders}) OR pending_event_status IS NOT NULL`,
      )
      .get(...ACTIVE_EXECUTION_STATES);
    return Number(row?.total || 0);
  } finally {
    db.close();
  }
}

function powershellExecutable(env) {
  return env.HARDWARE_POWERSHELL_EXECUTABLE?.trim() || "powershell.exe";
}

function windowsPrinterExists(printerName, env) {
  if (process.platform !== "win32") return { checked: false, exists: null };
  const executable = powershellExecutable(env);
  const encodedName = Buffer.from(printerName, "utf8").toString("base64");
  const command = [
    `$name=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedName}'));`,
    "$printer=Get-Printer -Name $name -ErrorAction SilentlyContinue;",
    "if($null -eq $printer){exit 3}else{Write-Output $printer.Name;exit 0}",
  ].join("");
  const result = spawnSync(executable, ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
  return {
    checked: true,
    exists: result.status === 0,
    error: result.status === 0 ? null : String(result.stderr || result.stdout || "Printer tidak ditemukan").trim(),
  };
}

function assertRealDeviceReady(device, env, rootDir) {
  if (device === "drawer") {
    throw new Error(
      "Cash drawer real diblokir sampai model/interface fisik dan drawer profile disetujui.",
    );
  }

  const printerKey = device === "label" ? "LABEL_PRINTER_NAME" : "DOCUMENT_PRINTER_NAME";
  const printerName = env[printerKey]?.trim();
  if (!printerName) {
    throw new Error(`${printerKey} wajib diisi sebelum adapter ${device} diubah ke real.`);
  }

  const printerCheck = windowsPrinterExists(printerName, env);
  if (printerCheck.checked && !printerCheck.exists) {
    throw new Error(`Printer Windows tidak ditemukan: ${printerName}. ${printerCheck.error || ""}`.trim());
  }

  if (device === "document") {
    const executable = env.PDF_PRINT_EXECUTABLE?.trim();
    if (!executable) {
      throw new Error("PDF_PRINT_EXECUTABLE wajib diisi sebelum document adapter real.");
    }
    const resolved = path.isAbsolute(executable) ? executable : path.resolve(rootDir, executable);
    if (!fs.existsSync(resolved)) {
      throw new Error(`SumatraPDF executable tidak ditemukan: ${resolved}`);
    }
  }
}

function runConfigCheck(rootDir) {
  const result = spawnSync(process.execPath, [path.join(rootDir, "scripts", "check-config.js")], {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}

function switchAdapter({ rootDir, device, mode, now = new Date() }) {
  if (!Object.hasOwn(DEVICE_ENV_KEYS, device) && device !== "all") {
    throw new Error("Device harus label, document, drawer, atau all.");
  }
  if (!['fake', 'real'].includes(mode)) {
    throw new Error("Mode harus fake atau real.");
  }
  if (device === "all" && mode === "real") {
    throw new Error("Aktivasi seluruh hardware real sekaligus tidak diperbolehkan.");
  }

  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error("hardware-hub/.env belum tersedia.");
  }

  const original = fs.readFileSync(envPath, "utf8");
  const env = parseEnv(original);
  const lockPath = path.resolve(rootDir, env.HARDWARE_LOCK_PATH || "data/agent.lock");
  const lock = readProcessLock(lockPath);
  if (lock?.alive) {
    throw new Error(
      `Agent masih berjalan (PID ${lock.pid}). Stop agent/Scheduled Task sebelum mengubah adapter.`,
    );
  }

  const journalPath = path.resolve(
    rootDir,
    env.HARDWARE_JOURNAL_PATH || "data/hardware-executions.sqlite",
  );
  const activeExecutions = countActiveExecutions(journalPath);
  if (activeExecutions > 0) {
    throw new Error(
      `Masih ada ${activeExecutions} local active/recoverable attempt. Selesaikan recovery sebelum mengubah adapter.`,
    );
  }

  const devices = device === "all" ? ["label", "document", "drawer"] : [device];
  if (mode === "real") {
    for (const selectedDevice of devices) {
      assertRealDeviceReady(selectedDevice, env, rootDir);
    }
  }

  const updates = {};
  for (const selectedDevice of devices) {
    updates[DEVICE_ENV_KEYS[selectedDevice]] = mode;
  }
  if (device === "all" && mode === "fake") {
    updates.HARDWARE_ADAPTER_MODE = "fake";
  }

  const backupPath = createEnvBackup(envPath, now);
  const updated = updateEnvContent(original, updates);
  fs.writeFileSync(envPath, updated, "utf8");

  const configCheck = runConfigCheck(rootDir);
  if (!configCheck.ok) {
    fs.copyFileSync(backupPath, envPath);
    const detail = [configCheck.stdout, configCheck.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `Config check gagal; .env sudah di-rollback dari ${backupPath}.${detail ? `\n${detail}` : ""}`,
    );
  }

  return {
    device,
    mode,
    backupPath,
    activeExecutions,
    configCheckOutput: configCheck.stdout.trim(),
  };
}

module.exports = {
  ACTIVE_EXECUTION_STATES,
  DEVICE_ENV_KEYS,
  assertRealDeviceReady,
  countActiveExecutions,
  createEnvBackup,
  parseEnv,
  readProcessLock,
  runConfigCheck,
  switchAdapter,
  updateEnvContent,
  windowsPrinterExists,
};
