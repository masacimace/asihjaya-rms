/* eslint-disable */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const AES_PREFIX = "aesgcm:v1";
const DPAPI_PREFIX = "dpapi:v1";

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
}

function getOrCreateLocalKey(keyPath) {
  ensureParent(keyPath);
  if (fs.existsSync(keyPath)) {
    const encoded = fs.readFileSync(keyPath, "utf8").trim();
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) {
      throw new Error("Hardware journal key file tidak valid.");
    }
    return key;
  }

  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key.toString("base64"), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  try {
    fs.chmodSync(keyPath, 0o600);
  } catch {}
  return key;
}

function runDpapi(operation, input) {
  const protect = operation === "protect";
  const script = protect
    ? [
        "$ErrorActionPreference='Stop'",
        "$raw=[Console]::In.ReadToEnd()",
        "$bytes=[Text.Encoding]::UTF8.GetBytes($raw)",
        "$out=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)",
        "[Console]::Out.Write([Convert]::ToBase64String($out))",
      ].join(";")
    : [
        "$ErrorActionPreference='Stop'",
        "$raw=[Console]::In.ReadToEnd().Trim()",
        "$bytes=[Convert]::FromBase64String($raw)",
        "$out=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)",
        "[Console]::Out.Write([Text.Encoding]::UTF8.GetString($out))",
      ].join(";");

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      input,
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    },
  );

  if (result.error || result.status !== 0) {
    throw new Error(
      `Windows DPAPI ${operation} gagal: ${result.stderr || result.error?.message || "unknown error"}`,
    );
  }

  return result.stdout.trim();
}

function createSecretProtector({ keyPath, platform = process.platform } = {}) {
  if (platform === "win32") {
    return {
      kind: "windows-dpapi-current-user",
      protect(value) {
        return `${DPAPI_PREFIX}:${runDpapi("protect", String(value))}`;
      },
      unprotect(value) {
        const prefix = `${DPAPI_PREFIX}:`;
        if (!String(value).startsWith(prefix)) {
          throw new Error("Encrypted journal secret bukan format DPAPI yang dikenal.");
        }
        return runDpapi("unprotect", String(value).slice(prefix.length));
      },
    };
  }

  if (!keyPath) {
    throw new Error("keyPath wajib untuk local AES journal secret protector.");
  }

  const key = getOrCreateLocalKey(keyPath);

  return {
    kind: "aes-256-gcm-local-key",
    protect(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([
        cipher.update(String(value), "utf8"),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      return [
        AES_PREFIX,
        iv.toString("base64"),
        tag.toString("base64"),
        encrypted.toString("base64"),
      ].join(":");
    },
    unprotect(value) {
      const parts = String(value).split(":");
      if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== AES_PREFIX) {
        throw new Error("Encrypted journal secret bukan format AES-GCM yang dikenal.");
      }
      const iv = Buffer.from(parts[2], "base64");
      const tag = Buffer.from(parts[3], "base64");
      const encrypted = Buffer.from(parts[4], "base64");
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    },
  };
}

module.exports = { createSecretProtector };
