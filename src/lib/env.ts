export type EnvironmentMode = "development" | "test" | "production";

export type EnvironmentSource = Readonly<
  Record<string, string | undefined>
>;

export type EnvironmentValidationIssue = {
  name: string;
  message: string;
};

export type ValidateEnvironmentOptions = {
  mode?: EnvironmentMode;
  requireCore?: boolean;
  requireDeployment?: boolean;
};

export const CORE_SECRET_NAMES = [
  "SESSION_SECRET",
  "RECEIPT_VERIFICATION_SECRET",
  "CUSTOMER_HISTORY_SESSION_SECRET",
  "CUSTOMER_HISTORY_PIN_PEPPER",
  "SECURITY_RATE_LIMIT_SECRET",
  "PDF_RENDER_TOKEN_SECRET",
  "HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY",
] as const;

export const CORE_REQUIRED_NAMES = [
  "APP_URL",
  "DATABASE_URL",
  "DEFAULT_ORGANIZATION_SLUG",
  ...CORE_SECRET_NAMES,
] as const;

export const PRODUCTION_DEPLOYMENT_REQUIRED_NAMES = [
  "NODE_ENV",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
] as const;

export const GENERATED_PRODUCTION_SECRET_NAMES = [
  "POSTGRES_PASSWORD",
  ...CORE_SECRET_NAMES,
  "BOOTSTRAP_ADMIN_PASSWORD",
  "HARDWARE_AGENT_SECRET",
] as const;

export const PRODUCTION_ENVIRONMENT_TEMPLATE_NAMES = [
  "NODE_ENV",
  "ASIHJAYA_IMAGE",
  "ASIHJAYA_ENV_FILE",
  "ASIHJAYA_BIND_ADDRESS",
  "ASIHJAYA_APP_PORT",
  "APP_REVISION",
  "APP_BUILD_DATE",
  "NEXT_PUBLIC_APP_NAME",
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
  "INTERNAL_RENDER_ORIGIN",
  "DEFAULT_ORGANIZATION_SLUG",
  "SERVER_ACTION_BODY_SIZE_LIMIT",
  "PORT",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "DATABASE_URL",
  ...CORE_SECRET_NAMES,
  "TRUST_PROXY",
  "TRUST_PROXY_HOPS",
  "LOGIN_RATE_LIMIT_IDENTIFIER_FAILURES",
  "LOGIN_RATE_LIMIT_IP_FAILURES",
  "LOGIN_RATE_LIMIT_WINDOW_MS",
  "LOGIN_RATE_LIMIT_BLOCK_MS",
  "SECURITY_RATE_LIMIT_RETENTION_HOURS",
  "PDF_RATE_LIMIT_ACTOR_REQUESTS",
  "PDF_RATE_LIMIT_IP_REQUESTS",
  "PDF_RATE_LIMIT_WINDOW_MS",
  "PDF_RATE_LIMIT_BLOCK_MS",
  "BOOTSTRAP_ORGANIZATION_NAME",
  "BOOTSTRAP_ORGANIZATION_SLUG",
  "BOOTSTRAP_OUTLET_CODE",
  "BOOTSTRAP_OUTLET_NAME",
  "BOOTSTRAP_REGISTER_CODE",
  "BOOTSTRAP_REGISTER_NAME",
  "BOOTSTRAP_ADMIN_NAME",
  "BOOTSTRAP_ADMIN_USERNAME",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_PASSWORD",
  "HARDWARE_JOB_COMPLETED_RETENTION_DAYS",
  "HARDWARE_JOB_CANCELLED_RETENTION_DAYS",
  "HARDWARE_JOB_FAILED_RETENTION_DAYS",
  "HARDWARE_JOB_STALE_MINUTES",
  "HARDWARE_AGENT_STALE_MINUTES",
  "HARDWARE_AGENT_AUTH_MODE",
  "HARDWARE_AGENT_SIGNATURE_TOLERANCE_MS",
  "HARDWARE_AGENT_NONCE_TTL_MS",
  "HARDWARE_AGENT_SIGNED_BODY_MAX_BYTES",
  "HARDWARE_AGENT_AUTH_FAILURE_WINDOW_MS",
  "HARDWARE_AGENT_AUTH_FAILURE_LIMIT_PER_AGENT",
  "HARDWARE_AGENT_AUTH_FAILURE_LIMIT_PER_IP",
  "HARDWARE_AGENT_ORGANIZATION_SLUG",
  "HARDWARE_AGENT_OUTLET_CODE",
  "HARDWARE_AGENT_REGISTER_CODE",
  "HARDWARE_AGENT_CODE",
  "HARDWARE_AGENT_NAME",
  "HARDWARE_AGENT_SECRET",
  "SHIFT_CASH_VARIANCE_CRITICAL_AMOUNT",
  "LARGE_CASH_OUT_NOTIFICATION_AMOUNT",
  "NOTIFICATION_SUCCESS_AUTO_RESOLVE_DAYS",
  "NOTIFICATION_INFO_AUTO_RESOLVE_DAYS",
  "NOTIFICATION_WARNING_AUTO_RESOLVE_DAYS",
  "NOTIFICATION_RESOLVED_AUTO_ARCHIVE_DAYS",
  "NOTIFICATION_MAINTENANCE_INTERVAL_MINUTES",
  "NOTIFICATION_ANTI_SPAM_WINDOW_MINUTES",
  "HARDWARE_PENDING_WARNING_SECONDS",
  "HARDWARE_SUBMITTED_WARNING_SECONDS",
  "HARDWARE_FAILURE_RATE_WARNING_PERCENT",
  "IMAGE_STORAGE_DRIVER",
  "IMAGE_STORAGE_ROOT",
  "IMAGE_MAX_UPLOAD_MB",
  "IMAGE_STORAGE_BUCKET",
  "IMAGE_STORAGE_ENDPOINT",
  "IMAGE_STORAGE_REGION",
  "IMAGE_STORAGE_ACCESS_KEY_ID",
  "IMAGE_STORAGE_SECRET_ACCESS_KEY",
  "IMAGE_STORAGE_FORCE_PATH_STYLE",
  "LEGACY_IMAGE_ALLOWED_HOSTS",
  "LEGACY_IMAGE_DOWNLOAD_TIMEOUT_MS",
  "LEGACY_IMAGE_DOWNLOAD_MAX_MB",
  "RECEIPT_OUTLET_INSTAGRAM",
  "RECEIPT_VENDOR_OUTLET_NAME",
  "RECEIPT_VENDOR_OUTLET_ADDRESS",
  "RECEIPT_VENDOR_OUTLET_PHONE",
  "RECEIPT_VENDOR_OUTLET_INSTAGRAM",
  "RECEIPT_DOCUMENT_PROFILE_ID",
  "RECEIPT_OVERLAY_OFFSET_X_MM",
  "RECEIPT_OVERLAY_OFFSET_Y_MM",
  "RECEIPT_OVERLAY_SCALE",
  "PDF_RENDER_TOKEN_TTL_MS",
  "PDF_RENDER_MAX_CONCURRENCY",
  "PDF_RENDER_MAX_QUEUE",
  "PDF_RENDER_QUEUE_WAIT_TIMEOUT_MS",
  "PDF_RENDER_TIMEOUT_MS",
  "PDF_RENDER_DISABLE_SANDBOX",
  "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH",
] as const;

const PLACEHOLDER_PATTERN =
  /(?:change[-_ ]?me|replace[-_ ]?me|generate[-_ ]?me|your[-_ ]?(?:secret|password|key)|example[-_ ]?(?:secret|password|key)|sample[-_ ]?(?:secret|password|key)|dummy|todo|password123|secret123|<[^>]+>)/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const BOOLEAN_VALUES = new Set(["true", "false", "1", "0", "yes", "no", "on", "off"]);

export class EnvironmentValidationError extends Error {
  readonly issues: readonly EnvironmentValidationIssue[];

  constructor(issues: readonly EnvironmentValidationIssue[]) {
    super(
      `Konfigurasi environment tidak valid:\n${issues
        .map((issue) => `- ${issue.name}: ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "EnvironmentValidationError";
    this.issues = issues;
  }
}

function resolveMode(source: EnvironmentSource): EnvironmentMode {
  const configured = source.NODE_ENV?.trim().toLowerCase();
  if (configured === "production" || configured === "test") {
    return configured;
  }
  return "development";
}

function optional(source: EnvironmentSource, name: string): string | undefined {
  const value = source[name]?.trim();
  return value ? value : undefined;
}

function required(source: EnvironmentSource, name: string): string {
  const value = optional(source, name);
  if (!value) {
    throw new EnvironmentValidationError([
      { name, message: "wajib diatur." },
    ]);
  }
  return value;
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERN.test(value);
}

function hasWeakCharacterDiversity(value: string): boolean {
  return new Set(value).size < 12;
}

function validateSecretValue(
  issues: EnvironmentValidationIssue[],
  name: string,
  value: string,
  minimumLength: number,
): void {
  if (value.length < minimumLength) {
    pushIssue(
      issues,
      name,
      `minimal harus terdiri dari ${minimumLength} karakter.`,
    );
  }
  if (isPlaceholder(value)) {
    pushIssue(issues, name, "masih memakai placeholder dan wajib diganti.");
  }
  if (hasWeakCharacterDiversity(value)) {
    pushIssue(
      issues,
      name,
      "terlalu mudah ditebak; gunakan secret acak dari generator atau password manager.",
    );
  }
}

function secret(source: EnvironmentSource, name: string): string {
  const value = required(source, name);
  const issues: EnvironmentValidationIssue[] = [];

  if (value.length < 32) {
    issues.push({ name, message: "minimal harus terdiri dari 32 karakter." });
  }
  if (isPlaceholder(value)) {
    issues.push({ name, message: "masih memakai placeholder dan wajib diganti." });
  }

  if (issues.length > 0) {
    throw new EnvironmentValidationError(issues);
  }
  return value;
}

function parseHttpOrigin(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new EnvironmentValidationError([
      { name, message: "harus berupa URL HTTP(S) yang valid." },
    ]);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new EnvironmentValidationError([
      {
        name,
        message:
          "harus berupa origin HTTP(S) tanpa path, credential, query, atau hash.",
      },
    ]);
  }

  return url;
}

function appUrl(source: EnvironmentSource, name: string): string {
  return parseHttpOrigin(required(source, name), name).origin;
}

function internalRenderOrigin(source: EnvironmentSource): string {
  const configured = optional(source, "INTERNAL_RENDER_ORIGIN");
  const fallbackPort = optional(source, "PORT") || "3000";
  const value = configured || `http://127.0.0.1:${fallbackPort}`;
  return parseHttpOrigin(value, "INTERNAL_RENDER_ORIGIN").origin;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}

function pushIssue(
  issues: EnvironmentValidationIssue[],
  name: string,
  message: string,
): void {
  issues.push({ name, message });
}

function validateOptionalBoolean(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
  name: string,
): boolean | undefined {
  const value = optional(source, name)?.toLowerCase();
  if (!value) return undefined;
  if (!BOOLEAN_VALUES.has(value)) {
    pushIssue(issues, name, "harus bernilai true atau false.");
    return undefined;
  }
  return ["true", "1", "yes", "on"].includes(value);
}

function validateOptionalInteger(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
  name: string,
  min: number,
  max: number,
): number | undefined {
  const rawValue = optional(source, name);
  if (!rawValue) return undefined;
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    pushIssue(issues, name, `harus bilangan bulat antara ${min} dan ${max}.`);
    return undefined;
  }
  return value;
}

function validateOptionalNumber(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
  name: string,
  min: number,
  max: number,
): number | undefined {
  const rawValue = optional(source, name);
  if (!rawValue) return undefined;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < min || value > max) {
    pushIssue(issues, name, `harus berupa angka antara ${min} dan ${max}.`);
    return undefined;
  }
  return value;
}

function validateOptionalEnum(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
  name: string,
  allowedValues: readonly string[],
): string | undefined {
  const value = optional(source, name)?.toLowerCase();
  if (!value) return undefined;
  if (!allowedValues.includes(value)) {
    pushIssue(issues, name, `harus salah satu dari: ${allowedValues.join(", ")}.`);
    return undefined;
  }
  return value;
}

function validateRequiredValues(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
): void {
  for (const name of CORE_REQUIRED_NAMES) {
    if (!optional(source, name)) {
      pushIssue(issues, name, "wajib diatur pada runtime production.");
    }
  }
}

function validateApplicationUrls(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
  mode: EnvironmentMode,
): void {
  const rawAppUrl = optional(source, "APP_URL");
  if (rawAppUrl) {
    try {
      const parsed = parseHttpOrigin(rawAppUrl, "APP_URL");
      if (
        mode === "production" &&
        !isLoopbackHostname(parsed.hostname) &&
        parsed.protocol !== "https:"
      ) {
        pushIssue(
          issues,
          "APP_URL",
          "wajib menggunakan HTTPS untuk hostname non-loopback di production.",
        );
      }
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }
  }

  const rawInternalOrigin = optional(source, "INTERNAL_RENDER_ORIGIN");
  if (rawInternalOrigin) {
    try {
      parseHttpOrigin(rawInternalOrigin, "INTERNAL_RENDER_ORIGIN");
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }
  }
}

function validateDatabaseUrl(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
  mode: EnvironmentMode,
): void {
  const rawValue = optional(source, "DATABASE_URL");
  if (!rawValue) return;

  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    pushIssue(issues, "DATABASE_URL", "harus berupa PostgreSQL URL yang valid.");
    return;
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    pushIssue(issues, "DATABASE_URL", "harus memakai protokol postgres atau postgresql.");
  }
  if (!url.hostname || !url.pathname || url.pathname === "/") {
    pushIssue(issues, "DATABASE_URL", "harus mencantumkan hostname dan nama database.");
  }
  if (mode === "production" && (!url.username || !url.password)) {
    pushIssue(
      issues,
      "DATABASE_URL",
      "production harus mencantumkan username dan password database.",
    );
  }
  if (
    mode === "production" &&
    url.username === "build" &&
    url.password === "build"
  ) {
    pushIssue(issues, "DATABASE_URL", "credential build tidak boleh dipakai di production.");
  }
}

function validateOrganizationSlug(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
): void {
  const value = optional(source, "DEFAULT_ORGANIZATION_SLUG");
  if (value && !SLUG_PATTERN.test(value.toLowerCase())) {
    pushIssue(
      issues,
      "DEFAULT_ORGANIZATION_SLUG",
      "harus berupa slug lowercase berisi huruf, angka, dan tanda hubung.",
    );
  }
}

function validateSecrets(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
  mode: EnvironmentMode,
): void {
  const configuredSecrets: Array<{ name: string; value: string }> = [];
  const minimumLength = mode === "production" ? 43 : 32;

  for (const name of CORE_SECRET_NAMES) {
    const value = optional(source, name);
    if (!value) continue;
    validateSecretValue(issues, name, value, minimumLength);
    configuredSecrets.push({ name, value });
  }

  for (const [index, left] of configuredSecrets.entries()) {
    for (const right of configuredSecrets.slice(index + 1)) {
      if (left.value === right.value) {
        pushIssue(
          issues,
          right.name,
          `harus berbeda dari ${left.name}; secret tidak boleh digunakan ulang.`,
        );
      }
    }
  }
}

function validateProxyPolicy(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
  mode: EnvironmentMode,
): void {
  const trustProxy = validateOptionalBoolean(source, issues, "TRUST_PROXY");
  validateOptionalInteger(source, issues, "TRUST_PROXY_HOPS", 1, 10);

  const rawAppUrl = optional(source, "APP_URL");
  if (!rawAppUrl || mode !== "production") return;

  try {
    const url = parseHttpOrigin(rawAppUrl, "APP_URL");
    if (!isLoopbackHostname(url.hostname) && trustProxy !== true) {
      pushIssue(
        issues,
        "TRUST_PROXY",
        "harus true untuk production non-loopback di belakang Cloudflare/reverse proxy.",
      );
    }
  } catch {
    // APP_URL sudah dilaporkan oleh validateApplicationUrls.
  }
}

function validateStoragePolicy(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
): void {
  const driver =
    validateOptionalEnum(source, issues, "IMAGE_STORAGE_DRIVER", ["local", "s3"]) ||
    "local";
  validateOptionalBoolean(source, issues, "IMAGE_STORAGE_FORCE_PATH_STYLE");

  if (driver !== "s3") return;

  for (const name of [
    "IMAGE_STORAGE_BUCKET",
    "IMAGE_STORAGE_REGION",
    "IMAGE_STORAGE_ACCESS_KEY_ID",
    "IMAGE_STORAGE_SECRET_ACCESS_KEY",
  ]) {
    const value = optional(source, name);
    if (!value) {
      pushIssue(issues, name, "wajib diatur ketika IMAGE_STORAGE_DRIVER=s3.");
    } else if (isPlaceholder(value)) {
      pushIssue(issues, name, "masih memakai placeholder dan wajib diganti.");
    }
  }

  if (
    optional(source, "IMAGE_STORAGE_REGION")?.toLowerCase() === "auto" &&
    !optional(source, "IMAGE_STORAGE_ENDPOINT")
  ) {
    pushIssue(
      issues,
      "IMAGE_STORAGE_ENDPOINT",
      "wajib diatur ketika region S3 menggunakan nilai auto.",
    );
  }
}

function validateSecurityAndRuntimeOptions(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
  mode: EnvironmentMode,
): void {
  const authMode = validateOptionalEnum(source, issues, "HARDWARE_AGENT_AUTH_MODE", [
    "dual",
    "signed-only",
    "legacy-only",
  ]);
  if (mode === "production" && authMode === "legacy-only") {
    pushIssue(
      issues,
      "HARDWARE_AGENT_AUTH_MODE",
      "legacy-only hanya boleh digunakan untuk rollback darurat, bukan konfigurasi production normal.",
    );
  }

  validateOptionalBoolean(source, issues, "PDF_RENDER_DISABLE_SANDBOX");

  const integerRules: Array<[string, number, number]> = [
    ["PORT", 1, 65_535],
    ["LOGIN_RATE_LIMIT_IDENTIFIER_FAILURES", 1, 100_000],
    ["LOGIN_RATE_LIMIT_IP_FAILURES", 1, 100_000],
    ["LOGIN_RATE_LIMIT_WINDOW_MS", 1_000, 86_400_000],
    ["LOGIN_RATE_LIMIT_BLOCK_MS", 1_000, 86_400_000],
    ["SECURITY_RATE_LIMIT_RETENTION_HOURS", 1, 8_760],
    ["PDF_RATE_LIMIT_ACTOR_REQUESTS", 1, 100_000],
    ["PDF_RATE_LIMIT_IP_REQUESTS", 1, 100_000],
    ["PDF_RATE_LIMIT_WINDOW_MS", 1_000, 86_400_000],
    ["PDF_RATE_LIMIT_BLOCK_MS", 1_000, 86_400_000],
    ["HARDWARE_JOB_COMPLETED_RETENTION_DAYS", 1, 365],
    ["HARDWARE_JOB_CANCELLED_RETENTION_DAYS", 1, 365],
    ["HARDWARE_JOB_FAILED_RETENTION_DAYS", 1, 365],
    ["HARDWARE_JOB_STALE_MINUTES", 1, 10_080],
    ["HARDWARE_AGENT_STALE_MINUTES", 1, 10_080],
    ["HARDWARE_AGENT_SIGNATURE_TOLERANCE_MS", 1_000, 3_600_000],
    ["HARDWARE_AGENT_NONCE_TTL_MS", 1_000, 86_400_000],
    ["HARDWARE_AGENT_SIGNED_BODY_MAX_BYTES", 1_024, 20 * 1_024 * 1_024],
    ["HARDWARE_AGENT_AUTH_FAILURE_WINDOW_MS", 1_000, 86_400_000],
    ["HARDWARE_AGENT_AUTH_FAILURE_LIMIT_PER_AGENT", 1, 100_000],
    ["HARDWARE_AGENT_AUTH_FAILURE_LIMIT_PER_IP", 1, 100_000],
    ["NOTIFICATION_SUCCESS_AUTO_RESOLVE_DAYS", 1, 365],
    ["NOTIFICATION_INFO_AUTO_RESOLVE_DAYS", 1, 365],
    ["NOTIFICATION_WARNING_AUTO_RESOLVE_DAYS", 1, 365],
    ["NOTIFICATION_RESOLVED_AUTO_ARCHIVE_DAYS", 1, 365],
    ["NOTIFICATION_MAINTENANCE_INTERVAL_MINUTES", 1, 1_440],
    ["NOTIFICATION_ANTI_SPAM_WINDOW_MINUTES", 1, 1_440],
    ["IMAGE_MAX_UPLOAD_MB", 1, 100],
    ["LEGACY_IMAGE_DOWNLOAD_TIMEOUT_MS", 1_000, 120_000],
    ["LEGACY_IMAGE_DOWNLOAD_MAX_MB", 1, 100],
    ["HARDWARE_PENDING_WARNING_SECONDS", 1, 86_400],
    ["HARDWARE_SUBMITTED_WARNING_SECONDS", 1, 86_400],
    ["HARDWARE_FAILURE_RATE_WARNING_PERCENT", 1, 100],
    ["PDF_RENDER_TOKEN_TTL_MS", 1_000, 3_600_000],
    ["PDF_RENDER_MAX_CONCURRENCY", 1, 16],
    ["PDF_RENDER_MAX_QUEUE", 1, 1_000],
    ["PDF_RENDER_QUEUE_WAIT_TIMEOUT_MS", 1_000, 300_000],
    ["PDF_RENDER_TIMEOUT_MS", 1_000, 300_000],
  ];

  for (const [name, min, max] of integerRules) {
    validateOptionalInteger(source, issues, name, min, max);
  }

  validateOptionalNumber(source, issues, "SHIFT_CASH_VARIANCE_CRITICAL_AMOUNT", 0, 1e15);
  validateOptionalNumber(source, issues, "LARGE_CASH_OUT_NOTIFICATION_AMOUNT", 0, 1e15);
  validateOptionalNumber(source, issues, "RECEIPT_OVERLAY_OFFSET_X_MM", -100, 100);
  validateOptionalNumber(source, issues, "RECEIPT_OVERLAY_OFFSET_Y_MM", -100, 100);
  validateOptionalNumber(source, issues, "RECEIPT_OVERLAY_SCALE", 0.5, 2);

  validateOptionalEnum(source, issues, "RECEIPT_DOCUMENT_PROFILE_ID", [
    "receipt_a4_landscape_v1",
    "receipt_a5_landscape_v1",
  ]);

  const bodySizeLimit = optional(source, "SERVER_ACTION_BODY_SIZE_LIMIT");
  if (bodySizeLimit && !/^\d+(?:\.\d+)?(?:kb|mb|gb)$/i.test(bodySizeLimit)) {
    pushIssue(
      issues,
      "SERVER_ACTION_BODY_SIZE_LIMIT",
      "harus memakai format ukuran seperti 20mb atau 512kb.",
    );
  }

  const allowedHosts = optional(source, "LEGACY_IMAGE_ALLOWED_HOSTS");
  if (allowedHosts) {
    for (const host of allowedHosts.split(",").map((value) => value.trim()).filter(Boolean)) {
      if (
        host.includes("://") ||
        host.includes("/") ||
        host.includes("?") ||
        host.includes("#")
      ) {
        pushIssue(
          issues,
          "LEGACY_IMAGE_ALLOWED_HOSTS",
          "hanya boleh berisi hostname yang dipisahkan koma tanpa protokol atau path.",
        );
        break;
      }
    }
  }
}

function decodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function validateProductionDeployment(
  source: EnvironmentSource,
  issues: EnvironmentValidationIssue[],
  mode: EnvironmentMode,
): void {
  for (const name of PRODUCTION_DEPLOYMENT_REQUIRED_NAMES) {
    if (!optional(source, name)) {
      pushIssue(issues, name, "wajib diatur untuk deployment production.");
    }
  }

  if (optional(source, "NODE_ENV") !== "production") {
    pushIssue(issues, "NODE_ENV", "wajib bernilai production untuk deployment production.");
  }

  const databaseName = optional(source, "POSTGRES_DB");
  const databaseUser = optional(source, "POSTGRES_USER");
  const databasePassword = optional(source, "POSTGRES_PASSWORD");

  const identifierPattern = /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/;
  if (databaseName && !identifierPattern.test(databaseName)) {
    pushIssue(
      issues,
      "POSTGRES_DB",
      "harus berupa identifier database sederhana tanpa spasi atau karakter shell.",
    );
  }
  if (databaseUser && !identifierPattern.test(databaseUser)) {
    pushIssue(
      issues,
      "POSTGRES_USER",
      "harus berupa identifier role sederhana tanpa spasi atau karakter shell.",
    );
  }
  if (databasePassword) {
    validateSecretValue(issues, "POSTGRES_PASSWORD", databasePassword, 32);
    if (databasePassword === databaseUser || databasePassword === databaseName) {
      pushIssue(
        issues,
        "POSTGRES_PASSWORD",
        "tidak boleh sama dengan nama database atau username database.",
      );
    }
  }

  const databaseUrl = optional(source, "DATABASE_URL");
  if (databaseUrl && databaseName && databaseUser && databasePassword) {
    try {
      const parsed = new URL(databaseUrl);
      const urlDatabaseName = decodeUrlComponent(parsed.pathname.replace(/^\//, ""));
      const urlUser = decodeUrlComponent(parsed.username);
      const urlPassword = decodeUrlComponent(parsed.password);

      if (urlDatabaseName !== databaseName) {
        pushIssue(
          issues,
          "DATABASE_URL",
          "nama database harus sama dengan POSTGRES_DB.",
        );
      }
      if (urlUser !== databaseUser) {
        pushIssue(
          issues,
          "DATABASE_URL",
          "username harus sama dengan POSTGRES_USER.",
        );
      }
      if (urlPassword !== databasePassword) {
        pushIssue(
          issues,
          "DATABASE_URL",
          "password harus sama dengan POSTGRES_PASSWORD.",
        );
      }
    } catch {
      // Format URL sudah dilaporkan oleh validateDatabaseUrl.
    }
  }

  const publicAppUrl = optional(source, "NEXT_PUBLIC_APP_URL");
  const appUrlValue = optional(source, "APP_URL");
  if (publicAppUrl && appUrlValue) {
    try {
      const publicOrigin = parseHttpOrigin(publicAppUrl, "NEXT_PUBLIC_APP_URL").origin;
      const privateOrigin = parseHttpOrigin(appUrlValue, "APP_URL").origin;
      if (publicOrigin !== privateOrigin) {
        pushIssue(
          issues,
          "NEXT_PUBLIC_APP_URL",
          "harus sama dengan APP_URL agar origin public dan server konsisten.",
        );
      }
    } catch (error) {
      if (error instanceof EnvironmentValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }
  }

  const bindAddress = optional(source, "ASIHJAYA_BIND_ADDRESS");
  if (bindAddress && !["127.0.0.1", "::1", "localhost"].includes(bindAddress)) {
    pushIssue(
      issues,
      "ASIHJAYA_BIND_ADDRESS",
      "wajib bind ke loopback; akses publik harus melalui reverse proxy.",
    );
  }

  validateOptionalInteger(source, issues, "ASIHJAYA_APP_PORT", 1, 65_535);

  const environmentFile = optional(source, "ASIHJAYA_ENV_FILE");
  if (environmentFile?.endsWith(".example")) {
    pushIssue(
      issues,
      "ASIHJAYA_ENV_FILE",
      "tidak boleh menunjuk file contoh pada deployment production.",
    );
  }

  if (mode !== "production") {
    pushIssue(
      issues,
      "NODE_ENV",
      "deployment profile hanya boleh divalidasi dalam mode production.",
    );
  }
}

export function collectServerEnvironmentIssues(
  source: EnvironmentSource = process.env,
  options: ValidateEnvironmentOptions = {},
): EnvironmentValidationIssue[] {
  const mode = options.mode ?? resolveMode(source);
  const requireCore = options.requireCore ?? mode === "production";
  const requireDeployment = options.requireDeployment ?? false;
  const issues: EnvironmentValidationIssue[] = [];

  if (requireCore) {
    validateRequiredValues(source, issues);
  }

  validateApplicationUrls(source, issues, mode);
  validateDatabaseUrl(source, issues, mode);
  validateOrganizationSlug(source, issues);
  validateSecrets(source, issues, mode);
  validateProxyPolicy(source, issues, mode);
  validateStoragePolicy(source, issues);
  validateSecurityAndRuntimeOptions(source, issues, mode);
  if (requireDeployment) {
    validateProductionDeployment(source, issues, mode);
  }

  return issues;
}

export function assertServerEnvironment(
  source: EnvironmentSource = process.env,
  options: ValidateEnvironmentOptions = {},
): void {
  const issues = collectServerEnvironmentIssues(source, options);
  if (issues.length > 0) {
    throw new EnvironmentValidationError(issues);
  }
}

export function getBootstrapEnvironment(
  source: EnvironmentSource = process.env,
) {
  const organizationName = required(source, "BOOTSTRAP_ORGANIZATION_NAME");
  const organizationSlug = required(source, "BOOTSTRAP_ORGANIZATION_SLUG").toLowerCase();
  const outletCode = required(source, "BOOTSTRAP_OUTLET_CODE").toUpperCase();
  const outletName = required(source, "BOOTSTRAP_OUTLET_NAME");
  const registerCode = required(source, "BOOTSTRAP_REGISTER_CODE").toUpperCase();
  const registerName = required(source, "BOOTSTRAP_REGISTER_NAME");
  const adminName = required(source, "BOOTSTRAP_ADMIN_NAME");
  const adminUsername = required(source, "BOOTSTRAP_ADMIN_USERNAME").toLowerCase();
  const adminEmail = required(source, "BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const adminPassword = required(source, "BOOTSTRAP_ADMIN_PASSWORD");
  const issues: EnvironmentValidationIssue[] = [];

  if (!SLUG_PATTERN.test(organizationSlug)) {
    pushIssue(issues, "BOOTSTRAP_ORGANIZATION_SLUG", "harus berupa slug yang valid.");
  }
  if (!CODE_PATTERN.test(outletCode)) {
    pushIssue(issues, "BOOTSTRAP_OUTLET_CODE", "harus berupa kode outlet yang valid.");
  }
  if (!CODE_PATTERN.test(registerCode)) {
    pushIssue(issues, "BOOTSTRAP_REGISTER_CODE", "harus berupa kode register yang valid.");
  }
  if (!/^\S+@\S+\.\S+$/.test(adminEmail)) {
    pushIssue(issues, "BOOTSTRAP_ADMIN_EMAIL", "harus berupa alamat email yang valid.");
  }
  if (adminPassword.length < 12) {
    pushIssue(issues, "BOOTSTRAP_ADMIN_PASSWORD", "minimal harus terdiri dari 12 karakter.");
  }
  if (isPlaceholder(adminPassword)) {
    pushIssue(
      issues,
      "BOOTSTRAP_ADMIN_PASSWORD",
      "masih memakai placeholder dan wajib diganti sebelum seed.",
    );
  }

  if (issues.length > 0) {
    throw new EnvironmentValidationError(issues);
  }

  return {
    organizationName,
    organizationSlug,
    outletCode,
    outletName,
    registerCode,
    registerName,
    adminName,
    adminUsername,
    adminEmail,
    adminPassword,
  };
}

export const serverEnv = {
  get APP_URL() {
    return appUrl(process.env, "APP_URL");
  },

  get INTERNAL_RENDER_ORIGIN() {
    return internalRenderOrigin(process.env);
  },

  get DATABASE_URL() {
    return required(process.env, "DATABASE_URL");
  },

  get SESSION_SECRET() {
    return secret(process.env, "SESSION_SECRET");
  },

  get RECEIPT_VERIFICATION_SECRET() {
    return secret(process.env, "RECEIPT_VERIFICATION_SECRET");
  },

  get CUSTOMER_HISTORY_SESSION_SECRET() {
    return secret(process.env, "CUSTOMER_HISTORY_SESSION_SECRET");
  },

  get CUSTOMER_HISTORY_PIN_PEPPER() {
    return secret(process.env, "CUSTOMER_HISTORY_PIN_PEPPER");
  },

  get SECURITY_RATE_LIMIT_SECRET() {
    return secret(process.env, "SECURITY_RATE_LIMIT_SECRET");
  },

  get PDF_RENDER_TOKEN_SECRET() {
    return secret(process.env, "PDF_RENDER_TOKEN_SECRET");
  },

  get HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY() {
    return secret(process.env, "HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY");
  },

  get DEFAULT_ORGANIZATION_SLUG() {
    const value = required(process.env, "DEFAULT_ORGANIZATION_SLUG").toLowerCase();
    if (!SLUG_PATTERN.test(value)) {
      throw new EnvironmentValidationError([
        {
          name: "DEFAULT_ORGANIZATION_SLUG",
          message: "harus berupa slug lowercase yang valid.",
        },
      ]);
    }
    return value;
  },
};
