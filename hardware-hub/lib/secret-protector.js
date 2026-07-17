/* eslint-disable */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const AES_PREFIX = "aesgcm:v1";
const DPAPI_PREFIX = "dpapi:v1";
const DEFAULT_POWERSHELL_EXECUTABLE = "powershell.exe";

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

function buildDpapiBootstrapScript() {
  return [
    "$assemblyErrors=@()",
    "foreach($assemblyName in @('System.Security.Cryptography.ProtectedData','System.Security')) {",
    "  try {",
    "    Add-Type -AssemblyName $assemblyName -ErrorAction Stop",
    "    break",
    "  } catch {",
    "    $assemblyErrors += $_.Exception.Message",
    "  }",
    "}",
    "$protectedDataType=('System.Security.Cryptography.ProtectedData' -as [type])",
    "$scopeType=('System.Security.Cryptography.DataProtectionScope' -as [type])",
    "if($null -eq $protectedDataType -or $null -eq $scopeType) {",
    "  throw ('DPAPI type tidak tersedia. Assembly errors: '+($assemblyErrors -join ' | '))",
    "}",
  ].join("\n");
}

function buildDpapiScript(operation) {
  const common = [
    "$ErrorActionPreference='Stop'",
    buildDpapiBootstrapScript(),
    "$raw=[Console]::In.ReadToEnd()",
  ];

  if (operation === "protect") {
    return [
      ...common,
      "$bytes=[System.Text.Encoding]::UTF8.GetBytes($raw)",
      "$out=[System.Security.Cryptography.ProtectedData]::Protect($bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
      "[Console]::Out.Write([System.Convert]::ToBase64String($out))",
    ].join("\n");
  }

  if (operation === "unprotect") {
    return [
      ...common,
      "$bytes=[System.Convert]::FromBase64String($raw.Trim())",
      "$out=[System.Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
      "[Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($out))",
    ].join("\n");
  }

  throw new Error(`Operasi DPAPI tidak dikenal: ${operation}`);
}

function normalizePowerShellError(result) {
  const stderr = String(result?.stderr || "").trim();
  const stdout = String(result?.stdout || "").trim();
  const processError = result?.error?.message || "";
  return stderr || processError || stdout || "unknown error";
}

function runDpapi(
  operation,
  input,
  {
    powershellExecutable = process.env.HARDWARE_POWERSHELL_EXECUTABLE?.trim() ||
      DEFAULT_POWERSHELL_EXECUTABLE,
    spawnSyncImpl = spawnSync,
  } = {},
) {
  const result = spawnSyncImpl(
    powershellExecutable,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      buildDpapiScript(operation),
    ],
    {
      input,
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    },
  );

  if (result?.error || result?.status !== 0) {
    const detail = normalizePowerShellError(result);
    throw new Error(
      `Windows DPAPI ${operation} gagal melalui ${powershellExecutable}: ${detail}`,
    );
  }

  const output = String(result.stdout || "").trim();
  if (!output) {
    throw new Error(
      `Windows DPAPI ${operation} gagal melalui ${powershellExecutable}: output kosong.`,
    );
  }
  return output;
}

function createRoundTripSelfTest(protector) {
  const sentinel = `asihjaya-hardware-hub-self-test:${crypto.randomUUID()}`;
  const encrypted = protector.protect(sentinel);
  if (encrypted === sentinel || !encrypted.includes(":")) {
    throw new Error("Secret protector self-test menghasilkan ciphertext yang tidak valid.");
  }
  const decrypted = protector.unprotect(encrypted);
  if (decrypted !== sentinel) {
    throw new Error("Secret protector self-test gagal: hasil decrypt tidak sama.");
  }
  return {
    ok: true,
    kind: protector.kind,
    testedAt: new Date().toISOString(),
  };
}

function createSecretProtector({
  keyPath,
  platform = process.platform,
  powershellExecutable = process.env.HARDWARE_POWERSHELL_EXECUTABLE?.trim() ||
    DEFAULT_POWERSHELL_EXECUTABLE,
  spawnSyncImpl = spawnSync,
} = {}) {
  if (platform === "win32") {
    const protector = {
      kind: "windows-dpapi-current-user",
      powershellExecutable,
      protect(value) {
        return `${DPAPI_PREFIX}:${runDpapi("protect", String(value), {
          powershellExecutable,
          spawnSyncImpl,
        })}`;
      },
      unprotect(value) {
        const prefix = `${DPAPI_PREFIX}:`;
        if (!String(value).startsWith(prefix)) {
          throw new Error("Encrypted journal secret bukan format DPAPI yang dikenal.");
        }
        return runDpapi("unprotect", String(value).slice(prefix.length), {
          powershellExecutable,
          spawnSyncImpl,
        });
      },
      selfTest() {
        return createRoundTripSelfTest(protector);
      },
    };
    return protector;
  }

  if (!keyPath) {
    throw new Error("keyPath wajib untuk local AES journal secret protector.");
  }

  const key = getOrCreateLocalKey(keyPath);
  const protector = {
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
    selfTest() {
      return createRoundTripSelfTest(protector);
    },
  };
  return protector;
}

module.exports = {
  DEFAULT_POWERSHELL_EXECUTABLE,
  buildDpapiBootstrapScript,
  buildDpapiScript,
  createSecretProtector,
  runDpapi,
};
