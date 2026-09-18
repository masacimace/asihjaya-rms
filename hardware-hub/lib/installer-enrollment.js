/* eslint-disable */
const os = require("os");
const path = require("path");

const {
  getOrCreateInstallerInstanceId,
  loadHardwareCredential,
  saveHardwareCredential,
  verifyPersistedHardwareCredential,
} = require("./credential-store");
const {
  claimHardwareEnrollment,
  completeHardwareEnrollment,
} = require("./enrollment-client");

class HardwareInstallerEnrollmentError extends Error {
  constructor(message, { code, cause = null, credentialPersisted = false } = {}) {
    super(message);
    this.name = "HardwareInstallerEnrollmentError";
    this.code = code || "INSTALLER_ENROLLMENT_FAILED";
    this.cause = cause;
    this.credentialPersisted = credentialPersisted;
  }
}

function resolveStatePaths(stateDir) {
  const resolvedStateDir = path.resolve(String(stateDir || "data"));
  return {
    stateDir: resolvedStateDir,
    instancePath: path.join(resolvedStateDir, "installer-instance.json"),
    credentialPath: path.join(resolvedStateDir, "agent-credential.json"),
    credentialKeyPath: path.join(resolvedStateDir, "credential-store.key"),
  };
}

async function completePersistedCredential({
  credential,
  installerVersion,
  timeoutMs,
  fetchImpl,
}) {
  return completeHardwareEnrollment({
    apiUrl: credential.apiUrl,
    enrollmentId: credential.enrollmentId,
    instanceId: credential.instanceId,
    agentId: credential.agentId,
    agentSecret: credential.secret,
    installerVersion: installerVersion || credential.installerVersion,
    credentialStoreKind: credential.protectorKind,
    timeoutMs,
    fetchImpl,
  });
}

async function enrollHardwareHubInstaller({
  apiUrl,
  installationCode,
  stateDir = "data",
  machineName = os.hostname(),
  installerVersion = null,
  timeoutMs = 15_000,
  fetchImpl = globalThis.fetch,
  platform = process.platform,
  powershellExecutable,
  spawnSyncImpl,
  protector,
} = {}) {
  const paths = resolveStatePaths(stateDir);
  const existing = loadHardwareCredential({
    credentialPath: paths.credentialPath,
    credentialKeyPath: paths.credentialKeyPath,
    platform,
    powershellExecutable,
    spawnSyncImpl,
    protector,
  });

  if (existing) {
    try {
      const completion = await completePersistedCredential({
        credential: existing,
        installerVersion,
        timeoutMs,
        fetchImpl,
      });
      return {
        resumed: true,
        credentialPersisted: true,
        instanceId: existing.instanceId,
        credential: existing,
        completion,
      };
    } catch (error) {
      throw new HardwareInstallerEnrollmentError(
        "Credential Hardware Hub sudah tersimpan, tetapi completion ke RMS belum berhasil.",
        {
          code: "COMPLETION_RETRY_REQUIRED",
          cause: error,
          credentialPersisted: true,
        },
      );
    }
  }

  const instanceId = getOrCreateInstallerInstanceId({
    instancePath: paths.instancePath,
  });

  let claim;
  try {
    claim = await claimHardwareEnrollment({
      apiUrl,
      installationCode,
      instanceId,
      machineName,
      installerVersion,
      timeoutMs,
      fetchImpl,
    });
  } catch (error) {
    throw new HardwareInstallerEnrollmentError(
      "Installation Code gagal diklaim dari RMS.",
      { code: "CLAIM_FAILED", cause: error },
    );
  }

  let persisted;
  try {
    saveHardwareCredential({
      credentialPath: paths.credentialPath,
      credentialKeyPath: paths.credentialKeyPath,
      apiUrl,
      enrollmentId: claim.enrollment.id,
      instanceId,
      agentId: claim.agent.id,
      secret: claim.credential.secret,
      authMode: claim.credential.authMode,
      protocolMode: claim.credential.protocolMode,
      machineName,
      installerVersion,
      platform,
      powershellExecutable,
      spawnSyncImpl,
      protector,
    });

    persisted = verifyPersistedHardwareCredential(
      {
        credentialPath: paths.credentialPath,
        credentialKeyPath: paths.credentialKeyPath,
        platform,
        powershellExecutable,
        spawnSyncImpl,
        protector,
      },
      {
        enrollmentId: claim.enrollment.id,
        instanceId,
        agentId: claim.agent.id,
        secret: claim.credential.secret,
      },
    );
  } catch (error) {
    throw new HardwareInstallerEnrollmentError(
      "Credential Hardware Hub gagal disimpan atau diverifikasi secara durable.",
      { code: "CREDENTIAL_PERSIST_FAILED", cause: error },
    );
  }

  let completion;
  try {
    completion = await completePersistedCredential({
      credential: persisted,
      installerVersion,
      timeoutMs,
      fetchImpl,
    });
  } catch (error) {
    throw new HardwareInstallerEnrollmentError(
      "Credential sudah tersimpan aman, tetapi RMS belum menerima completion ACK.",
      {
        code: "COMPLETION_RETRY_REQUIRED",
        cause: error,
        credentialPersisted: true,
      },
    );
  }

  return {
    resumed: false,
    credentialPersisted: true,
    instanceId,
    credential: persisted,
    claim,
    completion,
  };
}

async function resumeHardwareHubEnrollment({
  stateDir = "data",
  installerVersion = null,
  timeoutMs = 15_000,
  fetchImpl = globalThis.fetch,
  platform = process.platform,
  powershellExecutable,
  spawnSyncImpl,
  protector,
} = {}) {
  const paths = resolveStatePaths(stateDir);
  const credential = loadHardwareCredential({
    credentialPath: paths.credentialPath,
    credentialKeyPath: paths.credentialKeyPath,
    platform,
    powershellExecutable,
    spawnSyncImpl,
    protector,
  });
  if (!credential) {
    throw new HardwareInstallerEnrollmentError(
      "Credential Hardware Hub belum tersedia untuk resume completion.",
      { code: "CREDENTIAL_NOT_FOUND" },
    );
  }

  const completion = await completePersistedCredential({
    credential,
    installerVersion,
    timeoutMs,
    fetchImpl,
  });
  return {
    resumed: true,
    credentialPersisted: true,
    instanceId: credential.instanceId,
    credential,
    completion,
  };
}

module.exports = {
  HardwareInstallerEnrollmentError,
  resolveStatePaths,
  enrollHardwareHubInstaller,
  resumeHardwareHubEnrollment,
};
