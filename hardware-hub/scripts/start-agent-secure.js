/* eslint-disable */
const path = require("path");

try {
  require("dotenv").config({
    path: path.resolve(__dirname, "..", ".env"),
    quiet: true,
  });
} catch {}

const { loadHardwareCredential } = require("../lib/credential-store");

const hubRoot = path.resolve(__dirname, "..");
const credentialPath = path.resolve(
  hubRoot,
  process.env.HARDWARE_CREDENTIAL_STORE_PATH?.trim() || "data/agent-credential.json",
);
const credentialKeyPath = path.resolve(
  hubRoot,
  process.env.HARDWARE_CREDENTIAL_KEY_PATH?.trim() || "data/credential-store.key",
);

let credential = null;
try {
  credential = loadHardwareCredential({
    credentialPath,
    credentialKeyPath,
    powershellExecutable:
      process.env.HARDWARE_POWERSHELL_EXECUTABLE?.trim() || "powershell.exe",
  });
} catch (error) {
  console.error(`[-] Secure Hardware Hub credential gagal dibaca: ${error.message}`);
  process.exit(78);
}

if (credential) {
  process.env.ASIHJAYA_API_URL = credential.apiUrl;
  process.env.HARDWARE_AGENT_ID = credential.agentId;
  process.env.HARDWARE_AGENT_SECRET = credential.secret;
  process.env.HARDWARE_AGENT_REQUEST_AUTH_MODE = credential.authMode;
  process.env.HARDWARE_PROTOCOL_MODE = credential.protocolMode;
} else if (!process.env.HARDWARE_AGENT_ID || !process.env.HARDWARE_AGENT_SECRET) {
  console.error(
    `[-] Credential Hardware Hub belum tersedia di ${credentialPath}. Jalankan enrollment installer terlebih dahulu.`,
  );
  process.exit(78);
}

require("../agent.js");
