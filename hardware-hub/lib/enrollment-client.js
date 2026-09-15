class HardwareEnrollmentClaimError extends Error {
  constructor(message, { status = null, code = null, retryAfterSeconds = null } = {}) {
    super(message);
    this.name = "HardwareEnrollmentClaimError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function normalizeApiUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new HardwareEnrollmentClaimError("ASIHJAYA API URL wajib diisi.", {
      code: "INVALID_API_URL",
    });
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HardwareEnrollmentClaimError("ASIHJAYA API URL tidak valid.", {
      code: "INVALID_API_URL",
    });
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HardwareEnrollmentClaimError(
      "ASIHJAYA API URL harus memakai HTTP atau HTTPS.",
      { code: "INVALID_API_URL" },
    );
  }

  return url.toString().replace(/\/$/, "");
}

function optionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

async function parseJsonResponse(response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HardwareEnrollmentClaimError(
      "RMS mengembalikan response enrollment yang tidak valid.",
      { status: response.status, code: "INVALID_SERVER_RESPONSE" },
    );
  }
}

async function claimHardwareEnrollment({
  apiUrl,
  installationCode,
  instanceId,
  machineName,
  installerVersion,
  timeoutMs = 15_000,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new HardwareEnrollmentClaimError("HTTP client tidak tersedia.", {
      code: "HTTP_CLIENT_UNAVAILABLE",
    });
  }

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new HardwareEnrollmentClaimError("Enrollment timeout tidak valid.", {
      code: "INVALID_TIMEOUT",
    });
  }

  const baseUrl = normalizeApiUrl(apiUrl);
  const code = String(installationCode || "").trim().toUpperCase();
  const persistentInstanceId = String(instanceId || "").trim().toLowerCase();

  if (!code || !persistentInstanceId) {
    throw new HardwareEnrollmentClaimError(
      "Installation Code dan persistent instance ID wajib diisi.",
      { code: "INVALID_ENROLLMENT_INPUT" },
    );
  }

  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/hardware/v2/enrollments/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        installationCode: code,
        instanceId: persistentInstanceId,
        machineName: optionalText(machineName),
        installerVersion: optionalText(installerVersion),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new HardwareEnrollmentClaimError(
        "Koneksi ke RMS timeout saat mengklaim Installation Code.",
        { code: "CLAIM_TIMEOUT" },
      );
    }
    throw new HardwareEnrollmentClaimError(
      "Tidak dapat terhubung ke RMS untuk mengklaim Installation Code.",
      { code: "CLAIM_NETWORK_ERROR" },
    );
  }

  const payload = await parseJsonResponse(response);
  const retryAfterHeader = response.headers?.get?.("retry-after");
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : null;

  if (!response.ok || payload?.success !== true) {
    throw new HardwareEnrollmentClaimError(
      `Enrollment ditolak oleh RMS (${payload?.error || response.status}).`,
      {
        status: response.status,
        code: payload?.error || "CLAIM_REJECTED",
        retryAfterSeconds:
          Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds
            : null,
      },
    );
  }

  if (
    !payload?.agent?.id ||
    !payload?.credential?.secret ||
    payload?.credential?.authMode !== "signed"
  ) {
    throw new HardwareEnrollmentClaimError(
      "Response enrollment RMS tidak memiliki credential yang lengkap.",
      { status: response.status, code: "INCOMPLETE_CREDENTIAL_RESPONSE" },
    );
  }

  return payload;
}

module.exports = {
  HardwareEnrollmentClaimError,
  claimHardwareEnrollment,
};
