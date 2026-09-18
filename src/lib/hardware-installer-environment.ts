export type HardwareInstallerEnvironmentSource = Readonly<
  Record<string, string | undefined>
>;

export type HardwareInstallerEnvironmentIssue = {
  name: "HARDWARE_HUB_INSTALLER_DOWNLOAD_URL";
  message: string;
};

const INSTALLER_ENV_NAME = "HARDWARE_HUB_INSTALLER_DOWNLOAD_URL" as const;
const PLACEHOLDER_PATTERN =
  /(?:change[-_ ]?me|replace[-_ ]?me|generate[-_ ]?me|<[^>]+>)/i;

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}

export function collectHardwareInstallerEnvironmentIssues(
  source: HardwareInstallerEnvironmentSource,
  options: { required?: boolean } = {},
): HardwareInstallerEnvironmentIssue[] {
  const issues: HardwareInstallerEnvironmentIssue[] = [];
  const raw = source[INSTALLER_ENV_NAME]?.trim();

  if (!raw) {
    if (options.required) {
      issues.push({
        name: INSTALLER_ENV_NAME,
        message:
          "wajib diatur ke stable HTTPS release asset sebelum deployment production.",
      });
    }
    return issues;
  }

  if (PLACEHOLDER_PATTERN.test(raw)) {
    issues.push({
      name: INSTALLER_ENV_NAME,
      message: "masih memakai placeholder dan wajib diganti dengan release asset resmi.",
    });
    return issues;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    issues.push({
      name: INSTALLER_ENV_NAME,
      message: "harus berupa URL HTTPS yang valid.",
    });
    return issues;
  }

  if (url.protocol !== "https:") {
    issues.push({
      name: INSTALLER_ENV_NAME,
      message: "wajib menggunakan HTTPS.",
    });
  }
  if (isLoopbackHostname(url.hostname)) {
    issues.push({
      name: INSTALLER_ENV_NAME,
      message: "tidak boleh menunjuk localhost/loopback pada deployment production.",
    });
  }
  if (url.username || url.password) {
    issues.push({
      name: INSTALLER_ENV_NAME,
      message: "tidak boleh memuat credential di URL.",
    });
  }
  if (url.search || url.hash) {
    issues.push({
      name: INSTALLER_ENV_NAME,
      message:
        "harus berupa stable release URL tanpa query atau hash yang dapat bersifat sementara.",
    });
  }
  if (!url.pathname.endsWith("/ASIHJAYA-Hardware-Hub-Setup.exe")) {
    issues.push({
      name: INSTALLER_ENV_NAME,
      message:
        "wajib menunjuk asset ASIHJAYA-Hardware-Hub-Setup.exe secara langsung.",
    });
  }
  if (url.hostname.toLowerCase() === "github.com" && url.pathname.includes("/actions/")) {
    issues.push({
      name: INSTALLER_ENV_NAME,
      message:
        "GitHub Actions artifact bersifat sementara; gunakan GitHub Release asset untuk production.",
    });
  }

  return issues;
}

export function resolveHardwareInstallerDownloadUrl(
  source: HardwareInstallerEnvironmentSource,
): URL | null {
  if (collectHardwareInstallerEnvironmentIssues(source).length > 0) return null;
  const raw = source[INSTALLER_ENV_NAME]?.trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function assertHardwareInstallerEnvironment(
  source: HardwareInstallerEnvironmentSource,
  options: { required?: boolean } = {},
): void {
  const issues = collectHardwareInstallerEnvironmentIssues(source, options);
  if (issues.length === 0) return;

  throw new Error(
    `Konfigurasi Hardware Hub installer tidak valid:\n${issues
      .map((issue) => `- ${issue.name}: ${issue.message}`)
      .join("\n")}`,
  );
}
