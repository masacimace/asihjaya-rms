/* eslint-disable */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { createSecretProtector } = require("./secret-protector");

const STORE_VERSION = 1;
const INSTANCE_VERSION = 1;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
}

function chmodPrivate(filePath) {
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {}
}

function atomicWriteJson(filePath, value) {
  ensureParent(filePath);
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(tempPath, serialized, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  chmodPrivate(tempPath);
  try {
    fs.renameSync(tempPath, filePath);
    chmodPrivate(filePath);
  } catch (error) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {}
    throw error;
  }
}

function readJson(filePath, label) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} tidak dapat dibaca: ${error.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} tidak valid.`);
  }
  return parsed;
}

function normalizeApiUrl(value) {
  const raw = String(value || "").trim();
  const url = new URL(raw);
  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error("Credential store production wajib menggunakan HTTPS API URL.");
  }
  return url.toString().replace(/\/$/, "");
}

function validateUuid(value, label) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`${label} tidak valid.`);
  }
  return normalized;
}

function resolveProtector({
  protector,
  credentialKeyPath,
  platform = process.platform,
  powershellExecutable,
  spawnSyncImpl,
} = {}) {
  if (protector) return protector;
  return createSecretProtector({
    keyPath: credentialKeyPath,
    platform,
    powershellExecutable,
    spawnSyncImpl,
  });
}

function getOrCreateInstallerInstanceId({ instancePath }) {
  if (!instancePath) {
    throw new Error("instancePath wajib diisi.");
  }

  if (fs.existsSync(instancePath)) {
    const current = readJson(instancePath, "Installer instance store");
    if (current.version !== INSTANCE_VERSION) {
      throw new Error("Installer instance store version tidak didukung.");
    }
    return validateUuid(current.instanceId, "Installer instance ID");
  }

  const instanceId = crypto.randomUUID();
  atomicWriteJson(instancePath, {
    version: INSTANCE_VERSION,
    instanceId,
    createdAt: new Date().toISOString(),
  });
  return instanceId;
}

function saveHardwareCredential({
  credentialPath,
  credentialKeyPath,
  apiUrl,
  enrollmentId,
  instanceId,
  agentId,
  secret,
  authMode = "signed",
  protocolMode = "v2-preferred",
  machineName = null,
  installerVersion = null,
  protector,
  platform = process.platform,
  powershellExecutable,
  spawnSyncImpl,
}) {
  if (!credentialPath) {
    throw new Error("credentialPath wajib diisi.");
  }
  const normalizedEnrollmentId = validateUuid(enrollmentId, "Enrollment ID");
  const normalizedInstanceId = validateUuid(instanceId, "Installer instance ID");
  const normalizedAgentId = validateUuid(agentId, "Hardware Agent ID");
  const normalizedSecret = String(secret || "");
  if (normalizedSecret.length < 32) {
    throw new Error("Hardware Agent secret tidak valid.");
  }
  if (authMode !== "signed") {
    throw new Error("Credential store hanya menerima signed auth mode.");
  }

  const activeProtector = resolveProtector({
    protector,
    credentialKeyPath,
    platform,
    powershellExecutable,
    spawnSyncImpl,
  });
  const encryptedSecret = activeProtector.protect(normalizedSecret);
  if (!encryptedSecret || encryptedSecret === normalizedSecret) {
    throw new Error("Hardware Agent secret gagal dienkripsi.");
  }

  const document = {
    version: STORE_VERSION,
    apiUrl: normalizeApiUrl(apiUrl),
    enrollmentId: normalizedEnrollmentId,
    instanceId: normalizedInstanceId,
    agentId: normalizedAgentId,
    encryptedSecret,
    authMode,
    protocolMode: String(protocolMode || "v2-preferred").trim(),
    machineName: machineName ? String(machineName).trim().slice(0, 120) : null,
    installerVersion: installerVersion
      ? String(installerVersion).trim().slice(0, 64)
      : null,
    protectorKind: activeProtector.kind,
    savedAt: new Date().toISOString(),
  };

  atomicWriteJson(credentialPath, document);
  return {
    ...document,
    secret: normalizedSecret,
  };
}

function loadHardwareCredential({
  credentialPath,
  credentialKeyPath,
  protector,
  platform = process.platform,
  powershellExecutable,
  spawnSyncImpl,
}) {
  if (!credentialPath || !fs.existsSync(credentialPath)) {
    return null;
  }

  const document = readJson(credentialPath, "Hardware credential store");
  if (document.version !== STORE_VERSION) {
    throw new Error("Hardware credential store version tidak didukung.");
  }

  const activeProtector = resolveProtector({
    protector,
    credentialKeyPath,
    platform,
    powershellExecutable,
    spawnSyncImpl,
  });
  if (
    document.protectorKind &&
    String(document.protectorKind) !== String(activeProtector.kind)
  ) {
    throw new Error(
      `Credential protector tidak cocok: store=${document.protectorKind}, runtime=${activeProtector.kind}.`,
    );
  }

  const secret = activeProtector.unprotect(String(document.encryptedSecret || ""));
  if (!secret || secret.length < 32) {
    throw new Error("Hardware Agent secret hasil decrypt tidak valid.");
  }

  return {
    version: STORE_VERSION,
    apiUrl: normalizeApiUrl(document.apiUrl),
    enrollmentId: validateUuid(document.enrollmentId, "Enrollment ID"),
    instanceId: validateUuid(document.instanceId, "Installer instance ID"),
    agentId: validateUuid(document.agentId, "Hardware Agent ID"),
    secret,
    authMode: document.authMode === "signed" ? "signed" : (() => { throw new Error("Credential auth mode tidak valid."); })(),
    protocolMode: String(document.protocolMode || "v2-preferred").trim(),
    machineName: document.machineName ? String(document.machineName) : null,
    installerVersion: document.installerVersion ? String(document.installerVersion) : null,
    protectorKind: String(document.protectorKind || activeProtector.kind),
    savedAt: String(document.savedAt || ""),
  };
}

function verifyPersistedHardwareCredential(options, expected) {
  const loaded = loadHardwareCredential(options);
  if (!loaded) {
    throw new Error("Hardware credential belum tersimpan.");
  }
  if (
    loaded.enrollmentId !== validateUuid(expected.enrollmentId, "Enrollment ID") ||
    loaded.instanceId !== validateUuid(expected.instanceId, "Installer instance ID") ||
    loaded.agentId !== validateUuid(expected.agentId, "Hardware Agent ID") ||
    loaded.secret !== String(expected.secret || "")
  ) {
    throw new Error("Hardware credential persisted verification gagal.");
  }
  return loaded;
}

module.exports = {
  STORE_VERSION,
  INSTANCE_VERSION,
  atomicWriteJson,
  getOrCreateInstallerInstanceId,
  saveHardwareCredential,
  loadHardwareCredential,
  verifyPersistedHardwareCredential,
};
