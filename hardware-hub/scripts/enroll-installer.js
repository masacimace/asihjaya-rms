/* eslint-disable */
const path = require("path");

const {
  enrollHardwareHubInstaller,
  resumeHardwareHubEnrollment,
} = require("../lib/installer-enrollment");

function parseArgs(argv) {
  const result = { resume: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--resume") {
      result.resume = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Argumen ${arg} membutuhkan nilai.`);
    }
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

function safeResult(result) {
  return {
    success: true,
    resumed: Boolean(result.resumed),
    credentialPersisted: Boolean(result.credentialPersisted),
    instanceId: result.instanceId,
    enrollment: result.completion?.enrollment || null,
    agent: result.credential
      ? {
          id: result.credential.agentId,
          authMode: result.credential.authMode,
          protocolMode: result.credential.protocolMode,
          credentialStoreKind: result.credential.protectorKind,
        }
      : null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stateDir = path.resolve(
    String(args["state-dir"] || process.env.HARDWARE_INSTALLER_STATE_DIR || "data"),
  );
  const installerVersion =
    args["installer-version"] || process.env.HARDWARE_INSTALLER_VERSION || null;

  const result = args.resume
    ? await resumeHardwareHubEnrollment({
        stateDir,
        installerVersion,
      })
    : await enrollHardwareHubInstaller({
        apiUrl: required(
          args["api-url"] || process.env.ASIHJAYA_API_URL,
          "ASIHJAYA API URL",
        ),
        installationCode: required(
          args["installation-code"] || process.env.HARDWARE_INSTALLATION_CODE,
          "Installation Code",
        ),
        stateDir,
        machineName: args["machine-name"] || process.env.COMPUTERNAME || undefined,
        installerVersion,
      });

  process.stdout.write(`${JSON.stringify(safeResult(result))}\n`);
}

main().catch((error) => {
  const payload = {
    success: false,
    error: error?.code || "INSTALLER_ENROLLMENT_FAILED",
    message: error?.message || String(error),
    credentialPersisted: Boolean(error?.credentialPersisted),
    cause: error?.cause?.code || null,
  };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = error?.credentialPersisted ? 75 : 1;
});
