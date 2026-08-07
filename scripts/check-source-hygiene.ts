import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function listTrackedFiles(): string[] {
  try {
    const output = execFileSync("git", ["ls-files", "-z"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output
      .split("\0")
      .map(normalizePath)
      .filter(Boolean)
      .sort();
  } catch {
    const ignoredDirectories = new Set([
      ".git",
      ".next",
      "node_modules",
      "out",
      "build",
      "dist",
    ]);
    const files: string[] = [];

    function walk(relativeDirectory: string): void {
      const absoluteDirectory = path.join(projectRoot, relativeDirectory);
      for (const entry of readdirSync(absoluteDirectory)) {
        if (ignoredDirectories.has(entry)) {
          continue;
        }
        const relativePath = normalizePath(path.join(relativeDirectory, entry));
        const absolutePath = path.join(projectRoot, relativePath);
        if (statSync(absolutePath).isDirectory()) {
          walk(relativePath);
        } else {
          files.push(relativePath);
        }
      }
    }

    walk("");
    return files.sort();
  }
}

const trackedFiles = listTrackedFiles();
assert(trackedFiles.length > 0, "Tidak ada source file yang dapat diperiksa.");

const forbiddenExactPaths = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.validation",
  "hardware-hub/.env",
  "hardware-hub/fake-plan.json",
  "hardware-hub/health-state.json",
]);

const forbiddenPathPatterns: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /(^|\/)node_modules\//, description: "node_modules" },
  { pattern: /(^|\/)\.next\//, description: ".next output" },
  { pattern: /(^|\/)playwright-report\//, description: "Playwright report" },
  { pattern: /(^|\/)test-results\//, description: "test result" },
  { pattern: /^hardware-hub\/(?:data|logs|dry-run-output|support-bundles)\//, description: "Hardware Hub runtime data" },
  { pattern: /^hardware-hub\/(?:outlet-fixtures|outlet-reports)\//, description: "Hardware Hub generated outlet artifact" },
  { pattern: /\.(?:pem|key|p12|pfx)$/i, description: "private credential file" },
  { pattern: /\.(?:sqlite|sqlite3|db|dump|backup|bak)$/i, description: "database/runtime backup" },
  { pattern: /(?:^|\/)npm-debug\.log/i, description: "npm debug log" },
  { pattern: /(?:^|\/)hardware_job_.*\.(?:pdf|bin|txt)$/i, description: "generated hardware job artifact" },
];

const forbiddenFiles: string[] = [];
for (const filePath of trackedFiles) {
  if (forbiddenExactPaths.has(filePath)) {
    forbiddenFiles.push(`${filePath} (environment/runtime file)`);
    continue;
  }
  for (const rule of forbiddenPathPatterns) {
    if (rule.pattern.test(filePath)) {
      forbiddenFiles.push(`${filePath} (${rule.description})`);
      break;
    }
  }
}

assert(
  forbiddenFiles.length === 0,
  `File terlarang terdeteksi dalam source tracking:\n- ${forbiddenFiles.join("\n- ")}`,
);

const secretPatterns: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, description: "private key material" },
  { pattern: /AKIA[0-9A-Z]{16}/, description: "AWS access key" },
  { pattern: /ghp_[A-Za-z0-9]{30,}/, description: "GitHub personal access token" },
  { pattern: /github_pat_[A-Za-z0-9_]{40,}/, description: "GitHub fine-grained token" },
  { pattern: /sk_live_[A-Za-z0-9]{20,}/, description: "live API secret" },
  {
    pattern: /\b\d{5,20}:[A-Za-z0-9_-]{35,}\b/,
    description: "Telegram bot token",
  },
];

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".env",
  ".example",
  ".gitignore",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const secretFindings: string[] = [];

for (const filePath of trackedFiles) {
  const extension = path.extname(filePath).toLowerCase();
  if (!textExtensions.has(extension) && !path.basename(filePath).startsWith(".")) {
    continue;
  }
  const absolutePath = path.join(projectRoot, filePath);
  if (!existsSync(absolutePath) || statSync(absolutePath).size > 2 * 1024 * 1024) {
    continue;
  }
  const content = readFileSync(absolutePath, "utf8");
  for (const rule of secretPatterns) {
    if (rule.pattern.test(content)) {
      secretFindings.push(`${filePath} (${rule.description})`);
    }
  }
}

assert(
  secretFindings.length === 0,
  `Pola secret terdeteksi dalam tracked source:\n- ${secretFindings.join("\n- ")}`,
);

console.log(`OK: source hygiene lulus untuk ${trackedFiles.length} tracked/source file.`);
